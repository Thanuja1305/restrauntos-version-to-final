import json
from typing import Dict, Any, List
import google.generativeai as genai

from backend.app.agents.inventory.config import settings
from backend.app.agents.inventory.constants import Intent
from backend.app.agents.inventory.prompts import PLANNER_SYSTEM_PROMPT
from backend.app.agents.inventory.logger import logger

class StockPlanner:
    def __init__(self):
        self.use_llm = bool(settings.GEMINI_API_KEY)
        if self.use_llm:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"response_mime_type": "application/json"}
                )
            except Exception as e:
                logger.error(f"Failed to initialize Gemini for Planner: {e}")
                self.use_llm = False

    async def generate_plan(self, intent: str, entities: Dict[str, Any], query: str) -> Dict[str, Any]:
        """Generates a list of steps indicating tools and methods to execute."""
        if self.use_llm:
            try:
                prompt = f"{PLANNER_SYSTEM_PROMPT}\n\nIntent: \"{intent}\"\nEntities: {json.dumps(entities)}\nQuery: \"{query}\"\n\nReturn JSON output:"
                response = self.model.generate_content(prompt)
                plan = json.loads(response.text.strip())
                logger.info(f"LLM Generated Plan: {plan}")
                return plan
            except Exception as e:
                logger.error(f"LLM planning failed, falling back to static planner: {e}")
                
        return self._generate_rule_based_plan(intent, entities)

    def _generate_rule_based_plan(self, intent: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Maps intents to standard tools and parameters deterministically."""
        steps = []
        reasoning = f"Generated deterministic plan for intent: {intent}"
        
        ingredient_name = entities.get("ingredient_name")
        supplier_name = entities.get("supplier_name")
        limit = entities.get("limit") or 20

        if intent == Intent.STOCK_LOOKUP:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getCurrentStock",
                "params": {"ingredient_name": ingredient_name}
            })
        elif intent == Intent.LOW_STOCK:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getLowStockItems",
                "params": {}
            })
        elif intent == Intent.OUT_OF_STOCK:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getOutOfStockItems",
                "params": {}
            })
        elif intent == Intent.SUPPLIER_LOOKUP:
            steps.append({
                "step_id": 1,
                "tool": "SupplierTool",
                "method": "getSupplier",
                "params": {"supplier_name": supplier_name}
            })
        elif intent == Intent.PURCHASE_HISTORY:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getPurchaseHistory",
                "params": {"limit": limit}
            })
        elif intent == Intent.CONSUMPTION:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getStockMovements",
                "params": {"limit": limit}
            })
        elif intent == Intent.FORECAST:
            steps.append({
                "step_id": 1,
                "tool": "StockTool",
                "method": "getForecast",
                "params": {"ingredient_name": ingredient_name}
            })
        elif intent == Intent.INVENTORY_VALUE:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getInventoryValue",
                "params": {}
            })
        elif intent == Intent.INVENTORY_MOVEMENT:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getStockMovements",
                "params": {"limit": limit}
            })
        elif intent == Intent.EXPIRY_TRACKING:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getExpiringItems",
                "params": {"days_threshold": 7}
            })
        elif intent == Intent.REORDER_SUGGESTION:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getLowStockItems",
                "params": {}
            })
            steps.append({
                "step_id": 2,
                "tool": "SupplierTool",
                "method": "getSuppliers",
                "params": {}
            })
        elif intent == Intent.INVENTORY_REPORT:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getInventoryValue",
                "params": {}
            })
            steps.append({
                "step_id": 2,
                "tool": "InventorySQLTool",
                "method": "getLowStockItems",
                "params": {}
            })
        elif intent == Intent.WASTAGE_ANALYSIS:
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getStockMovements",
                "params": {"limit": 50}
            })
        else:
            # Fallback Stock lookup
            steps.append({
                "step_id": 1,
                "tool": "InventorySQLTool",
                "method": "getCurrentStock",
                "params": {}
            })

        return {
            "steps": steps,
            "reasoning": reasoning
        }
