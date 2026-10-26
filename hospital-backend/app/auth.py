# Authentication module — DISABLED for hackathon prototype
# All routes are directly accessible without login

def get_current_user():
    """No-op: returns a default user dict. Auth is disabled."""
    return {"sub": "hackathon", "role": "management", "name": "Hackathon User"}

def require_staff():
    """No-op: all staff endpoints are open. Auth is disabled."""
    return {"sub": "hackathon", "role": "management", "name": "Hackathon User"}
