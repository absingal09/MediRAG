from app.cache import make_cache_key, get_cached, set_cached

key = make_cache_key("Test question", 5)
print("Before saving:", get_cached(key))

set_cached(key, {"answer": "Original", "citations": []})

result = get_cached(key)
result["answer"] = "Changed"

print("Cached answer:", get_cached(key)["answer"])