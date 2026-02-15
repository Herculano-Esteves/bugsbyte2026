import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.config.settings import settings

from contextlib import asynccontextmanager

# ── Transport router singletons (initialised at startup) ────────────────────
_stop_index = None
_transport_router = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _stop_index, _transport_router

    # Startup logic
    print(f"Starting {settings.APP_NAME}...")
    print(f"Server accessible at: http://{settings.local_ip}:{settings.PORT}")
    print(f"Docs available at: http://{settings.local_ip}:{settings.PORT}/docs")
    
    # Initialize DB (Seed items if needed)
    from app.database.connection import initialize_database
    initialize_database()

    # Initialize transport router
    try:
        from app.transport.geo import StopIndex
        from app.transport.router import TransportRouter
        from app.transport.schedule import ScheduleService

        _stop_index = StopIndex()
        _stop_index.load()
        _transport_router = TransportRouter(_stop_index, ScheduleService())
        print(f"[TRANSPORT] Router initialized — {_stop_index.size:,} stops indexed")
    except FileNotFoundError as e:
        print(f"[TRANSPORT] ⚠  Skipping router init: {e}")
    except Exception as e:
        print(f"[TRANSPORT] ⚠  Router init failed: {e}")

    yield

    # Shutdown logic
    from app.transport.connection import close_transport_db
    close_transport_db()
    print("[TRANSPORT] Database connection closed.")

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
