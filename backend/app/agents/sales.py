import datetime
from typing import List, Dict, Any, Optional
from backend.app.agents.database_agent import DatabaseAgent

class SalesAgent:
    """
    Manages customer orders, transactions, and sales metrics.
    """
    @staticmethod
    async def get_orders() -> List[Dict[str, Any]]:
        return await DatabaseAgent.get_orders()

    @staticmethod
    async def get_today_sales_summary() -> Dict[str, Any]:
        orders = await DatabaseAgent.get_orders()
        
        # Filter completed orders for today
        today = datetime.date.today().isoformat()
        today_completed = [
            o for o in orders 
            if o.get("status") == "completed" and o.get("created_at", "").startswith(today)
        ]
        
        total_rev = sum(float(o.get("total", 0.0)) for o in today_completed)
        count = len(today_completed)
        aov = round(total_rev / count, 2) if count > 0 else 0.0
        
        return {
            "totalOrders": count,
            "totalRevenue": total_rev,
            "averageOrderValue": aov,
            "currency": "₹"
        }

    @staticmethod
    async def create_order(customer_id: Optional[str], customer_name: Optional[str], items: List[Dict[str, Any]], discount: float, user_id: str) -> Dict[str, Any]:
        # Perform calculations
        subtotal = sum(float(item["quantity"]) * float(item["unitPrice"]) for item in items)
        tax_rate = 5.0  # default 5%
        tax = round(subtotal * (tax_rate / 100.0), 2)
        total = round(subtotal + tax - discount, 2)
        
        order_id = f"ord_{int(datetime.datetime.utcnow().timestamp())}"
        order_data = {
            "id": order_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "user_id": user_id,
            "server_name": "AI System Gate",
            "status": "pending",
            "subtotal": subtotal,
            "tax": tax,
            "discount": discount,
            "total": total,
            "items": items,
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        
        return await DatabaseAgent.create_order(order_data)
class SalesAgentLegacy:
    pass
