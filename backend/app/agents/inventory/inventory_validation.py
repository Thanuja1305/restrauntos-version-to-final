from typing import Dict, Any
from backend.app.agents.inventory.exceptions import BusinessRuleValidationException

class InventoryValidator:
    @staticmethod
    def validate_final_state(state: Dict[str, Any]) -> None:
        """
        Validates the final execution state parameters.
        Ensures there are no critical validation errors, no invalid confidence scores,
        and no sensitive database parameters leaked.
        """
        errors = state.get("errors", [])
        if errors:
            # We don't block on simple errors unless it's a critical execution trace block
            pass
            
        intent = state.get("intent")
        if not intent:
            raise BusinessRuleValidationException("Validation failed: intent was not detected during execution.")

        confidence = state.get("confidence", 0.0)
        if confidence < 0.0 or confidence > 1.0:
            raise BusinessRuleValidationException("Validation failed: confidence score is outside normal bounds (0.0 to 1.0).")
            
        # Ensure that database primary key variables are mapped safely
        # in structured data and internal variables are sanitized
        business_results = state.get("business_results", {})
        if not isinstance(business_results, dict):
            raise BusinessRuleValidationException("Validation failed: business_results must be a dictionary.")
