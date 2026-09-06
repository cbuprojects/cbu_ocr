"""
Language and script detection for extracted document text.

Labels: 'uz_c' | 'uz_l' | 'ru' | 'en' | 'unknown'

WHY RULE-BASED
Uzbek is low-resource and the mainstream detectors do not handle it:
  - lingua and langdetect do not support Uzbek at all
  - fastText lid.176 has called Uzbek Cyrillic "Russian" and "Bashkir"
  - no statistical detector separates Uzbek Cyrillic from Uzbek Latin
The distinguishing evidence here is cheap and deterministic, so rules beat a
model — and need no model file, no download, and no network.

WHAT THIS DOES AND DOES NOT PROMISE
There is no certainty on arbitrary document text. Some inputs have no correct
answer: a table of figures, a list of names, a two-line scan, a bilingual
document. This module returns a confidence alongside the label and returns
'unknown' rather than inventing a verdict when the evidence is thin. Treat
confidence below ~0.35 as "do not rely on this".

HOW IT DECIDES
Two independent stages.

1. Script. Count Cyrillic vs Latin letters, after stripping URLs, markdown and
   digits so formatting cannot vote.

2. Language within that script, comparing rates rather than presence:

   Cyrillic — Uzbek Cyrillic uses four letters Russian does not (ў қ ғ ҳ);
   Russian uses four Uzbek does not (щ ы э ё). Both appear constantly in real
   prose. Function words are counted too, so a document that happens to avoid
   the distinguishing letters is still decided on evidence.

   Latin — Uzbek Latin markers (oʻ gʻ) and Uzbek function words are scored
   against English function words, both as per-word rates. Rates matter, not
   presence: English prose about Uzbekistan is full of Uzbek proper nouns
   ("TBC Sug'urta", "G'ijduvon"), so finding "g'" somewhere in a long document
   means nothing. Neither language wins by default.

MIXED DOCUMENTS
detect() also reports per-block results. A Russian letterhead over an Uzbek
body is normal at a central bank; `segments` and `mixed` expose that instead
of hiding it behind one label.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field, asdict
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Evidence
# ─────────────────────────────────────────────────────────────────────────────

# Letters in Uzbek Cyrillic, absent from Russian
_UZ_CYR_LETTERS = frozenset("ўқғҳЎҚҒҲ")

# Letters in Russian, absent from Uzbek Cyrillic
_RU_CYR_LETTERS = frozenset("щыэёЩЫЭЁ")

# Uzbek Latin markers. OCR renders the modifier letter as many different
# codepoints; all variants are folded onto U+02BB during normalisation, so
# only the canonical pair is listed here.
_UZ_LATIN_MARKERS = ("o\u02bb", "g\u02bb")

# Apostrophe variants OCR produces for that same character.
_APOSTROPHE_VARIANTS = "\u02bc\u2018\u2019\u0027\u0060\u00b4\u2032"

# Function words only. Proper nouns are deliberately excluded: place and
# company names appear in text of every language and cause exactly the false
# positives this module exists to avoid.
_UZ_LATIN_WORDS = frozenset({
    "va", "bilan", "uchun", "uning", "ular", "ularning", "ushbu", "hamda",
    "ham", "emas", "kerak", "boshqa", "yoki", "lekin", "ammo", "shu",
    "qilish", "qilingan", "tomonidan", "asosida", "haqida", "hisoblanadi",
    "mening", "menga", "sizning", "bunda", "quyidagi", "barcha", "hech",
    "faqat", "yana", "keyin", "oldin", "juda", "yildan", "yilda",
})

_UZ_CYR_WORDS = frozenset({
    "ва", "билан", "учун", "унинг", "улар", "уларнинг", "ушбу", "ҳамда",
    "ҳам", "эмас", "керак", "бошқа", "ёки", "лекин", "аммо", "шу",
    "қилиш", "қилинган", "томонидан", "асосида", "ҳақида", "бўйича",
    "мени", "менга", "сизнинг", "қуйидаги", "барча", "ҳеч", "фақат",
    "яна", "кейин", "олдин", "жуда", "йилда", "бўлган", "бўлиб",
})

_RU_WORDS = frozenset({
    "и", "в", "не", "на", "что", "с", "по", "для", "это", "как", "но",
    "из", "к", "от", "при", "был", "была", "были", "было", "года", "году",
    "также", "если", "или", "его", "её", "их", "все", "уже", "может",
    "должен", "быть", "этого", "который", "которые", "между", "после",
})

_EN_WORDS = frozenset({
    "the", "and", "of", "to", "in", "is", "that", "for", "with", "was",
    "as", "on", "are", "by", "this", "from", "has", "been", "were",
    "which", "their", "not", "but", "have", "its", "also", "these",
    "an", "at", "be", "or", "will", "would", "can", "more", "than",
    "when", "all", "other", "into", "about", "after", "over", "such",
})

# ─────────────────────────────────────────────────────────────────────────────
# Thresholds
# ─────────────────────────────────────────────────────────────────────────────

_MIN_LETTERS = 40        # below this, any verdict is a coin flip
_MIN_WORDS = 8           # rates are meaningless on fewer words
_SAMPLE_SIZE = 40_000    # scanning is microseconds per KB; read generously
_LOW_CONFIDENCE = 0.35   # below this, callers should treat the label as a guess
_SEGMENT_MIN_LETTERS = 60

_CYRILLIC = re.compile(r"[\u0400-\u04FF]")
_LATIN = re.compile(r"[A-Za-z]")
_CYR_WORD_RE = re.compile(r"[\u0400-\u04FF]+")
_LAT_WORD_RE = re.compile(r"[a-z\u02bb]+")

# Formatting that must not vote on the language.
_STRIP_PATTERNS = (
    re.compile(r"https?://\S+"),                  # URLs
    re.compile(r"\S+@\S+\.\S+"),                  # emails
    re.compile(r"```.*?```", re.S),               # fenced code
    re.compile(r"`[^`]*`"),                       # inline code
    re.compile(r"[|*#>_\[\]()~=+]+"),             # markdown punctuation
    re.compile(r"\d+"),                           # digits
)


@dataclass
class Detection:
    """Full detection result."""
    language: str                       # uz_c | uz_l | ru | en | unknown
    confidence: float                   # 0.0 – 1.0
    script: str                         # cyrillic | latin | none
    reliable: bool                      # confidence >= _LOW_CONFIDENCE
    mixed: bool                         # more than one language in the body
    reason: str                         # which rule decided it
    letters: int = 0
    words: int = 0
    scores: dict = field(default_factory=dict)
    segments: dict = field(default_factory=dict)   # language -> share of blocks

    def as_dict(self) -> dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
# Normalisation
# ─────────────────────────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """
    NFC-normalise, fold every apostrophe variant onto U+02BB, and remove
    formatting, URLs and digits so only prose votes.
    """
    out = unicodedata.normalize("NFC", text)
    for variant in _APOSTROPHE_VARIANTS:
        out = out.replace(variant, "\u02bb")
    for pattern in _STRIP_PATTERNS:
        out = pattern.sub(" ", out)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────────────────────────────────────────

def _confidence(winner: float, runner_up: float, evidence: int) -> float:
    """
    Combine the two things a caller cares about:
      margin   — how clearly the winner beat the runner-up
      evidence — how much text the verdict rests on
    A landslide over 12 words is not confident, and a narrow win over 4,000
    words is not confident either. Both must hold.
    """
    total = winner + runner_up
    margin = 1.0 if total == 0 else (winner - runner_up) / total
    volume = min(1.0, evidence / 120.0)
    return round(max(0.0, min(1.0, margin * volume)), 3)


def _score_cyrillic(text: str) -> tuple[str, float, dict]:
    lowered = text.lower()
    words = _CYR_WORD_RE.findall(lowered)
    total = max(len(words), 1)

    uz_letters = sum(1 for ch in text if ch in _UZ_CYR_LETTERS)
    ru_letters = sum(1 for ch in text if ch in _RU_CYR_LETTERS)
    uz_words = sum(1 for w in words if w in _UZ_CYR_WORDS)
    ru_words = sum(1 for w in words if w in _RU_WORDS)

    # Per-word normalised so a long document cannot win on bulk alone.
    uz_score = (uz_words + uz_letters) / total
    ru_score = (ru_words + ru_letters) / total

    scores = {
        "uz_letters": uz_letters, "ru_letters": ru_letters,
        "uz_words": uz_words, "ru_words": ru_words,
        "uz_score": round(uz_score, 4), "ru_score": round(ru_score, 4),
        "words": len(words),
    }

    if uz_score == 0.0 and ru_score == 0.0:
        return "unknown", 0.0, scores

    if uz_score > ru_score:
        return "uz_c", _confidence(uz_score, ru_score, len(words)), scores
    return "ru", _confidence(ru_score, uz_score, len(words)), scores


def _score_latin(text: str) -> tuple[str, float, dict]:
    lowered = text.lower()
    words = _LAT_WORD_RE.findall(lowered)
    total = max(len(words), 1)

    # Every occurrence, not presence. This is the whole point.
    markers = sum(lowered.count(m) for m in _UZ_LATIN_MARKERS)
    uz_words = sum(1 for w in words if w in _UZ_LATIN_WORDS)
    en_words = sum(1 for w in words if w in _EN_WORDS)

    # Markers are strong per occurrence but sparse even in genuine Uzbek, so
    # they count double against the function-word rates.
    uz_score = (uz_words + 2 * markers) / total
    en_score = en_words / total

    scores = {
        "uz_markers": markers, "uz_words": uz_words, "en_words": en_words,
        "uz_score": round(uz_score, 4), "en_score": round(en_score, 4),
        "words": len(words),
    }

    if uz_score == 0.0 and en_score == 0.0:
        return "unknown", 0.0, scores

    if uz_score > en_score:
        return "uz_l", _confidence(uz_score, en_score, len(words)), scores
    return "en", _confidence(en_score, uz_score, len(words)), scores


def _detect_block(text: str) -> tuple[str, float, str, dict]:
    """Detect one block. Returns (language, confidence, script, scores)."""
    cyrillic = len(_CYRILLIC.findall(text))
    latin = len(_LATIN.findall(text))

    if cyrillic + latin < _MIN_LETTERS:
        return "unknown", 0.0, "none", {"cyrillic": cyrillic, "latin": latin, "words": 0}

    if cyrillic > latin:
        lang, conf, scores = _score_cyrillic(text)
        script = "cyrillic"
    else:
        lang, conf, scores = _score_latin(text)
        script = "latin"

    scores["cyrillic"] = cyrillic
    scores["latin"] = latin
    return lang, conf, script, scores


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def detect(text: Optional[str]) -> Detection:
    """
    Detect language and script, with confidence and a per-block breakdown.

    Check `reliable` before acting on `language`. When `mixed` is true the
    document holds more than one language and `segments` shows the split.
    """
    if not text or not text.strip():
        return Detection("unknown", 0.0, "none", False, False, "empty input")

    sample = _normalise(text[:_SAMPLE_SIZE])

    cyrillic = len(_CYRILLIC.findall(sample))
    latin = len(_LATIN.findall(sample))
    letters = cyrillic + latin

    if letters < _MIN_LETTERS:
        return Detection(
            "unknown", 0.0, "none", False, False,
            f"only {letters} letters, need {_MIN_LETTERS}",
            letters=letters, scores={"cyrillic": cyrillic, "latin": latin},
        )

    language, confidence, script, scores = _detect_block(sample)
    words = scores.get("words", 0)

    if words < _MIN_WORDS:
        return Detection(
            "unknown", 0.0, script, False, False,
            f"only {words} words, need {_MIN_WORDS}",
            letters=letters, words=words, scores=scores,
        )

    # ── Per-block pass, so bilingual documents are visible ──
    blocks = [b for b in re.split(r"\n\s*\n", sample) if b.strip()]
    tally: dict[str, int] = {}
    for block in blocks:
        if len(_CYRILLIC.findall(block)) + len(_LATIN.findall(block)) < _SEGMENT_MIN_LETTERS:
            continue
        b_lang, b_conf, _, _ = _detect_block(block)
        if b_lang != "unknown" and b_conf >= _LOW_CONFIDENCE:
            tally[b_lang] = tally.get(b_lang, 0) + 1

    total_blocks = sum(tally.values())
    segments = (
        {k: round(v / total_blocks, 3)
         for k, v in sorted(tally.items(), key=lambda kv: -kv[1])}
        if total_blocks else {}
    )

    # "Mixed" means a genuine second language, not one stray paragraph.
    mixed = len(segments) > 1 and sorted(segments.values(), reverse=True)[1] >= 0.20

    if language == "unknown":
        reason = "no function words or marker letters for either candidate"
    elif mixed:
        reason = f"dominant language of a mixed document ({', '.join(segments)})"
    elif confidence < _LOW_CONFIDENCE:
        reason = "decided, but margin or text volume is low"
    else:
        reason = f"{script} script, {language} scored higher on its own vocabulary"

    return Detection(
        language=language,
        confidence=confidence,
        script=script,
        reliable=confidence >= _LOW_CONFIDENCE,
        mixed=mixed,
        reason=reason,
        letters=letters,
        words=words,
        scores=scores,
        segments=segments,
    )


def detect_language(text: Optional[str]) -> str:
    """
    Backwards-compatible entry point: returns the label only.

    Returns 'unknown' when the detection is not reliable, so a low-confidence
    guess never reaches the database as though it were a fact. Call detect()
    when you want the label regardless of confidence.
    """
    result = detect(text)
    return result.language if result.reliable else "unknown"