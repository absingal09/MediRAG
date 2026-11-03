import json

import requests

from app.config import SARVAM_API_KEY, SARVAM_MODEL
from app.telemetry import log_model_usage

SARVAM_URL = "https://api.sarvam.ai/v2/chat/completions"


def complete(messages):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")

    response = None
    usage = None

    try:
        response = requests.post(
            SARVAM_URL,
            headers={
                "api-subscription-key": SARVAM_API_KEY
            },
            json={
                "model": SARVAM_MODEL,
                "messages": messages,
                "temperature": 0,
                "reasoning_effort": "low",
                "max_tokens": 1024,
            },
            timeout=60,
        )

        if not response.ok:
            raise RuntimeError(
                f"Sarvam {response.status_code}: {response.text}"
            )

        data = response.json()
        usage = data.get("usage")

        return data["choices"][0]["message"]["content"]

    finally:
        try:
            if response is not None:
                response.close()
        finally:
            log_model_usage("complete", usage)


def stream_complete(messages):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")

    response = None
    usage = None

    try:
        response = requests.post(
            SARVAM_URL,
            headers={
                "api-subscription-key": SARVAM_API_KEY
            },
            json={
                "model": SARVAM_MODEL,
                "messages": messages,
                "temperature": 0,
                "reasoning_effort": "low",
                "max_tokens": 1024,
                "stream": True,
                "stream_options": {"include_usage": True},
            },
            timeout=60,
            stream=True,
        )

        if not response.ok:
            raise RuntimeError(
                f"Sarvam {response.status_code}: {response.text}"
            )

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
                yield content

    finally:
        try:
            if response is not None:
                response.close()
        finally:
            log_model_usage("stream_complete", usage)