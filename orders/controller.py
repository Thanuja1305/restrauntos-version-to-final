from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from orders.routes import router as orders_router

app = FastAPI(
    title="RestaurantOS AI - Orders API",
    description="Foundational Orders Module API with Clean Architecture and PostgreSQL integration.",
    version="1.0.0"
)

# Enable CORS for Next.js and static browser endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    from orders.dependencies import init_tables
    try:
        await init_tables()
        print("Database tables initialized successfully via SQLAlchemy!")
    except Exception as e:
        print(f"Error during database table initialization: {e}")

app.include_router(orders_router)

@app.get("/")
async def root():
    return {
        "module": "Orders",
        "service": "RestaurantOS AI Backend",
        "status": "online",
        "version": "1.0.0"
    }
