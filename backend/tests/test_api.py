def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_generate_missing_name_422(client):
    r = client.post(
        "/api/generate",
        json={"name": "", "manufacturer": "M"},
    )
    assert r.status_code == 422


def test_generate_success_mock(client, patch_llm):
    patch_llm()
    payload = {
        "name": "Манометр DM 02",
        "manufacturer": "Манотомь",
        "specs": {"диапазон измерений": "0–1,6 МПа"},
        "description": "desc",
    }
    r = client.post("/api/generate", json=payload)
    assert r.status_code == 200
    data = r.json()
    for key in (
        "seo_title",
        "seo_description",
        "characteristics",
        "search_queries",
        "commercial_block",
        "missing_fields",
        "warnings",
        "prompt_version",
    ):
        assert key in data
    assert data["prompt_version"] == "v1.0"
    spec_values = {
        c["name"]: c["value"]
        for c in data["characteristics"]
        if c["value"] != "данных нет"
    }
    assert spec_values["диапазон измерений"] == "0–1,6 МПа"


def test_generate_invalid_json_422(client):
    r = client.post("/api/generate", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422
