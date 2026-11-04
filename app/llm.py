import json
import requests

from app.config import SARVAM_API_KEY, SARVAM_MODEL, SARVAM_FALLBACK_MODEL
from app.telemetry import log_model_usage
from time import sleep
from contextlib import closing

SARVAM_URL = "https://api.sarvam.ai/v2/chat/completions"

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 3

def complete(messages, model=SARVAM_MODEL):
    try:
        return _complete_with_retries(messages, model)

    except (
        requests.exceptions.HTTPError,
        requests.exceptions.Timeout,
        requests.exceptions.ConnectionError,
    ) as error:
        if isinstance(error, requests.exceptions.HTTPError):
            if (
                error.response is None
                or error.response.status_code not in RETRYABLE_STATUS_CODES
            ):
                raise

        if not SARVAM_FALLBACK_MODEL or SARVAM_FALLBACK_MODEL == model:
            raise

    return _complete_with_retries(messages, SARVAM_FALLBACK_MODEL)

def _complete_with_retries(messages, model):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")
    for attempt in range(MAX_ATTEMPTS):

        response = None
        usage = None

        try:
            response = requests.post(
                SARVAM_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0,
                    "reasoning_effort": "low",
                    "max_tokens": 1024,
                },
                timeout=(10, 60),
            )

            response.raise_for_status()

            data = response.json()
            usage = data.get("usage")

            return data["choices"][0]["message"]["content"]
        except requests.exceptions.HTTPError:
            if (
                response.status_code not in RETRYABLE_STATUS_CODES
                or attempt == MAX_ATTEMPTS - 1
            ):
                raise
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
            if attempt == MAX_ATTEMPTS - 1:
                raise
        finally:
            try:
                if response is not None:
                    response.close()
            finally:
                log_model_usage("complete", usage)
        sleep(2 ** attempt)

def stream_complete(messages):
    emitted_text = False

    try:
        with closing(_stream_with_retries(messages, SARVAM_MODEL)) as stream:
            for fragment in stream:
                emitted_text = True
                yield fragment
        return

    except (
        requests.exceptions.HTTPError,
        requests.exceptions.Timeout,
        requests.exceptions.ConnectionError,
    ) as error:
        if emitted_text:
            raise

        if isinstance(error, requests.exceptions.HTTPError):
            if (
                error.response is None
                or error.response.status_code not in RETRYABLE_STATUS_CODES
            ):
                raise

        if (
            not SARVAM_FALLBACK_MODEL
            or SARVAM_FALLBACK_MODEL == SARVAM_MODEL
        ):
            raise

    yield from _stream_with_retries(messages, SARVAM_FALLBACK_MODEL)

def _stream_with_retries(messages, model):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")
    for attempt in range(MAX_ATTEMPTS):
        response = None
        usage = None
        emitted_text = False
        try:
            response = requests.post(
                SARVAM_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0,
                    "reasoning_effort": "low",
                    "max_tokens": 1024,
                    "stream": True,
                    "stream_options": {"include_usage": True},
                },
                timeout=(10, 60),
                stream=True,
            )

            response.raise_for_status()

            for line in response.iter_lines():
                if not line:
                    continue

                text = line.decode("utf-8")

                if not text.startswith("data:"):
                    continue

                payload = text[5:].strip()

                if payload == "[DONE]":
                    break

                event = json.loads(payload)

                if event.get("usage") is not None:
                    usage = event["usage"]

                choices = event.get("choices", [])

                if not choices:
                    continue

                delta = choices[0].get("delta", {})
                content = delta.get("content", "")

                if content:
                    emitted_text = True
                    yield content
            return
        except requests.exceptions.HTTPError:
            if (
                emitted_text
                or response.status_code not in RETRYABLE_STATUS_CODES
                or attempt == MAX_ATTEMPTS - 1
            ):
                raise

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
            if emitted_text or attempt == MAX_ATTEMPTS - 1:
                raise
        finally:
            try:
                if response is not None:
                    response.close()
            finally:
                log_model_usage("stream_complete", usage)
        sleep(2 ** attempt)