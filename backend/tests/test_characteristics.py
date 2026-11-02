from app.generator import build_characteristics
from app.schemas import NO_DATA, ProductInput


def test_all_spec_values_present():
    specs = {
        "диапазон измерений": "0–1,6 МПа",
        "класс точности": "1,5",
        "extra": "да",
    }
    chars, missing = build_characteristics(specs)
    values_from_specs = {c.name: c.value for c in chars if c.value != NO_DATA}
    assert values_from_specs == specs
    assert "extra" in values_from_specs


def test_missing_expected_fields_marked_no_data():
    specs = {"диапазон измерений": "0–2,5 МПа"}
    chars, missing = build_characteristics(specs)
    no_data_names = [c.name for c in chars if c.value == NO_DATA]
    assert "питание" in missing
    assert "интерфейсы" in missing
    assert all(m in no_data_names for m in missing)


def test_case_insensitive_expected_match():
    specs = {"Диапазон Измерений": "1 МПа", "Питание": "24V"}
    _chars, missing = build_characteristics(specs)
    assert "диапазон измерений" not in missing
    assert "питание" not in missing


def test_input_filters_empty_before_characteristics():
    p = ProductInput(
        name="X",
        manufacturer="Y",
        specs={"питание": "", "диапазон измерений": "1"},
    )
    assert "питание" not in p.specs
    _chars, missing = build_characteristics(p.specs)
    assert "питание" in missing
