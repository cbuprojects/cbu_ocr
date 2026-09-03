from paddleocr import PaddleOCRVL
import pypdfium2 as pdfium
from docling.document_converter import DocumentConverter
from pathlib import Path


def initialize_paddle_ocr():
    pipeline = PaddleOCRVL(
        pipeline_version="v1.6",
        device="gpu",
    )

    return pipeline


def initialize_docling():
    converter = DocumentConverter()
    return converter


def pdf_is_selectable(path: str, min_chars: int = 50) -> bool:
    """
    True  -> every page has selectable/embedded text (route to docling)
    False -> at least one page is a scanned image (route to PaddleOCR-VL)
    """
    pdf = pdfium.PdfDocument(path)
    if len(pdf) == 0:
        return False
    for page in pdf:
        if len(page.get_textpage().get_text_range().strip()) < min_chars:
            return False
    return True


def extract_docx_text(converter, path: str) -> str:
    """Extract text from a .docx as structured markdown."""
    result = converter.convert(path)
    return result.document.export_to_markdown()


def extract_single_page(pipeline, path: str) -> str:
    pages = list(pipeline.predict(path))
    if not pages:
        raise ValueError(f"No pages returned for {Path(path).name}")

    text = pages[0].markdown["markdown_texts"].strip()
    if not text:
        raise ValueError(f"No text extracted from {Path(path).name}")
    return text


def extract_multi_page(pipeline, path: str) -> str:
    pages = list(pipeline.predict(path))
    if not pages:
        raise ValueError(f"No pages returned for {Path(path).name}")

    pages = pipeline.restructure_pages(pages, merge_tables=True)
    text = "\n\n".join(p.markdown["markdown_texts"] for p in pages).strip()

    if not text:
        raise ValueError(f"No text extracted from {Path(path).name}")
    return text
