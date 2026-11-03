import requests
import os
from app.config import SARVAM_API_KEY, SARVAM_MODEL
import json

SARVAM_URL = "https://api.sarvam.ai/v2/chat/completions"

def complete(messages):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")

    response = requests.post(SARVAM_URL,
                            headers = {
                                "api-subscription-key" : SARVAM_API_KEY
                            },
                            json = {
                                "model" : SARVAM_MODEL,
                                "messages" : messages,
                                "temperature" : 0,
                                "reasoning_effort" : "low",
                                "max_tokens" : 1024,
                            },
                            timeout=60)
    if not response.ok:
        raise RuntimeError(f"Sarvam {response.status_code}: {response.text}")
    return response.json()["choices"][0]["message"]["content"]

def stream_complete(messages):
    if not SARVAM_API_KEY:
        raise ValueError("SARVAM_API_KEY is missing in .env")

    response = requests.post(SARVAM_URL,
                            headers = {
                                "api-subscription-key" : SARVAM_API_KEY
                            },
                            json = {
                                "model" : SARVAM_MODEL,
                                "messages" : messages,
                                "temperature" : 0,
                                "reasoning_effort" : "low",
                                "max_tokens" : 1024,
                                "stream" : True,
                            },
                            timeout=60,
                            stream=True,
                            )
    if not response.ok:
        raise RuntimeError(f"Sarvam {response.status_code}: {response.text}")

    try:
        for line in response.iter_lines():
            if line:
                text = line.decode("utf-8")

                if not text.startswith("data:"):
                    continue

                payload = text[5:].strip()

                if payload == "[DONE]":
                    break

                event = json.loads(payload)
                choices = event.get("choices", [])

                if not choices:
                    continue

                delta = choices[0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield content
    finally:
        response.close()