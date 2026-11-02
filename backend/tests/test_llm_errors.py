from app.llm_client import map_status_to_http, max_retries_for, should_retry


def test_no_retry_on_401():
    assert should_retry(401) is False
    assert max_retries_for(401) == 0


def test_retry_on_429():
    assert should_retry(429) is True
    assert max_retries_for(429) == 3


def test_retry_on_500():
    assert should_retry(500) is True
    assert max_retries_for(500) == 2


def test_map_401():
    code, msg = map_status_to_http(401)
    assert code == 401
    assert "конфигурации" in msg.lower()


def test_map_429():
    code, msg = map_status_to_http(429)
    assert code == 429
