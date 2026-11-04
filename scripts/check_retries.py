from unittest.mock import Mock, patch, call
import requests

from app.llm import (
    _complete_with_retries,
    _stream_with_retries,
    SARVAM_MODEL,
)

response = Mock()
response.json.return_value = {
    "choices": [{"message": {"content": "Hello"}}],
    "usage": {}
}

with patch("app.llm.requests.post") as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    mocked_post.side_effect = [
        requests.exceptions.Timeout("Test timeout"),
        response,
    ]

    answer = _complete_with_retries(
        [{"role": "user", "content": "Hello"}],
        SARVAM_MODEL,
    )

    assert answer == "Hello"
    assert mocked_post.call_count == 2
    mocked_sleep.assert_called_once_with(1)
    response.close.assert_called_once()

    print("Timeout retry passed")

with patch("app.llm.requests.post") as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    mocked_post.side_effect = requests.exceptions.Timeout("Test timeout")

    try:
        _complete_with_retries([{"role": "user", "content": "Hello"}], SARVAM_MODEL)
    except requests.exceptions.Timeout:
        pass
    else:
        raise AssertionError("Expected the final timeout to be raised")

    assert mocked_post.call_count == 3
    assert mocked_sleep.call_args_list == [call(1), call(2)]

    print("Retry limit passed")

forbidden = Mock()
forbidden.status_code = 403
forbidden.raise_for_status.side_effect = requests.exceptions.HTTPError(
    "Forbidden", response=forbidden
)

with patch("app.llm.requests.post", return_value=forbidden) as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    try:
        _complete_with_retries([{"role": "user", "content": "Hello"}], SARVAM_MODEL)
    except requests.exceptions.HTTPError:
        pass
    else:
        raise AssertionError("Expected HTTPError")

    mocked_post.assert_called_once()
    mocked_sleep.assert_not_called()
    forbidden.close.assert_called_once()

    print("Non-retryable HTTP error passed")

overloaded = Mock()
overloaded.status_code = 429
overloaded.raise_for_status.side_effect = requests.exceptions.HTTPError(
    "Rate limited", response=overloaded
)

response.reset_mock()

with patch("app.llm.requests.post", side_effect=[overloaded, response]) as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    assert _complete_with_retries([{"role": "user", "content": "Hello"}], SARVAM_MODEL) == "Hello"

    assert mocked_post.call_count == 2
    mocked_sleep.assert_called_once_with(1)
    overloaded.close.assert_called_once()
    response.close.assert_called_once()

    print("Retryable HTTP error passed")

stream_response = Mock()
stream_response.iter_lines.return_value = [
    b'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    b'data: [DONE]',
]

with patch("app.llm.requests.post", side_effect=[
    requests.exceptions.Timeout("Test timeout"),
    stream_response,
]) as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    fragments = list(_stream_with_retries([
        {"role": "user", "content": "Hello"}
    ], SARVAM_MODEL))

    assert fragments == ["Hello"]
    assert mocked_post.call_count == 2
    mocked_sleep.assert_called_once_with(1)
    stream_response.close.assert_called_once()

    print("Streaming timeout retry passed")

def interrupted_lines():
    yield b'data: {"choices":[{"delta":{"content":"Hello"}}]}'
    raise requests.exceptions.ConnectionError("Stream interrupted")


interrupted_response = Mock()
interrupted_response.iter_lines.side_effect = interrupted_lines

with patch("app.llm.requests.post", return_value=interrupted_response) as mocked_post, \
     patch("app.llm.sleep") as mocked_sleep, \
     patch("app.llm.log_model_usage"):

    stream = _stream_with_retries([{"role": "user", "content": "Hello"}], SARVAM_MODEL)

    assert next(stream) == "Hello"

    try:
        next(stream)
    except requests.exceptions.ConnectionError:
        pass
    else:
        raise AssertionError("Expected the stream error")

    mocked_post.assert_called_once()
    mocked_sleep.assert_not_called()
    interrupted_response.close.assert_called_once()

    print("No retry after streamed text passed")