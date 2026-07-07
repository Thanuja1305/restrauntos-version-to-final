import datetime
from typing import List, Dict, Any, Optional

class InventoryRulesEngine:
    @staticmethod
    def is_low_stock(quantity: float, reorder_point: float) -> bool:
        """Item is low stock if quantity is less than or equal to the reorder point."""
        return quantity <= reorder_point

    @staticmethod
    def is_out_of_stock(quantity: float) -> bool:
        """Item is out of stock if quantity is zero or less."""
        return quantity <= 0.0

    @staticmethod
    def calculate_item_value(quantity: float, cost_per_unit: float) -> float:
        """Calculate the total valuation of a single inventory item."""
        return max(0.0, quantity * cost_per_unit)

    @staticmethod
    def calculate_total_inventory_value(items: List[Dict[str, Any]]) -> float:
        """
        Calculate total valuation across all inventory items.
        Expected items format: [{"quantity": 10.0, "cost_per_unit": 2.5}, ...]
        """
        total = 0.0
        for item in items:
            total += InventoryRulesEngine.calculate_item_value(item.get("quantity", 0.0), item.get("cost_per_unit", 0.0))
        return round(total, 2)

    @staticmethod
    def calculate_safety_stock(
        max_daily_usage: float, max_lead_time_days: int, avg_daily_usage: float, avg_lead_time_days: int
    ) -> float:
        """
        Safety Stock Formula: (Max Daily Usage * Max Lead Time) - (Avg Daily Usage * Avg Lead Time)
        """
        max_limit = max_daily_usage * max_lead_time_days
        avg_limit = avg_daily_usage * avg_lead_time_days
        return max(0.0, max_limit - avg_limit)

    @staticmethod
    def calculate_reorder_point(safety_stock: float, avg_daily_usage: float, lead_time_days: int) -> float:
        """
        Reorder Point Formula: Safety Stock + (Avg Daily Usage * Lead Time)
        """
        return safety_stock + (avg_daily_usage * lead_time_days)

    @staticmethod
    def determine_expiry_status(expiry_date: datetime.date, warning_days: int = 7) -> str:
        """
        Determines expiry alert level.
        Returns: "EXPIRED" if date is past, "WARNING" if within warning_days, otherwise "SAFE".
        """
        today = datetime.date.today()
        if expiry_date < today:
            return "EXPIRED"
        elif expiry_date <= today + datetime.timedelta(days=warning_days):
            return "WARNING"
        return "SAFE"

    @staticmethod
    def validate_purchase_item(quantity: float, unit_cost: float) -> bool:
        """Validates that purchase order parameters are realistic and positive."""
        return quantity > 0.0 and unit_cost >= 0.0

    @staticmethod
    def calculate_inventory_turnover(cost_of_goods_sold: float, beginning_inventory: float, ending_inventory: float) -> float:
        """
        Turnover Formula: COGS / Average Inventory Value
        """
        avg_inventory = (beginning_inventory + ending_inventory) / 2.0
        if avg_inventory <= 0.0:
            return 0.0
        return round(cost_of_goods_sold / avg_inventory, 2)
