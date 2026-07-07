from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from orders.dependencies import get_db_session
from orders.service import (
    OrderService, AuditLogService, InventoryService, SalesService, FinanceService, AnalyticsService
)
from orders.schemas import (
    OrderCreate, OrderUpdate, OrderDTO, AgentEventRequest, AgentEventResponse,
    InventoryItemResponse, InventoryItemCreate, InventoryTransactionCreate,
    ExpenseCreate, ExpenseResponse, RevenueCreate, RevenueResponse,
    FinancialSummaryResponse, SalesKPIResponse, InventoryKPIResponse,
    CustomerKPIResponse, InsightResponse, CustomerResponse
)
from orders.exceptions import OrderDomainException

router = APIRouter(tags=["RestaurantOS AI"])

# --- ORDERS API (Original Routes, Fully Preserved) ---

@router.post("/orders", response_model=OrderDTO, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Creates a new restaurant order, auto-calculates totals, and logs updates.
    """
    service = OrderService(db)
    try:
        return await service.create_order(payload)
    except OrderDomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders", response_model=List[OrderDTO])
async def list_orders(
    search: Optional[str] = Query(None, description="Search term matching ID, customer name or type"),
    status: Optional[str] = Query(None, description="Filter by Pending, Completed, Cancelled"),
    order_type: Optional[str] = Query(None, alias="orderType", description="Dine In, Takeaway, Delivery"),
    sort_by: str = Query("created_at", alias="sortBy", description="Field to sort by"),
    sort_order: str = Query("desc", alias="sortOrder", description="Sort direction (asc/desc)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Queries and lists all orders with rich filtering, searching, sorting and pagination.
    """
    service = OrderService(db)
    try:
        orders, _ = await service.list_orders(
            search_query=search,
            status=status,
            order_type=order_type,
            sort_by=sort_by,
            sort_order=sort_order,
            limit=limit,
            offset=offset
        )
        return orders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders/{order_id}", response_model=OrderDTO)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Retrieves a single order by its integer ID.
    """
    service = OrderService(db)
    try:
        return await service.get_order_by_id(order_id)
    except OrderDomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/orders/{order_id}", response_model=OrderDTO)
async def update_order(
    order_id: int,
    payload: OrderUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Updates status or payment status of an existing order.
    """
    service = OrderService(db)
    try:
        return await service.update_order_status(order_id, payload)
    except OrderDomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Deletes an order by ID.
    """
    service = OrderService(db)
    try:
        await service.delete_order(order_id)
        return None
    except OrderDomainException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- TASK 6: AGENT COMMUNICATION API ---

@router.post("/api/agents/events", response_model=AgentEventResponse, status_code=status.HTTP_200_OK)
async def handle_agent_event(
    payload: AgentEventRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Master Orchestrator integration webhook endpoint. Processes incoming specialist agent event states,
    creates audit records, and triggers database/state side-effects.
    """
    audit_service = AuditLogService(db)
    sales_service = SalesService(db)
    inventory_service = InventoryService(db)
    finance_service = FinanceService(db)
    analytics_service = AnalyticsService(db)

    # Handle backward-compatible fields
    agent_name = payload.source_agent or payload.agent or "Unknown Agent"
    event_name = payload.event_type or payload.event or "Unknown Event"
    event_type = event_name.upper()

    # 1. Log event inside audit logs
    await audit_service.log_action(
        actor_type="AI_AGENT",
        agent_name=agent_name,
        action_type="ROUTE",
        entity_type="Event",
        new_value={"event": event_name, "data": payload.data}
    )

    try:
        if event_type == "ORDER_CREATED":
            # Map data to OrderCreate schema
            order_data = OrderCreate(**payload.data)
            order = await sales_service.create_order(
                order_data, 
                actor_type="AI_AGENT", 
                agent_name=agent_name
            )
            res_dict = {
                "id": order.id,
                "order_number": order.order_number,
                "total_amount": float(order.total_amount)
            }
            return {
                "success": True,
                "status": "success",
                "message": f"Order {order.order_number} created successfully from agent event.",
                "result": res_dict,
                "data": res_dict,
                "timestamp": datetime.utcnow()
            }

        elif event_type == "STOCK_ALERT":
            # Map data to InventoryTransactionCreate schema
            txn_data = InventoryTransactionCreate(**payload.data)
            txn = await inventory_service.log_inventory_transaction(txn_data)
            res_dict = {
                "id": txn.id,
                "transaction_type": txn.transaction_type,
                "quantity": float(txn.quantity)
            }
            return {
                "success": True,
                "status": "success",
                "message": "Inventory transaction logged and stock levels updated.",
                "result": res_dict,
                "data": res_dict,
                "timestamp": datetime.utcnow()
            }

        elif event_type == "EXPENSE_LOGGED":
            # Map data to ExpenseCreate schema
            exp_data = ExpenseCreate(**payload.data)
            expense = await finance_service.create_expense(
                exp_data, 
                actor_type="AI_AGENT", 
                agent_name=agent_name
            )
            res_dict = {
                "id": expense.id,
                "category": expense.category,
                "amount": float(expense.amount)
            }
            return {
                "success": True,
                "status": "success",
                "message": f"Expense {expense.id} logged successfully.",
                "result": res_dict,
                "data": res_dict,
                "timestamp": datetime.utcnow()
            }

        elif event_type == "METRICS_REQUESTED":
            category = payload.data.get("category", "all").lower()
            response_data = {}
            if category in ["sales", "all"]:
                sales_kpi = await analytics_service.get_sales_kpi()
                response_data["sales"] = sales_kpi.model_dump()
            if category in ["inventory", "all"]:
                inv_kpi = await analytics_service.get_inventory_kpi()
                response_data["inventory"] = inv_kpi.model_dump()
            if category in ["customer", "all"]:
                cust_kpi = await analytics_service.get_customer_kpi()
                response_data["customer"] = cust_kpi.model_dump()

            return {
                "success": True,
                "status": "success",
                "message": "Metrics fetched successfully.",
                "result": response_data,
                "data": response_data,
                "timestamp": datetime.utcnow()
            }

        elif event_type == "ANALYTICS_REQUEST":
            request_type = payload.data.get("request_type", "BUSINESS_SUMMARY").upper()
            response_data = {}
            
            if request_type == "SALES_REPORT":
                response_data = await analytics_service.get_sales_kpis()
            elif request_type == "INVENTORY_REPORT":
                response_data = await analytics_service.get_inventory_kpis()
            elif request_type == "FINANCE_REPORT":
                response_data = await analytics_service.get_financial_kpis()
            elif request_type == "CUSTOMER_REPORT":
                response_data = await analytics_service.get_customer_kpis()
            elif request_type in ["BUSINESS_SUMMARY", "PERFORMANCE_ANALYSIS"]:
                response_data = await analytics_service.generate_business_summary()
            else:
                response_data = await analytics_service.generate_business_summary()
                
            # Log audit event for analytics query
            await analytics_service.log_audit_event(
                agent_name=agent_name,
                event_type=event_name,
                action=f"Calculated {request_type}",
                status="SUCCESS"
            )
            
            return {
                "success": True,
                "status": "success",
                "message": f"Analytics {request_type} compiled successfully.",
                "result": response_data,
                "data": response_data,
                "timestamp": datetime.utcnow()
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unhandled agent event type: {event_name}"
            )

    except Exception as e:
        await audit_service.log_action(
            actor_type="AI_AGENT",
            agent_name=agent_name,
            action_type="ROUTE",
            entity_type="Event",
            metadata={"error": str(e), "event": event_name}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Failed to process event: {str(e)}"
        )


# --- ADDITIONAL CRUD & METRICS FOR COMPLETED STATE ---

def map_inventory_item(item) -> dict:
    return {
        "id": item.id,
        "item_name": item.name,
        "category": item.category,
        "subcategory": item.subcategory,
        "unit_of_measure": item.unit,
        "current_quantity": float(item.current_qty) if item.current_qty is not None else 0.0,
        "minimum_stock_level": float(item.reorder_level) if item.reorder_level is not None else 0.0,
        "maximum_stock_level": float(item.maximum_stock_level) if item.maximum_stock_level is not None else 0.0,
        "reorder_point": float(item.reorder_point) if item.reorder_point is not None else 0.0,
        "reorder_quantity": float(item.reorder_quantity) if item.reorder_quantity is not None else 0.0,
        "unit_cost": float(item.unit_price) if item.unit_price is not None else 0.0,
        "supplier_id": item.supplier_id,
        "storage_location": item.storage_location,
        "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
        "batch_number": item.batch_number,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None
    }

@router.get("/api/inventory")
async def list_inventory(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves full inventory stock records with manual mapping.
    """
    service = InventoryService(db)
    items = await service.list_inventory()
    return [map_inventory_item(i) for i in items]

@router.get("/api/inventory/low-stock")
async def get_low_stock(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves low stock inventory items where current_quantity <= reorder_level.
    """
    service = InventoryService(db)
    items = await service.list_inventory()
    low_stock = []
    for i in items:
        threshold = i.reorder_level if i.reorder_level is not None else 0.0
        if i.current_qty <= threshold:
            low_stock.append({
                "item": i.name,
                "current_quantity": float(i.current_qty),
                "required_level": float(threshold),
                "recommended_order_quantity": float(i.reorder_quantity) if i.reorder_quantity else 50.0,
                "priority": "HIGH" if i.current_qty == 0 else "MEDIUM"
            })
    return low_stock

@router.get("/api/menu")
async def get_menu(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves menu items with categories, prices, costs, food cost %, and margins.
    """
    from orders.repository import MenuRepository
    repo = MenuRepository(db)
    items = await repo.list_menu_items()
    response = []
    for item in items:
        cost = float(item.cost) if item.cost is not None else 0.0
        price = float(item.price) if item.price is not None else 1.0
        margin = price - cost
        food_cost_pct = (cost / price * 100) if price > 0 else 0.0
        response.append({
            "menu_item_id": item.id,
            "item_name": item.name,
            "category": item.category,
            "selling_price": price,
            "ingredient_cost": cost,
            "food_cost_percentage": food_cost_pct,
            "profit_margin": margin,
            "availability_status": item.status
        })
    return response

@router.get("/api/analytics/kpis")
async def get_analytics_kpis(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves aggregated Sales, Inventory, and Customer KPIs.
    """
    service = AnalyticsService(db)
    sales_kpi = await service.get_sales_kpi()
    inventory_kpi = await service.get_inventory_kpi()
    customer_kpi = await service.get_customer_kpi()
    
    return {
        "sales": {
            "daily_sales": float(sales_kpi.daily_sales),
            "weekly_sales": float(sales_kpi.weekly_sales),
            "monthly_sales": float(sales_kpi.monthly_sales),
            "best_selling_items": sales_kpi.best_selling_items,
            "average_order_value": float(sales_kpi.average_order_value)
        },
        "inventory": {
            "inventory_value": float(inventory_kpi.inventory_value),
            "low_stock_items": inventory_kpi.low_stock_items,
            "waste_percentage": float(inventory_kpi.waste_percentage),
            "stock_turnover": float(inventory_kpi.stock_turnover)
        },
        "customer": {
            "total_customers": int(customer_kpi.total_customers),
            "returning_customers": int(customer_kpi.returning_customers),
            "customer_frequency": float(customer_kpi.customer_frequency),
            "customer_lifetime_value": float(customer_kpi.customer_lifetime_value)
        }
    }

@router.get("/api/inventory/transactions")
@router.get("/api/transactions")
async def list_transactions(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves log of all inventory transactions.
    """
    service = InventoryService(db)
    txns = await service.list_transactions()
    response = []
    for t in txns:
        item = await service.get_inventory_item(t.item_id)
        response.append({
            "id": t.id,
            "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            "item": item.name if item else f"Item {t.item_id}",
            "transaction_type": t.transaction_type,
            "quantity_change": float(t.quantity),
            "user": t.created_by or "SYSTEM",
            "reference": f"{t.reference_type or ''} {t.reference_id or ''}".strip() or "N/A"
        })
    return response

@router.post("/api/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Creates a new inventory stock item.
    """
    service = InventoryService(db)
    return await service.create_inventory_item(payload)

@router.post("/api/inventory/transactions")
async def create_inventory_transaction(
    payload: InventoryTransactionCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Logs an inventory transaction and updates stock levels.
    """
    service = InventoryService(db)
    return await service.log_inventory_transaction(payload)

@router.get("/api/finance/summary", response_model=FinancialSummaryResponse)
async def get_finance_summary(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves the aggregated profit/loss and expense ratios.
    """
    service = FinanceService(db)
    return await service.get_financial_summary()

@router.post("/api/finance/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def log_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Logs a restaurant expense item.
    """
    service = FinanceService(db)
    return await service.create_expense(payload)

@router.get("/api/analytics/insights", response_model=List[InsightResponse])
async def get_insights(db: AsyncSession = Depends(get_db_session)):
    """
    Dynamically generates strategic operational insights.
    """
    service = AnalyticsService(db)
    return await service.generate_insights()

@router.get("/api/audit-logs")
async def list_audit_logs(db: AsyncSession = Depends(get_db_session)):
    """
    Retrieves full chronological audit logs.
    """
    service = AuditLogService(db)
    return await service.list_logs()

