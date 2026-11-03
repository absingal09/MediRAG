from unittest.mock import patch
from app.ask import ask

with patch("app.ask.search", return_value=[]) as mocked_search, \
     patch("app.ask.complete", return_value="NOT_IN_DOCUMENTS") as mocked_complete:

    ask("cache test question", k=5)
    ask("cache test question", k=5)
    print("Search calls:", mocked_search.call_count)
    print("Complete calls:", mocked_complete.call_count)