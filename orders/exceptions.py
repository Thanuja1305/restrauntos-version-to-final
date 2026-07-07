class OrderDomainException(Exception):
    """Base domain exception for the orders module."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class MenuItemNotFoundException(OrderDomainException):
    def __init__(self, menu_item_id: str):
        super().__init__(f"Menu item with ID '{menu_item_id}' not found", status_code=404)

class CustomerNotFoundException(OrderDomainException):
    def __init__(self, customer_id: str):
        super().__init__(f"Customer with ID '{customer_id}' not found", status_code=404)

class OrderNotFoundException(OrderDomainException):
    def __init__(self, order_id: int):
        super().__init__(f"Order with ID '{order_id}' not found", status_code=404)

class EmptyOrderException(OrderDomainException):
    def __init__(self):
        super().__init__("Cannot create an order with zero items", status_code=400)

class InvalidQuantityException(OrderDomainException):
    def __init__(self, menu_item_id: str, quantity: int):
        super().__init__(f"Invalid quantity {quantity} for menu item '{menu_item_id}'. Must be greater than zero.", status_code=400)

class OutOfStockException(OrderDomainException):
    def __init__(self, ingredient_name: str, requested: float, available: float):
        super().__init__(
            f"Insufficient stock for ingredient '{ingredient_name}'. Requested: {requested}, Available: {available}", 
            status_code=400
        )
