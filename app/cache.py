import hashlib
import json

from app.config import CORPUS_VERSION, EMBED_MODEL, SARVAM_MODEL, SARVAM_FALLBACK_MODEL
from copy import deepcopy

PIPELINE_VERSION = "v1"


def make_cache_key(question, k):
    settings = {
        "question" : question,
        "k" : k,
        "corpus_version" : CORPUS_VERSION,
        "embedding_model" : EMBED_MODEL,
        "generation_model" : SARVAM_MODEL,
        "fallback_model": SARVAM_FALLBACK_MODEL,
        "pipeline_version" : PIPELINE_VERSION
    }

    serialized = json.dumps(settings, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

_cache = {}


def get_cached(key):
    # Return a deep copy of the stored result, or None on a miss.
    return deepcopy(_cache.get(key))


def set_cached(key, result):
    # Store a deep copy of result under key.
    _cache[key] = deepcopy(result)