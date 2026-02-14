import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.config.settings import settings

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print(f"Starting {settings.APP_NAME}...")
    print(f"Server accessible at: http://{settings.local_ip}:{settings.PORT}")
    print(f"Docs available at: http://{settings.local_ip}:{settings.PORT}/docs")
    
    # Initialize DB (Seed items if needed)
    from app.database.connection import initialize_database
    initialize_database()
    
    yield
    # Shutdown logic (if any) could go here

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Backend for BugsByte2026 Hackathon Project",
    lifespan=lifespan
)

# CORS Configuration
# allowing all for development convenience (especially with Expo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routes
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
