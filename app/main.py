from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Deep Research API starting on {settings.api_host}:{settings.api_port}")
    print(f"vLLM endpoint: {settings.vllm_base_url}")
    print(f"Model: {settings.vllm_model_name}")
    print(f"API auth: {'enabled' if settings.api_key else 'disabled'}")
    print(f"CORS origins: {settings.cors_origins}")
    yield
    # Shutdown
    print("Deep Research API shutting down")


app = FastAPI(
    title="Deep Research API",
    version="0.1.0",
    description="6-agent deep research pipeline powered by LangGraph and vLLM",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """If API_KEY is configured, require it on all /api/* routes."""
    if settings.api_key and request.url.path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if token != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return await call_next(request)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.vllm_model_name}


# Serve React frontend in production (must come after all API routes)
_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
