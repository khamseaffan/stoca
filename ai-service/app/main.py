import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import enrichment, search, tools

app = FastAPI(title="Stoca AI Tool Service", version="1.0.0")

allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(tools.router)
app.include_router(search.router)
app.include_router(enrichment.router)


@app.get("/api/ai/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "stoca-ai-tool-service"}
