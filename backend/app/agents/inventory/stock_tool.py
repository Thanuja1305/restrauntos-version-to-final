import datetime
from typing import List, Dict, Any, Optional
from backend.app.agents.inventory.repository import InventoryRepository
from backend.app.agents.inventory.inventory_rules import InventoryRulesEngine

class StockTool:
    def __init__(self, repo: InventoryRepository):
        self.repo = repo

    async def getForecast(self, restaurant_id: str, ingredient_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves demand forecasts for ingredients or projects them based on consumption."""
        if not ingredient_name:
            return []
            
        ingredient = await self.repo.get_ingredient_by_name(restaurant_id, ingredient_name)
        if not ingredient:
            return []

        forecasts = await self.repo.get_forecasts_by_ingredient(restaurant_id, ingredient.id)
        if forecasts:
            return [{
                "ingredient_name": ingredient.name,
                "forecast_date": f.forecast_date.isoformat(),
                "predicted_demand": f.predicted_demand,
                "confidence": f.confidence
            } for f in forecasts]
            
        # If no DB records exist, project based on stock level and simple consumption
        inventory = await self.repo.get_inventory_by_ingredient(restaurant_id, ingredient.id)
        if inventory:
            # Let's project standard demand for the next 3 days
            today = datetime.date.today()
            projected = []
            for i in range(1, 4):
                future_date = today + datetime.timedelta(days=i)
                # Average default daily usage is safety_stock or a fraction of current stock
                avg_usage = max(2.0, inventory.safety_stock * 0.5)
                projected.append({
                    "ingredient_name": ingredient.name,
                    "forecast_date": future_date.isoformat(),
                    "predicted_demand": avg_usage,
                    "confidence": 0.7
                })
            return projected

        return []
