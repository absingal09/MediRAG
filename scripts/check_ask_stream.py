from app.ask import ask_stream

for event in ask_stream("What is the aspirin loading dose?"):
    if event["event"] == "delta":
        print(event["data"]["text"], end="", flush=True)
    else:
        print("\n\nFinal result:")
        print(event["data"])