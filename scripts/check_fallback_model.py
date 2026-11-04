from app.config import SARVAM_FALLBACK_MODEL
from app.llm import complete

print("Model:", SARVAM_FALLBACK_MODEL)

answer = complete(
    [{"role": "user", "content": "Reply with only: Hello"}],
    model=SARVAM_FALLBACK_MODEL,
)

print("Answer:", answer)