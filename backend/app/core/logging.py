"""
structlog setup (Day 5).

Console renderer in debug, JSON in prod. `merge_contextvars` pulls in any
context bound for the request (e.g. correlation_id), so every log line emitted
during a request carries the same request id.
"""

import structlog

from app.core.config import settings


def setup_logging() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if settings.debug
            else structlog.processors.JSONRenderer(),
        ]
    )


def get_logger(*args, **kwargs):
    return structlog.get_logger(*args, **kwargs)
