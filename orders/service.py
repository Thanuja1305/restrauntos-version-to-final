from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from orders.repository import (
    OrderRepository, InventoryRepository, MenuRepository, 
    CustomerRepository, FinanceRepository, AnalyticsRepository, AuditLogRepository
)
from orders.models import (
    Order, OrderItem, Customer, MenuItem, MenuCategory, Recipe, 
    RecipeIngredient, Inventory, InventoryTransaction, SalesTransaction, 
    Expense, Revenue, FinancialSummary, AnalyticsMetrics, AuditLogs
)
from orders.schemas import (
    OrderCreate, OrderUpdate, InventoryItemCreate, InventoryItemUpdate, 
    InventoryTransactionCreate, MenuItemCreate, MenuItemUpdate, ExpenseCreate, 
    RevenueCreate, FinancialSummaryResponse, SalesKPIResponse, InventoryKPIResponse, 
    CustomerKPIResponse, InsightResponse
)
from orders.exceptions import (
    CustomerNotFoundException, 
    MenuItemNotFoundException,
    OrderNotFoundException,
    EmptyOrderException
)

# --- AUDIT LOGGING SERVICE ---

class AuditLogService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AuditLogRepository(db)

    async def log_action(
        self,
        actor_type: str,  # USER, AI_AGENT, SYSTEM
        action_type: str,  # CREATE, UPDATE, DELETE, QUERY, ROUTE
        actor_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditLogs:
        log = AuditLogs(
            actor_type=actor_type,
            actor_id=actor_id,
            agent_name=agent_name,
            action_type=action_type,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            request_id=request_id,
            ip_address=ip_address,
            payload_metadata=metadata
        )
        created_log = await self.repo.create_audit_log(log)
        return created_log

    async def list_logs(self) -> List[AuditLogs]:
        return await self.repo.list_audit_logs()


# --- EXISTING ORDERS SERVICE (Retained & Integrated) ---

class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = OrderRepository(db)

    async def create_order(self, payload: OrderCreate) -> Order:
        """
        Creates a new order in the database.
        Applies business rules:
        - Checks customer exists.
        - Checks menu items exist.
        - Generates order number (e.g. ORD-000001) sequentially.
        - Computes subtotals, tax (5% GST), and grand total.
        """
        # 1. Validate Customer
        customer_stmt = select(Customer).where(Customer.id == payload.customer_id)
        customer_res = await self.db.execute(customer_stmt)
        customer = customer_res.scalar_one_or_none()
        if not customer:
            raise CustomerNotFoundException(payload.customer_id)

        # 2. Validate Items
        if not payload.items:
            raise EmptyOrderException()

        db_order_items: List[OrderItem] = []
        subtotal_sum = 0.0

        for item_req in payload.items:
            # Check menu item
            menu_stmt = select(MenuItem).where(MenuItem.id == item_req.menu_item_id)
            menu_res = await self.db.execute(menu_stmt)
            menu_item = menu_res.scalar_one_or_none()
            
            if not menu_item:
                raise MenuItemNotFoundException(item_req.menu_item_id)
            
            item_price = float(menu_item.price)
            item_subtotal = item_price * item_req.quantity
            subtotal_sum += item_subtotal

            db_item = OrderItem(
                menu_item_id=item_req.menu_item_id,
                name=menu_item.name,
                quantity=item_req.quantity,
                price=item_price
            )
            db_order_items.append(db_item)

        # 3. Calculate financial totals
        gst_rate = 0.05
        tax_amount = subtotal_sum * gst_rate
        discount_amount = payload.discount if payload.discount else 0.0
        final_total = max(0.0, (subtotal_sum + tax_amount) - discount_amount)

        # 4. Generate sequential order number
        next_ord_num = await self.repo.get_next_order_number()

        # 5. Build order model
        db_order = Order(
            order_number=next_ord_num,
            customer_id=payload.customer_id,
            customer_name=customer.name,
            phone=customer.phone,
            table_or_type=payload.order_type,
            status="Pending",
            payment_status="Pending",
            subtotal=subtotal_sum,
            tax=tax_amount,
            discount=discount_amount,
            total_amount=final_total,
            items=db_order_items
        )

        # 6. Update Customer stats
        customer.visit_count += 1
        customer.total_orders += 1
        customer.total_spent = float(customer.total_spent) + final_total
        customer.last_order_date = datetime.utcnow()
        customer.last_visit = datetime.utcnow()

        created_order = await self.repo.create(db_order)
        return created_order

    async def get_order_by_id(self, order_id: int) -> Order:
        order = await self.repo.get_by_id(order_id)
        if not order:
            raise OrderNotFoundException(order_id)
        return order

    async def update_order_status(self, order_id: int, update_payload: OrderUpdate) -> Order:
        order = await self.repo.get_by_id(order_id)
        if not order:
            raise OrderNotFoundException(order_id)

        if update_payload.status == "Completed":
            order.payment_status = "Paid"

        updated_order = await self.repo.update(order, update_payload)
        return updated_order

    async def delete_order(self, order_id: int) -> None:
        order = await self.repo.get_by_id(order_id)
        if not order:
            raise OrderNotFoundException(order_id)
        await self.repo.delete(order)

    async def list_orders(
        self,
        search_query: Optional[str] = None,
        status: Optional[str] = None,
        order_type: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Order], int]:
        return await self.repo.list_and_search(
            search_query=search_query,
            status=status,
            order_type=order_type,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )


