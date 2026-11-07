from pathlib import Path
from statistics import median
from time import perf_counter

import yaml

from app.search import vector_search
from app.reranking import reranked_search

questions_path = (
    Path(__file__).resolve().parents[1] / "evals" / "questions.yaml"
)

with open(questions_path, encoding="utf-8") as file:
    data = yaml.safe_load(file)

answerable_questions = [
    item
    for item in data["questions"]
    if item.get("split") == "dev"
    and item["type"] != "unanswerable"
]

if not answerable_questions:
    raise ValueError("No answerable dev questions found.")

# Load both models and warm the retrieval paths before timing.
warmup_question = answerable_questions[0]["question"]
vector_search(warmup_question, k=5)
reranked_search(warmup_question, k=5)

timings = {"vector": [], "reranked": []}

methods = [
    ("vector", vector_search),
    ("reranked", reranked_search),
]

for index, item in enumerate(answerable_questions):
    # Alternate order to reduce consistent first/second-call bias.
    ordered_methods = methods if index % 2 == 0 else methods[::-1]

    for name, method in ordered_methods:
        started = perf_counter()
        method(item["question"], k=5)
        elapsed_ms = (perf_counter() - started) * 1000
        timings[name].append(elapsed_ms)

    print(f"Measured {item['id']}")

print(f"\nWarm retrieval: {len(answerable_questions)} answerable dev questions")

for name, values in timings.items():
    print(f"{name}: median {median(values):.1f} ms")

print(
    "Difference between medians: "
    f"{median(timings['reranked']) - median(timings['vector']):.1f} ms"
)