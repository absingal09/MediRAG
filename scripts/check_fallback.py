from unittest.mock import patch, call
import requests

from app.llm import complete, SARVAM_MODEL, stream_complete

messages = [{"role": "user", "content": "Hello"}]

with patch("app.llm.SARVAM_FALLBACK_MODEL", "test-fallback"), \
     patch("app.llm._complete_with_retries") as mocked_complete:

    mocked_complete.side_effect = [
        requests.exceptions.Timeout("Primary exhausted"),
        "Fallback answer",
    ]

    assert complete(messages) == "Fallback answer"
    assert mocked_complete.call_args_list == [
        call(messages, SARVAM_MODEL),
        call(messages, "test-fallback"),
    ]

    print("Fallback switching passed")

response = requests.Response()
response.status_code = 403

with patch("app.llm.SARVAM_FALLBACK_MODEL", "test-fallback"), \
     patch("app.llm._complete_with_retries") as mocked_complete:

    mocked_complete.side_effect = requests.exceptions.HTTPError(
        "Forbidden", response=response
    )

    try:
        complete(messages)
    except requests.exceptions.HTTPError:
        pass
    else:
        raise AssertionError("Expected authentication error")

    mocked_complete.assert_called_once_with(messages, SARVAM_MODEL)

    print("No fallback on authentication error passed")

def failed_stream():
    raise requests.exceptions.Timeout("Primary exhausted")
    yield


def fallback_stream():
    yield "Fallback answer"


with patch("app.llm.SARVAM_FALLBACK_MODEL", "test-fallback"), \
     patch("app.llm._stream_with_retries") as mocked_stream:

    mocked_stream.side_effect = [
        failed_stream(),
        fallback_stream(),
    ]

    assert list(stream_complete(messages)) == ["Fallback answer"]
    assert mocked_stream.call_args_list == [
        call(messages, SARVAM_MODEL),
        call(messages, "test-fallback"),
    ]

    print("Streaming fallback passed")

def interrupted_stream():
    yield "Partial answer"
    raise requests.exceptions.ConnectionError("Stream interrupted")


with patch("app.llm.SARVAM_FALLBACK_MODEL", "test-fallback"), \
     patch("app.llm._stream_with_retries", return_value=interrupted_stream()) as mocked_stream:

    stream = stream_complete(messages)
    assert next(stream) == "Partial answer"

    try:
        next(stream)
    except requests.exceptions.ConnectionError:
        pass
    else:
        raise AssertionError("Expected stream failure")

    mocked_stream.assert_called_once_with(messages, SARVAM_MODEL)

    print("No fallback after streamed text passed")