# --- NEW INVENTORY SERVICE ---

class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = InventoryRepository(db)
        self.audit = AuditLogService(db)

    async def get_inventory_item(self, item_id: str) -> Optional[Inventory]:
        return await self.repo.get_by_id(item_id)

    async def list_inventory(self) -> List[Inventory]:
        return await self.repo.list_items()

    async def create_inventory_item(self, payload: InventoryItemCreate) -> Inventory:
        item = Inventory(
            name=payload.item_name,
            category=payload.category,
            subcategory=payload.subcategory,
            unit=payload.unit_of_measure,
            current_qty=payload.current_quantity,
            reorder_level=payload.minimum_stock_level,
            maximum_stock_level=payload.maximum_stock_level,
            reorder_point=payload.reorder_point,
            reorder_quantity=payload.reorder_quantity,
            unit_price=payload.unit_cost,
            supplier_id=payload.supplier_id,
            storage_location=payload.storage_location,
            expiry_date=payload.expiry_date,
            batch_number=payload.batch_number
        )
        created = await self.repo.create_item(item)
        await self.audit.log_action(
            actor_type="SYSTEM",
            action_type="CREATE",
            entity_type="Inventory",
            entity_id=created.id,
            new_value=payload.model_dump(mode='json')
        )
        return created

    async def update_inventory_item(self, item_id: str, payload: InventoryItemUpdate, actor_type: str = "SYSTEM", agent_name: Optional[str] = None) -> Optional[Inventory]:
        item = await self.repo.get_by_id(item_id)
        if not item:
            return None
        
        old_val = {
            "current_quantity": float(item.current_qty),
            "unit_cost": float(item.unit_price),
            "minimum_stock_level": float(item.reorder_level),
        }

        if payload.item_name is not None:
            item.name = payload.item_name
        if payload.category is not None:
            item.category = payload.category
        if payload.subcategory is not None:
            item.subcategory = payload.subcategory
        if payload.unit_of_measure is not None:
            item.unit = payload.unit_of_measure
        if payload.current_quantity is not None:
            item.current_qty = payload.current_quantity
        if payload.minimum_stock_level is not None:
            item.reorder_level = payload.minimum_stock_level
        if payload.maximum_stock_level is not None:
            item.maximum_stock_level = payload.maximum_stock_level
        if payload.reorder_point is not None:
            item.reorder_point = payload.reorder_point
        if payload.reorder_quantity is not None:
            item.reorder_quantity = payload.reorder_quantity
        if payload.unit_cost is not None:
            item.unit_price = payload.unit_cost
        if payload.supplier_id is not None:
            item.supplier_id = payload.supplier_id
        if payload.storage_location is not None:
            item.storage_location = payload.storage_location
        if payload.expiry_date is not None:
            item.expiry_date = payload.expiry_date
        if payload.batch_number is not None:
            item.batch_number = payload.batch_number

        await self.db.flush()

        new_val = {
            "current_quantity": float(item.current_qty),
            "unit_cost": float(item.unit_price),
            "minimum_stock_level": float(item.reorder_level),
        }

        await self.audit.log_action(
            actor_type=actor_type,
            agent_name=agent_name,
            action_type="UPDATE",
            entity_type="Inventory",
            entity_id=item.id,
            old_value=old_val,
            new_value=new_val
        )
        return item

    async def log_inventory_transaction(self, payload: InventoryTransactionCreate) -> InventoryTransaction:
        txn = InventoryTransaction(
            transaction_type=payload.transaction_type,
            item_id=payload.item_id,
            quantity=payload.quantity,
            unit_of_measure=payload.unit_of_measure,
            reference_id=payload.reference_id,
            reference_type=payload.reference_type,
            reason=payload.reason,
            created_by=payload.created_by or "SYSTEM",
            timestamp=payload.timestamp or datetime.utcnow()
        )
        created = await self.repo.create_transaction(txn)
        
        item = await self.repo.get_by_id(payload.item_id)
        if item:
            old_qty = float(item.current_qty)
            if payload.transaction_type == "RECEIVE":
                item.current_qty = float(item.current_qty) + float(payload.quantity)
            elif payload.transaction_type in ["CONSUME", "WASTE"]:
                item.current_qty = float(item.current_qty) - float(payload.quantity)
            
            await self.db.flush()

            await self.audit.log_action(
                actor_type="SYSTEM",
                action_type="UPDATE",
                entity_type="Inventory",
                entity_id=item.id,
                old_value={"current_quantity": old_qty},
                new_value={"current_quantity": float(item.current_qty)},
                metadata={"transaction_type": payload.transaction_type, "txn_quantity": payload.quantity}
            )

        return created

    async def list_transactions(self) -> List[InventoryTransaction]:
        return await self.repo.list_transactions()


