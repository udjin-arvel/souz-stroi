from __future__ import annotations

from app.llm_client import DeepSeekClient, LLMServiceError
from app.schemas import (
    NO_DATA,
    PROMPT_VERSION,
    SEO_DESC_MAX,
    SEO_DESC_MIN,
    SEO_TITLE_MAX,
    SEARCH_QUERIES_MAX,
    SEARCH_QUERIES_MIN,
    Characteristic,
    LLMTextOutput,
    ProductCardOutput,
    ProductInput,
)

EXPECTED_FIELDS = [
    "диапазон измерений",
    "класс точности",
    "присоединение",
    "диаметр корпуса",
    "питание",
    "интерфейсы",
]


def build_characteristics(specs: dict[str, str]) -> tuple[list[Characteristic], list[str]]:
    """Deterministic characteristics from specs + expected fields marked NO_DATA."""
    lower_to_key = {k.lower(): k for k in specs}
    characteristics: list[Characteristic] = [
        Characteristic(name=k, value=v) for k, v in specs.items()
    ]
    missing: list[str] = []
    present_lower = set(lower_to_key.keys())
    for field in EXPECTED_FIELDS:
        if field.lower() not in present_lower:
            missing.append(field)
            characteristics.append(Characteristic(name=field, value=NO_DATA))
    return characteristics, missing


def _truncate_seo_title(title: str, warnings: list[str]) -> str:
    if len(title) <= SEO_TITLE_MAX:
        return title
    warnings.append("SEO-заголовок обрезан до 70 символов")
    return title[:SEO_TITLE_MAX].rstrip()


def _validate_seo_description(desc: str, warnings: list[str]) -> bool:
    n = len(desc)
    if SEO_DESC_MIN <= n <= SEO_DESC_MAX:
        return True
    warnings.append(
        f"SEO-описание {n} символов — вне диапазона {SEO_DESC_MIN}–{SEO_DESC_MAX}"
    )
    return False


def _normalize_search_queries(
    queries: list[str],
    product: ProductInput,
    warnings: list[str],
) -> list[str]:
    cleaned = [q.strip() for q in queries if q and q.strip()]
    if len(cleaned) > SEARCH_QUERIES_MAX:
        warnings.append(f"Поисковые запросы обрезаны до {SEARCH_QUERIES_MAX}")
        cleaned = cleaned[:SEARCH_QUERIES_MAX]

    if len(cleaned) >= SEARCH_QUERIES_MIN:
        return cleaned

    name_l = product.name.lower()
    man_l = product.manufacturer.lower()
    kind = (product.name.split()[0] if product.name.split() else product.name).lower()
    fallbacks = [
        f"{name_l} купить",
        f"{name_l} {man_l}",
        f"{kind} {man_l} цена",
        f"{man_l} {kind}",
    ]
    spec_items = list(product.specs.items())
    if spec_items:
        _k, v = spec_items[0]
        fallbacks.insert(2, f"{kind} {v}")

    seen = set(cleaned)
    for fb in fallbacks:
        if len(cleaned) >= SEARCH_QUERIES_MIN:
            break
        if fb not in seen:
            cleaned.append(fb)
            seen.add(fb)

    while len(cleaned) < SEARCH_QUERIES_MIN:
        cleaned.append(f"{name_l} заказать")

    return cleaned[:SEARCH_QUERIES_MAX]


def apply_post_validation(
    llm: LLMTextOutput,
    product: ProductInput,
    warnings: list[str],
) -> LLMTextOutput:
    title = _truncate_seo_title(llm.seo_title.strip(), warnings)
    desc = llm.seo_description.strip()
    queries = _normalize_search_queries(llm.search_queries, product, warnings)
    commercial = llm.commercial_block.strip()
    return LLMTextOutput(
        seo_title=title,
        seo_description=desc,
        search_queries=queries,
        commercial_block=commercial,
    )


def generate_product_card(
    product: ProductInput,
    request_id: str,
    llm_client: DeepSeekClient | None = None,
) -> ProductCardOutput:
    client = llm_client or DeepSeekClient()
    characteristics, missing_fields = build_characteristics(product.specs)
    warnings: list[str] = []

    result = client.complete_json(product, missing_fields, request_id)
    llm_out = apply_post_validation(result.output, product, warnings)

    if not _validate_seo_description(llm_out.seo_description, warnings):
        hint = (
            f"Предыдущее SEO-описание было {len(llm_out.seo_description)} символов. "
            f"Перепиши seo_description строго от {SEO_DESC_MIN} до {SEO_DESC_MAX} символов."
        )
        retry = client.complete_json(product, missing_fields, request_id, length_hint=hint)
        llm_out = apply_post_validation(retry.output, product, warnings)
        _validate_seo_description(llm_out.seo_description, warnings)

    return ProductCardOutput(
        seo_title=llm_out.seo_title,
        seo_description=llm_out.seo_description,
        characteristics=characteristics,
        search_queries=llm_out.search_queries,
        commercial_block=llm_out.commercial_block,
        missing_fields=missing_fields,
        warnings=warnings,
        prompt_version=PROMPT_VERSION,
    )
