from paddleocr import PaddleOCRVL


def initialize_paddle_ocr():
    pipeline = PaddleOCRVL(
        pipeline_version="v1.6",
        device="gpu",
    )

    return pipeline

