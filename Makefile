COMPOSE ?= docker compose
BACKEND_DIR := backend
CLIENT_DIR := client
API_URL ?= http://localhost:8000
SAMPLE ?= samples/product_1.json

.PHONY: up down logs health generate test test-client dev-api dev-web install-api

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

health:
	curl -sf $(API_URL)/api/health | python -m json.tool

generate:
	curl -sf -X POST $(API_URL)/api/generate \
		-H "Content-Type: application/json" \
		-d @$(SAMPLE) | python -m json.tool

test:
	$(COMPOSE) run --rm --no-deps backend python -m pytest -q

test-client:
	cd $(CLIENT_DIR) && npm test

install-api:
	cd $(BACKEND_DIR) && py -3 -m pip install -r requirements.txt

dev-api:
	cd $(BACKEND_DIR) && py -3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd $(CLIENT_DIR) && npx vite dev --host 127.0.0.1 --port 5173
