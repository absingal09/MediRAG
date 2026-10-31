import csv
from app.config import SOURCES_CSV, PDF_DIR
from app.parse import parse_pdf
from app.chunking import make_chunks
from app.embeddings import embed, count_tokens
from app.db import connect

def load_sources():
    with open(SOURCES_CSV, encoding="utf-8") as f:
        rows = csv.DictReader(f)          # each row becomes a dict, keyed by column names
        return {row["file"]: row for row in rows}

def insert_document(conn, name, source, pages):
    row = conn.execute(
        """INSERT INTO documents (name, source_url, edition, pages)
           VALUES (%s, %s, %s, %s)
           RETURNING id""",
        (name, source["source_url"], source["edition"], pages),
    ).fetchone()
    return row[0]

def insert_chunks(conn, doc_id, chunks, vectors):
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO chunks (document_id, page_no, heading, content, embedding)
               VALUES (%s, %s, %s, %s, %s)""",
            [
                (doc_id, c["page_no"], c["heading"], c["text"], v)
                for c, v in zip(chunks, vectors)
            ],
        )

def main():
    sources = load_sources()
    pdfs = sorted(PDF_DIR.glob("*.pdf"))

    with connect() as conn:
        # 1. wipe: empty both tables, restart ids at 1
        conn.execute("TRUNCATE documents RESTART IDENTITY CASCADE")

        total = 0
        for pdf in pdfs:
            parsed_pdf = parse_pdf(pdf)
            chunks = make_chunks(parsed_pdf)
            texts = [f"{c['heading']}\n{c['text']}" for c in chunks]
            for t in texts:
                if count_tokens(t) > 256:
                    raise ValueError(f"{pdf.name}: chunk over 256 tokens: {t[:60]}")
            pages = max(c["page_no"] for c in chunks)
            doc_id = insert_document(conn, pdf.stem, sources[pdf.name], pages)
            vectors = embed(texts)
            insert_chunks(conn, doc_id, chunks, vectors)
            print(pdf.stem, len(chunks))
            total += len(chunks)
        print(f"Done: {len(pdfs)} documents, {total} chunks")
    # leaving the "with" block commits automatically


if __name__ == "__main__":
    main()