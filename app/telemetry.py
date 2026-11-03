import json
import logging

logger = logging.getLogger("uvicorn.error")


def log_request(
    mode, cache_hit, elapsed_ms, status="success", error_type=None
):
    entry = {
        "event": "request",
        "mode": mode,
        "cache_hit": cache_hit,
        "elapsed_ms": round(elapsed_ms, 3),
        "status": status,
        "error_type": error_type,
    }
    logger.info(json.dumps(entry))

def log_model_usage(mode, usage):
    entry = {
        "event": "model_usage",
        "mode": mode,
        "usage": usage
    }
    logger.info(json.dumps(entry))