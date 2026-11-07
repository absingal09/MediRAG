import json
import yaml
from pathlib import Path
from app.ask import ask
from unittest.mock import patch
from app.reranking import reranked_search

def ask_reranked(question):
    with patch("app.ask.search", reranked_search), \
         patch("app.ask.get_cached", return_value=None), \
         patch("app.ask.set_cached"):
        return ask(question)

# 1. Load all dev questions.
questions_path = (
    Path(__file__).resolve().parents[1] / "evals" / "questions.yaml"
)

with open(questions_path, encoding="utf-8") as file:
    data = yaml.safe_load(file)

dev_questions = [
    item
    for item in data["questions"]
    if item.get("split") == "heldout"
]

output_path = questions_path.parent / "heldout_answers.json"
records = []

if output_path.exists():
    with open(output_path, encoding="utf-8") as file:
        records = json.load(file)

completed_ids = {record["id"] for record in records}

for item in dev_questions:
    if item["id"] in completed_ids:
        print("Already saved:", {item['id']})
        continue

    result = ask_reranked(item["question"])

    record = {
        "id": item["id"],
        "type": item["type"],
        "question": item["question"],
        "reference_answer": item["reference_answer"],
        "generated_answer": result["answer"],
        "refused": result["refused"],
        "citations": result["citations"],
        "retrieved_sources": result["sources"],
    }

    records.append(record)

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(records, file, ensure_ascii=False, indent=2)

    completed_ids.add(item["id"])
    print(f"Saved {item['id']}")

print("Saved records:", len(records))
print("Unique IDs:", len({record["id"] for record in records}))

unanswerable = [r for r in records if r["type"] == "unanswerable"]
answerable = [r for r in records if r["type"] != "unanswerable"]

correct_refusals = sum(r["refused"] for r in unanswerable)
false_refusals = sum(r["refused"] for r in answerable)

print(f"Correct refusals: {correct_refusals}/{len(unanswerable)}")
print(f"False refusals: {false_refusals}/{len(answerable)}")