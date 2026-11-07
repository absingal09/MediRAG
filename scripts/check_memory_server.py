from unittest.mock import patch

import uvicorn

from app.main import app
from app.reranking import reranked_search


if __name__ == "__main__":
    with patch("app.ask.search", reranked_search):
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            workers=1,
        )