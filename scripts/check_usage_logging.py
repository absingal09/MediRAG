from unittest.mock import Mock, patch

import requests

from app.llm import complete, stream_complete


# Timeouts: unknown usage must be logged exactly once.
for function in (complete, stream_complete):
    with patch("app.llm.SARVAM_API_KEY", "test-key"), \
         patch(
             "app.llm.requests.post",
             side_effect=requests.exceptions.ReadTimeout("Test timeout"),
         ), \
         patch("app.llm.log_model_usage") as logged:

        try:
            if function is complete:
                function([])
            else:
                list(function([]))
        except requests.exceptions.ReadTimeout:
            pass
        else:
            raise AssertionError("Expected a timeout")

        logged.assert_called_once_with(function.__name__, None)
        print(function.__name__, "timeout usage logging passed")


# Interrupted stream: response closes and unavailable usage stays unknown.
response = Mock()
response.ok = True
response.iter_lines.return_value = iter([
    b'data: {"choices":[{"delta":{"content":"Hello"}}]}'
])

with patch("app.llm.SARVAM_API_KEY", "test-key"), \
     patch("app.llm.requests.post", return_value=response), \
     patch("app.llm.log_model_usage") as logged:

    stream = stream_complete([])
    assert next(stream) == "Hello"
    stream.close()

    response.close.assert_called_once()
    logged.assert_called_once_with("stream_complete", None)
    print("Interrupted stream cleanup and usage logging passed")