import json
import re
from typing import Dict, Any, Tuple
import google.generativeai as genai

from backend.app.agents.inventory.config import settings
from backend.app.agents.inventory.constants import Intent, ErrorCode
from backend.app.agents.inventory.prompts import INTENT_CLASSIFICATION_SYSTEM_PROMPT
from backend.app.agents.inventory.logger import logger

class IntentEngine:
    def __init__(self):
        self.use_llm = bool(settings.GEMINI_API_KEY)
        if self.use_llm:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"response_mime_type": "application/json"}
                )
                logger.info("Gemini Intent Engine initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini. Using rule-based fallback. Error: {e}")
                self.use_llm = False
        else:
            logger.info("No GEMINI_API_KEY provided. Using rule-based Intent Engine.")

    async def classify(self, query: str) -> Dict[str, Any]:
        """Classifies the natural language query and extracts entities."""
        query_lower = query.lower()
        
        # 1. Try LLM Classification if enabled
        if self.use_llm:
            try:
                prompt = f"{INTENT_CLASSIFICATION_SYSTEM_PROMPT}\n\nUser Query: \"{query}\"\n\nReturn JSON output:"
                response = self.model.generate_content(prompt)
                data = json.loads(response.text.strip())
                logger.info(f"LLM Classification Result: {data}")
                return data
            except Exception as e:
                logger.error(f"LLM Classification failed, falling back to rules: {e}")

        # 2. Rule-based Fallback Classification
        return self._classify_rule_based(query_lower)

    def _classify_rule_based(self, query: str) -> Dict[str, Any]:
        """A deterministic keyword-based classifier used as a backup or for testing."""
        intent = Intent.STOCK_LOOKUP
        confidence = 0.8
        entities: Dict[str, Any] = {
            "ingredient_name": None,
            "supplier_name": None,
            "date_range": {"start": None, "end": None},
            "limit": None
        }
        handoff_required = False
        target_agent = None

        # Detect non-inventory domains for Handoff
        sales_keywords = ["sell", "revenue", "sales", "order menu", "customer order", "popular dishes"]
        finance_keywords = ["profit", "expense", "bill", "invoice", "payment", "revenue margin"]
        support_keywords = ["complain", "refund", "ticket", "issue", "delivery status", "support"]

        if any(kw in query for kw in sales_keywords):
            handoff_required = True
            target_agent = "sales"
            intent = "Handoff"
        elif any(kw in query for kw in finance_keywords):
            handoff_required = True
            target_agent = "finance"
            intent = "Handoff"
        elif any(kw in query for kw in support_keywords):
            handoff_required = True
            target_agent = "support"
            intent = "Handoff"
        # Inventory Intents
        elif "low" in query or "running low" in query or "reorder" in query or "below" in query:
            intent = Intent.LOW_STOCK
        elif "out" in query or "empty" in query or "zero stock" in query:
            intent = Intent.OUT_OF_STOCK
        elif "supplier" in query or "vendor" in query or "distributor" in query:
            intent = Intent.SUPPLIER_LOOKUP
        elif "purchase history" in query or "ordered history" in query or "purchases" in query:
            intent = Intent.PURCHASE_HISTORY
        elif "consume" in query or "usage" in query or "consumption" in query:
            intent = Intent.CONSUMPTION
        elif "forecast" in query or "predict" in query or "future demand" in query:
            intent = Intent.FORECAST
        elif "valuation" in query or "inventory value" in query or "cost value" in query:
            intent = Intent.INVENTORY_VALUE
        elif "movement" in query or "transaction" in query or "adjust" in query:
            intent = Intent.INVENTORY_MOVEMENT
        elif "expire" in query or "expiry" in query or "expired" in query:
            intent = Intent.EXPIRY_TRACKING
        elif "report" in query or "analytics summary" in query:
            intent = Intent.INVENTORY_REPORT
        elif "waste" in query or "spoilage" in query or "wastage" in query:
            intent = Intent.WASTAGE_ANALYSIS

        # Simple entity extraction
        for ing in ["tomato", "cheese", "milk"]:
            if ing in query:
                entities["ingredient_name"] = ing
                break

        if not entities["ingredient_name"]:
            # Look for ingredient names after "stock of" or "for"
            match_ingredient = re.search(r'(?:stock of|for|check)\s+([a-zA-Z\s]+)', query)
            if match_ingredient:
                possible_name = match_ingredient.group(1).strip()
                # Clean up common filler words
                possible_name = re.sub(r'\b(the|is|are|a|an|stock|levels|level)\b', '', possible_name).strip()
                if possible_name:
                    entities["ingredient_name"] = possible_name

        # Look for supplier names after "supplier" or "vendor"
        match_supplier = re.search(r'(?:supplier|vendor)\s+([a-zA-Z\s]+)', query)
        if match_supplier:
            possible_supplier = match_supplier.group(1).strip()
            possible_supplier = re.sub(r'\b(name|is|called|called)\b', '', possible_supplier).strip()
            if possible_supplier:
                entities["supplier_name"] = possible_supplier

        return {
            "intent": intent,
            "confidence": confidence,
            "entities": entities,
            "handoff_required": handoff_required,
            "target_agent": target_agent
        }
