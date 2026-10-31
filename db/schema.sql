CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id         SERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    source_url TEXT,
    edition    TEXT,
    pages      INT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id          SERIAL PRIMARY KEY,
    document_id INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_no     INT NOT NULL,
    heading TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    embedding   VECTOR(384) NOT NULL
);