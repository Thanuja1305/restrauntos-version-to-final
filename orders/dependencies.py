import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Normally read database URI from environment (Supabase connection)
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if not DATABASE_URL or DATABASE_URL == '""' or not (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql+asyncpg://")):
    print("⚠️ DATABASE_URL not set or invalid. Falling back to local SQLite database with aiosqlite.")
    DATABASE_URL = "sqlite+aiosqlite:///restaurant_db.sqlite"
else:
    # Automatically rewrite connection string prefix for async pg driver compatibility
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True if "sqlite" not in DATABASE_URL else False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def init_tables():
    """
    Auto-creates all SQLAlchemy database tables in the PostgreSQL/Supabase database.
    """
    from orders.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an asynchronous database session.
    Automatically rolls back on exception, and commits or closes on completion.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
