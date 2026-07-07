import inspect
from typing import Dict, Any, List
from backend.app.agents.inventory.repository import InventoryRepository
from backend.app.agents.inventory.inventory_sql_tool import InventorySQLTool
from backend.app.agents.inventory.supplier_tool import SupplierTool
from backend.app.agents.inventory.stock_tool import StockTool
from backend.app.agents.inventory.logger import logger
from backend.app.agents.inventory.exceptions import ToolException

class ToolSelector:
    def __init__(self, repo: InventoryRepository):
        self.sql_tool = InventorySQLTool(repo)
        self.supplier_tool = SupplierTool(repo)
        self.stock_tool = StockTool(repo)

    async def execute_step(self, restaurant_id: str, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a single step of the plan by finding the requested tool and method
        and calling it with the provided params.
        """
        tool_name = step.get("tool")
        method_name = step.get("method")
        params = step.get("params", {})
        
        # Inject restaurant_id since every tool needs it
        params["restaurant_id"] = restaurant_id

        logger.info(f"Executing tool {tool_name}.{method_name} with params {params}")

        # Locate tool instance
        if tool_name == "InventorySQLTool":
            tool_instance = self.sql_tool
        elif tool_name == "SupplierTool":
            tool_instance = self.supplier_tool
        elif tool_name == "StockTool":
            tool_instance = self.stock_tool
        else:
            raise ToolException(f"Unsupported tool name specified: '{tool_name}'")

        # Locate method on tool
        if not hasattr(tool_instance, method_name):
            raise ToolException(f"Tool '{tool_name}' has no method named '{method_name}'")

        method = getattr(tool_instance, method_name)
        
        try:
            # Check signature parameters to only pass what the method expects
            sig = inspect.signature(method)
            filtered_params = {
                k: v for k, v in params.items() if k in sig.parameters
            }
            
            # Execute async tool method
            result = await method(**filtered_params)
            
            return {
                "step_id": step.get("step_id"),
                "tool": tool_name,
                "method": method_name,
                "status": "success",
                "result": result
            }
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}.{method_name}: {e}")
            return {
                "step_id": step.get("step_id"),
                "tool": tool_name,
                "method": method_name,
                "status": "error",
                "error": str(e)
            }