# --- NEW SALES SERVICE ---

class SalesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_service = OrderService(db)
        self.cust_repo = CustomerRepository(db)
        self.finance_repo = FinanceRepository(db)
        self.audit = AuditLogService(db)

    async def create_order(self, payload: OrderCreate, actor_type: str = "SYSTEM", agent_name: Optional[str] = None) -> Order:
        order = await self.order_service.create_order(payload)
        
        # Log Revenue entry
        rev_entry = Revenue(
            source=order.table_or_type,
            amount=order.total_amount,
            order_id=order.id,
            date=datetime.utcnow()
        )
        await self.finance_repo.create_revenue(rev_entry)

        # Log SalesTransaction
        sales_txn = SalesTransaction(
            order_id=order.id,
            revenue_amount=order.subtotal,
            payment_method="Cash" if order.table_or_type == "Takeaway" else "Card",
            discount=order.discount,
            tax=order.tax,
            final_amount=order.total_amount,
            timestamp=datetime.utcnow()
        )
        await self.finance_repo.create_sales_transaction(sales_txn)

        await self.audit.log_action(
            actor_type=actor_type,
            agent_name=agent_name,
            action_type="CREATE",
            entity_type="Order",
            entity_id=str(order.id),
            new_value={"total_amount": float(order.total_amount), "order_number": order.order_number}
        )
        return order

    async def update_order_status(self, order_id: int, payload: OrderUpdate, actor_type: str = "SYSTEM", agent_name: Optional[str] = None) -> Order:
        order_before = await self.order_service.get_order_by_id(order_id)
        old_status = order_before.status if order_before else "Pending"

        order = await self.order_service.update_order_status(order_id, payload)

        await self.audit.log_action(
            actor_type=actor_type,
            agent_name=agent_name,
            action_type="UPDATE",
            entity_type="Order",
            entity_id=str(order.id),
            old_value={"status": old_status},
            new_value={"status": order.status}
        )
        return order

    async def create_customer(self, name: str, phone: str, email: Optional[str] = None) -> Customer:
        cust = Customer(
            name=name,
            phone=phone,
            email=email,
            visit_count=0,
            total_spent=0.0,
            total_orders=0
        )
        created = await self.cust_repo.create(cust)
        await self.audit.log_action(
            actor_type="SYSTEM",
            action_type="CREATE",
            entity_type="Customer",
            entity_id=created.id,
            new_value={"name": name, "phone": phone, "email": email}
        )
        return created

    async def list_customers(self) -> List[Customer]:
        return await self.cust_repo.list_customers()


