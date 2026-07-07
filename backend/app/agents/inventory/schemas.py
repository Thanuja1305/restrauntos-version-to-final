import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

# Database Base Schema Configurations
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Ingredient Schemas
class IngredientBase(BaseSchema):
    restaurant_id: str
    name: str
    unit: str

class IngredientCreate(IngredientBase):
    pass

class IngredientResponse(IngredientBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

# Inventory Schemas
class InventoryBase(BaseSchema):
    restaurant_id: str
    ingredient_id: int
    quantity: float
    safety_stock: float
    reorder_point: float
    cost_per_unit: float
    location: Optional[str] = None

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    last_updated: datetime.datetime
    ingredient_name: Optional[str] = None

# Inventory Transaction Schemas
class InventoryTransactionBase(BaseSchema):
    restaurant_id: str
    inventory_id: int
    type: str  # IN, OUT, ADJUST
    quantity: float
    reference_id: Optional[str] = None

class InventoryTransactionCreate(InventoryTransactionBase):
    pass

class InventoryTransactionResponse(InventoryTransactionBase):
    id: int
    timestamp: datetime.datetime

# Supplier Schemas
class SupplierBase(BaseSchema):
    restaurant_id: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: int = 3
    rating: float = 5.0

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: int

# Purchase Order Schemas
class PurchaseItemBase(BaseSchema):
    ingredient_id: int
    quantity: float
    unit_cost: float

class PurchaseItemCreate(PurchaseItemBase):
    pass

class PurchaseItemResponse(PurchaseItemBase):
    id: int
    purchase_order_id: int

class PurchaseOrderBase(BaseSchema):
    restaurant_id: str
    supplier_id: int
    status: str = "PENDING"
    total_amount: float = 0.0

class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseItemCreate]

class PurchaseOrderResponse(PurchaseOrderBase):
    id: int
    order_date: datetime.datetime
    delivery_date: Optional[datetime.datetime] = None
    items: List[PurchaseItemResponse] = []

# Expiry Tracking Schemas
class ExpiryTrackingBase(BaseSchema):
    restaurant_id: str
    inventory_id: int
    batch_number: str
    expiry_date: datetime.date
    quantity: float
    status: str = "SAFE"

class ExpiryTrackingCreate(ExpiryTrackingBase):
    pass

class ExpiryTrackingResponse(ExpiryTrackingBase):
    id: int
    created_at: datetime.datetime

# Inventory Forecast Schemas
class InventoryForecastBase(BaseSchema):
    restaurant_id: str
    ingredient_id: int
    forecast_date: datetime.date
    predicted_demand: float
    confidence: float = 1.0

class InventoryForecastCreate(InventoryForecastBase):
    pass

class InventoryForecastResponse(InventoryForecastBase):
    id: int

# API Input/Output Schemas
class QueryRequest(BaseModel):
    request_id: str = Field(..., description="Unique ID for this request")
    workflow_id: str = Field(..., description="Unique LangGraph workflow execution ID")
    restaurant_id: str = Field(..., description="Restaurant Identifier")
    session_id: str = Field(..., description="Session ID")
    conversation_id: str = Field(..., description="Unique Conversation Identifier")
    shared_context: Dict[str, Any] = Field(default_factory=dict, description="Shared context passed by Orchestrator")
    query: str = Field(..., description="Natural language user query")

class QueryResponse(BaseModel):
    agent: str = "inventory"
    status: str = "success"  # success, error, handoff
    intent: str
    summary: str
    confidence: float
    structured_data: Dict[str, Any]
    execution_time: float
    tool_usage: List[str]
    errors: List[str]
