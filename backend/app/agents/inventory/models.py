import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Date, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g., kg, liters, pieces
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    inventory: Mapped[Optional["Inventory"]] = relationship(back_populates="ingredient", cascade="all, delete-orphan")
    purchase_items: Mapped[List["PurchaseItem"]] = relationship(back_populates="ingredient")
    forecasts: Mapped[List["InventoryForecast"]] = relationship(back_populates="ingredient")

class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), unique=True, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    safety_stock: Mapped[float] = mapped_column(Float, default=0.0)
    reorder_point: Mapped[float] = mapped_column(Float, default=0.0)
    cost_per_unit: Mapped[float] = mapped_column(Float, default=0.0)
    location: Mapped[Optional[str]] = mapped_column(String(100))
    last_updated: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(back_populates="inventory")
    transactions: Mapped[List["InventoryTransaction"]] = relationship(back_populates="inventory", cascade="all, delete-orphan")
    expiry_records: Mapped[List["ExpiryTracking"]] = relationship(back_populates="inventory", cascade="all, delete-orphan")

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("inventory.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # IN, OUT, ADJUST
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    reference_id: Mapped[Optional[str]] = mapped_column(String(100))  # e.g., ORDER_123, PO_456
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    inventory: Mapped["Inventory"] = relationship(back_populates="transactions")

class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(String(200))
    lead_time_days: Mapped[int] = mapped_column(Integer, default=3)
    rating: Mapped[float] = mapped_column(Float, default=5.0)

    # Relationships
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(back_populates="supplier")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING, SENT, RECEIVED, CANCELLED
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    order_date: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    delivery_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime)

    # Relationships
    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_orders")
    items: Mapped[List["PurchaseItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="purchase_items")

class InventoryForecast(Base):
    __tablename__ = "inventory_forecasts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), nullable=False)
    forecast_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    predicted_demand: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(back_populates="forecasts")

class InventoryKPI(Base):
    __tablename__ = "inventory_kpis"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    date: Mapped[datetime.date] = mapped_column(Date, default=datetime.date.today, nullable=False)
    turnover_rate: Mapped[float] = mapped_column(Float, default=0.0)
    utilization_rate: Mapped[float] = mapped_column(Float, default=0.0)
    stockout_count: Mapped[int] = mapped_column(Integer, default=0)
    wastage_value: Mapped[float] = mapped_column(Float, default=0.0)

class InventoryReport(Base):
    __tablename__ = "inventory_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(20), nullable=False)  # DAILY, WEEKLY, MONTHLY
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    content: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

class ExpiryTracking(Base):
    __tablename__ = "expiry_tracking"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    inventory_id: Mapped[int] = mapped_column(ForeignKey("inventory.id"), nullable=False)
    batch_number: Mapped[str] = mapped_column(String(50), nullable=False)
    expiry_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="SAFE")  # SAFE, WARNING, EXPIRED
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    inventory: Mapped["Inventory"] = relationship(back_populates="expiry_records")
