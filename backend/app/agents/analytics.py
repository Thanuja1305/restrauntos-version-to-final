from typing import Dict, Any, List
from backend.app.agents.database_agent import DatabaseAgent

class AnalyticsAgent:
    """
    Analyzes transaction histories, calculates margins, profitability,
    and structures charts dataset arrays.
    """
    @staticmethod
    async def get_financial_overview() -> Dict[str, Any]:
        orders = await DatabaseAgent.get_orders()
        bills = await DatabaseAgent.get_bills()
        expenses = await DatabaseAgent.get_expenses()
        settings = await DatabaseAgent.get_settings()
        
        # Calculate completed order revenue
        completed_orders = [o for o in orders if o.get("status") == "completed"]
        total_revenue = sum(float(o.get("total", 0.0)) for o in completed_orders)
        
        # Calculate unpaid bills
        unpaid_bills = [b for b in bills if b.get("status") == "unpaid"]
        unpaid_count = len(unpaid_bills)
        unpaid_amount = sum(float(b.get("amount", 0.0)) for b in unpaid_bills)
        
        # Calculate expenses
        total_expenses = sum(float(e.get("amount", 0.0)) for e in expenses)
        
        # Profit
        profit = total_revenue - total_expenses
        
        return {
            "totalRevenue": round(total_revenue, 2),
            "unpaidBillsCount": unpaid_count,
            "totalExpenses": round(total_expenses, 2),
            "profit": round(profit, 2),
            "currency": settings.get("currency", "₹"),
            "unpaidBillsAmount": round(unpaid_amount, 2)
        }
