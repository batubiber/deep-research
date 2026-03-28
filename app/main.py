from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
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
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.vllm_model_name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )

# Serve React frontend in production
_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
