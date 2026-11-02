from pydantic import BaseModel, Field, field_validator


NO_DATA = "данных нет"
PROMPT_VERSION = "v1.0"

SEO_TITLE_MAX = 70
SEO_DESC_MIN = 800
SEO_DESC_MAX = 1200
SEARCH_QUERIES_MIN = 3
SEARCH_QUERIES_MAX = 5


class ProductInput(BaseModel):
    name: str
    manufacturer: str
    specs: dict[str, str] = Field(default_factory=dict)
    description: str = ""

    @field_validator("name", "manufacturer")
    @classmethod
    def non_empty_stripped(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Поле не может быть пустым")
        return s

    @field_validator("specs", mode="before")
    @classmethod
    def filter_empty_specs(cls, v: object) -> dict[str, str]:
        if v is None:
            return {}
        if not isinstance(v, dict):
            return v  # type: ignore[return-value]
        out: dict[str, str] = {}
        for k, val in v.items():
            key = str(k).strip()
            if not key:
                continue
            sval = str(val).strip() if val is not None else ""
            if not sval:
                continue
            out[key] = sval
        return out


class Characteristic(BaseModel):
    name: str
    value: str


class LLMTextOutput(BaseModel):
    seo_title: str
    seo_description: str
    search_queries: list[str]
    commercial_block: str


class ProductCardOutput(BaseModel):
    seo_title: str
    seo_description: str
    characteristics: list[Characteristic]
    search_queries: list[str]
    commercial_block: str
    missing_fields: list[str]
    warnings: list[str]
    prompt_version: str
