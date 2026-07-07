import json
import datetime
from typing import Dict, Any, List, Optional
from google import genai

from backend.app.config import settings
from backend.app.agents.database_agent import DatabaseAgent
from backend.app.agents.sales import SalesAgent
from backend.app.agents.inventory import InventoryAgent
from backend.app.logger import logger

class OrchestratorAgent:
    """
    Central router of the RestaurantOS AI system. Parses messages,
    attaches context, delegates queries, and handles Gemini GenAI reasoning.
    """
    @staticmethod
    async def process_chat_query(message: str, user_id: str) -> Dict[str, Any]:
        normalized_query = message.lower().strip()
        
        # 1. Gather real-time database stats
        settings_data = await DatabaseAgent.get_settings()
        orders = await DatabaseAgent.get_orders()
        
        # Completed orders counts
        completed_orders = [o for o in orders if o.get("status") == "completed"]
        today = datetime.date.today().isoformat()
        today_completed = [
            o for o in completed_orders 
            if o.get("created_at", "").startswith(today)
        ]
        
        today_rev = sum(float(o.get("total", 0.0)) for o in today_completed)
        today_count = len(today_completed)
        today_aov = round(today_rev / today_count, 2) if today_count > 0 else 0.0
        
        # 2. Intent detection & attachment compiler
        attachment_type: Optional[str] = None
        attachment_data: Any = None
        
        if any(kw in normalized_query for kw in ["sales summary", "revenue today", "today's sales"]):
            attachment_type = "sales_summary"
            attachment_data = {
                "totalOrders": today_count,
                "totalRevenue": today_rev,
                "averageOrderValue": today_aov,
                "topSellingItem": "Masala Dosa (18)"
            }
        elif any(kw in normalized_query for kw in ["low stock", "stock warning", "low-stock"]):
            attachment_type = "low_stock"
            low_items = await InventoryAgent.get_low_stock_items()
            attachment_data = [
                {
                    "name": item["ingredientName"],
                    "stock": f"{item['currentStock']} {item['unitOfMeasure']}"
                } for item in low_items
            ]
        elif any(kw in normalized_query for kw in ["recent orders", "last orders"]):
            attachment_type = "recent_orders"
            # Return last 5 orders
            attachment_data = [
                {
                    "id": o["id"],
                    "customer": o.get("customer_name") or "Walk-in Guest",
                    "total": float(o.get("total", 0.0)),
                    "status": o.get("status", "pending")
                } for o in orders[:5]
            ]

        # 3. LLM Content Generation (using new google-genai SDK if key exists)
        agent_response_text = ""
        has_gemini = bool(settings.GEMINI_API_KEY) and settings.GEMINI_API_KEY != "MY_GEMINI_API_KEY"

        if has_gemini:
            try:
                # Initialize Google GenAI client
                ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
                
                # Fetch low stock raw details for prompt
                low_items = await InventoryAgent.get_low_stock_items()
                
                context_prompt = (
                    f"You are the RestaurantOS AI Agent for '{settings_data.get('restaurant_name', 'Spice Heaven')}' restaurant. "
                    "You help managers run the restaurant by answering performance questions in a professional, concise tone.\n"
                    f"Settings: {json.dumps(settings_data)}\n"
                    f"Total Completed Orders Today: {today_count}\n"
                    f"Net Revenue Today: {today_rev}\n"
                    f"Average Order Value Today: {today_aov}\n"
                    f"Low Stock Alerts count: {len(low_items)}\n"
                    f"User Query: \"{message}\"\n\n"
                    "Write a concise and professional response. If the query asks for a sales summary or low stock items, "
                    "acknowledge that you are displaying the live card/badges for them in the interface. "
                    "Do not write markdown tables or lists of low stock items if they are already mapped to attachments."
                )
                
                # Call gemini-2.5-flash
                response = ai_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=context_prompt
                )
                agent_response_text = response.text or ""
            except Exception as e:
                logger.error(f"GenAI SDK execution failed: {e}")
                agent_response_text = OrchestratorAgent._get_semantic_fallback(normalized_query, today_count, today_rev, today_aov)
        else:
            agent_response_text = OrchestratorAgent._get_semantic_fallback(normalized_query, today_count, today_rev, today_aov)

        # 4. Save to Database chat_history
        user_msg = {
            "id": f"msg_{int(datetime.datetime.utcnow().timestamp())}_u",
            "role": "user",
            "content": message,
            "timestamp": datetime.datetime.now().strftime("%I:%M %p")
        }
        
        agent_msg = {
            "id": f"msg_{int(datetime.datetime.utcnow().timestamp())}_a",
            "role": "assistant",
            "content": agent_response_text,
            "timestamp": datetime.datetime.now().strftime("%I:%M %p"),
            "attachment_type": attachment_type,
            "attachment_data": attachment_data
        }
        
        await DatabaseAgent.add_chat_message(user_msg)
        await DatabaseAgent.add_chat_message(agent_msg)
        
        return {
            "userMessage": user_msg,
            "agentMessage": agent_msg
        }

    @staticmethod
    def _get_semantic_fallback(query: str, count: int, rev: float, aov: float) -> str:
        if any(kw in query for kw in ["sales summary", "revenue today", "today's sales"]):
            return "Here is today's sales summary. We are recording a very steady footfall with high average check size!"
        if any(kw in query for kw in ["low stock", "stock warning", "low-stock"]):
            return "I've detected multiple inventory ingredients falling below their target minimum threshold. Please inspect the list below:"
        if any(kw in query for kw in ["recent orders", "last orders"]):
            return "Displaying the last 5 transactions recorded by the POS register."
        if any(kw in query for kw in ["hello", "hi", "hey"]):
            return "Hello! I am your RestaurantOS AI assistant. How can I help you manage Spice Heaven today?"
        return "I've processed your query. As the Spice Heaven digital assistant, I can check your stock logs, show live financial margins, or fetch custom billing statuses. Let me know how to assist you next!"
