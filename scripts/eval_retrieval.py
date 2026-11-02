from pathlib import Path
import yaml
from app.search import search

# 1. Load only answerable dev questions.
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

# # 2. Initialize totals.
# hits = 0
# reciprocal_rank_total = 0.0
# coverage_total = 0.0
# all_pages_hits = 0

# # 3. Evaluate each question.
# for item in answerable_questions:
#     expected_pages = {
#         (source["doc"], source["page"])
#         for source in item["sources"]
#     }

#     if not expected_pages:
#         raise ValueError(f"{item['id']} has no expected source pages.")

#     retrieved = search(item["question"], k=5)

#     retrieved_pages = {
#         (chunk["doc_name"], chunk["page_no"])
#         for chunk in retrieved
#     }

#     # Find the first retrieved chunk from an expected page.
#     first_correct_rank = None

#     for rank, chunk in enumerate(retrieved, start=1):
#         page = (chunk["doc_name"], chunk["page_no"])

#         if page in expected_pages:
#             first_correct_rank = rank
#             break

#     # Calculate this question's metrics.
#     hit = first_correct_rank is not None
#     reciprocal_rank = 1 / first_correct_rank if hit else 0.0

#     matched_pages = expected_pages.intersection(retrieved_pages)
#     page_coverage = len(matched_pages) / len(expected_pages)
#     all_pages_hit = expected_pages.issubset(retrieved_pages)

#     # Update totals after calculating the metrics.
#     hits += int(hit)
#     reciprocal_rank_total += reciprocal_rank
#     coverage_total += page_coverage
#     all_pages_hits += int(all_pages_hit)

#     # Display this question's results.
#     print(f"\n{item['id']}: {item['question']}")
#     print("First correct rank:", first_correct_rank)
#     print("Hit@5:", hit)
#     print("Reciprocal rank:", reciprocal_rank)
#     print("Page coverage@5:", page_coverage)
#     print("All-required-pages@5:", all_pages_hit)

# # 4. Display overall results.
# total = len(answerable_questions)

# if total == 0:
#     raise ValueError("No answerable dev questions found.")

# print(f"\n--- Retrieval baseline: {total} answerable dev questions ---")
# print(f"Hit@5: {hits}/{total} ({hits / total:.1%})")
# print(f"MRR@5: {reciprocal_rank_total / total:.3f}")
# print(f"Mean page coverage@5: {coverage_total / total:.1%}")
# print(
#     f"All-required-pages@5: {all_pages_hits}/{total} "
#     f"({all_pages_hits / total:.1%})"
# )

multi_questions = [
    q for q in answerable_questions
    if q["type"] == "multi"
]

item = multi_questions[7]  # Select the 8th multi question for demonstration.

print(item["id"], item["question"])
print("Reference:", item["reference_answer"])

for chunk in search(item["question"], k=5):
    print("\n", chunk["doc_name"], chunk["page_no"])
    print("Heading:", chunk["heading"])
    print(chunk["content"])