from app.generator import _normalize_search_queries, _truncate_seo_title, apply_post_validation
from app.schemas import LLMTextOutput, ProductInput


def test_truncate_seo_title():
    warnings: list[str] = []
    long = "A" * 80
    out = _truncate_seo_title(long, warnings)
    assert len(out) == 70
    assert warnings


def test_search_queries_padded_to_three():
    warnings: list[str] = []
    product = ProductInput(name="Манометр DM", manufacturer="Манотомь", specs={"диапазон": "1"})
    llm = LLMTextOutput(
        seo_title="t",
        seo_description="d" * 900,
        search_queries=["один"],
        commercial_block="c",
    )
    out = apply_post_validation(llm, product, warnings)
    assert len(out.search_queries) >= 3


def test_search_queries_trimmed_to_five():
    warnings: list[str] = []
    product = ProductInput(name="T", manufacturer="M")
    llm = LLMTextOutput(
        seo_title="t",
        seo_description="d" * 900,
        search_queries=[f"q{i}" for i in range(7)],
        commercial_block="c",
    )
    out = apply_post_validation(llm, product, warnings)
    assert len(out.search_queries) == 5
    assert any("обрезаны" in w for w in warnings)
