from sentence_transformers import SentenceTransformer
from app.config import EMBED_MODEL

model = SentenceTransformer(EMBED_MODEL)

def embed(texts):
    return model.encode(texts, normalize_embeddings=True)

def count_tokens(text):
    return len(model.tokenizer.encode(text))