import psycopg
from pgvector.psycopg import register_vector
from app.config import DATABASE_URL

def connect():
    """Connect to the Postgres database and register pgvector."""
    conn = psycopg.connect(DATABASE_URL, connect_timeout=5)
    register_vector(conn)
    return conn