import uuid
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.ext.asyncio import AsyncSession
from orders.models import (
    Customer, MenuItem, MenuCategory, Recipe, RecipeIngredient, 
    Inventory, InventoryTransaction, Order, OrderItem, 
    SalesTransaction, Expense, Revenue, FinancialSummary, 
    AnalyticsMetrics, AuditLogs
)

class AnalyticsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_sales_data(self) -> List[Order]:
        """
        Fetches all orders from the database, ordered by creation date descending.
        """
        stmt = select(Order).order_by(desc(Order.created_at))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def fetch_inventory_data(self) -> List[Inventory]:
        """
        Fetches all inventory items from the database.
        """
        stmt = select(Inventory).order_by(Inventory.name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def fetch_finance_data(self) -> Dict[str, List[Any]]:
        """
        Fetches all revenue and expense records.
        """
        rev_stmt = select(Revenue).order_by(desc(Revenue.date))
        exp_stmt = select(Expense).order_by(desc(Expense.date))
        
        rev_res = await self.db.execute(rev_stmt)
        exp_res = await self.db.execute(exp_stmt)
        
        return {
            "revenues": list(rev_res.scalars().all()),
            "expenses": list(exp_res.scalars().all())
        }

    async def fetch_customer_data(self) -> List[Customer]:
        """
        Fetches all customer records.
        """
        stmt = select(Customer).order_by(Customer.name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def fetch_inventory_transactions(self) -> List[InventoryTransaction]:
        """
        Fetches all inventory transactions.
        """
        stmt = select(InventoryTransaction).order_by(desc(InventoryTransaction.timestamp))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_audit_log(self, log: AuditLogs) -> AuditLogs:
        """
        Creates an audit log entry.
        """
        self.db.add(log)
        await self.db.flush()
        return log
