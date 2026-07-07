import logging
import sys
from backend.app.agents.inventory.config import settings

def setup_logger():
    logger = logging.getLogger("inventory_agent")
    
    # Avoid duplicate handlers if initialized multiple times
    if logger.handlers:
        return logger
        
    logger.setLevel(settings.LOG_LEVEL)
    
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "name": "%(name)s", "level": "%(levelname)s", "message": "%(message)s"}'
    )
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger

logger = setup_logger()
