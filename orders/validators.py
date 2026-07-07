from typing import List
from orders.schemas import OrderCreate, OrderItemCreate
from orders.exceptions import EmptyOrderException, InvalidQuantityException

class OrderValidator:
    @staticmethod
    def validate_create_payload(payload: OrderCreate) -> None:
        """
        Performs static validation checks on the order payload.
        Ensures items aren't empty and quantities are positive.
        """
        if not payload.items:
            raise EmptyOrderException()
        
        for item in payload.items:
            if item.quantity <= 0:
                raise InvalidQuantityException(item.menu_item_id, item.quantity)
            
            if not item.menu_item_id.strip():
                raise ValueError("Menu item ID cannot be empty or whitespace")
