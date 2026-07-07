from backend.app.agents.inventory.constants import ErrorCode

class InventoryAgentException(Exception):
    def __init__(self, message: str, error_code: str = ErrorCode.INTERNAL_ERROR):
        super().__init__(message)
        self.message = message
        self.error_code = error_code

class InvalidRequestException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.INVALID_REQUEST)

class DatabaseException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.DATABASE_UNAVAILABLE)

class SupplierNotFoundException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.SUPPLIER_NOT_FOUND)

class InventoryNotFoundException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.INVENTORY_NOT_FOUND)

class ToolException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.TOOL_FAILURE)

class BusinessRuleValidationException(InventoryAgentException):
    def __init__(self, message: str):
        super().__init__(message, ErrorCode.VALIDATION_ERROR)
