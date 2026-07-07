class Intent:
    STOCK_LOOKUP = "StockLookup"
    LOW_STOCK = "LowStock"
    OUT_OF_STOCK = "OutOfStock"
    SUPPLIER_LOOKUP = "SupplierLookup"
    PURCHASE_HISTORY = "PurchaseHistory"
    CONSUMPTION = "Consumption"
    FORECAST = "Forecast"
    INVENTORY_VALUE = "InventoryValue"
    INVENTORY_MOVEMENT = "InventoryMovement"
    EXPIRY_TRACKING = "ExpiryTracking"
    REORDER_SUGGESTION = "ReorderSuggestion"
    INVENTORY_REPORT = "InventoryReport"
    WASTAGE_ANALYSIS = "WastageAnalysis"

class Channel:
    WHATSAPP = "whatsapp"
    APP = "app"
    DASHBOARD = "dashboard"

class ErrorCode:
    INVALID_REQUEST = "INVALID_REQUEST"
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    SUPPLIER_NOT_FOUND = "SUPPLIER_NOT_FOUND"
    INVENTORY_NOT_FOUND = "INVENTORY_NOT_FOUND"
    INVALID_INTENT = "INVALID_INTENT"
    TOOL_FAILURE = "TOOL_FAILURE"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
