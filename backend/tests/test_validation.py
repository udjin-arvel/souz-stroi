import pytest
from pydantic import ValidationError

from app.schemas import ProductInput


def test_name_required():
    with pytest.raises(ValidationError) as exc:
        ProductInput(name="", manufacturer="X")
    assert "name" in str(exc.value).lower() or any(
        e["loc"] == ("name",) for e in exc.value.errors()
    )


def test_manufacturer_required():
    with pytest.raises(ValidationError):
        ProductInput(name="Прибор", manufacturer="   ")


def test_empty_specs_values_dropped():
    p = ProductInput(
        name="Т",
        manufacturer="M",
        specs={"питание": "", "диапазон": "0-1", "  ": "x"},
    )
    assert p.specs == {"диапазон": "0-1"}


def test_specs_trim_values():
    p = ProductInput(name="T", manufacturer="M", specs={" ключ ": " знач "})
    assert p.specs == {"ключ": "знач"}
