from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openai import APIConnectionError, APITimeoutError, APIStatusError, OpenAI

from app.config import Settings, get_settings
from app.schemas import LLMTextOutput, ProductInput

logger = logging.getLogger("llm")

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
SYSTEM_PROMPT_PATH = PROMPTS_DIR / "system_v1.md"
USER_TEMPLATE_PATH = PROMPTS_DIR / "user_template_v1.md"

# Maps to user-facing messages per spec
MSG_CONFIG = "Ошибка конфигурации LLM"
MSG_UNAVAILABLE = "Сервис LLM временно недоступен"
MSG_RATE_LIMIT = "Слишком много запросов, попробуйте позже"
MSG_TIMEOUT = "Превышено время ожидания ответа LLM"


class LLMServiceError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


@dataclass
class LLMCallResult:
    output: LLMTextOutput
    prompt_tokens: int
    completion_tokens: int


def should_retry(status_code: int | None) -> bool:
    if status_code is None:
        return True  # connection/timeout
    if status_code in (400, 401, 402, 422):
        return False
    if status_code == 429:
        return True
    if status_code in (500, 503):
        return True
    return False


def max_retries_for(status_code: int | None) -> int:
    if status_code == 429:
        return 3
    if status_code in (500, 503) or status_code is None:
        return 2
    return 0


def map_status_to_http(status_code: int | None) -> tuple[int, str]:
    if status_code == 401:
        return 401, MSG_CONFIG
    if status_code == 402:
        return 402, MSG_UNAVAILABLE
    if status_code == 429:
        return 429, MSG_RATE_LIMIT
    return 503, MSG_UNAVAILABLE


def _load_prompt(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def build_user_prompt(product: ProductInput, missing_fields: list[str]) -> str:
    template = _load_prompt(USER_TEMPLATE_PATH)
    specs = product.specs
    if specs:
        specs_block = "\n".join(f"- {k}: {v}" for k, v in specs.items())
    else:
        specs_block = "(параметры не переданы)"
    missing_list = ", ".join(missing_fields) if missing_fields else "(нет — все ожидаемые поля либо переданы, либо не требуются)"
    desc = product.description.strip() or "(не указано)"
    return (
        template.replace("{{name}}", product.name)
        .replace("{{manufacturer}}", product.manufacturer)
        .replace("{{specs_block}}", specs_block)
        .replace("{{description}}", desc)
        .replace("{{missing_list}}", missing_list)
    )


def _log_event(
    request_id: str,
    status_code: int | None,
    retry_count: int,
    latency_ms: float,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    **extra: Any,
) -> None:
    payload = {
        "request_id": request_id,
        "status_code": status_code,
        "retry_count": retry_count,
        "latency_ms": round(latency_ms, 2),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        **extra,
    }
    logger.info(json.dumps(payload, ensure_ascii=False))


def _parse_llm_json(content: str | None) -> LLMTextOutput:
    if not content or not content.strip():
        raise ValueError("empty content")
    data = json.loads(content)
    return LLMTextOutput.model_validate(data)


def _sleep_backoff(attempt: int, status_code: int | None) -> None:
    base = 0.5 * (2**attempt)
    jitter = random.uniform(0, 0.3)
    time.sleep(base + jitter)


class DeepSeekClient:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._client: OpenAI | None = None

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            if not self.settings.deepseek_api_key:
                raise LLMServiceError(401, MSG_CONFIG)
            self._client = OpenAI(
                api_key=self.settings.deepseek_api_key,
                base_url=self.settings.deepseek_base_url,
                timeout=self.settings.llm_timeout_seconds,
            )
        return self._client

    def complete_json(
        self,
        product: ProductInput,
        missing_fields: list[str],
        request_id: str,
        *,
        length_hint: str | None = None,
    ) -> LLMCallResult:
        deadline = time.monotonic() + self.settings.request_timeout_seconds
        system = _load_prompt(SYSTEM_PROMPT_PATH)
        user = build_user_prompt(product, missing_fields)
        if length_hint:
            user = f"{user}\n\n{length_hint}"

        parse_retries = 0
        max_parse_retries = 1
        last_status: int | None = None
        total_retry_count = 0

        while True:
            if time.monotonic() > deadline:
                raise LLMServiceError(504, MSG_TIMEOUT)

            attempt = 0
            while True:
                if time.monotonic() > deadline:
                    raise LLMServiceError(504, MSG_TIMEOUT)

                t0 = time.monotonic()
                try:
                    response = self.client.chat.completions.create(
                        model=self.settings.deepseek_model,
                        messages=[
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=3000,
                    )
                    latency = (time.monotonic() - t0) * 1000
                    usage = response.usage
                    pt = usage.prompt_tokens if usage else 0
                    ct = usage.completion_tokens if usage else 0
                    content = response.choices[0].message.content if response.choices else None
                    try:
                        output = _parse_llm_json(content)
                    except (json.JSONDecodeError, ValueError) as e:
                        _log_event(
                            request_id,
                            200,
                            total_retry_count,
                            latency,
                            pt,
                            ct,
                            parse_error=str(e),
                        )
                        if parse_retries < max_parse_retries:
                            parse_retries += 1
                            total_retry_count += 1
                            break  # retry whole call
                        raise LLMServiceError(503, MSG_UNAVAILABLE) from e

                    _log_event(request_id, 200, total_retry_count, latency, pt, ct)
                    return LLMCallResult(output=output, prompt_tokens=pt, completion_tokens=ct)

                except LLMServiceError:
                    raise
                except APITimeoutError as e:
                    latency = (time.monotonic() - t0) * 1000
                    last_status = None
                    _log_event(request_id, None, total_retry_count, latency, error="timeout")
                    if attempt < max_retries_for(None) - 1:
                        attempt += 1
                        total_retry_count += 1
                        _sleep_backoff(attempt, None)
                        continue
                    raise LLMServiceError(504, MSG_TIMEOUT) from e
                except APIConnectionError as e:
                    latency = (time.monotonic() - t0) * 1000
                    _log_event(request_id, None, total_retry_count, latency, error="connection")
                    if attempt < max_retries_for(None) - 1:
                        attempt += 1
                        total_retry_count += 1
                        _sleep_backoff(attempt, None)
                        continue
                    raise LLMServiceError(503, MSG_UNAVAILABLE) from e
                except APIStatusError as e:
                    latency = (time.monotonic() - t0) * 1000
                    last_status = e.status_code
                    _log_event(request_id, last_status, total_retry_count, latency, error=str(e.message))
                    if should_retry(last_status) and attempt < max_retries_for(last_status) - 1:
                        attempt += 1
                        total_retry_count += 1
                        _sleep_backoff(attempt, last_status)
                        continue
                    http_code, detail = map_status_to_http(last_status)
                    raise LLMServiceError(http_code, detail) from e

            # parse retry loop
            if parse_retries <= max_parse_retries:
                continue
            raise LLMServiceError(503, MSG_UNAVAILABLE)
