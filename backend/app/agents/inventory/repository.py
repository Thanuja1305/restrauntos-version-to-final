import datetime
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, update, and_, or_, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.agents.inventory.config import settings
from backend.app.agents.inventory import models, exceptions

# Database Engine and Session Configuration
engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class InventoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # Ingredient Methods
    async def get_ingredient_by_name(self, restaurant_id: str, name: str) -> Optional[models.Ingredient]:
        stmt = select(models.Ingredient).where(
            and_(
                models.Ingredient.restaurant_id == restaurant_id,
                models.Ingredient.name.ilike(name.strip())
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create_ingredient(self, restaurant_id: str, name: str, unit: str) -> models.Ingredient:
        ingredient = await self.get_ingredient_by_name(restaurant_id, name)
        if not ingredient:
            ingredient = models.Ingredient(restaurant_id=restaurant_id, name=name, unit=unit)
            self.session.add(ingredient)
            await self.session.flush()
        return ingredient

    # Inventory Methods
    async def get_inventory_by_restaurant(self, restaurant_id: str) -> List[models.Inventory]:
        stmt = select(models.Inventory).options(selectinload(models.Inventory.ingredient)).where(
            models.Inventory.restaurant_id == restaurant_id
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_inventory_by_ingredient(self, restaurant_id: str, ingredient_id: int) -> Optional[models.Inventory]:
        stmt = select(models.Inventory).options(selectinload(models.Inventory.ingredient)).where(
            and_(
                models.Inventory.restaurant_id == restaurant_id,
                models.Inventory.ingredient_id == ingredient_id
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_inventory_by_ingredient_name(self, restaurant_id: str, name: str) -> Optional[models.Inventory]:
        stmt = select(models.Inventory).join(models.Ingredient).options(selectinload(models.Inventory.ingredient)).where(
            and_(
                models.Inventory.restaurant_id == restaurant_id,
                models.Ingredient.name.ilike(name.strip())
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_low_stock_items(self, restaurant_id: str) -> List[models.Inventory]:
        stmt = select(models.Inventory).options(selectinload(models.Inventory.ingredient)).where(
            and_(
                models.Inventory.restaurant_id == restaurant_id,
                models.Inventory.quantity <= models.Inventory.reorder_point
            )
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_out_of_stock_items(self, restaurant_id: str) -> List[models.Inventory]:
        stmt = select(models.Inventory).options(selectinload(models.Inventory.ingredient)).where(
            and_(
                models.Inventory.restaurant_id == restaurant_id,
                models.Inventory.quantity <= 0.0
            )
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # Transactions
    async def get_stock_movements(self, restaurant_id: str, limit: int = 50) -> List[models.InventoryTransaction]:
        stmt = select(models.InventoryTransaction).options(
            selectinload(models.InventoryTransaction.inventory).selectinload(models.Inventory.ingredient)
        ).where(
            models.InventoryTransaction.restaurant_id == restaurant_id
        ).order_by(models.InventoryTransaction.timestamp.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_transaction(
        self, restaurant_id: str, inventory_id: int, txn_type: str, quantity: float, reference_id: Optional[str] = None
    ) -> models.InventoryTransaction:
        txn = models.InventoryTransaction(
            restaurant_id=restaurant_id,
            inventory_id=inventory_id,
            type=txn_type,
            quantity=quantity,
            reference_id=reference_id
        )
        self.session.add(txn)
        await self.session.flush()
        return txn

    # Supplier Methods
    async def get_suppliers_by_restaurant(self, restaurant_id: str) -> List[models.Supplier]:
        stmt = select(models.Supplier).where(models.Supplier.restaurant_id == restaurant_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_supplier_by_id_or_name(self, restaurant_id: str, identifier: str) -> Optional[models.Supplier]:
        if identifier.isdigit():
            stmt = select(models.Supplier).where(
                and_(models.Supplier.restaurant_id == restaurant_id, models.Supplier.id == int(identifier))
            )
        else:
            stmt = select(models.Supplier).where(
                and_(models.Supplier.restaurant_id == restaurant_id, models.Supplier.name.ilike(identifier.strip()))
            )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # Purchase Orders
    async def get_purchase_orders(self, restaurant_id: str, limit: int = 50) -> List[models.PurchaseOrder]:
        stmt = select(models.PurchaseOrder).options(
            selectinload(models.PurchaseOrder.supplier),
            selectinload(models.PurchaseOrder.items).selectinload(models.PurchaseItem.ingredient)
        ).where(
            models.PurchaseOrder.restaurant_id == restaurant_id
        ).order_by(models.PurchaseOrder.order_date.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_purchase_order(
        self, restaurant_id: str, supplier_id: int, total_amount: float, items_data: List[Dict[str, Any]]
    ) -> models.PurchaseOrder:
        po = models.PurchaseOrder(
            restaurant_id=restaurant_id,
            supplier_id=supplier_id,
            status="PENDING",
            total_amount=total_amount
        )
        self.session.add(po)
        await self.session.flush()

        for item in items_data:
            po_item = models.PurchaseItem(
                purchase_order_id=po.id,
                ingredient_id=item["ingredient_id"],
                quantity=item["quantity"],
                unit_cost=item["unit_cost"]
            )
            self.session.add(po_item)
        
        await self.session.flush()
        return po

    # Expiry Tracking
    async def get_expiring_items(self, restaurant_id: str, days_threshold: int = 7) -> List[models.ExpiryTracking]:
        cutoff_date = datetime.date.today() + datetime.timedelta(days=days_threshold)
        stmt = select(models.ExpiryTracking).options(
            selectinload(models.ExpiryTracking.inventory).selectinload(models.Inventory.ingredient)
        ).where(
            and_(
                models.ExpiryTracking.restaurant_id == restaurant_id,
                models.ExpiryTracking.expiry_date <= cutoff_date,
                models.ExpiryTracking.quantity > 0.0
            )
        ).order_by(models.ExpiryTracking.expiry_date.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # Forecasts
    async def get_forecasts_by_ingredient(self, restaurant_id: str, ingredient_id: int) -> List[models.InventoryForecast]:
        stmt = select(models.InventoryForecast).where(
            and_(
                models.InventoryForecast.restaurant_id == restaurant_id,
                models.InventoryForecast.ingredient_id == ingredient_id
            )
        ).order_by(models.InventoryForecast.forecast_date.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # KPIs
    async def get_latest_kpi(self, restaurant_id: str) -> Optional[models.InventoryKPI]:
        stmt = select(models.InventoryKPI).where(
            models.InventoryKPI.restaurant_id == restaurant_id
        ).order_by(models.InventoryKPI.date.desc())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # Reports
    async def get_latest_report(self, restaurant_id: str, report_type: str) -> Optional[models.InventoryReport]:
        stmt = select(models.InventoryReport).where(
            and_(
                models.InventoryReport.restaurant_id == restaurant_id,
                models.InventoryReport.report_type == report_type
            )
        ).order_by(models.InventoryReport.generated_at.desc())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