# --- NEW FINANCE SERVICE ---

class FinanceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FinanceRepository(db)
        self.audit = AuditLogService(db)

    async def create_expense(self, payload: ExpenseCreate, actor_type: str = "SYSTEM", agent_name: Optional[str] = None) -> Expense:
        exp = Expense(
            category=payload.category,
            amount=payload.amount,
            payment_method=payload.payment_method,
            vendor=payload.vendor,
            description=payload.description,
            date=payload.date or datetime.utcnow()
        )
        created = await self.repo.create_expense(exp)
        await self.audit.log_action(
            actor_type=actor_type,
            agent_name=agent_name,
            action_type="CREATE",
            entity_type="Expense",
            entity_id=created.id,
            new_value=payload.model_dump(mode='json')
        )
        return created

    async def create_revenue(self, payload: RevenueCreate, actor_type: str = "SYSTEM", agent_name: Optional[str] = None) -> Revenue:
        rev = Revenue(
            source=payload.source,
            amount=payload.amount,
            date=payload.date or datetime.utcnow(),
            order_id=payload.order_id
        )
        created = await self.repo.create_revenue(rev)
        await self.audit.log_action(
            actor_type=actor_type,
            agent_name=agent_name,
            action_type="CREATE",
            entity_type="Revenue",
            entity_id=created.id,
            new_value=payload.model_dump(mode='json')
        )
        return created

    async def list_expenses(self) -> List[Expense]:
        return await self.repo.list_expenses()

    async def list_revenues(self) -> List[Revenue]:
        return await self.repo.list_revenues()

    async def get_financial_summary(self) -> FinancialSummaryResponse:
        expenses = await self.repo.list_expenses()
        revenues = await self.repo.list_revenues()

        total_rev = sum(float(r.amount) for r in revenues)
        total_exp = sum(float(e.amount) for e in expenses)
        gross_profit = total_rev
        net_profit = total_rev - total_exp
        
        food_cost = sum(float(e.amount) for e in expenses if e.category == "Food Cost")
        labor_cost = sum(float(e.amount) for e in expenses if e.category == "Salary")
        
        margin = (net_profit / total_rev * 100) if total_rev > 0 else 0.0

        # Persist summary
        summary = FinancialSummary(
            total_revenue=total_rev,
            total_expenses=total_exp,
            gross_profit=gross_profit,
            net_profit=net_profit,
            food_cost=food_cost,
            labor_cost=labor_cost,
            profit_margin_percentage=margin,
            calculation_date=datetime.utcnow()
        )
        await self.repo.create_financial_summary(summary)

        return FinancialSummaryResponse(
            total_revenue=total_rev,
            total_expenses=total_exp,
            gross_profit=gross_profit,
            net_profit=net_profit,
            food_cost=food_cost,
            labor_cost=labor_cost,
            profit_margin_percentage=margin
        )


# --- RE-EXPORT ANALYTICS SERVICE FROM SEPARATE MODULE ---

from orders.analytics_service import AnalyticsService

