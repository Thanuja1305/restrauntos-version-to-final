import datetime
from typing import Dict, Any
from backend.app.agents.inventory.state import InventoryAgentState

class ContextBuilder:
    @staticmethod
    async def build(state: InventoryAgentState) -> Dict[str, Any]:
        """
        Gathers configuration metadata, default warning margins,
        and currency symbols, adding them to the execution state context.
        """
        # Load from shared_context or use defaults
        shared = state.get("metadata", {})
        
        context = {
            "restaurant_id": state["restaurant_id"],
            "user_role": state.get("user_role", "staff"),
            "timezone": shared.get("timezone", "UTC"),
            "currency": shared.get("currency", "USD"),
            "fiscal_year_start": "01-01",
            "low_stock_warning_threshold": shared.get("low_stock_warning_threshold", 5.0),
            "expiry_warning_days": shared.get("expiry_warning_days", 7),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
        return context
