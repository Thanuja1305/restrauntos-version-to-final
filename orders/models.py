import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Customer(Base):
    __tablename__ = "customers"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    visit_count: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    last_order_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Extra Pydantic/Analytic mappings
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    last_visit: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    orders: Mapped[List["Order"]] = relationship("Order", back_populates="customer")


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    category_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active_status: Mapped[bool] = mapped_column(Boolean, default=True)


class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cost: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Available")
    popularity: Mapped[int] = mapped_column(Integer, default=5)
    
    # Extended requested fields
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recipe_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ingredient_cost: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    food_cost_percentage: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    profit_margin: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="menu_item")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    menu_item_id: Mapped[str] = mapped_column(String(50), ForeignKey("menu_items.id"), nullable=False)
    recipe_name: Mapped[str] = mapped_column(String(100), nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ingredients: Mapped[List["RecipeIngredient"]] = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id: Mapped[str] = mapped_column(String(50), ForeignKey("recipes.id"), nullable=False)
    inventory_id: Mapped[str] = mapped_column(String(50), ForeignKey("inventory.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(50), nullable=False)

    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="ingredients")
    inventory: Mapped["Inventory"] = relationship("Inventory")


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # Map name to item_name in schema
    current_qty: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    reorder_level: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    supplier_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)

    # Extended requested fields
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    maximum_stock_level: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    reorder_point: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    reorder_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    storage_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    batch_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # RECEIVE, CONSUME, WASTE, TRANSFER, ADJUST
    item_id: Mapped[str] = mapped_column(String(50), ForeignKey("inventory.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reference_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="SYSTEM")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    inventory: Mapped["Inventory"] = relationship("Inventory")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    table_or_type: Mapped[str] = mapped_column(String(100), nullable=False)  # Map table_or_type
    status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending, Completed, Cancelled
    payment_status: Mapped[str] = mapped_column(String(30), default="Pending")  # Pending, Paid
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tax: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)  # total
    sales_channel: Mapped[str] = mapped_column(String(50), default="Dine-In")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id: Mapped[str] = mapped_column(String, ForeignKey("menu_items.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship("Order", back_populates="items")
    menu_item: Mapped["MenuItem"] = relationship("MenuItem", back_populates="order_items")


class SalesTransaction(Base):
    __tablename__ = "sales_transactions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False)
    revenue_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    tax: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    final_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped["Order"] = relationship("Order")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # Food Cost, Salary, Rent, Utilities, Marketing, Maintenance
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Revenue(Base):
    __tablename__ = "revenues"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    source: Mapped[str] = mapped_column(String(100), nullable=False)  # Dine-in, Online, Delivery, Takeaway
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    order_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FinancialSummary(Base):
    __tablename__ = "financial_summaries"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    total_revenue: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    total_expenses: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    gross_profit: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    net_profit: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    food_cost: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    labor_cost: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0.0)
    profit_margin_percentage: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.0)
    calculation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AnalyticsMetrics(Base):
    __tablename__ = "analytics_metrics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    kpi_name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)  # Can store number or serialised details
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # Sales, Inventory, Customer
    calculation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLogs(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)  # USER, AI_AGENT, SYSTEM
    actor_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    agent_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Inventory Agent, Sales Agent, Finance Agent, Analytics Agent
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, QUERY, ROUTE
    entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Inventory, Order, Expense, Revenue, Menu
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payload_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
