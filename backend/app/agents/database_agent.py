import datetime
from typing import List, Dict, Any, Optional
from backend.app.supabase_client import supabase
from backend.app.logger import logger

# Pre-seeded local mock data for Spice Heaven to handle offline/sandbox environments where Supabase is unreachable
_mock_db = {
    "settings": {
        "restaurant_name": "Spice Heaven",
        "address": "23 Green Street, Hitech City, Hyderabad - 500081",
        "gstin": "36ABCDE1234F1Z5",
        "fssai": "13620012000456",
        "tax_rate": 5.0,
        "currency": "₹"
    },
    "menu": [
      { "id": "m1", "name": "Masala Dosa", "category": "Main Course", "price": 120.0, "cost": 40.0, "is_available": True, "popularity": 5 },
      { "id": "m2", "name": "Paneer Butter Masala", "category": "Main Course", "price": 220.0, "cost": 80.0, "is_available": True, "popularity": 4 },
      { "id": "m3", "name": "Garlic Naan", "category": "Main Course", "price": 40.0, "cost": 12.0, "is_available": True, "popularity": 4 },
      { "id": "m4", "name": "Filter Coffee", "category": "Beverage", "price": 30.0, "cost": 8.0, "is_available": True, "popularity": 5 },
      { "id": "m5", "name": "Mango Lassi", "category": "Beverage", "price": 80.0, "cost": 25.0, "is_available": True, "popularity": 4 },
      { "id": "m6", "name": "Samosa (2 Pcs)", "category": "Appetizer", "price": 50.0, "cost": 15.0, "is_available": True, "popularity": 4 },
      { "id": "m7", "name": "Gulab Jamun (2 Pcs)", "category": "Dessert", "price": 60.0, "cost": 18.0, "is_available": True, "popularity": 5 }
    ],
    "inventory": [
      { "id": "i1", "ingredient_id": "ing1", "name": "Tomatoes", "current_stock": 12.5, "unit_of_measure": "kg", "min_stock_level": 5.0, "supplier_id": "s2", "unit_price": 40.0 },
      { "id": "i2", "ingredient_id": "ing2", "name": "Onions", "current_stock": 18.0, "unit_of_measure": "kg", "min_stock_level": 6.0, "supplier_id": "s2", "unit_price": 30.0 },
      { "id": "i3", "ingredient_id": "ing3", "name": "Paneer", "current_stock": 4.2, "unit_of_measure": "kg", "min_stock_level": 2.0, "supplier_id": "s1", "unit_price": 350.0 },
      { "id": "i4", "ingredient_id": "ing4", "name": "Milk", "current_stock": 15.0, "unit_of_measure": "L", "min_stock_level": 5.0, "supplier_id": "s1", "unit_price": 60.0 },
      { "id": "i5", "ingredient_id": "ing5", "name": "Flour/Maida", "current_stock": 25.0, "unit_of_measure": "kg", "min_stock_level": 10.0, "supplier_id": "s2", "unit_price": 45.0 },
      { "id": "i6", "ingredient_id": "ing6", "name": "Coffee Beans", "current_stock": 3.5, "unit_of_measure": "kg", "min_stock_level": 1.5, "supplier_id": "s3", "unit_price": 800.0 }
    ],
    "suppliers": [
      { "id": "s1", "name": "Dairy Craft", "contact_name": "Rajesh Kumar", "phone": "+91 98888 77777", "items_supplied": ["Paneer", "Milk", "Cheese"], "pending_payments": 2800.00 },
      { "id": "s2", "name": "Fresh Farms", "contact_name": "Anil Sharma", "phone": "+91 97777 66666", "items_supplied": ["Tomatoes", "Onions", "Potatoes", "Flour/Maida"], "pending_payments": 1500.00 },
      { "id": "s3", "name": "Kapi Co.", "contact_name": "Srinivas Rao", "phone": "+91 96666 55555", "items_supplied": ["Coffee Beans", "Tea Powder"], "pending_payments": 0.00 }
    ],
    "customers": [
      { "id": "c1", "name": "Rahul", "phone": "+91 98765 43210", "visit_count": 12, "total_spent": 2450.0, "last_order_date": datetime.datetime.utcnow().isoformat(), "notes": "Regular. Likes Filter Coffee strong and sweet." },
      { "id": "c2", "name": "Priya", "phone": "+91 91234 56789", "visit_count": 8, "total_spent": 1920.0, "last_order_date": datetime.datetime.utcnow().isoformat(), "notes": "Prefers mild options, fan of paneer." },
      { "id": "c3", "name": "Amit", "phone": "+91 99887 76655", "visit_count": 3, "total_spent": 450.0, "last_order_date": datetime.datetime.utcnow().isoformat(), "notes": "Prefers table near the window." },
      { "id": "c4", "name": "Sneha", "phone": "+91 97777 88888", "visit_count": 20, "total_spent": 5200.0, "last_order_date": datetime.datetime.utcnow().isoformat(), "notes": "VVIP customer. Prefers organic ingredients." }
    ],
    "orders": [
      {
        "id": "ORD-001041",
        "customer_id": "c1",
        "customer_name": "Rahul",
        "phone": "+91 98765 43210",
        "table_or_type": "Table 4",
        "items": [
          { "menuItemId": "m1", "name": "Masala Dosa", "quantity": 2, "price": 120.0, "unitPrice": 120.0 },
          { "menuItemId": "m4", "name": "Filter Coffee", "quantity": 1, "price": 30.0, "unitPrice": 30.0 }
        ],
        "subtotal": 270.0,
        "tax": 13.5,
        "total": 283.5,
        "status": "completed",
        "created_at": (datetime.datetime.utcnow() - datetime.timedelta(hours=2)).isoformat()
      },
      {
        "id": "ORD-001042",
        "customer_id": "c2",
        "customer_name": "Priya",
        "phone": "+91 91234 56789",
        "table_or_type": "Table 2",
        "items": [
          { "menuItemId": "m2", "name": "Paneer Butter Masala", "quantity": 1, "price": 220.0, "unitPrice": 220.0 },
          { "menuItemId": "m3", "name": "Garlic Naan", "quantity": 2, "price": 40.0, "unitPrice": 40.0 }
        ],
        "subtotal": 300.0,
        "tax": 15.0,
        "total": 315.0,
        "status": "pending",
        "created_at": (datetime.datetime.utcnow() - datetime.timedelta(minutes=15)).isoformat()
      }
    ],
    "expenses": [
      { "id": "f1", "expense_date": (datetime.datetime.utcnow() - datetime.timedelta(days=3)).isoformat(), "category": "Rent", "amount": 12000.00, "description": "Monthly restaurant space rent" },
      { "id": "f2", "expense_date": (datetime.datetime.utcnow() - datetime.timedelta(days=3)).isoformat(), "category": "Salaries", "amount": 8500.00, "description": "Part-time kitchen staff salaries" },
      { "id": "f3", "expense_date": (datetime.datetime.utcnow() - datetime.timedelta(days=3)).isoformat(), "category": "Utilities", "amount": 2350.00, "description": "Electricity and water bills" }
    ],
    "bills": [
      { "id": "b1", "supplier_id": "s1", "supplier_name": "Dairy Craft", "amount": 2800.0, "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat(), "status": "unpaid" },
      { "id": "b2", "supplier_id": "s2", "supplier_name": "Fresh Farms", "amount": 1500.0, "due_date": (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat(), "status": "unpaid" }
    ],
    "chat_history": [
      {
        "id": "msg_init",
        "role": "assistant",
        "content": "I'm your Restaurant AI Agent 🤖\nI can help you with orders, inventory, finance, customers, suppliers, reports and much more.",
        "timestamp": datetime.datetime.now().strftime("%I:%M %p")
      }
    ],
    "notifications": [
      {
        "notification_id": "notif_1",
        "title": "Low Stock Alert",
        "message": "Paneer stock level is below threshold limit (4.2 kg remaining, required 5.0 kg)",
        "type": "warning",
        "status": "unread",
        "created_at": datetime.datetime.utcnow().isoformat(),
        "route": { "agent": "inventory", "action": "restock" }
      }
    ]
}

class DatabaseAgent:
    """
    Abstractions for Supabase Database operations, supplying clean,
    reusable methods for CRUD and join queries with resilient local fallbacks.
    """
    @staticmethod
    async def get_settings() -> Dict[str, Any]:
        try:
            res = supabase.table("settings").select("*").eq("id", "default").execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase get_settings failed, using local mock. Info: {e}")
        return _mock_db["settings"]

    @staticmethod
    async def update_settings(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("settings").upsert({
                "id": "default",
                **data
            }).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase update_settings failed, using local mock. Info: {e}")
        _mock_db["settings"].update(data)
        return _mock_db["settings"]

    @staticmethod
    async def get_menu(search: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            query = supabase.table("menu").select("*")
            if search:
                query = query.ilike("name", f"%{search}%")
            res = query.execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_menu failed, using local mock. Info: {e}")
        
        items = _mock_db["menu"]
        if search:
            items = [item for item in items if search.lower() in item["name"].lower()]
        return items

    @staticmethod
    async def get_menu_item(menu_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = supabase.table("menu").select("*").eq("id", menu_id).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase get_menu_item failed, using local mock. Info: {e}")
        
        for item in _mock_db["menu"]:
            if item["id"] == menu_id:
                return item
        return None

    @staticmethod
    async def update_menu_item(menu_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("menu").update(data).eq("id", menu_id).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase update_menu_item failed, using local mock. Info: {e}")
        
        for item in _mock_db["menu"]:
            if item["id"] == menu_id:
                item.update(data)
                return item
        return {}

    @staticmethod
    async def get_inventory(search: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            res = supabase.table("inventory").select("*, ingredients:ingredients(*)").execute()
            data_list = res.data or []
            
            mapped = []
            for item in data_list:
                ing = item.get("ingredients") or {}
                ing_name = ing.get("name", "Unknown Ingredient")
                
                if search and search.lower() not in ing_name.lower():
                    continue
                    
                mapped.append({
                    "id": item["id"],
                    "ingredientId": item["ingredient_id"],
                    "ingredientName": ing_name,
                    "currentStock": float(item["current_stock"]),
                    "minStockLevel": float(ing.get("min_stock_level", 0.0)),
                    "unitOfMeasure": ing.get("unit_of_measure", "units")
                })
            return mapped
        except Exception as e:
            logger.warn(f"Supabase get_inventory failed, using local mock. Info: {e}")
            
        items = []
        for it in _mock_db["inventory"]:
            if search and search.lower() not in it["name"].lower():
                continue
            items.append({
                "id": it["id"],
                "ingredientId": it["ingredient_id"],
                "ingredientName": it["name"],
                "currentStock": float(it["current_stock"]),
                "minStockLevel": float(it["min_stock_level"]),
                "unitOfMeasure": it["unit_of_measure"]
            })
        return items

    @staticmethod
    async def adjust_inventory(ingredient_id: str, adjustment: float) -> Dict[str, Any]:
        try:
            # Fetch current inventory row
            res = supabase.table("inventory").select("*").eq("ingredient_id", ingredient_id).execute()
            if res.data:
                item = res.data[0]
                new_stock = max(0.0, float(item["current_stock"]) + adjustment)
                
                # Update stock level
                supabase.table("inventory").update({
                    "current_stock": new_stock,
                    "last_updated": datetime.datetime.utcnow().isoformat()
                }).eq("ingredient_id", ingredient_id).execute()
                
                # Retrieve ingredient metadata
                ing_res = supabase.table("ingredients").select("*").eq("id", ingredient_id).execute()
                ing = ing_res.data[0] if ing_res.data else {}
                
                return {
                    "id": item["id"],
                    "ingredientId": ingredient_id,
                    "ingredientName": ing.get("name", "Unknown"),
                    "currentStock": new_stock,
                    "minStockLevel": float(ing.get("min_stock_level", 0.0)),
                    "unitOfMeasure": ing.get("unit_of_measure", "units")
                }
        except Exception as e:
            logger.warn(f"Supabase adjust_inventory failed, using local mock. Info: {e}")
            
        for it in _mock_db["inventory"]:
            if it["ingredient_id"] == ingredient_id or it["id"] == ingredient_id:
                it["current_stock"] = max(0.0, it["current_stock"] + adjustment)
                return {
                    "id": it["id"],
                    "ingredientId": it["ingredient_id"],
                    "ingredientName": it["name"],
                    "currentStock": it["current_stock"],
                    "minStockLevel": it["min_stock_level"],
                    "unitOfMeasure": it["unit_of_measure"]
                }
        return {}

    @staticmethod
    async def get_suppliers(search: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            query = supabase.table("suppliers").select("*")
            if search:
                query = query.or_(f"name.ilike.%{search}%,contact_name.ilike.%{search}%")
            res = query.execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_suppliers failed, using local mock. Info: {e}")
            
        suppliers = _mock_db["suppliers"]
        if search:
            suppliers = [s for s in suppliers if search.lower() in s["name"].lower() or search.lower() in s["contact_name"].lower()]
        return suppliers

    @staticmethod
    async def get_customers(search: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            query = supabase.table("customers").select("*")
            if search:
                query = query.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
            res = query.execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_customers failed, using local mock. Info: {e}")
            
        customers = _mock_db["customers"]
        if search:
            customers = [c for c in customers if search.lower() in c["name"].lower() or search.lower() in c["phone"].lower()]
        return customers

    @staticmethod
    async def add_customer(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("customers").insert({
                "id": f"cust_{int(datetime.datetime.utcnow().timestamp())}",
                "created_at": datetime.datetime.utcnow().isoformat(),
                **data
            }).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase add_customer failed, using local mock. Info: {e}")
            
        new_cust = {
            "id": f"cust_{int(datetime.datetime.utcnow().timestamp())}",
            "name": data.get("name", "Unknown"),
            "phone": data.get("phone", ""),
            "visit_count": int(data.get("visit_count") or 1),
            "total_spent": float(data.get("total_spent") or 0.0),
            "last_order_date": datetime.datetime.utcnow().isoformat(),
            "notes": data.get("notes", "")
        }
        _mock_db["customers"].append(new_cust)
        return new_cust

    @staticmethod
    async def get_orders() -> List[Dict[str, Any]]:
        try:
            res = supabase.table("orders").select("*").order("created_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_orders failed, using local mock. Info: {e}")
        return _mock_db["orders"]

    @staticmethod
    async def create_order(data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("orders").insert(data).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase create_order failed, using local mock. Info: {e}")
            
        _mock_db["orders"].insert(0, data)
        return data

    @staticmethod
    async def update_order(order_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("orders").update(data).eq("id", order_id).execute()
            if res.data:
                return res.data[0]
                
            res = supabase.table("orders").update(data).eq("id", f"ORD-{order_id}").execute()
            if res.data:
                return res.data[0]
                
            res = supabase.table("orders").update(data).eq("id", order_id.lower()).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase update_order failed, using local mock. Info: {e}")
            
        for o in _mock_db["orders"]:
            if o["id"] == order_id or o["id"] == f"ORD-{order_id}" or o["id"].lower() == order_id.lower() or o["id"].replace("ord_", "") == order_id:
                o.update(data)
                return o
        return {}

    @staticmethod
    async def get_bills() -> List[Dict[str, Any]]:
        try:
            res = supabase.table("bills").select("*").execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_bills failed, using local mock. Info: {e}")
        return _mock_db["bills"]

    @staticmethod
    async def get_expenses() -> List[Dict[str, Any]]:
        try:
            res = supabase.table("expenses").select("*").execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_expenses failed, using local mock. Info: {e}")
        return _mock_db["expenses"]

    @staticmethod
    async def get_chat_history() -> List[Dict[str, Any]]:
        try:
            res = supabase.table("chat_history").select("*").order("timestamp", desc=False).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_chat_history failed, using local mock. Info: {e}")
        return _mock_db["chat_history"]

    @staticmethod
    async def add_chat_message(msg: Dict[str, Any]) -> Dict[str, Any]:
        try:
            res = supabase.table("chat_history").insert(msg).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase add_chat_message failed, using local mock. Info: {e}")
            
        _mock_db["chat_history"].append(msg)
        return msg

    @staticmethod
    async def clear_chat_history() -> List[Dict[str, Any]]:
        default_msg = {
            "id": "msg_init",
            "role": "assistant",
            "content": "I'm your Restaurant AI Agent 🤖\nI can help you with orders, inventory, finance, customers, suppliers, reports and much more.",
            "timestamp": datetime.datetime.now().strftime("%I:%M %p")
        }
        try:
            supabase.table("chat_history").delete().neq("id", "keep_empty_clause").execute()
            res = supabase.table("chat_history").insert(default_msg).execute()
            if res.data:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase clear_chat_history failed, using local mock. Info: {e}")
            
        _mock_db["chat_history"] = [default_msg]
        return _mock_db["chat_history"]

    @staticmethod
    async def get_notifications() -> List[Dict[str, Any]]:
        try:
            res = supabase.table("notifications").select("*").order("created_at", desc=True).execute()
            if res.data is not None:
                return res.data
        except Exception as e:
            logger.warn(f"Supabase get_notifications failed, using local mock. Info: {e}")
        return _mock_db["notifications"]

    @staticmethod
    async def mark_notifications_read() -> None:
        try:
            supabase.table("notifications").update({"status": "read"}).eq("status", "unread").execute()
            return
        except Exception as e:
            logger.warn(f"Supabase mark_notifications_read failed, using local mock. Info: {e}")
            
        for n in _mock_db["notifications"]:
            n["status"] = "read"

    @staticmethod
    async def mark_single_notification_read(notif_id: str) -> Optional[Dict[str, Any]]:
        try:
            res = supabase.table("notifications").update({"status": "read"}).eq("notification_id", notif_id).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            logger.warn(f"Supabase mark_single_notification_read failed, using local mock. Info: {e}")
            
        for n in _mock_db["notifications"]:
            if n["notification_id"] == notif_id:
                n["status"] = "read"
                return n
        return None
