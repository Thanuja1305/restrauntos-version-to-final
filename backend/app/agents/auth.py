import jwt
import datetime
from typing import Dict, Any, Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from backend.app.config import settings
from backend.app.supabase_client import supabase
from backend.app.logger import logger

security = HTTPBearer(auto_error=False)

class AuthAgent:
    """
    Handles user session authorization, role access tokens, and user registrations,
    supporting native Supabase Auth and fallback local JWT keys.
    """
    @staticmethod
    def create_local_token(user_data: Dict[str, Any]) -> str:
        payload = {
            "sub": user_data["id"],
            "email": user_data["email"],
            "firstName": user_data.get("firstName", ""),
            "lastName": user_data.get("lastName", ""),
            "role": user_data.get("role", "staff"),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    @staticmethod
    async def login_user(email: str, password: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        
        # 1. Try Supabase Auth
        try:
            res = supabase.auth.sign_in_with_password({
                "email": email_clean,
                "password": password
            })
            if res.user and res.session:
                user_meta = res.user.user_metadata or {}
                user_schema = {
                    "id": res.user.id,
                    "email": res.user.email,
                    "firstName": user_meta.get("firstName", "User"),
                    "lastName": user_meta.get("lastName", ""),
                    "role": user_meta.get("role", "staff"),
                    "isActive": True,
                    "createdAt": res.user.created_at,
                    "name": f"{user_meta.get('firstName', 'User')} {user_meta.get('lastName', '')}".strip()
                }
                return {
                    "success": True,
                    "token": res.session.access_token,
                    "user": user_schema
                }
        except Exception as e:
            logger.warn(f"Supabase login failed, trying fallback account. Info: {e}")

        # 2. Fallback local account (owner@spiceheaven.com / password123 or admin@restaurantos.ai / restaurant123)
        if (email_clean == "owner@spiceheaven.com" and password == "password123") or \
           (email_clean == "admin@restaurantos.ai" and password == "restaurant123"):
            is_owner = email_clean == "owner@spiceheaven.com"
            user_schema = {
                "id": "usr_fallback_1" if is_owner else "usr_fallback_admin",
                "email": email_clean,
                "firstName": "Spice" if is_owner else "Admin",
                "lastName": "Heaven" if is_owner else "User",
                "role": "owner" if is_owner else "admin",
                "isActive": True,
                "createdAt": datetime.datetime.utcnow().isoformat(),
                "name": "Restaurant Owner" if is_owner else "Administrator"
            }
            token = AuthAgent.create_local_token(user_schema)
            return {
                "success": True,
                "token": token,
                "user": user_schema
            }
            
        raise HTTPException(status_code=401, detail="Invalid email or password credentials.")

    @staticmethod
    async def register_user(email: str, password: str, first_name: str, last_name: str, role: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        
        # 1. Try registering with Supabase Auth
        try:
            res = supabase.auth.sign_up({
                "email": email_clean,
                "password": password,
                "options": {
                    "data": {
                        "firstName": first_name,
                        "lastName": last_name,
                        "role": role
                    }
                }
            })
            if res.user:
                return {"success": True, "message": "Registration successful. Please verify your email."}
        except Exception as e:
            logger.error(f"Supabase registration error: {e}")
            
        # 2. Local fallback registration response
        mock_user = {
            "id": f"usr_{int(datetime.datetime.utcnow().timestamp())}",
            "email": email_clean,
            "firstName": first_name,
            "lastName": last_name,
            "role": role,
            "isActive": True,
            "createdAt": datetime.datetime.utcnow().isoformat()
        }
        token = AuthAgent.create_local_token(mock_user)
        return {
            "token": token,
            "user": mock_user
        }

    @staticmethod
    async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Dict[str, Any]:
        if not credentials:
            # Fallback mock user when frontend does not send the token (default behavior in local/dev)
            return {
                "id": "usr_fallback_1",
                "email": "owner@spiceheaven.com",
                "firstName": "Spice",
                "lastName": "Heaven",
                "role": "owner",
                "isActive": True,
                "createdAt": datetime.datetime.utcnow().isoformat(),
                "name": "Restaurant Owner"
            }
            
        token = credentials.credentials
        
        # 1. Try verifying with Supabase Auth API
        try:
            res = supabase.auth.get_user(token)
            if res.user:
                user_meta = res.user.user_metadata or {}
                return {
                    "id": res.user.id,
                    "email": res.user.email,
                    "firstName": user_meta.get("firstName", "User"),
                    "lastName": user_meta.get("lastName", ""),
                    "role": user_meta.get("role", "staff"),
                    "isActive": True,
                    "createdAt": res.user.created_at,
                    "name": f"{user_meta.get('firstName', 'User')} {user_meta.get('lastName', '')}".strip()
                }
        except Exception as e:
            pass

        # 2. Try decoding local fallback token
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            return {
                "id": payload["sub"],
                "email": payload["email"],
                "firstName": payload.get("firstName", ""),
                "lastName": payload.get("lastName", ""),
                "role": payload.get("role", "staff"),
                "isActive": True,
                "createdAt": datetime.datetime.utcnow().isoformat(),
                "name": payload.get("name") or f"{payload.get('firstName', '')} {payload.get('lastName', '')}".strip() or "User"
            }
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            raise HTTPException(status_code=401, detail="Authentication token invalid or expired.")
