from pathlib import Path


def report_memory(stage):
    memory_bytes = int(
        Path("/sys/fs/cgroup/memory.current").read_text().strip()
    )
    memory_mib = memory_bytes / (1024 * 1024)
    print(f"{stage}: {memory_mib:.1f} MiB", flush=True)

report_memory("Before backend import")

import app.main

report_memory("Backend imported")

from app.search import vector_search
from app.reranking import reranked_search

question = (
    "How does insulin dosing in DKA work, "
    "from the starting dose to when the infusion can be stopped?"
)

vector_search(question, k=5)
report_memory("After vector retrieval")

reranked_search(question, k=5)
report_memory("After reranked retrieval")

stats = dict(
    line.split()
    for line in Path("/sys/fs/cgroup/memory.stat").read_text().splitlines()
)

for field in ("anon", "file", "inactive_file"):
    print(f"{field}: {int(stats[field]) / 1024**2:.1f} MiB", flush=True)

print(
    Path("/sys/fs/cgroup/memory.events").read_text(),
    flush=True,
)

print("Memory test completed", flush=True)