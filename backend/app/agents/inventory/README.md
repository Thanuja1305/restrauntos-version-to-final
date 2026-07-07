# RestaurantOS AI - Inventory Agent

This microservice acts as the dedicated **Inventory Domain Agent** for the RestaurantOS AI platform. It handles intent classification, stock planning, tool execution, validation, and response generation for all inventory requests under the coordination of the Orchestrator Agent.

## 🛠 Tech Stack
- **FastAPI** (Python web framework)
- **LangGraph** (StateGraph execution engine)
- **Google Gemini** (LLM reasoning and intent parsing)
- **SQLAlchemy** (ORM mapping)
- **PostgreSQL / Supabase** (Database storage, SQLite supported by default for local testing)

## 📁 Codebase Layout
- `api.py`: Initializes FastAPI instance, configures CORS, and handles lifespan table creation.
- `router.py`: HTTP endpoint routing (`POST /agents/inventory/query`).
- `service.py`: Service boundary connecting API schemas to StateGraph execution.
- `graph.py`: Setup and compilation of the StateGraph nodes.
- `nodes.py`: Execution node logic binding databases and LLMs.
- `state.py`: Strongly-typed TypedDict containing all execution tracking fields.
- `inventory_rules.py`: Formula implementation engine (Valuations, safety margins, turnover rates, low stock warnings).
- `repository.py`: Async queries, transactions, and session bindings using SQLAlchemy.
- `models.py`: Database declarations (Ingredients, Inventory, Suppliers, Expiry records, etc.).

## 🚀 Local Run Command
To start the microservice locally:
```bash
pip install fastapi uvicorn sqlalchemy aiosqlite langgraph google-generativeai pydantic
uvicorn backend.app.agents.inventory.api:app --reload --port 8000
```

## 🧪 Running Tests
To run unit and integration suites:
```bash
pytest backend/tests/
```
