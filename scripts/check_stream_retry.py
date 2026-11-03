from unittest.mock import patch
from app.ask import ask_stream

with patch("app.ask.stream_complete") as streamed, \
     patch("app.ask.complete") as retry:

    streamed.return_value = iter(["Test answer [S999]"])
    retry.return_value = "Test answer [S999]"

    events = list(ask_stream("test question"))
    final = events[-1]

    print("Retry calls:", retry.call_count)
    print("Final event:", final["event"])
    print("Refused:", final["data"]["refused"])
    print("Citations:", final["data"]["citations"])