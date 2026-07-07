import datetime
from typing import Dict, Any, List

from backend.app.agents.inventory.state import InventoryAgentState
from backend.app.agents.inventory.repository import AsyncSessionLocal, InventoryRepository
from backend.app.agents.inventory.input_layer import initialize_agent_state
from backend.app.agents.inventory.intent_engine import IntentEngine
from backend.app.agents.inventory.context_builder import ContextBuilder
from backend.app.agents.inventory.stock_planner import StockPlanner
from backend.app.agents.inventory.tool_selector import ToolSelector
from backend.app.agents.inventory.inventory_processing import InventoryProcessor
from backend.app.agents.inventory.inventory_rules import InventoryRulesEngine
from backend.app.agents.inventory.inventory_validation import InventoryValidator
from backend.app.agents.inventory.response_generator import ResponseGenerator
from backend.app.agents.inventory.logger import logger
from backend.app.agents.inventory.exceptions import InventoryAgentException

# Node Instances (singletons or stateless helpers)
intent_engine = IntentEngine()
stock_planner = StockPlanner()
response_generator = ResponseGenerator()

async def input_layer_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Validates inputs and initializes internal state tracing fields."""
    logger.info(f"Node execution: input_layer_node, Request ID: {state.get('request_id')}")
    # Already initialized in wrapper or API level, but let's ensure keys are present
    return {"execution_history": state.get("execution_history", []) + ["input_layer"]}

async def intent_engine_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Classifies user intent and identifies entities."""
    logger.info("Node execution: intent_engine_node")
    query = state["inventory_query"]
    
    try:
        classification = await intent_engine.classify(query)
        logger.info(f"Intent classified as: {classification.get('intent')} with confidence {classification.get('confidence')}")
        
        updates = {
            "intent": classification.get("intent", "StockLookup"),
            "confidence": classification.get("confidence", 0.8),
            "entities": classification.get("entities", {}),
            "execution_history": state["execution_history"] + ["intent_engine"]
        }
        
        if classification.get("handoff_required"):
            updates["metadata"] = {**state.get("metadata", {}), "handoff_target": classification.get("target_agent")}
            updates["execution_history"].append("handoff_detected")
            
        return updates
    except Exception as e:
        logger.error(f"Error in intent_engine_node: {e}")
        return {
            "errors": state.get("errors", []) + [f"Intent classification failed: {str(e)}"],
            "intent": "StockLookup",
            "confidence": 0.5,
            "execution_history": state["execution_history"] + ["intent_engine_failed"]
        }

async def context_builder_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Loads default warning thresholds and restaurant timezone/currency settings."""
    logger.info("Node execution: context_builder_node")
    try:
        context = await ContextBuilder.build(state)
        return {
            "metadata": {**state.get("metadata", {}), "context": context},
            "execution_history": state["execution_history"] + ["context_builder"]
        }
    except Exception as e:
        logger.error(f"Error in context_builder_node: {e}")
        return {
            "errors": state.get("errors", []) + [f"Context builder failed: {str(e)}"],
            "execution_history": state["execution_history"] + ["context_builder_failed"]
        }

async def stock_planner_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Generates execution plan containing required tool calls."""
    logger.info("Node execution: stock_planner_node")
    if "handoff_detected" in state["execution_history"]:
        return {"execution_history": state["execution_history"] + ["stock_planner_skipped"]}
        
    try:
        plan = await stock_planner.generate_plan(state["intent"], state["entities"], state["inventory_query"])
        selected_tools = list(set(step["tool"] for step in plan.get("steps", [])))
        return {
            "planner_output": plan,
            "selected_tools": selected_tools,
            "execution_history": state["execution_history"] + ["stock_planner"]
        }
    except Exception as e:
        logger.error(f"Error in stock_planner_node: {e}")
        return {
            "errors": state.get("errors", []) + [f"Planning failed: {str(e)}"],
            "execution_history": state["execution_history"] + ["stock_planner_failed"]
        }

