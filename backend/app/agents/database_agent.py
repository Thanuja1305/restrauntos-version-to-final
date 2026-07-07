import datetime
from typing import List, Dict, Any, Optional
from backend.app.supabase_client import supabase
from backend.app.logger import logger

class DatabaseAgent:
    """
    Abstractions for Supabase Database operations, supplying clean,
    reusable methods for CRUD and join queries.
    """
    @staticmethod
    async def get_settings() -> Dict[str, Any]:
        res = supabase.table("settings").select("*").eq("id", "default").execute()
        if res.data:
            return res.data[0]
        # Return default if not found
        return {
            "restaurant_name": "Spice Heaven",
            "address": "23 Green Street, Hitech City, Hyderabad - 500081",
            "gstin": "36ABCDE1234F1Z5",
            "fssai": "13620012000456",
            "tax_rate": 5.0,
            "currency": "₹"
        }

    @staticmethod
    async def update_settings(data: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("settings").upsert({
            "id": "default",
            **data
        }).execute()
        return res.data[0] if res.data else {}

    @staticmethod
    async def get_menu(search: Optional[str] = None) -> List[Dict[str, Any]]:
        query = supabase.table("menu").select("*")
        if search:
            query = query.ilike("name", f"%{search}%")
        res = query.execute()
        return res.data or []

    @staticmethod
    async def get_menu_item(menu_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("menu").select("*").eq("id", menu_id).execute()
        return res.data[0] if res.data else None

    @staticmethod
    async def update_menu_item(menu_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("menu").update(data).eq("id", menu_id).execute()
        return res.data[0] if res.data else {}

    @staticmethod
    async def get_inventory(search: Optional[str] = None) -> List[Dict[str, Any]]:
        # Fetch inventory joined with ingredients
        res = supabase.table("inventory").select("*, ingredients:ingredients(*)").execute()
        data_list = res.data or []
        
        mapped = []
        for item in data_list:
            ing = item.get("ingredients") or {}
            ing_name = ing.get("name", "Unknown Ingredient")
            
            # Filter if search query is provided
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

    @staticmethod
    async def adjust_inventory(ingredient_id: str, adjustment: float) -> Dict[str, Any]:
        # 1. Fetch current inventory row
        res = supabase.table("inventory").select("*").eq("ingredient_id", ingredient_id).execute()
        if not res.data:
            raise Exception("Inventory record not found")
        
        item = res.data[0]
        new_stock = max(0.0, float(item["current_stock"]) + adjustment)
        
        # 2. Update stock level
        upd = supabase.table("inventory").update({
            "current_stock": new_stock,
            "last_updated": datetime.datetime.utcnow().isoformat()
        }).eq("ingredient_id", ingredient_id).execute()
        
        # 3. Retrieve ingredient metadata
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

    @staticmethod
    async def get_suppliers(search: Optional[str] = None) -> List[Dict[str, Any]]:
        query = supabase.table("suppliers").select("*")
        if search:
            query = query.or_(f"name.ilike.%{search}%,contact_name.ilike.%{search}%")
        res = query.execute()
        return res.data or []

    @staticmethod
    async def get_customers(search: Optional[str] = None) -> List[Dict[str, Any]]:
        query = supabase.table("customers").select("*")
        if search:
            query = query.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%")
        res = query.execute()
        return res.data or []

    @staticmethod
    async def add_customer(data: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("customers").insert({
            "id": f"cust_{int(datetime.datetime.utcnow().timestamp())}",
            "created_at": datetime.datetime.utcnow().isoformat(),
            **data
        }).execute()
        return res.data[0] if res.data else {}

    @staticmethod
    async def get_orders() -> List[Dict[str, Any]]:
        res = supabase.table("orders").select("*").order("created_at", desc=True).execute()
        return res.data or []

    @staticmethod
    async def create_order(data: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("orders").insert(data).execute()
        return res.data[0] if res.data else {}

    @staticmethod
    async def get_bills() -> List[Dict[str, Any]]:
        res = supabase.table("bills").select("*").execute()
        return res.data or []

    @staticmethod
    async def get_expenses() -> List[Dict[str, Any]]:
        res = supabase.table("expenses").select("*").execute()
        return res.data or []

    @staticmethod
    async def get_chat_history() -> List[Dict[str, Any]]:
        res = supabase.table("chat_history").select("*").order("timestamp", desc=False).execute()
        return res.data or []

    @staticmethod
    async def add_chat_message(msg: Dict[str, Any]) -> Dict[str, Any]:
        res = supabase.table("chat_history").insert(msg).execute()
        return res.data[0] if res.data else {}

    @staticmethod
    async def clear_chat_history() -> List[Dict[str, Any]]:
        # Delete all messages and seed default message
        supabase.table("chat_history").delete().neq("id", "keep_empty_clause").execute()
        default_msg = {
            "id": "msg_init",
            "role": "assistant",
            "content": "I'm your Restaurant AI Agent 🤖\nI can help you with orders, inventory, finance, customers, suppliers, reports and much more.",
            "timestamp": datetime.datetime.now().strftime("%I:%M %p")
        }
        res = supabase.table("chat_history").insert(default_msg).execute()
        return [default_msg]

    @staticmethod
    async def get_notifications() -> List[Dict[str, Any]]:
        res = supabase.table("notifications").select("*").order("created_at", desc=True).execute()
        return res.data or []

    @staticmethod
    async def mark_notifications_read() -> None:
        supabase.table("notifications").update({"status": "read"}).eq("status", "unread").execute()
        
    @staticmethod
    async def mark_single_notification_read(notif_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("notifications").update({"status": "read"}).eq("notification_id", notif_id).execute()
        return res.data[0] if res.data else None
