import time
import datetime
from typing import Dict, Any, List

from backend.app.agents.inventory import schemas, exceptions
from backend.app.agents.inventory.input_layer import initialize_agent_state
from backend.app.agents.inventory.graph import inventory_graph
from backend.app.agents.inventory.logger import logger

class InventoryAgentService:
    @staticmethod
    async def execute_query(request: schemas.QueryRequest) -> schemas.QueryResponse:
        """
        Runs the full LangGraph execution pipeline asynchronously,
        measuring performance metrics and formatting output schemas.
        """
        start_time = time.time()
        
        # 1. Map request to dictionary
        payload = request.model_dump()
        
        try:
            # 2. Parse and initialize State dict
            state = initialize_agent_state(payload)
        except exceptions.InvalidRequestException as e:
            elapsed = time.time() - start_time
            return schemas.QueryResponse(
                intent="Unknown",
                summary=f"Invalid request parameters: {e.message}",
                confidence=0.0,
                status="error",
                structured_data={},
                execution_time=round(elapsed, 4),
                tool_usage=[],
                errors=[e.message]
            )

        # 3. Invoke LangGraph Graph
        try:
            final_state = await inventory_graph.ainvoke(state)
        except Exception as e:
            logger.error(f"LangGraph execution crashed: {e}")
            elapsed = time.time() - start_time
            return schemas.QueryResponse(
                intent="Unknown",
                summary="An internal system error occurred during execution.",
                confidence=0.0,
                status="error",
                structured_data={},
                execution_time=round(elapsed, 4),
                tool_usage=[],
                errors=[str(e)]
            )

        elapsed = time.time() - start_time
        
        # 4. Extract results
        errors = final_state.get("errors", [])
        intent = final_state.get("intent", "StockLookup")
        confidence = final_state.get("confidence", 1.0)
        business_res = final_state.get("business_results", {})
        
        # Determine status (success / handoff / error)
        status = "success"
        if "response_generated_handoff" in final_state.get("execution_history", []):
            status = "handoff"
        elif errors and not business_res:
            status = "error"
            
        summary = business_res.get("summary", "Query completed with empty summaries.")
        
        # Clean up database keys or internal helper fields from structured_data response
        structured_data = {
            k: v for k, v in business_res.items() 
            if k not in ["summary", "dashboard_suggestions"]
        }
        
        # Add suggestions to structured data if they exist
        if "dashboard_suggestions" in business_res:
            structured_data["suggestions"] = business_res["dashboard_suggestions"]

        # Compile list of used tools
        tool_usage = []
        for step_res in final_state.get("tool_results", []):
            tool_name = step_res.get("tool")
            method = step_res.get("method")
            if tool_name and method:
                tool_usage.append(f"{tool_name}.{method}")

        return schemas.QueryResponse(
            agent="inventory",
            status=status,
            intent=intent,
            summary=summary,
            confidence=confidence,
            structured_data=structured_data,
            execution_time=round(elapsed, 4),
            tool_usage=tool_usage,
            errors=errors
        )
