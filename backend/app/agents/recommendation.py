from typing import List, Dict, Any
from backend.app.agents.database_agent import DatabaseAgent

class RecommendationAgent:
    """
    Formulates operational suggestions, replenishment requests,
    and menu pricing recommendations based on current database states.
    """
    @staticmethod
    async def get_replenishment_suggestions() -> List[Dict[str, Any]]:
        inventory = await DatabaseAgent.get_inventory()
        suggestions = []
        for item in inventory:
            current = item["currentStock"]
            min_lvl = item["minStockLevel"]
            if current < min_lvl:
                # Suggest reordering twice the min stock level minus current stock
                suggested_qty = max(10.0, (min_lvl * 2.0) - current)
                suggestions.append({
                    "ingredient_id": item["ingredientId"],
                    "ingredient_name": item["ingredientName"],
                    "current_stock": current,
                    "min_stock_level": min_lvl,
                    "suggested_order_quantity": round(suggested_qty, 2),
                    "unit": item["unitOfMeasure"]
                })
        return suggestions
