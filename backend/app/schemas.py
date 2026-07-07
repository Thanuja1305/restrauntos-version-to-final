from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# Common Schema Elements
class UserSchema(BaseModel):
    id: str
    email: str
    firstName: str = Field(alias="first_name", default="")
    lastName: str = Field(alias="last_name", default="")
    role: str = "staff"
    isActive: bool = True
    createdAt: str

    class Config:
        populate_by_name = True

# Auth Requests & Responses
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: UserSchema

class RegisterRequest(BaseModel):
    email: str
    password: str
    firstName: str
    lastName: str
    role: str = "staff"

class AuthMeResponse(BaseModel):
    user: UserSchema

# Settings
class SettingsSchema(BaseModel):
    restaurantName: str = Field(alias="restaurant_name")
    address: str
    gstin: Optional[str] = None
    fssai: Optional[str] = None
    taxRate: float = Field(alias="tax_rate", default=5.0)
    currency: str = "₹"

    class Config:
        populate_by_name = True

# Menu Items
class MenuItemSchema(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    price: float
    category: str
    isAvailable: bool = Field(alias="is_available", default=True)
    createdAt: str

    class Config:
        populate_by_name = True

# Suppliers
class SupplierSchema(BaseModel):
    id: str
    name: str
    contactName: Optional[str] = Field(alias="contact_name", default=None)
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    createdAt: str

    class Config:
        populate_by_name = True

# Ingredients
class IngredientSchema(BaseModel):
    id: str
    name: str
    unitOfMeasure: str = Field(alias="unit_of_measure")
    supplierId: str = Field(alias="supplier_id")
    minStockLevel: float = Field(alias="min_stock_level")

    class Config:
        populate_by_name = True

# Inventory Items
class InventoryItemSchema(BaseModel):
    id: str
    ingredientId: str = Field(alias="ingredient_id")
    ingredientName: str = Field(alias="ingredient_name")
    currentStock: float = Field(alias="current_stock")
    minStockLevel: float = Field(alias="min_stock_level")
    unitOfMeasure: str = Field(alias="unit_of_measure")

    class Config:
        populate_by_name = True

class StockAdjustmentRequest(BaseModel):
    ingredientId: str = Field(alias="ingredient_id")
    adjustment: float

# Orders
class OrderItemSchema(BaseModel):
    id: str
    menuId: str = Field(alias="menu_id")
    menuName: str = Field(alias="menu_name")
    quantity: int
    unitPrice: float = Field(alias="unit_price")
    notes: Optional[str] = None

    class Config:
        populate_by_name = True

class OrderSchema(BaseModel):
    id: str
    customerId: Optional[str] = Field(alias="customer_id", default=None)
    customerName: Optional[str] = Field(alias="customer_name", default=None)
    userId: str = Field(alias="user_id")
    serverName: str = Field(alias="server_name")
    status: str
    subtotal: float
    tax: float
    discount: float
    total: float
    items: List[OrderItemSchema]
    createdAt: str

    class Config:
        populate_by_name = True

class OrderCreateRequest(BaseModel):
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    items: List[OrderItemSchema]
    discount: float = 0.0

# Customers
class CustomerSchema(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    loyaltyPoints: int = Field(alias="loyalty_points", default=0)
    createdAt: str

    class Config:
        populate_by_name = True

# Bills
class BillSchema(BaseModel):
    id: str
    supplierId: str = Field(alias="supplier_id")
    supplierName: str = Field(alias="supplier_name")
    amount: float
    dueDate: str = Field(alias="due_date")
    status: str

    class Config:
        populate_by_name = True

# Expenses
class ExpenseSchema(BaseModel):
    id: str
    category: str
    amount: float
    description: Optional[str] = None
    expenseDate: str = Field(alias="expense_date")

    class Config:
        populate_by_name = True

# Chat Messages
class MessageSchema(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str
    attachmentType: Optional[str] = Field(alias="attachment_type", default=None)
    attachmentData: Optional[Any] = Field(alias="attachment_data", default=None)

    class Config:
        populate_by_name = True

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    userMessage: MessageSchema
    agentMessage: MessageSchema

class ChatClearResponse(BaseModel):
    status: str = "ok"
    chatHistory: List[MessageSchema]

# Notifications
class NotificationRoute(BaseModel):
    agent: str
    action: str

class NotificationSchema(BaseModel):
    notification_id: str
    title: str
    message: str
    type: str
    status: str
    created_at: str
    reference_id: Optional[str] = None
    route: NotificationRoute

    class Config:
        populate_by_name = True

# Finance Overview
class FinanceOverview(BaseModel):
    totalRevenue: float = Field(alias="total_revenue")
    unpaidBillsCount: int = Field(alias="unpaid_bills_count")
    totalExpenses: float = Field(alias="total_expenses")
    profit: float
    currency: str = "₹"
    unpaidBillsAmount: float = Field(alias="unpaid_bills_amount")

    class Config:
        populate_by_name = True
