.PHONY: dev install build test docker-up docker-down

# Run backend + frontend dev servers concurrently (hot-reload)
dev:
	@trap 'kill 0' INT; \
	uvicorn app.main:app --reload --port 8000 & \
	cd frontend && npm run dev

# Install all dependencies
install:
	uv sync
	cd frontend && npm install

# Production build (frontend only — Docker handles the full build)
build:
	cd frontend && npm run build

# Run all tests
test:
	pytest tests/ -v
	cd frontend && npm test

# Docker: build image (frontend embedded) and start
docker-up:
	docker compose up --build

docker-down:
	docker compose down
