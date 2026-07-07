from typing import List, Dict, Any, Optional
from backend.app.agents.database_agent import DatabaseAgent

class InventoryAgent:
    """
    Manages stock levels, low-stock detection, and warehouse adjustments.
    """
    @staticmethod
    async def get_inventory(search: Optional[str] = None) -> List[Dict[str, Any]]:
        return await DatabaseAgent.get_inventory(search)

    @staticmethod
    async def adjust_stock(ingredient_id: str, adjustment: float) -> Dict[str, Any]:
        return await DatabaseAgent.adjust_inventory(ingredient_id, adjustment)

    @staticmethod
    async def get_low_stock_items() -> List[Dict[str, Any]]:
        inventory = await DatabaseAgent.get_inventory()
        return [
            item for item in inventory
            if item["currentStock"] < item["minStockLevel"]
        ]
