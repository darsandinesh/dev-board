"""
Shared async Redis client (Day 5).

Used by Authz.check() to cache permission decisions (30s TTL) and to invalidate
a user's cached answers on tuple writes/deletes. Lazy-connecting: constructing
the client does no IO, so it's safe to build at import time.
"""

import redis.asyncio as aioredis

from app.core.config import settings

redis_client: aioredis.Redis = aioredis.from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=False,  # we store raw b"1"/b"0"
)
