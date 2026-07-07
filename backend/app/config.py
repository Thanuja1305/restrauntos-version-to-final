import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    SUPABASE_URL: str = Field(default="https://ohjmpsmqdacqxmadtfxi.supabase.co")
    SUPABASE_PUBLISHABLE_KEY: str = Field(default="sb_publishable_cxH_9CYpj5UCeU8-yGOCHw_v5Try5NH")
    SUPABASE_SECRET_KEY: str = Field(default="your-secret-key")
    SUPABASE_JWKS_URL: str = Field(default="https://ohjmpsmqdacqxmadtfxi.supabase.co/auth/v1/.well-known/jwks.json")
    
    JWT_SECRET: str = Field(default="restaurant-os-super-secret-key-13579")
    GEMINI_API_KEY: str = Field(default="")
    PORT: int = Field(default=8000)
    HOST: str = Field(default="127.0.0.1")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
