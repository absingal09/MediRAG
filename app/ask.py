from app.search import search
from app.prompting import build_messages, parse_answer
from app.llm import complete

CANT_ANSWER = "I couldn't find this in the guidelines."

def ask(question, k=5):
    chunks = search(question, k)
    messages = build_messages(question, chunks)

    for attempt in range(2):                     # first try + 1 retry
        result = parse_answer(complete(messages), chunks)
        if not result["invalid"]:
            break
        
    if result["invalid"]:                    # still bad after the retry → refuse
        result["refused"] = True
        result["citations"] = []

    if result["refused"]:                    # model refused OR we refused
        result["answer"] = CANT_ANSWER

    result["sources"] = chunks
    return result