from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from orders.models import (
    Customer, MenuItem, MenuCategory, Recipe, RecipeIngredient, 
    Inventory, InventoryTransaction, Order, OrderItem, 
    SalesTransaction, Expense, Revenue, FinancialSummary, 
    AnalyticsMetrics, AuditLogs
)
from orders.schemas import OrderCreate, OrderUpdate

class OrderRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, order_id: int) -> Optional[Order]:
        """
        Retrieves a single order by its ID with items pre-loaded.
        """
        stmt = (
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.menu_item))
            .options(selectinload(Order.customer))
            .where(Order.id == order_id)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_order_number(self) -> str:
        """
        Queries the latest order number to generate the next unique order number sequentially (ORD-000001).
        """
        stmt = select(Order.order_number).order_by(desc(Order.id)).limit(1)
        result = await self.db.execute(stmt)
        latest = result.scalar_one_or_none()
        
        if not latest:
            return "ORD-000001"
        
        try:
            num_part = latest.split("-")[1]
            next_num = int(num_part) + 1
            return f"ORD-{next_num:06d}"
        except Exception:
            stmt_count = select(func.count(Order.id))
            count_res = await self.db.execute(stmt_count)
            count = count_res.scalar_one() + 1
            return f"ORD-{count:06d}"

    async def create(self, order: Order) -> Order:
        """
        Persists a new order along with its order items in the database.
        """
        self.db.add(order)
        await self.db.flush()
        return order

    async def update(self, order: Order, update_data: OrderUpdate) -> Order:
        """
        Updates the order status or payment status.
        """
        if update_data.status is not None:
            order.status = update_data.status
        if update_data.payment_status is not None:
            order.payment_status = update_data.payment_status
        await self.db.flush()
        return order

    async def delete(self, order: Order) -> None:
        """
        Removes an order and cascade deletes its order items.
        """
        await self.db.delete(order)
        await self.db.flush()

    async def list_and_search(
        self,
        search_query: Optional[str] = None,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Order], int]:
        """
        Lists orders with pagination, sorting, filtering, and keyword search.
        Returns a tuple of (List of Orders, Total matching count).
        """
        stmt = (
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.menu_item))
            .options(selectinload(Order.customer))
        )
        
        filters = []
        if status and status != "All":
            filters.append(Order.status == status)
        if order_type:
            filters.append(Order.order_type == order_type)
            
        if search_query:
            stmt = stmt.join(Order.customer)
            search_pattern = f"%{search_query}%"
            filters.append(
                or_(
                    Order.order_number.ilike(search_pattern),
                    Customer.name.ilike(search_pattern),
                    Order.table_or_type.ilike(search_pattern)
                )
            )
            
        if filters:
            stmt = stmt.where(and_(*filters))
            
        count_stmt = select(func.count(Order.id))
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        
        if search_query:
            count_stmt = count_stmt.join(Order.customer)
            
        count_result = await self.db.execute(count_stmt)
        total_count = count_result.scalar_one()

        sort_col = getattr(Order, sort_by, Order.created_at)
        if sort_order.lower() == "asc":
            stmt = stmt.order_by(asc(sort_col))
        else:
            stmt = stmt.order_by(desc(sort_col))

        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        orders = result.scalars().unique().all()
        
        return list(orders), total_count


class InventoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, item_id: str) -> Optional[Inventory]:
        stmt = select(Inventory).where(Inventory.id == item_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Optional[Inventory]:
        stmt = select(Inventory).where(Inventory.name.ilike(name))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_item(self, item: Inventory) -> Inventory:
        self.db.add(item)
        await self.db.flush()
        return item

    async def list_items(self) -> List[Inventory]:
        stmt = select(Inventory).order_by(Inventory.name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_transaction(self, txn: InventoryTransaction) -> InventoryTransaction:
        self.db.add(txn)
        await self.db.flush()
        return txn

    async def list_transactions(self) -> List[InventoryTransaction]:
        stmt = select(InventoryTransaction).order_by(desc(InventoryTransaction.timestamp))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())


class MenuRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_item_by_id(self, item_id: str) -> Optional[MenuItem]:
        stmt = select(MenuItem).where(MenuItem.id == item_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_item_by_name(self, name: str) -> Optional[MenuItem]:
        stmt = select(MenuItem).where(MenuItem.name.ilike(name))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_menu_item(self, item: MenuItem) -> MenuItem:
        self.db.add(item)
        await self.db.flush()
        return item

    async def list_menu_items(self) -> List[MenuItem]:
        stmt = select(MenuItem).order_by(MenuItem.name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_category(self, cat: MenuCategory) -> MenuCategory:
        self.db.add(cat)
        await self.db.flush()
        return cat

    async def list_categories(self) -> List[MenuCategory]:
        stmt = select(MenuCategory).order_by(MenuCategory.category_name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_recipe(self, rec: Recipe) -> Recipe:
        self.db.add(rec)
        await self.db.flush()
        return rec

    async def get_recipe_by_menu_item(self, menu_item_id: str) -> Optional[Recipe]:
        stmt = (
            select(Recipe)
            .options(selectinload(Recipe.ingredients).selectinload(RecipeIngredient.inventory))
            .where(Recipe.menu_item_id == menu_item_id)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, cust_id: str) -> Optional[Customer]:
        stmt = select(Customer).where(Customer.id == cust_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[Customer]:
        stmt = select(Customer).where(Customer.phone == phone)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def create(self, cust: Customer) -> Customer:
        self.db.add(cust)
        await self.db.flush()
        return cust

    async def list_customers(self) -> List[Customer]:
        stmt = select(Customer).order_by(Customer.name)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())


class FinanceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_expense(self, exp: Expense) -> Expense:
        self.db.add(exp)
        await self.db.flush()
        return exp

    async def list_expenses(self) -> List[Expense]:
        stmt = select(Expense).order_by(desc(Expense.date))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_revenue(self, rev: Revenue) -> Revenue:
        self.db.add(rev)
        await self.db.flush()
        return rev

    async def list_revenues(self) -> List[Revenue]:
        stmt = select(Revenue).order_by(desc(Revenue.date))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_sales_transaction(self, txn: SalesTransaction) -> SalesTransaction:
        self.db.add(txn)
        await self.db.flush()
        return txn

    async def create_financial_summary(self, summary: FinancialSummary) -> FinancialSummary:
        self.db.add(summary)
        await self.db.flush()
        return summary

    async def get_latest_financial_summary(self) -> Optional[FinancialSummary]:
        stmt = select(FinancialSummary).order_by(desc(FinancialSummary.calculation_date)).limit(1)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()


class AnalyticsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_metric(self, metric: AnalyticsMetrics) -> AnalyticsMetrics:
        self.db.add(metric)
        await self.db.flush()
        return metric

    async def get_metrics_by_category(self, cat: str) -> List[AnalyticsMetrics]:
        stmt = select(AnalyticsMetrics).where(AnalyticsMetrics.category == cat).order_by(desc(AnalyticsMetrics.calculation_date))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())


class AuditLogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_audit_log(self, log: AuditLogs) -> AuditLogs:
        self.db.add(log)
        await self.db.flush()
        return log

    async def list_audit_logs(self) -> List[AuditLogs]:
        stmt = select(AuditLogs).order_by(desc(AuditLogs.timestamp))
        res = await self.db.execute(stmt)
        return list(res.scalars().all())
