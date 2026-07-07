from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

# --- EXISTING SCHEMAS (Retained for compatibility) ---

class OrderItemBase(BaseModel):
    menu_item_id: str = Field(..., description="The unique ID of the menu item")
    quantity: int = Field(..., description="Quantity ordered")

    @field_validator("quantity")
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be strictly greater than 0")
        return v

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemDTO(OrderItemBase):
    id: int
    order_id: int
    name: str = Field(..., description="Derived name of the menu item for convenience")
    price: float = Field(..., description="Price at which item was ordered")
    subtotal: float = Field(..., description="Item quantity multiplied by individual price")
    created_at: datetime

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    customer_id: str = Field(..., description="ID of the customer placing the order")
    order_type: str = Field(..., description="Dine In, Takeaway, or Delivery")
    discount: Optional[float] = Field(0.0, description="Any applied discount amount")

    @field_validator("order_type")
    def validate_order_type(cls, v):
        allowed = ["Dine In", "Takeaway", "Delivery"]
        if v not in allowed:
            raise ValueError(f"Order type must be one of {allowed}")
        return v

class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., description="List of menu items in the order")

    @field_validator("items")
    def validate_items(cls, v):
        if not v:
            raise ValueError("An order must contain at least one item")
        return v

class OrderUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Pending, Completed, or Cancelled")
    payment_status: Optional[str] = Field(None, description="Pending or Paid")

    @field_validator("status")
    def validate_status(cls, v):
        if v is not None:
            allowed = ["Pending", "Completed", "Cancelled"]
            if v not in allowed:
                raise ValueError(f"Status must be one of {allowed}")
        return v

    @field_validator("payment_status")
    def validate_payment_status(cls, v):
        if v is not None:
            allowed = ["Pending", "Paid"]
            if v not in allowed:
                raise ValueError(f"Payment status must be one of {allowed}")
        return v

class CustomerBriefDTO(BaseModel):
    id: str
    name: str
    phone: str

    class Config:
        from_attributes = True

class OrderDTO(BaseModel):
    id: int
    order_number: str
    customer_id: str
    customer: Optional[CustomerBriefDTO] = None
    order_type: str
    status: str
    payment_status: str
    subtotal: float
    tax: float
    discount: float
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemDTO]

    class Config:
        from_attributes = True


# --- NEW SCHEMAS FOR TASK 1 ---

# 1. INVENTORY SCHEMAS

class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., description="Name of the stock item (e.g. Tomatoes)")
    category: Optional[str] = None
    subcategory: Optional[str] = None
    unit_of_measure: str = Field(..., description="Unit (e.g., kg, L, pcs)")
    current_quantity: float = Field(..., description="Current quantity in stock")
    minimum_stock_level: float = Field(..., description="The minimum safety level")
    maximum_stock_level: float = Field(0.0, description="The maximum capacity level")
    reorder_point: float = Field(0.0, description="Reorder point threshold")
    reorder_quantity: float = Field(0.0, description="Quantity to reorder")
    unit_cost: float = Field(..., description="Cost per unit")
    supplier_id: Optional[str] = None
    storage_location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    batch_number: Optional[str] = None

class InventoryItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    unit_of_measure: Optional[str] = None
    current_quantity: Optional[float] = None
    minimum_stock_level: Optional[float] = None
    maximum_stock_level: Optional[float] = None
    reorder_point: Optional[float] = None
    reorder_quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    supplier_id: Optional[str] = None
    storage_location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    batch_number: Optional[str] = None

class InventoryItemResponse(BaseModel):
    id: str
    item_name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    unit_of_measure: str
    current_quantity: float
    minimum_stock_level: float
    maximum_stock_level: float
    reorder_point: float
    reorder_quantity: float
    unit_cost: float
    supplier_id: Optional[str] = None
    storage_location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    batch_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InventoryTransactionCreate(BaseModel):
    transaction_type: str = Field(..., description="RECEIVE, CONSUME, WASTE, TRANSFER, ADJUST")
    item_id: str
    quantity: float
    unit_of_measure: str
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    reason: Optional[str] = None
    created_by: Optional[str] = "SYSTEM"
    timestamp: Optional[datetime] = None

    @field_validator("transaction_type")
    def validate_type(cls, v):
        allowed = ["RECEIVE", "CONSUME", "WASTE", "TRANSFER", "ADJUST"]
        if v not in allowed:
            raise ValueError(f"Transaction type must be one of {allowed}")
        return v


# 2. MENU MANAGEMENT SCHEMAS

class MenuItemCreate(BaseModel):
    item_name: str
    category: str
    description: Optional[str] = None
    selling_price: float
    recipe_id: Optional[str] = None
    ingredient_cost: float = 0.0
    food_cost_percentage: float = 0.0
    profit_margin: float = 0.0
    availability_status: str = "Available"

class MenuItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    selling_price: Optional[float] = None
    recipe_id: Optional[str] = None
    ingredient_cost: Optional[float] = None
    food_cost_percentage: Optional[float] = None
    profit_margin: Optional[float] = None
    availability_status: Optional[str] = None

