from typing import List, Dict, Any, Optional
from backend.app.agents.database_agent import DatabaseAgent

class NotificationAgent:
    """
    Creates and manages system notifications, warnings, and alerts.
    """
    @staticmethod
    async def get_notifications() -> List[Dict[str, Any]]:
        return await DatabaseAgent.get_notifications()

    @staticmethod
    async def mark_all_read() -> None:
        await DatabaseAgent.mark_notifications_read()

    @staticmethod
    async def mark_single_read(notif_id: str) -> Optional[Dict[str, Any]]:
        return await DatabaseAgent.mark_single_notification_read(notif_id)
