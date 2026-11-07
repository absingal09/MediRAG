"""Frozen supplementary evaluation; never modifies production code or old evals."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import time
import unicodedata
import re
from unittest.mock import patch

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evals/fresh50"
TRACKED = ["evals/fresh50/questions.yaml", "evals/fresh50/protocol.md",
           "evals/fresh50/judge_prompt.txt", "scripts/eval_fresh50.py"]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def normalized(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def read(name, default=None):
    path = OUT / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save(name, data):
    path = OUT / name
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def questions():
    import fitz
    items = yaml.safe_load((OUT / "questions.yaml").read_text(encoding="utf-8"))["questions"]
    assert len(items) == len({q["id"] for q in items}) == 50
    assert Counter(q["type"] for q in items) == {"direct": 30, "multi": 10, "unanswerable": 10}
    old = yaml.safe_load((ROOT / "evals/questions.yaml").read_text(encoding="utf-8"))["questions"]
    assert not {normalized(q["question"]).casefold() for q in old} & {normalized(q["question"]).casefold() for q in items}
    for q in items:
        assert bool(q["sources"]) == (q["type"] != "unanswerable")
        assert bool(q["required_facts"]) == (q["type"] != "unanswerable")
        for source in q["sources"]:
            with fitz.open(ROOT / "data/pdfs" / (source["doc"] + ".pdf")) as pdf:
                text = normalized(pdf[source["page"] - 1].get_text())
            assert all(normalized(quote) in text for quote in source["evidence_quotes"]), q["id"]
    assert len({s["doc"] for q in items for s in q["sources"]}) == 14
    return items


def settings():
    from app import config
    return {k: getattr(config, k) for k in ["SARVAM_MODEL", "SARVAM_FALLBACK_MODEL", "EMBED_MODEL", "TOP_K", "CORPUS_VERSION"]}


def database_snapshot():
    from app.db import connect
    with connect() as conn:
        rows = conn.execute("SELECT d.name,c.page_no,c.heading,c.content FROM chunks c JOIN documents d ON d.id=c.document_id ORDER BY d.name,c.page_no,c.id").fetchall()
    assert len(rows) == 494 and len({r[0] for r in rows}) == 14
    return {"documents": 14, "chunks": 494, "content_sha256": digest(json.dumps(rows, ensure_ascii=False).encode())}


def snapshot():
    paths = [ROOT / p for p in TRACKED] + sorted((ROOT / "app").glob("*.py")) + sorted((ROOT / "data/pdfs").glob("*.pdf"))
    return {"files": {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p.read_bytes()) for p in paths},
            "settings": settings(), "database": database_snapshot(),
            "packages": {name: importlib.metadata.version(name) for name in ["sentence-transformers", "transformers", "torch", "requests", "psycopg", "PyYAML"]}}


def freeze():
    questions()
    current = snapshot()
    previous = read("freeze.json")
    if previous:
        assert current == previous["snapshot"], "Frozen inputs changed; do not overwrite the existing run."
        print("Frozen inputs verified.", flush=True)
        return previous
    manifest = {"created_utc": datetime.now(timezone.utc).isoformat(),
                "git_revision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                "snapshot": current, "retrieval": "vector top20 -> cross-encoder/ms-marco-MiniLM-L6-v2 CPU batch1 -> top5",
                "generation": {"temperature": 0, "reasoning_effort": "low", "max_tokens": 1024, "cache": "bypassed", "configured_fallback": "preserved"}}
    save("freeze.json", manifest)
    print("Frozen 50 questions, scoring protocol, application, corpus and database.", flush=True)
    return manifest


def verify():
    manifest = read("freeze.json")
    assert manifest, "Run --freeze before generating answers."
    assert snapshot() == manifest["snapshot"], "Frozen inputs changed; stop rather than mix configurations."


def tracked_calls(calls):
    import app.llm as llm
    original = llm.requests.post
    def post(*args, **kwargs):
        entry = {"requested_model": kwargs.get("json", {}).get("model")}
        calls.append(entry)
        try:
            response = original(*args, **kwargs)
            entry["http_status"] = response.status_code
            if response.ok:
                body = response.json()
                entry.update({"response_model": body.get("model"), "response_id": body.get("id"), "usage": body.get("usage"),
                              "finish_reason": (body.get("choices") or [{}])[0].get("finish_reason")})
            return response
        except Exception as error:
            entry["error_type"] = type(error).__name__
            raise
    return patch("app.llm.requests.post", post)


def run_answers():
    verify()
    from app.ask import ask
    records = read("answers.json", [])
    completed = {r["id"] for r in records}
    errors = read("generation_errors.json", [])
    consecutive_failures = 0
    for item in questions():
        if item["id"] in completed:
            continue
        calls = []
        start = time.perf_counter()
        try:
            with patch("app.ask.get_cached", return_value=None), patch("app.ask.set_cached"), tracked_calls(calls):
                result = ask(item["question"], k=5)
        except Exception as error:
            # No credentials, request headers or connection strings in logs.
            errors.append({"id": item["id"], "error_type": type(error).__name__, "model_calls": calls, "utc": datetime.now(timezone.utc).isoformat()})
            save("generation_errors.json", errors)
            print(f"{item['id']}: transport/execution error ({type(error).__name__}); retained for resume", flush=True)
            consecutive_failures += 1
            if consecutive_failures >= 3:
                raise RuntimeError("Three consecutive failures; saved progress. Resume without regenerating completed answers.") from None
            continue
        consecutive_failures = 0
        record = {**item, "generated_answer": result["answer"], "refused": result["refused"], "citations": result["citations"],
                  "invalid": result.get("invalid", []), "retrieved_sources": result["sources"], "model_calls": calls,
                  "elapsed_ms": round((time.perf_counter() - start) * 1000, 2), "utc": datetime.now(timezone.utc).isoformat()}
        records.append(record)
        save("answers.json", records)
        completed.add(item["id"])
        print(f"Saved {item['id']} ({len(records)}/50), refused={result['refused']}", flush=True)
    print(f"Saved {len(records)} unique answers. Existing answers were not rerun.", flush=True)


def parse_judge(raw, fact_count):
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    obj = json.loads(text)
    facts = obj["fact_results"]
    assert len(facts) == fact_count
    assert {f["index"] for f in facts} == set(range(1, fact_count + 1))
    assert all(isinstance(f["supported"], bool) and isinstance(f["reason"], str) for f in facts)
    assert isinstance(obj["contradictions"], list) and isinstance(obj["extra_claims_to_review"], list)
    supported = sum(f["supported"] for f in facts)
    verdict = "incorrect" if obj["contradictions"] or supported == 0 else "correct" if supported == fact_count else "partial"
    return {**obj, "verdict": verdict}


def judge():
    verify()
    from app.llm import complete
    answers = read("answers.json", [])
    assert len(answers) == 50, "Complete all 50 saved answers before judging."
    judgements = read("judgements.json", [])
    completed = {j["id"] for j in judgements}
    prompt = (OUT / "judge_prompt.txt").read_text(encoding="utf-8")
    for r in answers:
        if r["type"] == "unanswerable" or r["id"] in completed:
            continue
        calls = []
        if r["refused"]:
            entry = {"id": r["id"], "verdict": "incorrect", "reason": "Refused an answerable question.", "fact_results": [], "contradictions": [], "extra_claims_to_review": [], "raw_response": None, "method": "deterministic_refusal"}
        else:
            messages = [{"role": "system", "content": prompt}, {"role": "user", "content": json.dumps({
                "question": r["question"], "required_facts": r["required_facts"], "reference_evidence": r["sources"],
                "candidate": r["generated_answer"], "retrieved_sources": r["retrieved_sources"]}, ensure_ascii=False)}]
            with tracked_calls(calls):
                raw = complete(messages)
            try:
                entry = {"id": r["id"], **parse_judge(raw, len(r["required_facts"])), "raw_response": raw, "method": "llm_fact_judge"}
            except Exception as error:
                errors = read("judge_errors.json", [])
                errors.append({"id": r["id"], "raw_response": raw, "model_calls": calls, "error_type": type(error).__name__})
                save("judge_errors.json", errors)
                raise RuntimeError(f"Judge output invalid for {r['id']}; raw output retained, no verdict invented.") from None
        judgements.append({**entry, "model_calls": calls})
        save("judgements.json", judgements)
        completed.add(r["id"])
        print(f"Judged {r['id']}: {entry['verdict']} ({len(judgements)}/40)", flush=True)


def summary():
    answers = read("answers.json", [])
    judgements = read("judgements.json", [])
    answerable = [r for r in answers if r["type"] != "unanswerable"]
    absent = [r for r in answers if r["type"] == "unanswerable"]
    metrics = []
    for r in answerable:
        expected = {(s["doc"], s["page"]) for s in r["sources"]}
        pages = [(s["doc_name"], s["page_no"]) for s in r["retrieved_sources"][:5]]
        first = next((i for i, page in enumerate(pages, 1) if page in expected), None)
        metrics.append({"id": r["id"], "hit": first is not None, "rr": 1 / first if first else 0,
                        "page_coverage": len(expected & set(pages)) / len(expected), "all_pages": expected <= set(pages)})
    save("retrieval.json", metrics)
    counts = Counter(j["verdict"] for j in judgements)
    result = {"saved_answers": len(answers), "unique_ids": len({r['id'] for r in answers}), "answerable": len(answerable),
              "judged": len(judgements), "raw_verdict_counts": dict(counts), "correct_refusals": sum(r["refused"] for r in absent),
              "unanswerable": len(absent), "false_refusals": sum(r["refused"] for r in answerable),
              "hit_at_5": sum(m["hit"] for m in metrics), "mrr_at_5": sum(m["rr"] for m in metrics) / len(metrics) if metrics else None,
              "mean_page_coverage": sum(m["page_coverage"] for m in metrics) / len(metrics) if metrics else None,
              "all_pages_at_5": sum(m["all_pages"] for m in metrics), "review_status": "pending assistant adjudication; raw judge results only"}
    save("summary.json", result)
    print(json.dumps(result, indent=2), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ["freeze", "run", "judge", "summary", "validate"]:
        parser.add_argument("--" + flag, action="store_true")
    args = parser.parse_args()
    if args.validate:
        questions()
        print("50-question schema and original-PDF evidence verified.")
    if args.freeze: freeze()
    if args.run: run_answers()
    if args.judge: judge()
    if args.summary: summary()


if __name__ == "__main__":
    main()
