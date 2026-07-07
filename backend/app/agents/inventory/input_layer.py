import uuid
import datetime
from typing import Dict, Any
from backend.app.agents.inventory.state import InventoryAgentState
from backend.app.agents.inventory.exceptions import InvalidRequestException

def validate_request_payload(payload: Dict[str, Any]) -> None:
    """Verifies that all required properties exist and are valid in the incoming JSON request."""
    required_keys = ["request_id", "workflow_id", "restaurant_id", "session_id", "conversation_id", "query"]
    for key in required_keys:
        if key not in payload or not payload[key]:
            raise InvalidRequestException(f"Missing required input parameter: '{key}'")
            
    # Optional constraint validation
    if len(payload["restaurant_id"].strip()) < 3:
        raise InvalidRequestException("Invalid restaurant_id formatting provided.")

def initialize_agent_state(payload: Dict[str, Any]) -> InventoryAgentState:
    """Converts verified orchestrator payload into a strongly-typed LangGraph State dictionary."""
    validate_request_payload(payload)
    
    current_time_iso = datetime.datetime.utcnow().isoformat()
    
    # Extract optional values from context or use sensible defaults
    shared_ctx = payload.get("shared_context", {})
    user_id = shared_ctx.get("user_id", "unknown_user")
    user_role = shared_ctx.get("user_role", "staff")
    trace_id = shared_ctx.get("trace_id", str(uuid.uuid4()))
    
    state: InventoryAgentState = {
        "request_id": payload["request_id"],
        "workflow_id": payload["workflow_id"],
        "trace_id": trace_id,
        "conversation_id": payload["conversation_id"],
        "session_id": payload["session_id"],
        "restaurant_id": payload["restaurant_id"],
        "user_id": user_id,
        "user_role": user_role,
        "inventory_query": payload["query"],
        "intent": "",
        "confidence": 0.0,
        "entities": {},
        "selected_tools": [],
        "planner_output": {},
        "inventory_data": [],
        "supplier_data": [],
        "forecast_data": [],
        "stock_data": [],
        "report_data": {},
        "tool_results": [],
        "business_results": {},
        "execution_history": ["input_layer_validated"],
        "memory": [],
        "errors": [],
        "retry_count": 0,
        "timestamps": {
            "started_at": current_time_iso,
            "last_updated": current_time_iso
        },
        "metadata": {
            "channel": payload.get("channel", "dashboard")
        }
    }
    return state
