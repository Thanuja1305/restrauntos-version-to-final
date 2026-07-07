from typing import TypedDict, List, Dict, Any, Optional

class InventoryAgentState(TypedDict):
    request_id: str
    workflow_id: str
    trace_id: str
    conversation_id: str
    session_id: str
    restaurant_id: str
    user_id: str
    user_role: str
    inventory_query: str
    intent: str
    confidence: float
    entities: Dict[str, Any]
    selected_tools: List[str]
    planner_output: Dict[str, Any]
    inventory_data: List[Dict[str, Any]]
    supplier_data: List[Dict[str, Any]]
    forecast_data: List[Dict[str, Any]]
    stock_data: List[Dict[str, Any]]
    report_data: Dict[str, Any]
    tool_results: List[Dict[str, Any]]
    business_results: Dict[str, Any]
    execution_history: List[str]
    memory: List[Dict[str, Any]]
    errors: List[str]
    retry_count: int
    timestamps: Dict[str, str]
    metadata: Dict[str, Any]
