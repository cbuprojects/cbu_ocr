"""
Language detection for extracted document text.

Returns one of: 'uz_c', 'uz_l', 'ru', 'en', 'unknown'

Rule-based by design. Uzbek is a low-resource language and the mainstream
detectors do not handle it:
  - lingua and langdetect do not support Uzbek at all
  - fastText lid.176 classified "Ўзбекистон Республикаси Марказий банки"
    as Russian (0.36) and another Uzbek sample as Bashkir (0.23)
  - no statistical detector distinguishes Uzbek Cyrillic from Uzbek Latin

The Cyrillic split is deterministic: Uzbek Cyrillic uses four letters
Russian does not (ў қ ғ ҳ) and Russian uses four Uzbek Cyrillic does not
(щ ы э ё). Both appear constantly in real prose, so counting them and
comparing is more reliable here than any probabilistic model — and it
needs no model file, no download, and no network.
"""

from __future__ import annotations

# Letters present in Uzbek Cyrillic, absent from Russian
_UZ_CYRILLIC = frozenset("ўқғҳЎҚҒҲ")

# Letters present in Russian, absent from Uzbek Cyrillic
_RU_CYRILLIC = frozenset("щыэёЩЫЭЁ")

# Uzbek Latin markers (oʻ / gʻ). OCR renders the modifier letter as several
# different codepoints, so every common variant is listed.
_UZ_LATIN_MARKERS = (
    "oʻ", "gʻ",    # U+02BB modifier letter turned comma (correct form)
    "oʼ", "gʼ",    # U+02BC modifier letter apostrophe
    "o‘", "g‘",    # U+2018 left single quotation mark
    "o’", "g’",    # U+2019 right single quotation mark
    "o'", "g'",    # U+0027 ASCII apostrophe
    "o`", "g`",    # U+0060 grave accent
)

# Uzbek Latin function words — fallback when OCR dropped the apostrophes.
# Deliberately words with no English homographs.
_UZ_LATIN_WORDS = frozenset({
    "bilan", "uchun", "lekin", "ammo", "yoki", "boshqa", "kerak",
    "qilish", "hujjat", "qonun", "murojaat", "tomonidan", "asosida",
    "haqida", "yashovchi", "fuqaro", "masala", "javob", "muddat",
    "hisobimdan", "bankining", "xodimlari", "menga", "mening",
})

_CYRILLIC_START = "\u0400"
_CYRILLIC_END = "\u04FF"

# Below this many letters, any verdict is a coin flip.
_MIN_LETTERS = 40

# Scanning is ~microseconds per KB, so read generously. A Russian letterhead
# above an Uzbek body is common; a large window lets the body outweigh it.
_SAMPLE_SIZE = 20_000


def _counts(sample: str) -> tuple[int, int, int, int]:
    """Return (cyrillic, latin, uz_cyrillic_hits, ru_cyrillic_hits)."""
    cyrillic = latin = uz_hits = ru_hits = 0
    for ch in sample:
        if _CYRILLIC_START <= ch <= _CYRILLIC_END:
            cyrillic += 1
            if ch in _UZ_CYRILLIC:
                uz_hits += 1
            elif ch in _RU_CYRILLIC:
                ru_hits += 1
        elif ch.isascii() and ch.isalpha():
            latin += 1
    return cyrillic, latin, uz_hits, ru_hits


def detect_language(text: str | None) -> str:
    """
    Detect the language and script of extracted document text.

    Args:
        text: extracted text; markdown formatting is harmless

    Returns:
        'uz_c'    Uzbek, Cyrillic script
        'uz_l'    Uzbek, Latin script
        'ru'      Russian
        'en'      English
        'unknown' too short, empty, or no recognisable script
    """
    if not text or not text.strip():
        return "unknown"

    sample = text[:_SAMPLE_SIZE]
    cyrillic, latin, uz_hits, ru_hits = _counts(sample)

    if cyrillic + latin < _MIN_LETTERS:
        return "unknown"

    # ---- Cyrillic script ----
    if cyrillic > latin:
        if uz_hits > ru_hits:
            return "uz_c"
        if ru_hits > uz_hits:
            return "ru"
        # No distinguishing letters at all. Uzbek Cyrillic prose essentially
        # always contains ў/қ/ғ/ҳ, so their absence points to Russian.
        return "ru"

    # ---- Latin script ----
    lowered = sample.lower()

    if any(marker in lowered for marker in _UZ_LATIN_MARKERS):
        return "uz_l"

    words = {w for w in "".join(
        ch if ch.isalnum() else " " for ch in lowered
    ).split() if len(w) > 2}

    if len(words & _UZ_LATIN_WORDS) >= 2:
        return "uz_l"

    return "en"


def detect_language_verbose(text: str | None) -> dict:
    """
    Same result, plus the underlying signals. Use this when a real document
    is misclassified — the counts show which rule made the call.
    """
    sample = (text or "")[:_SAMPLE_SIZE]
    cyrillic, latin, uz_hits, ru_hits = _counts(sample)
    lowered = sample.lower()

    return {
        "language": detect_language(text),
        "sample_chars": len(sample),
        "cyrillic": cyrillic,
        "latin": latin,
        "uz_cyrillic_hits": uz_hits,
        "ru_cyrillic_hits": ru_hits,
        "uz_latin_markers": [m for m in _UZ_LATIN_MARKERS if m in lowered],
    }