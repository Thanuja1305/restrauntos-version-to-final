from typing import List, Dict, Any, Optional
from backend.app.agents.inventory.repository import InventoryRepository

class InventorySQLTool:
    def __init__(self, repo: InventoryRepository):
        self.repo = repo

    async def getCurrentStock(self, restaurant_id: str, ingredient_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves stock information. Filters by ingredient name if provided."""
        if ingredient_name:
            item = await self.repo.get_inventory_by_ingredient_name(restaurant_id, ingredient_name)
            if not item:
                return []
            return [{
                "id": item.id,
                "ingredient_id": item.ingredient_id,
                "ingredient_name": item.ingredient.name,
                "quantity": item.quantity,
                "safety_stock": item.safety_stock,
                "reorder_point": item.reorder_point,
                "cost_per_unit": item.cost_per_unit,
                "unit": item.ingredient.unit,
                "location": item.location,
                "last_updated": item.last_updated.isoformat()
            }]
        else:
            items = await self.repo.get_inventory_by_restaurant(restaurant_id)
            return [{
                "id": item.id,
                "ingredient_id": item.ingredient_id,
                "ingredient_name": item.ingredient.name,
                "quantity": item.quantity,
                "safety_stock": item.safety_stock,
                "reorder_point": item.reorder_point,
                "cost_per_unit": item.cost_per_unit,
                "unit": item.ingredient.unit,
                "location": item.location,
                "last_updated": item.last_updated.isoformat()
            } for item in items]

    async def getLowStockItems(self, restaurant_id: str) -> List[Dict[str, Any]]:
        """Retrieves items below their defined reorder point."""
        items = await self.repo.get_low_stock_items(restaurant_id)
        return [{
            "id": item.id,
            "ingredient_name": item.ingredient.name,
            "quantity": item.quantity,
            "reorder_point": item.reorder_point,
            "unit": item.ingredient.unit,
            "cost_per_unit": item.cost_per_unit
        } for item in items]

    async def getOutOfStockItems(self, restaurant_id: str) -> List[Dict[str, Any]]:
        """Retrieves items that are completely out of stock."""
        items = await self.repo.get_out_of_stock_items(restaurant_id)
        return [{
            "id": item.id,
            "ingredient_name": item.ingredient.name,
            "quantity": item.quantity,
            "unit": item.ingredient.unit,
            "cost_per_unit": item.cost_per_unit
        } for item in items]

    async def getPurchaseHistory(self, restaurant_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves supplier purchase order history."""
        orders = await self.repo.get_purchase_orders(restaurant_id, limit)
        result = []
        for order in orders:
            result.append({
                "purchase_order_id": order.id,
                "supplier_name": order.supplier.name,
                "status": order.status,
                "total_amount": order.total_amount,
                "order_date": order.order_date.isoformat(),
                "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
                "items": [{
                    "ingredient_name": item.ingredient.name,
                    "quantity": item.quantity,
                    "unit_cost": item.unit_cost
                } for item in order.items]
            })
        return result

    async def getStockMovements(self, restaurant_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves historical stock changes (IN/OUT/ADJUST logs)."""
        txns = await self.repo.get_stock_movements(restaurant_id, limit)
        return [{
            "transaction_id": txn.id,
            "ingredient_name": txn.inventory.ingredient.name,
            "type": txn.type,
            "quantity": txn.quantity,
            "reference_id": txn.reference_id,
            "timestamp": txn.timestamp.isoformat()
        } for txn in txns]

    async def getExpiringItems(self, restaurant_id: str, days_threshold: int = 7) -> List[Dict[str, Any]]:
        """Retrieves batches of ingredients close to their expiration date."""
        records = await self.repo.get_expiring_items(restaurant_id, days_threshold)
        return [{
            "id": r.id,
            "ingredient_name": r.inventory.ingredient.name,
            "batch_number": r.batch_number,
            "expiry_date": r.expiry_date.isoformat(),
            "quantity": r.quantity,
            "status": r.status
        } for r in records]

    async def getInventoryValue(self, restaurant_id: str) -> Dict[str, Any]:
        """Calculates total valuation for all current inventory items."""
        items = await self.getCurrentStock(restaurant_id)
        total_value = sum(item["quantity"] * item["cost_per_unit"] for item in items)
        return {
            "total_value": round(total_value, 2),
            "item_count": len(items)
        }
