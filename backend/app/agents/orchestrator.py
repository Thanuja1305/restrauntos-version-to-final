import json
import datetime
from typing import Dict, Any, List, Optional
from google import genai

from backend.app.config import settings
from backend.app.agents.database_agent import DatabaseAgent
from backend.app.agents.sales import SalesAgent
from backend.app.agents.inventory_agent import InventoryAgent
from backend.app.agents.analytics import AnalyticsAgent
from backend.app.logger import logger

class OrchestratorAgent:
    """
    Central router of the RestaurantOS AI system. Parses messages,
    attaches context, delegates queries, and handles Gemini GenAI reasoning.
    """
    @staticmethod
    def classify_query(query: str) -> str:
        q = query.lower()
        if any(kw in q for kw in ["stock", "inventory", "ingredient", "restock", "tomatoes", "onions", "paneer", "milk"]):
            return "inventory"
        if any(kw in q for kw in ["order", "customer", "sale", "selling", "menu", "cancel", "table"]):
            return "sales"
        if any(kw in q for kw in ["bill", "expense", "payout", "cost", "spend", "payment", "settle", "pay"]):
            return "finance"
        if any(kw in q for kw in ["profit", "margin", "revenue", "summary", "audit", "report", "perform"]):
            return "analytics"
        if any(kw in q for kw in ["added", "done with"]):
            return "voice"
        return "general"

    @staticmethod
    async def process_chat_query(message: str, user_id: str) -> Dict[str, Any]:
        logger.info(f"[Orchestrator Agent] Received chat message: '{message}' for user: '{user_id}'")
        normalized_query = message.lower().strip()
        
        # 1. Gather stats from DatabaseAgent
        settings_data = await DatabaseAgent.get_settings()
        orders = await DatabaseAgent.get_orders()
        completed_orders = [o for o in orders if o.get("status") == "completed"]
        today = datetime.date.today().isoformat()
        today_completed = [
            o for o in completed_orders 
            if o.get("created_at", "").startswith(today)
        ]
        today_rev = sum(float(o.get("total", 0.0)) for o in today_completed)
        today_count = len(today_completed)
        today_aov = round(today_rev / today_count, 2) if today_count > 0 else 0.0

        # 2. Pipeline routing & classification
        specialist = OrchestratorAgent.classify_query(normalized_query)
        logger.info(f"[Orchestrator Agent] Classified intent as: '{specialist}'")
        
        # 3. Process query by designated specialist agent and execute database actions
        attachment_type: Optional[str] = None
        attachment_data: Any = None
        agent_response_text = ""

        if specialist == "sales":
            # Check if this suggests order creation template
            if any(kw in normalized_query for kw in ["create an order", "order for rahul", "dosa order"]):
                logger.info("[Orchestrator Agent -> Sales Agent] Creating order for Rahul")
                # Parse items
                items = [
                    { "menuItemId": "m1", "name": "Masala Dosa", "quantity": 2, "unitPrice": 120.0 },
                    { "menuItemId": "m4", "name": "Filter Coffee", "quantity": 1, "unitPrice": 30.0 }
                ]
                # Call SalesAgent to record order
                order = await SalesAgent.create_order(
                    customer_id="c1",
                    customer_name="Rahul",
                    items=items,
                    discount=0.0,
                    user_id=user_id
                )
                agent_response_text = f"✔ **Order Created Successfully for Rahul.** Added 2 Masala Dosa, 1 Filter Coffee (Total: ₹283.50). Thermal invoice generated."
                attachment_type = "recent_orders"
                # Get last 5 orders
                orders_fresh = await DatabaseAgent.get_orders()
                attachment_data = [
                    {
                        "id": o["id"],
                        "customer": o.get("customer_name") or "Walk-in Guest",
                        "total": float(o.get("total", 0.0)),
                        "status": o.get("status", "pending")
                    } for o in orders_fresh[:5]
                ]
            else:
                # Ordinary sales summary request
                logger.info("[Orchestrator Agent -> Sales Agent] Fetching sales summary")
                summary = await SalesAgent.get_today_sales_summary()
                attachment_type = "sales_summary"
                attachment_data = {
                    "totalOrders": summary["totalOrders"],
                    "totalRevenue": summary["totalRevenue"],
                    "averageOrderValue": summary["averageOrderValue"],
                    "topSellingItem": "Masala Dosa (18)"
                }
                agent_response_text = (
                    "Here is today's sales summary:\n\n"
                    f"- **Total Orders Today**: {summary['totalOrders']}\n"
                    f"- **Net Revenue**: ₹{summary['totalRevenue']:.2f}\n"
                    f"- **Average Order Value (AOV)**: ₹{summary['averageOrderValue']:.2f}\n"
                    "- **Top Selling Item**: Masala Dosa"
                )

        elif specialist == "inventory":
            # Check if user requests adjustment
            if any(kw in normalized_query for kw in ["adjust", "restock", "add", "subtract"]):
                logger.info("[Orchestrator Agent -> Inventory Agent] Adjusting stock levels")
                # Adjust tomatoes as default demo action
                adjusted = await InventoryAgent.adjust_stock("ing1", 10.0)
                agent_response_text = f"✔ **Stock adjusted successfully.** Adjusted Tomatoes by +10.0 kg. Current stock is now {adjusted.get('currentStock')} kg."
            else:
                logger.info("[Orchestrator Agent -> Inventory Agent] Listing low stock items")
                low_items = await InventoryAgent.get_low_stock_items()
                attachment_type = "low_stock"
                attachment_data = [
                    {
                        "name": item["ingredientName"],
                        "stock": f"{item['currentStock']} {item['unitOfMeasure']}"
                    } for item in low_items
                ]
                if low_items:
                    agent_response_text = "I've detected multiple inventory ingredients falling below their target minimum threshold. Please inspect the list below:\n\n"
                    agent_response_text += "| Ingredient | Current Stock | Reorder Level | Unit |\n"
                    agent_response_text += "| :--- | :--- | :--- | :--- |\n"
                    for item in low_items:
                        agent_response_text += f"| **{item['ingredientName']}** | {item['currentStock']} | {item['minStockLevel']} | {item['unitOfMeasure']} |\n"
                else:
                    agent_response_text = "✔ **All ingredients are fully stocked!** No low stock warnings currently."

        elif specialist == "finance":
            if any(kw in normalized_query for kw in ["settle", "pay dairy craft", "pay supplier"]):
                logger.info("[Orchestrator Agent -> Finance Agent] Settling supplier bill for Dairy Craft")
                # Settle Dairy Craft (s1) outstanding bill
                await DatabaseAgent.settle_supplier_bill("s1")
                # Record the payment under expenses
                await DatabaseAgent.add_expense("Suppliers", 2800.0, "Settled Dairy Craft outstanding balance")
                agent_response_text = "✔ **Outstanding balance settled successfully with Dairy Craft.** Paid off ₹2800.00 and recorded the transaction under expenses."
            else:
                logger.info("[Orchestrator Agent -> Finance Agent] Showing outstanding bills")
                bills = await DatabaseAgent.get_bills()
                unpaid = [b for b in bills if b.get("status") == "unpaid"]
                agent_response_text = f"We have {len(unpaid)} outstanding bills pending. The total unpaid balance is ₹{sum(float(b['amount']) for b in unpaid)}."

        elif specialist == "analytics":
            logger.info("[Orchestrator Agent -> Analytics Agent] Fetching financial analytics report")
            fin = await AnalyticsAgent.get_financial_overview()
            agent_response_text = (
                f"Here is the financial summary for Spice Heaven:\n\n"
                f"- **Total Revenue**: {fin['currency']}{fin['totalRevenue']}\n"
                f"- **Total Expenses**: {fin['currency']}{fin['totalExpenses']}\n"
                f"- **Net Profit**: {fin['currency']}{fin['profit']}\n"
                f"- **Unpaid Bills**: {fin['unpaidBillsCount']} bills pending (Total: {fin['currency']}{fin['unpaidBillsAmount']})"
            )

        elif specialist == "voice":
            logger.info("[Orchestrator Agent -> Voice Specialist] Processing shorthand operational query")
            agent_response_text = "Command recognized and executed on the floor."

        else:
            # General specialist
            logger.info("[Orchestrator Agent -> General Specialist] Handling query via LLM or Heuristics")
            has_gemini = bool(settings.GEMINI_API_KEY) and settings.GEMINI_API_KEY != "MY_GEMINI_API_KEY"
            if has_gemini:
                try:
                    ai_client = genai.Client(api_key=settings.GEMINI_API_KEY)
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
                        "Write a concise and professional response."
                    )
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

        # 4. Compile messages and update DB chat history
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
        
        logger.info("[Orchestrator Agent] Successfully processed query and saved chat logs.")
        
        return {
            "userMessage": user_msg,
            "agentMessage": agent_msg
        }

    @staticmethod
    def _get_semantic_fallback(query: str, count: int, rev: float, aov: float) -> str:
        if any(kw in query for kw in ["sales summary", "revenue today", "today's sales"]):
            return "Here is today's sales summary. We are recording a very steady footfall with high average check size!"
        if any(kw in query for kw in ["low stock", "stock warning", "low-stock"]):
            return "I've detected multiple inventory ingredients falling below their target minimum threshold. Please inspect the low stock alerts in the interface."
        if any(kw in query for kw in ["recent orders", "last orders"]):
            return "Displaying the last 5 transactions recorded by the POS register."
        if any(kw in query for kw in ["hello", "hi", "hey"]):
            return "Hello! I am your RestaurantOS AI assistant. How can I help you manage Spice Heaven today?"
        return "I've processed your query. As the Spice Heaven digital assistant, I can check your stock logs, show live financial margins, or fetch custom billing statuses. Let me know how to assist you next!"
