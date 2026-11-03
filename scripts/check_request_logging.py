from unittest.mock import patch

from app.ask import ask, ask_stream


def fake_stream(messages):
    yield "Hello"


# Failed normal and streaming requests.
for function in (ask, ask_stream):
    with patch("app.ask.get_cached", return_value=None), \
         patch("app.ask.search", side_effect=RuntimeError("Test failure")), \
         patch("app.ask.log_request") as logged:

        try:
            if function is ask:
                function("logging test")
            else:
                list(function("logging test"))
        except RuntimeError:
            pass

        assert logged.call_count == 1
        assert logged.call_args.kwargs["status"] == "error"
        assert logged.call_args.kwargs["error_type"] == "RuntimeError"

        print(function.__name__, "error logging passed")


# Stream closed before a final result.
with patch("app.ask.get_cached", return_value=None), \
     patch("app.ask.search", return_value=[]), \
     patch("app.ask.build_messages", return_value=[]), \
     patch("app.ask.stream_complete", side_effect=fake_stream), \
     patch("app.ask.log_request") as logged:

    stream = ask_stream("closure test")
    next(stream)
    stream.close()

    assert logged.call_count == 1
    assert logged.call_args.kwargs["status"] == "closed"

    print("Stream closure logging passed")