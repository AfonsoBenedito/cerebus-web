.PHONY: local-up local-down build run-tests lint

local-up:
	@echo "Starting dev server..."
	npm run dev

local-down:
	@echo "Stopping dev server..."
	@lsof -ti :5175 | xargs kill -9 2>/dev/null || true
	@echo "Dev server stopped."

build:
	npm run build

run-tests:
	@echo "[placeholder] No tests configured yet."

lint:
	npm run lint
