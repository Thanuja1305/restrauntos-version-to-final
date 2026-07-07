from langgraph.graph import StateGraph, END

from backend.app.agents.inventory.state import InventoryAgentState
from backend.app.agents.inventory import nodes

# 1. Initialize State Graph
workflow = StateGraph(InventoryAgentState)

# 2. Register Nodes
workflow.add_node("input_layer", nodes.input_layer_node)
workflow.add_node("intent_engine", nodes.intent_engine_node)
workflow.add_node("context_builder", nodes.context_builder_node)
workflow.add_node("stock_planner", nodes.stock_planner_node)
workflow.add_node("execute_tools", nodes.execute_tools_node)
workflow.add_node("process_results", nodes.process_results_node)
workflow.add_node("validate_output", nodes.validate_output_node)
workflow.add_node("generate_response", nodes.generate_response_node)

# 3. Setup Entry Points and Transitions
workflow.set_entry_point("input_layer")

workflow.add_edge("input_layer", "intent_engine")
workflow.add_edge("intent_engine", "context_builder")
workflow.add_edge("context_builder", "stock_planner")
workflow.add_edge("stock_planner", "execute_tools")
workflow.add_edge("execute_tools", "process_results")
workflow.add_edge("process_results", "validate_output")
workflow.add_edge("validate_output", "generate_response")
workflow.add_edge("generate_response", END)

# 4. Compile Graph Workflow
inventory_graph = workflow.compile()
