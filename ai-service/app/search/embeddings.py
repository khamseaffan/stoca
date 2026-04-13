import logging

import openai

from app.config import settings

logger = logging.getLogger(__name__)


async def generate_embedding(text: str) -> list[float]:
    """Generate a vector embedding for the given text using OpenAI.

    Calls the OpenAI embeddings API to produce a dense vector representation
    suitable for pgvector cosine-distance queries.

    Args:
        text: The input text to embed. Typically a product name, search
            query, or short description.

    Returns:
        A list of floats representing the embedding vector. Returns an
        empty list if the API call fails so callers can fall back to
        text-based search.
    """
    try:
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=text,
        )
        return response.data[0].embedding
    except Exception:
        logger.exception("Failed to generate embedding for text: %s", text[:80])
        return []
