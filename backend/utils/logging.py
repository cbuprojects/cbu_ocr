import logging
import logging.handlers
from pathlib import Path

LOG_DIR = Path("logs")
FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
RETENTION_DAYS = 365


def _file_handler(filename: str) -> logging.Handler:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = logging.handlers.TimedRotatingFileHandler(
        LOG_DIR / filename,
        when="midnight",
        backupCount=RETENTION_DAYS,
        encoding="utf-8",
        utc=False,
    )
    handler.suffix = "%Y-%m-%d"
    handler.setFormatter(logging.Formatter(FORMAT, datefmt=DATE_FORMAT))
    return handler


def setup_logging(level=logging.INFO):
    """Console + logs/app.log for everything."""
    root = logging.getLogger()
    root.setLevel(level)
    if root.handlers:
        return

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(FORMAT, datefmt=DATE_FORMAT))
    root.addHandler(console)
    root.addHandler(_file_handler("app.log"))


def get_logger(name: str, filename: str = None) -> logging.Logger:
    """
    get_logger("cbu_api")                            -> app.log only
    get_logger("cbu_api.external", "external.log")   -> external.log + app.log
    """
    log = logging.getLogger(name)
    if filename and not log.handlers:
        log.addHandler(_file_handler(filename))
    return log