async def execute_tools_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Iterates through and runs tool operations mapped by the planner."""
    logger.info("Node execution: execute_tools_node")
    if "handoff_detected" in state["execution_history"]:
        return {"execution_history": state["execution_history"] + ["execute_tools_skipped"]}

    plan = state.get("planner_output", {})
    steps = plan.get("steps", [])
    if not steps:
        return {"execution_history": state["execution_history"] + ["execute_tools_empty"]}

    tool_results = []
    errors = []

    # Open DB connection session for tool executions
    async with AsyncSessionLocal() as session:
        repo = InventoryRepository(session)
        selector = ToolSelector(repo)
        
        for step in steps:
            try:
                res = await selector.execute_step(state["restaurant_id"], step)
                tool_results.append(res)
                if res.get("status") == "error":
                    errors.append(f"Step {step.get('step_id')} failed: {res.get('error')}")
            except Exception as e:
                errors.append(f"Exception during step {step.get('step_id')}: {str(e)}")

    return {
        "tool_results": tool_results,
        "errors": state.get("errors", []) + errors,
        "execution_history": state["execution_history"] + ["execute_tools"]
    }

async def process_results_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Combines raw tool results and computes stock KPIs, valuations, and replenishment rules."""
    logger.info("Node execution: process_results_node")
    if "handoff_detected" in state["execution_history"]:
        return {"execution_history": state["execution_history"] + ["process_results_skipped"]}

    # Aggregate tool results
    processed = InventoryProcessor.process_tool_results(state.get("tool_results", []))
    
    # Calculate Business Rules Formulas based on intent
    intent = state.get("intent")
    business_results: Dict[str, Any] = {}
    
    inv_data = processed["inventory_data"]
    sup_data = processed["supplier_data"]
    exp_data = processed["stock_data"]  # Expiring batches are saved in stock_data key
    
    # Standard computations
    if intent in ["StockLookup", "ReorderSuggestion", "InventoryReport"]:
        business_results["items"] = inv_data
        
    if intent in ["LowStock", "ReorderSuggestion", "InventoryReport"]:
        low_items = [
            i for i in inv_data 
            if InventoryRulesEngine.is_low_stock(i.get("quantity", 0.0), i.get("reorder_point", 0.0))
        ]
        business_results["low_stock_items"] = low_items

    if intent in ["OutOfStock", "InventoryReport"]:
        oos_items = [
            i for i in inv_data 
            if InventoryRulesEngine.is_out_of_stock(i.get("quantity", 0.0))
        ]
        business_results["out_of_stock_items"] = oos_items

    if intent == "InventoryValue":
        # Calculate total value using pure python calculations
        total_value = InventoryRulesEngine.calculate_total_inventory_value(inv_data)
        business_results["value"] = {
            "total_value": total_value,
            "item_count": len(inv_data)
        }

    if intent == "SupplierLookup":
        business_results["suppliers"] = sup_data

    if intent == "ExpiryTracking":
        # exp_data holds expiring batch dictionaries from SQL Tool
        business_results["expiring_items"] = exp_data

    if intent == "Forecast":
        business_results["forecasts"] = processed["forecast_data"]

    # For multi-step Reorder suggestion: map lead times from suppliers
    if intent == "ReorderSuggestion":
        suggestions = []
        lead_time_map = {s["name"].lower(): s["lead_time_days"] for s in sup_data} if sup_data else {}
        
        # Calculate reorder requirements
        for item in business_results.get("low_stock_items", []):
            req_qty = max(10.0, item.get("reorder_point", 0.0) * 2 - item.get("quantity", 0.0))
            suggestions.append({
                "ingredient_name": item["ingredient_name"],
                "current_stock": item["quantity"],
                "reorder_threshold": item["reorder_point"],
                "suggested_order_quantity": req_qty,
                "cost_estimate": round(req_qty * item.get("cost_per_unit", 0.0), 2)
            })
        business_results["reorder_suggestions"] = suggestions

    return {
        "inventory_data": inv_data,
        "supplier_data": sup_data,
        "forecast_data": processed["forecast_data"],
        "stock_data": processed["stock_data"],
        "business_results": business_results,
        "execution_history": state["execution_history"] + ["process_results"]
    }

async def validate_output_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Performs safety checks and checks business rules validation."""
    logger.info("Node execution: validate_output_node")
    if "handoff_detected" in state["execution_history"]:
        return {"execution_history": state["execution_history"] + ["validate_output_skipped"]}

    try:
        InventoryValidator.validate_final_state(state)
        return {"execution_history": state["execution_history"] + ["validate_output"]}
    except Exception as e:
        logger.error(f"Validation failed in validate_output_node: {e}")
        return {
            "errors": state.get("errors", []) + [f"Validation failure: {str(e)}"],
            "execution_history": state["execution_history"] + ["validate_output_failed"]
        }

async def generate_response_node(state: InventoryAgentState) -> Dict[str, Any]:
    """Formats final return payload with summary text."""
    logger.info("Node execution: generate_response_node")
    
    # Handle handoff targets directly
    if "handoff_detected" in state["execution_history"]:
        target = state.get("metadata", {}).get("handoff_target", "sales")
        return {
            "business_results": {
                "status": "handoff",
                "target_agent": target,
                "reason": f"Request domain is classified under '{target}' agent."
            },
            "execution_history": state["execution_history"] + ["response_generated_handoff"]
        }

    try:
        response_data = await response_generator.generate(state)
        return {
            "business_results": {
                **state.get("business_results", {}),
                "summary": response_data.get("summary", ""),
                "dashboard_suggestions": response_data.get("dashboard_suggestions", [])
            },
            "execution_history": state["execution_history"] + ["response_generated"]
        }
    except Exception as e:
        logger.error(f"Error in generate_response_node: {e}")
        return {
            "business_results": {
                **state.get("business_results", {}),
                "summary": "Executed query successfully, but encountered an error formatting the summary text.",
                "dashboard_suggestions": []
            },
            "errors": state.get("errors", []) + [f"Response generation failed: {str(e)}"],
            "execution_history": state["execution_history"] + ["response_generated_with_error"]
        }
