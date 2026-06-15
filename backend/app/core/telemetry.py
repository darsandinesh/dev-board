"""
OpenTelemetry setup (Day 5).

Goal: one request produces a trace with nested spans for the three places it
can be rejected/slowed — JWT validation, the OpenFGA check, and the DB query.

We use a console exporter so traces print to stdout (no Jaeger needed). FastAPI
and SQLAlchemy are auto-instrumented; JWT validation and OpenFGA checks get
manual spans in auth.py / authz.py via the `tracer` exported here.
"""

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

_initialized = False


def setup_telemetry(app, engine) -> None:
    """Install the tracer provider and auto-instrument FastAPI + SQLAlchemy.
    Safe to call once at startup."""
    global _initialized
    if _initialized:
        return

    from app.core.config import settings

    if not settings.enable_telemetry:
        return

    provider = TracerProvider(resource=Resource.create({"service.name": "devboard-backend"}))
    provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)

    # Auto-instrument the web layer and DB (DB query span).
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)

    _initialized = True


# Module-level tracer for manual spans (JWT validation, OpenFGA check).
tracer = trace.get_tracer("devboard")