class MenuItemResponse(BaseModel):
    menu_item_id: str
    item_name: str
    category: str
    description: Optional[str] = None
    selling_price: float
    recipe_id: Optional[str] = None
    ingredient_cost: float
    food_cost_percentage: float
    profit_margin: float
    availability_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MenuCategorySchema(BaseModel):
    category_id: str
    category_name: str
    description: Optional[str] = None
    active_status: bool = True

    class Config:
        from_attributes = True


# 3. SALES SCHEMAS

class OrderItemResponseSchema(BaseModel):
    menu_item_id: str
    quantity: int
    price: float
    subtotal: float

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    order_id: int
    customer_id: str
    order_items: List[OrderItemResponseSchema]
    quantity: int
    total_amount: float
    payment_status: str
    order_status: str
    sales_channel: str
    created_at: datetime

    class Config:
        from_attributes = True

class SalesTransactionResponse(BaseModel):
    transaction_id: str
    order_id: int
    revenue_amount: float
    payment_method: str
    discount: float
    tax: float
    final_amount: float
    timestamp: datetime

    class Config:
        from_attributes = True

class CustomerResponse(BaseModel):
    customer_id: str
    name: str
    phone: str
    email: Optional[str] = None
    total_orders: int
    total_spent: float
    last_visit: Optional[datetime] = None

    class Config:
        from_attributes = True


# 4. FINANCE SCHEMAS

class ExpenseCreate(BaseModel):
    category: str = Field(..., description="Food Cost, Salary, Rent, Utilities, Marketing, Maintenance")
    amount: float
    payment_method: str
    vendor: str
    description: Optional[str] = None
    date: Optional[datetime] = None

    @field_validator("category")
    def validate_category(cls, v):
        allowed = ["Food Cost", "Salary", "Rent", "Utilities", "Marketing", "Maintenance"]
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}")
        return v

class ExpenseResponse(BaseModel):
    expense_id: str
    category: str
    amount: float
    payment_method: str
    vendor: str
    description: Optional[str] = None
    date: datetime

    class Config:
        from_attributes = True

class RevenueCreate(BaseModel):
    source: str = Field(..., description="Dine-in, Online, Delivery, Takeaway")
    amount: float
    date: Optional[datetime] = None
    order_id: Optional[int] = None

    @field_validator("source")
    def validate_source(cls, v):
        allowed = ["Dine-in", "Online", "Delivery", "Takeaway"]
        if v not in allowed:
            raise ValueError(f"Source must be one of {allowed}")
        return v

class RevenueResponse(BaseModel):
    revenue_id: str
    source: str
    amount: float
    date: datetime
    order_id: Optional[int] = None

    class Config:
        from_attributes = True

class FinancialSummaryResponse(BaseModel):
    total_revenue: float
    total_expenses: float
    gross_profit: float
    net_profit: float
    food_cost: float
    labor_cost: float
    profit_margin_percentage: float

    class Config:
        from_attributes = True


# 5. ANALYTICS SCHEMAS

class KPIResponse(BaseModel):
    kpi_name: str
    value: str
    calculation_date: datetime
    category: str

    class Config:
        from_attributes = True

class SalesKPIResponse(BaseModel):
    daily_sales: float
    weekly_sales: float
    monthly_sales: float
    best_selling_items: List[str]
    average_order_value: float

class InventoryKPIResponse(BaseModel):
    inventory_value: float
    low_stock_items: List[str]
    waste_percentage: float
    stock_turnover: float

class CustomerKPIResponse(BaseModel):
    total_customers: int
    returning_customers: int
    customer_frequency: float
    customer_lifetime_value: float

class InsightResponse(BaseModel):
    insight_title: str
    explanation: str
    recommendation: str
    confidence_score: float
    generated_at: datetime

    class Config:
        from_attributes = True


# Agent Event Body Schema for POST /api/agents/events

class AgentEventRequest(BaseModel):
    # Old fields for backward compatibility
    agent: Optional[str] = Field(None, description="Name of the agent (e.g. Sales Agent)")
    event: Optional[str] = Field(None, description="Event name (e.g. ORDER_CREATED)")
    
    # New fields for Part 6
    event_id: Optional[UUID] = Field(None, description="Unique event UUID")
    event_type: Optional[str] = Field(None, description="Type of event (e.g. ANALYTICS_REQUEST)")
    source_agent: Optional[str] = Field(None, description="Source agent (e.g. Master Orchestrator)")
    target_agent: Optional[str] = Field(None, description="Target agent (e.g. Analytics Agent)")
    timestamp: Optional[datetime] = Field(None, description="Timestamp of the event")
    
    # Shared payload data
    data: dict = Field(..., description="Event detailed data")


class AgentEventResponse(BaseModel):
    success: bool = Field(..., description="Success flag")
    message: str = Field(..., description="Response message")
    result: dict = Field(..., description="Response payload dictionary")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")

