"""Settings, read from .env in one place. Every other file imports from here."""
import os
from pathlib import Path

from dotenv import load_dotenv

# config.py is in MediRAG/app/, so .parent = app/, .parent.parent = MediRAG/
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

# Required: crash immediately with a clear KeyError if it's missing
DATABASE_URL = os.environ["DATABASE_URL"]

# Optional: fall back to a default
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_MODEL = os.getenv("SARVAM_MODEL", "glm5.3")
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
TOP_K = int(os.getenv("TOP_K", "5"))   # .env values are strings

# Paths built from ROOT, so they work no matter which folder you run from
PDF_DIR = ROOT / "data" / "pdfs"
SOURCES_CSV = ROOT / "data" / "sources.csv"
QUESTIONS_FILE = ROOT / "evals" / "questions.yaml"