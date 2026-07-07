import asyncio
import datetime
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.agents.inventory.api import app
from backend.app.agents.inventory.models import Base, Ingredient, Inventory, Supplier, ExpiryTracking
from backend.app.agents.inventory.repository import InventoryRepository, AsyncSessionLocal
from backend.app.agents.inventory.inventory_rules import InventoryRulesEngine
from backend.app.agents.inventory import schemas, service

# Use a test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Setup test database engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(autouse=True)
async def init_db():
    # Bind test engine to Base metadata
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed mock data
    async with TestSessionLocal() as session:
        # Create Supplier
        supplier = Supplier(
            restaurant_id="rest_test_123",
            name="Fresh Farms",
            contact_name="Alice",
            email="alice@freshfarms.com",
            phone="12345",
            lead_time_days=3,
            rating=4.8
        )
        session.add(supplier)
        await session.flush()

        # Create Ingredients
        tomato = Ingredient(restaurant_id="rest_test_123", name="Tomato", unit="kg")
        cheese = Ingredient(restaurant_id="rest_test_123", name="Cheese", unit="kg")
        milk = Ingredient(restaurant_id="rest_test_123", name="Milk", unit="liters")
        session.add_all([tomato, cheese, milk])
        await session.flush()

        # Create Inventory Records
        inv_tomato = Inventory(
            restaurant_id="rest_test_123",
            ingredient_id=tomato.id,
            quantity=2.0,       # Low Stock (threshold 5.0)
            safety_stock=3.0,
            reorder_point=5.0,
            cost_per_unit=2.50,
            location="Fridge A"
        )
        inv_cheese = Inventory(
            restaurant_id="rest_test_123",
            ingredient_id=cheese.id,
            quantity=15.0,      # Safe Stock
            safety_stock=5.0,
            reorder_point=8.0,
            cost_per_unit=6.00,
            location="Fridge A"
        )
        inv_milk = Inventory(
            restaurant_id="rest_test_123",
            ingredient_id=milk.id,
            quantity=0.0,       # Out of Stock
            safety_stock=2.0,
            reorder_point=4.0,
            cost_per_unit=1.80,
            location="Cold Room"
        )
        session.add_all([inv_tomato, inv_cheese, inv_milk])
        await session.flush()

        # Create Expiry Record
        expiry = ExpiryTracking(
            restaurant_id="rest_test_123",
            inventory_id=inv_tomato.id,
            batch_number="B-TOM-01",
            expiry_date=datetime.date.today() + datetime.timedelta(days=2), # Expiring soon
            quantity=2.0,
            status="SAFE"
        )
        session.add(expiry)
        await session.commit()

    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# Mock service dependency to use Test Session local in execution node
@pytest.fixture(autouse=True)
def mock_db_session(monkeypatch):
    # Monkeypatch AsyncSessionLocal in repository and nodes to use our TestSessionLocal
    import backend.app.agents.inventory.repository as repo_module
    import backend.app.agents.inventory.nodes as nodes_module
    monkeypatch.setattr(repo_module, "AsyncSessionLocal", TestSessionLocal)
    monkeypatch.setattr(nodes_module, "AsyncSessionLocal", TestSessionLocal)

# --- Business Rules Engine Tests ---
def test_rules_is_low_stock():
    assert InventoryRulesEngine.is_low_stock(2.0, 5.0) is True
    assert InventoryRulesEngine.is_low_stock(10.0, 5.0) is False

def test_rules_is_out_of_stock():
    assert InventoryRulesEngine.is_out_of_stock(0.0) is True
    assert InventoryRulesEngine.is_out_of_stock(-1.5) is True
    assert InventoryRulesEngine.is_out_of_stock(0.5) is False

def test_rules_valuation():
    items = [
        {"quantity": 10.0, "cost_per_unit": 2.5},
        {"quantity": 2.0, "cost_per_unit": 5.0}
    ]
    total = InventoryRulesEngine.calculate_total_inventory_value(items)
    assert total == 35.0

# --- Repository Layer Tests ---
@pytest.mark.asyncio
async def test_repo_stock_fetching():
    async with TestSessionLocal() as session:
        repo = InventoryRepository(session)
        low_items = await repo.get_low_stock_items("rest_test_123")
        assert len(low_items) == 2  # Tomato (2.0 <= 5.0) and Milk (0.0 <= 4.0)
        
        out_items = await repo.get_out_of_stock_items("rest_test_123")
        assert len(out_items) == 1  # Milk

# --- Service Integration Tests (LangGraph Workflow Execution) ---
@pytest.mark.asyncio
async def test_service_stock_lookup():
    req = schemas.QueryRequest(
        request_id="req_001",
        workflow_id="wf_001",
        restaurant_id="rest_test_123",
        session_id="sess_001",
        conversation_id="conv_001",
        query="Check stock levels for Tomato"
    )
    
    resp = await service.InventoryAgentService.execute_query(req)
    assert resp.status == "success"
    assert resp.intent == "StockLookup"
    assert len(resp.structured_data.get("items", [])) > 0
    assert "Tomato" in resp.summary

@pytest.mark.asyncio
async def test_service_low_stock():
    req = schemas.QueryRequest(
        request_id="req_002",
        workflow_id="wf_002",
        restaurant_id="rest_test_123",
        session_id="sess_002",
        conversation_id="conv_002",
        query="What items are low on stock?"
    )
    
    resp = await service.InventoryAgentService.execute_query(req)
    assert resp.status == "success"
    assert resp.intent == "LowStock"
    assert len(resp.structured_data.get("low_stock_items", [])) == 2

@pytest.mark.asyncio
async def test_service_handoff_detection():
    req = schemas.QueryRequest(
        request_id="req_003",
        workflow_id="wf_003",
        restaurant_id="rest_test_123",
        session_id="sess_003",
        conversation_id="conv_003",
        query="Generate profit report for last month"
    )
    
    resp = await service.InventoryAgentService.execute_query(req)
    assert resp.status == "handoff"
    assert resp.structured_data.get("target_agent") == "finance"

# --- API Endpoint Routing Tests ---
@pytest.mark.asyncio
async def test_api_query_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/agents/inventory/query", json={
            "request_id": "req_004",
            "workflow_id": "wf_004",
            "restaurant_id": "rest_test_123",
            "session_id": "sess_004",
            "conversation_id": "conv_004",
            "query": "Which items are out of stock?"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent"] == "inventory"
        assert data["status"] == "success"
        assert data["intent"] == "OutOfStock"
        assert len(data["structured_data"]["out_of_stock_items"]) == 1
