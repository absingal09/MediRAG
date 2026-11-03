from app.llm import stream_complete

messages = [
    {
        "role": "user",
        "content": "Say hello in one short sentence. Do it 10 times"
     }
]

for fragment in stream_complete(messages):
    print(fragment, end="", flush=True)

print()