import os
from pydantic import BaseModel, Field

class Settings(BaseModel):
    DATABASE_URL: str = Field(
        default=os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./inventory.db"),
        description="Async database connection URL"
    )
    GEMINI_API_KEY: str = Field(
        default=os.getenv("GEMINI_API_KEY", ""),
        description="Google Gemini API key for reasoning nodes"
    )
    LOG_LEVEL: str = Field(
        default=os.getenv("LOG_LEVEL", "INFO"),
        description="Logging level for the microservice"
    )

settings = Settings()
