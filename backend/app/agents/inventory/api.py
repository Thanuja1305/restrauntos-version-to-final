import os
import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from backend.app.agents.inventory.models import Base
from backend.app.agents.inventory import models
from backend.app.agents.inventory.repository import engine, AsyncSessionLocal
from backend.app.agents.inventory.router import router as inventory_router

async def seed_mock_data(session):
    """Seed the database with sample inventory records on first boot."""
    result = await session.execute(select(models.Ingredient))
    if result.scalars().first() is not None:
        return
        
    # Seed suppliers
    supplier_1 = models.Supplier(
        restaurant_id="rest_test_123",
        name="Fresh Farms Co.",
        contact_name="John Doe",
        email="john@freshfarms.com",
        phone="555-0199",
        address="100 Green Valley Rd",
        lead_time_days=2,
        rating=4.9
    )
    supplier_2 = models.Supplier(
        restaurant_id="rest_test_123",
        name="Global Foods Dist.",
        contact_name="Sarah Smith",
        email="orders@globalfoods.com",
        phone="555-0144",
        address="404 Industrial Pkwy",
        lead_time_days=4,
        rating=4.5
    )
    session.add_all([supplier_1, supplier_2])
    await session.flush()
    
    # Seed ingredients
    tomato = models.Ingredient(restaurant_id="rest_test_123", name="Tomato", unit="kg")
    cheese = models.Ingredient(restaurant_id="rest_test_123", name="Cheese", unit="kg")
    milk = models.Ingredient(restaurant_id="rest_test_123", name="Milk", unit="liters")
    beef = models.Ingredient(restaurant_id="rest_test_123", name="Beef", unit="kg")
    onion = models.Ingredient(restaurant_id="rest_test_123", name="Onion", unit="kg")
    session.add_all([tomato, cheese, milk, beef, onion])
    await session.flush()
    
    # Seed inventory
    inv_tomato = models.Inventory(
        restaurant_id="rest_test_123",
        ingredient_id=tomato.id,
        quantity=2.5,
        safety_stock=4.0,
        reorder_point=5.0,
        cost_per_unit=2.20,
        location="Fridge A"
    )
    inv_cheese = models.Inventory(
        restaurant_id="rest_test_123",
        ingredient_id=cheese.id,
        quantity=12.0,
        safety_stock=5.0,
        reorder_point=8.0,
        cost_per_unit=6.50,
        location="Fridge A"
    )
    inv_milk = models.Inventory(
        restaurant_id="rest_test_123",
        ingredient_id=milk.id,
        quantity=0.0,
        safety_stock=3.0,
        reorder_point=5.0,
        cost_per_unit=1.50,
        location="Cold Room"
    )
    inv_beef = models.Inventory(
        restaurant_id="rest_test_123",
        ingredient_id=beef.id,
        quantity=8.0,
        safety_stock=4.0,
        reorder_point=6.0,
        cost_per_unit=12.00,
        location="Freezer B"
    )
    inv_onion = models.Inventory(
        restaurant_id="rest_test_123",
        ingredient_id=onion.id,
        quantity=20.0,
        safety_stock=6.0,
        reorder_point=10.0,
        cost_per_unit=1.10,
        location="Dry Shelf"
    )
    session.add_all([inv_tomato, inv_cheese, inv_milk, inv_beef, inv_onion])
    await session.flush()
    
    # Expiry
    expiry = models.ExpiryTracking(
        restaurant_id="rest_test_123",
        inventory_id=inv_tomato.id,
        batch_number="B-TOM-99",
        expiry_date=datetime.date.today() + datetime.timedelta(days=3),
        quantity=2.5,
        status="WARNING"
    )
    session.add(expiry)
    await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically bootstrap SQLAlchemy models for greenfield execution/testing
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Run seeder
    async with AsyncSessionLocal() as session:
        await seed_mock_data(session)
        
    yield
    # Cleanup DB connection resources on shutdown
    await engine.dispose()

app = FastAPI(
    title="RestaurantOS AI - Inventory Agent Service",
    version="1.0.0",
    description="Microservice coordinating inventory pipelines under LangGraph",
    lifespan=lifespan
)

# Enable CORS for local dashboards and Orchestrator interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory_router)

@app.get("/", response_class=HTMLResponse, tags=["UI"])
async def read_index():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(current_dir, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content, status_code=200)

@app.get("/standard", response_class=HTMLResponse, tags=["UI"])
async def read_standard():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    standard_path = os.path.join(current_dir, "standard.html")
    with open(standard_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content, status_code=200)

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "inventory_agent"}
