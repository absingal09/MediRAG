from contextlib import closing
from time import perf_counter

from app.search import search
from app.prompting import build_messages, parse_answer
from app.llm import complete, stream_complete
from app.cache import make_cache_key, get_cached, set_cached
from app.telemetry import log_request

CANT_ANSWER = "I couldn't find this in the guidelines."


def ask(question, k=5):
    started = perf_counter()
    cache_hit = False
    status = "error"
    error_type = None

    try:
        key = make_cache_key(question, k)
        cached = get_cached(key)

        if cached is not None:
            cache_hit = True
            status = "success"
            return cached

        chunks = search(question, k)
        messages = build_messages(question, chunks)

        for attempt in range(2):
            result = parse_answer(complete(messages), chunks)
            if not result["invalid"]:
                break

        if result["invalid"]:
            result["refused"] = True
            result["citations"] = []

        if result["refused"]:
            result["answer"] = CANT_ANSWER

        result["sources"] = chunks

        if not result["invalid"]:
            set_cached(key, result)

        status = "success"
        return result

    except Exception as error:
        error_type = type(error).__name__
        raise

    finally:
        log_request(
            "ask",
            cache_hit,
            (perf_counter() - started) * 1000,
            status=status,
            error_type=error_type,
        )


def ask_stream(question, k=5):
    started = perf_counter()
    cache_hit = False
    status = "closed"
    error_type = None

    try:
        key = make_cache_key(question, k)
        cached = get_cached(key)

        if cached is not None:
            cache_hit = True
            status = "success"
            yield {"event": "final", "data": cached}
            return

        chunks = search(question, k)
        messages = build_messages(question, chunks)
        fragments = []

        with closing(stream_complete(messages)) as stream:
            for fragment in stream:
                fragments.append(fragment)
                yield {
                    "event": "delta",
                    "data": {"text": fragment},
                }

        answer_text = "".join(fragments)
        result = parse_answer(answer_text, chunks)

        if result["invalid"]:
            result = parse_answer(complete(messages), chunks)

        if result["invalid"]:
            result["refused"] = True
            result["citations"] = []

        if result["refused"]:
            result["answer"] = CANT_ANSWER

        result["sources"] = chunks

        if not result["invalid"]:
            set_cached(key, result)

        status = "success"
        yield {"event": "final", "data": result}

    except Exception as error:
        status = "error"
        error_type = type(error).__name__
        raise

    finally:
        log_request(
            "ask_stream",
            cache_hit,
            (perf_counter() - started) * 1000,
            status=status,
            error_type=error_type,
        )