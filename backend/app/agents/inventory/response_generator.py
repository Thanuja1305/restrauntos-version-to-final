import json
from typing import Dict, Any
import google.generativeai as genai

from backend.app.agents.inventory.config import settings
from backend.app.agents.inventory.constants import Intent
from backend.app.agents.inventory.prompts import RESPONSE_SYNTHESIS_PROMPT
from backend.app.agents.inventory.logger import logger

class ResponseGenerator:
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
                logger.error(f"Failed to initialize Gemini for ResponseGenerator: {e}")
                self.use_llm = False

    async def generate(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generates natural language summary and action items."""
        intent = state.get("intent")
        business_results = state.get("business_results", {})
        query = state.get("inventory_query")

        if self.use_llm:
            try:
                prompt = (
                    f"{RESPONSE_SYNTHESIS_PROMPT}\n\n"
                    f"User Query: \"{query}\"\n"
                    f"Intent: {intent}\n"
                    f"Business Results: {json.dumps(business_results)}\n\n"
                    f"Return JSON output:"
                )
                response = self.model.generate_content(prompt)
                data = json.loads(response.text.strip())
                logger.info(f"LLM Generated Summary: {data}")
                return data
            except Exception as e:
                logger.error(f"LLM summary generation failed, using rule-based generator: {e}")

        return self._generate_rule_based(intent, business_results)

    def _generate_rule_based(self, intent: str, business_results: Dict[str, Any]) -> Dict[str, Any]:
        """Provides fallback human-readable responses based on the intent and calculations."""
        summary = ""
        suggestions = []

        if intent == Intent.STOCK_LOOKUP:
            items = business_results.get("items", [])
            if not items:
                summary = "I could not find any inventory items matching that name in the database."
                suggestions.append("Check spelling or verify if the ingredient was registered.")
            else:
                summary_parts = []
                for item in items:
                    name = item.get("ingredient_name")
                    qty = item.get("quantity")
                    unit = item.get("unit")
                    summary_parts.append(f"{name}: {qty} {unit}")
                summary = f"Current stock levels: {', '.join(summary_parts)}."
                suggestions.append("Keep monitoring stock levels periodically.")

        elif intent == Intent.LOW_STOCK:
            items = business_results.get("low_stock_items", [])
            count = len(items)
            if count == 0:
                summary = "All ingredients are currently above safety stock levels. No low stock items detected."
            else:
                names = [item.get("ingredient_name") for item in items]
                summary = f"Warning: There are {count} items running low on stock: {', '.join(names)}."
                suggestions.append("Create purchase orders to replenish low-stock ingredients.")

        elif intent == Intent.OUT_OF_STOCK:
            items = business_results.get("out_of_stock_items", [])
            count = len(items)
            if count == 0:
                summary = "Great news! No ingredients are currently out of stock."
            else:
                names = [item.get("ingredient_name") for item in items]
                summary = f"Critical Alert: The following {count} items are completely out of stock: {', '.join(names)}."
                suggestions.append("Reorder immediately to avoid service disruption.")

        elif intent == Intent.SUPPLIER_LOOKUP:
            suppliers = business_results.get("suppliers", [])
            if not suppliers:
                summary = "I could not find any supplier matching that description."
            else:
                names = [s.get("name") for s in suppliers]
                summary = f"Found supplier details for: {', '.join(names)}."
                suggestions.append("Verify active contact phone/email for purchase orders.")

        elif intent == Intent.INVENTORY_VALUE:
            val = business_results.get("value", {})
            total = val.get("total_value", 0.0)
            summary = f"The total cost value of all inventory currently stored is ${total:,.2f}."
            suggestions.append("Compare inventory cost with monthly budget parameters.")

        elif intent == Intent.EXPIRY_TRACKING:
            expiring = business_results.get("expiring_items", [])
            count = len(expiring)
            if count == 0:
                summary = "No ingredients are expiring within the next warning period."
            else:
                parts = [f"{e.get('ingredient_name')} (Expiry: {e.get('expiry_date')})" for e in expiring]
                summary = f"Attention: There are {count} expiring batches: {', '.join(parts)}."
                suggestions.append("Prioritize utilizing expiring batches first (FIFO).")
        
        else:
            summary = "Inventory database query executed successfully. Check the structured data for details."

        return {
            "summary": summary,
            "dashboard_suggestions": suggestions
        }
