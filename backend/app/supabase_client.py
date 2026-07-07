from supabase import create_client, Client
from backend.app.config import settings

# Select secret key if provided, else fall back to publishable key
active_key = settings.SUPABASE_SECRET_KEY
if not active_key or active_key == "your-secret-key":
    active_key = settings.SUPABASE_PUBLISHABLE_KEY

# Centralized client using master credentials
supabase: Client = create_client(settings.SUPABASE_URL, active_key)

def get_user_client(token: str) -> Client:
    """
    Creates a new Supabase client instance bound to the user's JWT token,
    ensuring all Postgrest queries respect RLS rules.
    """
    client = create_client(settings.SUPABASE_URL, active_key)
    client.postgrest.auth(token)
    return client
