from unittest.mock import patch
from app.ask import ask_stream

with patch("app.ask.search", return_value=[]) as mocked_search, \
     patch("app.ask.stream_complete") as mocked_stream:

    mocked_stream.return_value = iter(["NOT_IN_DOCUMENTS"])

    first = list(ask_stream("stream cache test", k=5))
    second = list(ask_stream("stream cache test", k=5))
    print("First call events:", [event["event"] for event in first])
    print("Second call events:", [event["event"] for event in second])
    print("Search calls:", mocked_search.call_count)
    print("Stream calls:", mocked_stream.call_count)