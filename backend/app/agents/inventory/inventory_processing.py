from typing import Dict, Any, List

class InventoryProcessor:
    @staticmethod
    def process_tool_results(tool_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Gathers raw results from the different tool steps and splits them 
        into distinct collections (inventory_data, supplier_data, forecast_data, stock_data).
        """
        aggregated = {
            "inventory_data": [],
            "supplier_data": [],
            "forecast_data": [],
            "stock_data": []
        }

        for step_result in tool_results:
            if step_result.get("status") != "success":
                continue
                
            tool_name = step_result.get("tool")
            method_name = step_result.get("method")
            result = step_result.get("result")

            if tool_name == "InventorySQLTool":
                if method_name in ["getCurrentStock", "getLowStockItems", "getOutOfStockItems"]:
                    if isinstance(result, list):
                        aggregated["inventory_data"].extend(result)
                elif method_name in ["getPurchaseHistory", "getStockMovements", "getExpiringItems"]:
                    if isinstance(result, list):
                        aggregated["stock_data"].extend(result)
                elif method_name == "getInventoryValue":
                    if isinstance(result, dict):
                        aggregated["stock_data"].append(result)

            elif tool_name == "SupplierTool":
                if isinstance(result, list):
                    aggregated["supplier_data"].extend(result)

            elif tool_name == "StockTool":
                if method_name == "getForecast":
                    if isinstance(result, list):
                        aggregated["forecast_data"].extend(result)

        return aggregated
