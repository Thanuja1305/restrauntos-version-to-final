from fastapi import APIRouter, HTTPException, status
from backend.app.agents.inventory import schemas
from backend.app.agents.inventory.service import InventoryAgentService

router = APIRouter(
    prefix="/agents/inventory",
    tags=["Inventory Agent"]
)

@router.post(
    "/query",
    response_model=schemas.QueryResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit query to the Inventory Agent"
)
async def query_inventory(request: schemas.QueryRequest):
    """
    Submits a user inventory query (e.g., check stock, low stock, expired batches)
    routed through the Orchestrator. Returns structured status and summaries.
    """
    response = await InventoryAgentService.execute_query(request)
    return response
