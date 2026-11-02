from pathlib import Path
import yaml
from app.ask import ask

questions_path = (
    Path(__file__).parents[1] / "evals" / "questions.yaml"
)

with open(questions_path, encoding="utf-8") as file:
    data = yaml.safe_load(file)

# Filter the question entries to split == "dev".
dev_questions = [question for question in data["questions"] if question.get("split") == "dev"]

unanswerable_total = 0
correct_refusals = 0
answerable_total = 0
false_refusals = 0


for item in dev_questions:
    result = ask(item["question"])
    if item["type"] == "unanswerable":
        unanswerable_total += 1
        if result["refused"]:
            correct_refusals += 1
    else:
        answerable_total += 1
        if result["refused"]:
            false_refusals += 1

print(f"\nCorrect refusals: {correct_refusals}/{unanswerable_total}")
print(f"False refusals: {false_refusals}/{answerable_total}")