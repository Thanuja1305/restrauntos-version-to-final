from typing import List, Dict, Any, Optional
from backend.app.agents.inventory.repository import InventoryRepository

class SupplierTool:
    def __init__(self, repo: InventoryRepository):
        self.repo = repo

    async def getSupplier(self, restaurant_id: str, supplier_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves specific supplier details by name or returns all suppliers if name is omitted."""
        if supplier_name:
            supplier = await self.repo.get_supplier_by_id_or_name(restaurant_id, supplier_name)
            if not supplier:
                return []
            return [{
                "id": supplier.id,
                "name": supplier.name,
                "contact_name": supplier.contact_name,
                "email": supplier.email,
                "phone": supplier.phone,
                "address": supplier.address,
                "lead_time_days": supplier.lead_time_days,
                "rating": supplier.rating
            }]
        else:
            suppliers = await self.repo.get_suppliers_by_restaurant(restaurant_id)
            return [{
                "id": s.id,
                "name": s.name,
                "contact_name": s.contact_name,
                "email": s.email,
                "phone": s.phone,
                "address": s.address,
                "lead_time_days": s.lead_time_days,
                "rating": s.rating
            } for s in suppliers]

    async def getSuppliers(self, restaurant_id: str) -> List[Dict[str, Any]]:
        """Retrieves all suppliers registered for the restaurant."""
        return await self.getSupplier(restaurant_id)
