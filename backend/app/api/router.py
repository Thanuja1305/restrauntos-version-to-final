import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body

from backend.app import schemas
from backend.app.agents.auth import AuthAgent
from backend.app.agents.database_agent import DatabaseAgent
from backend.app.agents.sales import SalesAgent
from backend.app.agents.inventory_agent import InventoryAgent
from backend.app.agents.analytics import AnalyticsAgent
from backend.app.agents.notification import NotificationAgent
from backend.app.agents.orchestrator import OrchestratorAgent

router = APIRouter(prefix="/api")

# ==========================================
# AUTH ENDPOINTS
# ==========================================
@router.post("/auth/login", response_model=schemas.LoginResponse)
async def login(payload: schemas.LoginRequest):
    return await AuthAgent.login_user(payload.email, payload.password)

@router.post("/auth/register")
async def register(payload: schemas.RegisterRequest):
    return await AuthAgent.register_user(
        payload.email, 
        payload.password, 
        payload.firstName, 
        payload.lastName, 
        payload.role
    )

@router.get("/auth/me", response_model=schemas.AuthMeResponse)
async def get_me(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return {"user": user}

# ==========================================
# SETTINGS ENDPOINTS
# ==========================================
@router.get("/settings", response_model=schemas.SettingsSchema)
async def get_settings(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_settings()

@router.put("/settings", response_model=schemas.SettingsSchema)
async def update_settings(data: Dict[str, Any], user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.update_settings(data)

# ==========================================
# MENU ENDPOINTS
# ==========================================
@router.get("/menu", response_model=List[schemas.MenuItemSchema])
async def get_menu(search: Optional[str] = None, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_menu(search)

@router.put("/menu/{menu_id}", response_model=schemas.MenuItemSchema)
async def update_menu_item(menu_id: str, data: Dict[str, Any], user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.update_menu_item(menu_id, data)

# ==========================================
# INVENTORY ENDPOINTS
# ==========================================
@router.get("/inventory", response_model=List[schemas.InventoryItemSchema])
async def get_inventory(search: Optional[str] = None, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await InventoryAgent.get_inventory(search)

@router.post("/inventory/adjust", response_model=schemas.InventoryItemSchema)
async def adjust_inventory(payload: schemas.StockAdjustmentRequest, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await InventoryAgent.adjust_stock(payload.ingredientId, payload.adjustment)

# ==========================================
# SUPPLIERS ENDPOINTS
# ==========================================
@router.get("/suppliers", response_model=List[schemas.SupplierSchema])
async def get_suppliers(search: Optional[str] = None, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_suppliers(search)

# ==========================================
# CUSTOMERS ENDPOINTS
# ==========================================
@router.get("/customers", response_model=List[schemas.CustomerSchema])
async def get_customers(search: Optional[str] = None, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_customers(search)

@router.post("/customers", response_model=schemas.CustomerSchema)
async def add_customer(data: Dict[str, Any], user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.add_customer(data)

# ==========================================
# ORDERS ENDPOINTS
# ==========================================
@router.get("/orders", response_model=List[schemas.OrderSchema])
async def get_orders(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await SalesAgent.get_orders()

@router.post("/orders", response_model=schemas.OrderSchema)
async def create_order(payload: schemas.OrderCreateRequest, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    items_dict = [item.model_dump(by_alias=True) for item in payload.items]
    return await SalesAgent.create_order(
        payload.customerId, 
        payload.customerName, 
        items_dict, 
        payload.discount, 
        user["id"]
    )

# ==========================================
# NOTIFICATIONS ENDPOINTS
# ==========================================
@router.get("/notifications", response_model=List[schemas.NotificationSchema])
async def get_notifications(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await NotificationAgent.get_notifications()

@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    await NotificationAgent.mark_all_read()
    return {"success": True}

@router.post("/notifications/{notif_id}/read")
async def mark_single_notification_read(notif_id: str, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    res = await NotificationAgent.mark_single_read(notif_id)
    if not res:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "notification": res}

# ==========================================
# FINANCE ENDPOINTS
# ==========================================
@router.get("/finance", response_model=schemas.FinanceOverview)
async def get_finance_overview(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await AnalyticsAgent.get_financial_overview()

@router.get("/finance/bills", response_model=List[schemas.BillSchema])
async def get_bills(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_bills()

@router.get("/finance/expenses", response_model=List[schemas.ExpenseSchema])
async def get_expenses(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_expenses()

# ==========================================
# CHAT ENDPOINTS
# ==========================================
@router.get("/chat", response_model=List[schemas.MessageSchema])
async def get_chat_history(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await DatabaseAgent.get_chat_history()

@router.post("/chat", response_model=schemas.ChatResponse)
async def submit_chat_message(payload: schemas.ChatRequest, user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    res = await OrchestratorAgent.process_chat_query(payload.message, user["id"])
    state = await get_state(user)
    return {
        "reply": res["agentMessage"]["content"],
        "updatedState": state
    }

@router.post("/chat/clear", response_model=schemas.ChatClearResponse)
async def clear_chat(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    history = await DatabaseAgent.clear_chat_history()
    return {"status": "ok", "chatHistory": history}

# ==========================================
# STATE & EXTRA ORDER ENDPOINTS
# ==========================================

def map_menu_item(m: Dict[str, Any]) -> Dict[str, Any]:
    is_avail = m.get("is_available", m.get("isAvailable", True))
    if "availability_status" in m:
        is_avail = m["availability_status"] == "Available"
    return {
        "id": str(m.get("id")),
        "name": m.get("name") or m.get("item_name") or "Unnamed Item",
        "category": m.get("category", "Main Course"),
        "price": float(m.get("price") or m.get("selling_price") or 0.0),
        "cost": float(m.get("cost") or m.get("ingredient_cost") or (float(m.get("price") or m.get("selling_price") or 0.0) * 0.4)),
        "status": "Available" if is_avail else "Sold Out",
        "popularity": int(m.get("popularity", 4))
    }

def map_inventory_item(item: Dict[str, Any]) -> Dict[str, Any]:
    ing = item.get("ingredients") or {}
    return {
        "id": str(item.get("id")),
        "name": item.get("ingredientName") or ing.get("name") or item.get("name") or "Unnamed Ingredient",
        "currentQty": float(item.get("currentStock") or item.get("current_qty") or item.get("currentQty") or 0.0),
        "unit": item.get("unitOfMeasure") or ing.get("unit_of_measure") or item.get("unit") or "kg",
        "reorderLevel": float(item.get("minStockLevel") or ing.get("min_stock_level") or item.get("reorderLevel") or 0.0),
        "supplierId": item.get("supplierId") or ing.get("supplier_id") or item.get("supplier_id") or "s1",
        "unitPrice": float(item.get("unitPrice") or item.get("unit_price") or ing.get("unit_price") or 10.0)
    }

def map_order(o: Dict[str, Any]) -> Dict[str, Any]:
    raw_items = o.get("items") or []
    items = []
    for it in raw_items:
        items.append({
            "menuItemId": it.get("menuItemId") or it.get("menu_item_id") or it.get("menuId") or "",
            "name": it.get("name") or it.get("menu_name") or it.get("menuName") or "Unnamed",
            "quantity": int(it.get("quantity") or 1),
            "price": float(it.get("price") or it.get("unitPrice") or it.get("unit_price") or 0.0)
        })
    
    status_raw = o.get("status") or "Pending"
    status = status_raw.capitalize()
    
    return {
        "id": str(o.get("id")),
        "customerName": o.get("customerName") or o.get("customer_name") or "Guest Customer",
        "phone": o.get("phone") or "",
        "tableOrType": o.get("tableOrType") or o.get("table_or_type") or "Table 1",
        "items": items,
        "subtotal": float(o.get("subtotal") or 0.0),
        "tax": float(o.get("tax") or 0.0),
        "total": float(o.get("total") or 0.0),
        "status": status,
        "timestamp": o.get("created_at") or o.get("createdAt") or datetime.datetime.utcnow().isoformat()
    }

def map_customer(c: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(c.get("id")),
        "name": c.get("name") or "Unknown",
        "phone": c.get("phone") or "",
        "visitCount": int(c.get("visit_count") or c.get("visitCount") or 1),
        "totalSpent": float(c.get("total_spent") or c.get("totalSpent") or 0.0),
        "lastOrderDate": c.get("last_order_date") or c.get("lastOrderDate") or "",
        "notes": c.get("notes") or ""
    }

def map_supplier(s: Dict[str, Any]) -> Dict[str, Any]:
    items_supplied = s.get("items_supplied") or s.get("itemsSupplied") or []
    if isinstance(items_supplied, str):
        try:
            import json
            items_supplied = json.loads(items_supplied)
        except Exception:
            items_supplied = [items_supplied] if items_supplied else []
            
    return {
        "id": str(s.get("id")),
        "companyName": s.get("company_name") or s.get("companyName") or s.get("name") or "Unknown Company",
        "contactPerson": s.get("contact_person") or s.get("contactPerson") or s.get("contact_name") or s.get("contactName") or "",
        "phone": s.get("phone") or "",
        "itemsSupplied": items_supplied,
        "pendingPayments": float(s.get("pending_payments") or s.get("pendingPayments") or 0.0)
    }

def map_finance_entry_from_expense(e: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(e.get("id")),
        "timestamp": e.get("expense_date") or e.get("expenseDate") or e.get("created_at") or datetime.datetime.utcnow().isoformat(),
        "type": "Expense",
        "category": e.get("category") or "Other",
        "amount": float(e.get("amount") or 0.0),
        "description": e.get("description") or ""
    }

def map_finance_entry_from_order(o: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": f"rev_{o.get('id')}",
        "timestamp": o.get("created_at") or datetime.datetime.utcnow().isoformat(),
        "type": "Income",
        "category": "Order Revenue",
        "amount": float(o.get("total") or 0.0),
        "description": f"Completed Order {o.get('id')} for {o.get('customer_name') or 'Guest'}"
    }

@router.get("/state")
async def get_state(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    try:
        menu_items_raw = await DatabaseAgent.get_menu()
        inventory_raw = await DatabaseAgent.get_inventory()
        orders_raw = await DatabaseAgent.get_orders()
        customers_raw = await DatabaseAgent.get_customers()
        suppliers_raw = await DatabaseAgent.get_suppliers()
        expenses_raw = await DatabaseAgent.get_expenses()
        
        menu = [map_menu_item(m) for m in menu_items_raw]
        inventory = [map_inventory_item(i) for i in inventory_raw]
        orders = [map_order(o) for o in orders_raw]
        customers = [map_customer(c) for c in customers_raw]
        suppliers = [map_supplier(s) for s in suppliers_raw]
        
        finances = []
        for e in expenses_raw:
            finances.append(map_finance_entry_from_expense(e))
        for o in orders_raw:
            if o.get("status") in ["completed", "Completed"]:
                finances.append(map_finance_entry_from_order(o))
                
        finances.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return {
            "menu": menu,
            "inventory": inventory,
            "orders": orders,
            "customers": customers,
            "suppliers": suppliers,
            "finances": finances
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/state/update")
async def update_state(payload: Dict[str, Any] = Body(...), user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return payload

@router.post("/state/reset")
async def reset_state(user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    return await get_state(user)

@router.put("/orders/{order_id}")
async def update_order(order_id: str, payload: Dict[str, Any] = Body(...), user: Dict[str, Any] = Depends(AuthAgent.verify_token)):
    update_data = {}
    if "status" in payload:
        update_data["status"] = payload["status"].lower()
        
    updated = await DatabaseAgent.update_order(order_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Order not found")
        
    return map_order(updated)
