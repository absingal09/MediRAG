import json
from pathlib import Path

evals_dir = Path(__file__).resolve().parents[1] / "evals"

with open(evals_dir / "baseline_judgements.json", encoding="utf-8") as file:
    baseline = json.load(file)

with open(evals_dir / "filtered_judgements.json", encoding="utf-8") as file:
    filtered = json.load(file)

baseline_by_id = {item["id"]: item for item in baseline}
filtered_by_id = {item["id"]: item for item in filtered}

if len(baseline_by_id) != len(baseline):
    raise ValueError("Duplicate IDs in baseline judgements.")

if len(filtered_by_id) != len(filtered):
    raise ValueError("Duplicate IDs in filtered judgements.")

if baseline_by_id.keys() != filtered_by_id.keys():
    raise ValueError("Baseline and filtered question IDs do not match.")

changed = 0

for question_id, old in baseline_by_id.items():
    new = filtered_by_id[question_id]

    if old["verdict"] != new["verdict"]:
        changed += 1
        print(f"\n{question_id}: {old['verdict']} → {new['verdict']}")
        print("Baseline reason:", old["reason"])
        print("Filtered reason:", new["reason"])

print(f"\nChanged verdicts: {changed}/{len(baseline_by_id)}")