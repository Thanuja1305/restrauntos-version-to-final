import datetime
from typing import Dict, Any, Optional
from backend.app.agents.inventory.repository import InventoryRepository
from backend.app.agents.inventory.exceptions import InventoryNotFoundException

class StockUpdateService:
    def __init__(self, repo: InventoryRepository):
        self.repo = repo

    async def adjust_stock(
        self, restaurant_id: str, ingredient_id: int, quantity_delta: float, txn_type: str, reference_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Adjusts stock levels for an ingredient.
        Increments stock if quantity_delta is positive, decrements if negative.
        Logs an inventory transaction.
        """
        inventory = await self.repo.get_inventory_by_ingredient(restaurant_id, ingredient_id)
        if not inventory:
            raise InventoryNotFoundException(f"Inventory record for ingredient ID {ingredient_id} not found.")

        # Update stock quantity
        inventory.quantity += quantity_delta
        
        # Ensure stock never goes below zero unless adjustments explicitly allow
        if inventory.quantity < 0.0:
            inventory.quantity = 0.0

        # Log transaction record
        txn = await self.repo.create_transaction(
            restaurant_id=restaurant_id,
            inventory_id=inventory.id,
            txn_type=txn_type,
            quantity=quantity_delta,
            reference_id=reference_id
        )

        return {
            "inventory_id": inventory.id,
            "ingredient_name": inventory.ingredient.name,
            "new_quantity": inventory.quantity,
            "transaction_id": txn.id
        }
