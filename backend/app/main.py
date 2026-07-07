import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.api.router import router as api_router
from backend.app.config import settings

app = FastAPI(
    title="RestaurantOS AI - Multi-Agent Core Backend",
    version="1.0.0",
    description="FastAPI + Supabase multi-agent system"
)

# CORS configuration supporting local Vite React server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints router
app.include_router(api_router)

# Mount Vite frontend dist folder if compiled for production deployment
dist_path = os.path.join(os.getcwd(), "dist")
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    @app.get("/{catchall:path}", include_in_schema=False)
    async def serve_frontend(catchall: str):
        file_path = os.path.join(dist_path, catchall)
        if catchall and os.path.exists(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/", include_in_schema=False)
    async def root_fallback():
        return {"status": "running", "message": "Backend API active. Frontend React dev server is running separately."}
