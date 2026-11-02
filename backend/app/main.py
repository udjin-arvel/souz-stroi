from __future__ import annotations

import uuid
from contextvars import ContextVar

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.generator import generate_product_card
from app.llm_client import LLMServiceError
from app.schemas import ProductCardOutput, ProductInput

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="AI Product Card Generator", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_ctx.set(rid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/generate", response_model=ProductCardOutput)
    def api_generate(body: ProductInput) -> ProductCardOutput:
        rid = request_id_ctx.get() or str(uuid.uuid4())
        try:
            return generate_product_card(body, rid)
        except LLMServiceError as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail) from e

    return app


app = create_app()
