import pytest
from fastapi.testclient import TestClient

from app.llm_client import DeepSeekClient, LLMCallResult
from app.main import app
from app.schemas import LLMTextOutput


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_llm_json():
    def _factory(**overrides):
        base = {
            "seo_title": "Манометр DM 02 Манотомь — купить для промышленности",
            "seo_description": "x" * 850,
            "search_queries": ["манометр купить", "манометр манотомь", "dm 02 цена"],
            "commercial_block": "Для служб КИПиА.\nУточнить присоединение.",
        }
        base.update(overrides)
        return LLMTextOutput.model_validate(base)

    return _factory


@pytest.fixture
def patch_llm(monkeypatch, mock_llm_json):
    def apply(output: LLMTextOutput | None = None):
        out = output or mock_llm_json()

        class FakeClient(DeepSeekClient):
            def complete_json(self, product, missing_fields, request_id, *, length_hint=None):
                return LLMCallResult(output=out, prompt_tokens=100, completion_tokens=200)

        monkeypatch.setattr("app.generator.DeepSeekClient", FakeClient)

    return apply
