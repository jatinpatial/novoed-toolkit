"""Pexels image search proxy (Track-F-prep, polish-19b, GG1).

The frontend's banner / cover-image affordances need a steady source
of professional stock photography. Pexels is free, instant-signup,
permissive licensing — fits the BCG U pilot constraints (no
procurement loop, no per-image cost).

This module ships the BACKEND scaffold only — endpoint exists,
key-detection is in place, response shape is final. Track-F-full
(deferred until the LD provides a Pexels API key) wires the FE-side
auto-fetch on lesson open. With the key set in .env, the endpoint
returns real results; without it, returns 503 with a clear message
so the FE falls back to the existing abstract-gradient banners.

Wire format
  GET /api/images/search?query=<text>&type=banner|cover

  200 OK: {
    "query": str,
    "results": [
      {
        "id": int,
        "url": str,         # large source url (1280px wide)
        "thumb": str,       # medium source url (640px wide)
        "alt": str,         # descriptive alt text
        "photographer": str,
        "photographerUrl": str
      },
      ...
    ]
  }

  503: { "detail": "..." } when PEXELS_API_KEY is unset.

Caching
  In-process LRU keyed by (query, type). Pexels free tier is
  rate-limited (200 req/hr) so we cache 30 minutes per query. A
  single LD building a 14-lesson course will hit ~14-20 distinct
  queries per build — well under the limit even without the cache,
  but the cache eliminates duplicate fetches across multiple
  lessons sharing common terms.
"""
from __future__ import annotations

import logging
import os
import random
import ssl
import time
from typing import Any

import certifi
import httpx
from fastapi import APIRouter, HTTPException, Query

log = logging.getLogger(__name__)

# Track-T (SSL fix v2): pre-build a real ssl.SSLContext and pass it to
# httpx.AsyncClient(verify=ctx). Track-F's first attempt passed
# certifi.where() (a string path) directly — turns out httpx doesn't
# always honor a string path on Windows, so the call fell back to
# the system trust store and produced "unable to get local issuer
# certificate". Building the context explicitly with cafile=certifi.where()
# forces httpx to use the certifi bundle.
#
# Multi-attempt resolution:
#   1. truststore (if available) — uses the Windows native cert store.
#      Most likely to "just work" on a corporate Windows machine where
#      the BCG U cert chain is in the system store.
#   2. ssl.create_default_context(cafile=certifi.where()) — Mozilla's
#      bundle, broadly compatible.
#   3. ssl.create_default_context() — system default, last resort.
#
# Resolved once at import; the context is reusable across requests.
def _build_ssl_context() -> ssl.SSLContext:
    try:
        import truststore  # type: ignore[import-not-found]
        ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        log.info("Pexels SSL: using truststore (Windows native cert store)")
        return ctx
    except ImportError:
        pass
    except Exception as exc:
        log.warning("Pexels SSL: truststore failed (%s) — falling back to certifi", exc)
    try:
        ctx = ssl.create_default_context(cafile=certifi.where())
        log.info("Pexels SSL: using certifi bundle %s", certifi.where())
        return ctx
    except Exception as exc:
        log.warning("Pexels SSL: certifi context failed (%s) — using system default", exc)
        return ssl.create_default_context()


_PEXELS_SSL_CONTEXT = _build_ssl_context()

router = APIRouter(prefix="/api/images")

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")
PEXELS_BASE = "https://api.pexels.com/v1"

# (query, type) → (timestamp, payload). Track-F-prep simple cache;
# upgrade to functools.lru_cache + TTL wrapper if size becomes a
# concern. 30-min TTL fits typical course-build wall-time.
_cache: dict[tuple[str, str], tuple[float, dict[str, Any]]] = {}
_CACHE_TTL_SECONDS = 30 * 60


@router.get("/search")
async def search_images(
    query: str = Query(..., min_length=1, max_length=200),
    type: str = Query("banner", pattern="^(banner|cover)$"),
    bust: bool = Query(False),
) -> dict[str, Any]:
    """Search Pexels for landscape stock photography matching the
    query. Returns up to 5 results.

    - banner: lesson hero / module hero. Landscape orientation,
      moderate density.
    - cover: project card thumbnail. Same Pexels shape today; the
      `type` param is reserved so a future iteration can route to
      different orientations / sizes per surface without breaking
      existing callers.
    - bust=true (GG1): skip the in-process cache AND request a random
      Pexels page (1-5) so the LD's "Regenerate" button returns
      genuinely new photos. Without this, the cache returns the same
      payload for 30 minutes and Pexels' deterministic page=1 returns
      the same five photos every time.
    """
    if not PEXELS_API_KEY:
        # Track-F-prep: clear 503 so the FE knows to fall back to
        # the existing abstract-gradient banners. The error detail
        # surfaces in the FE's catch path — useful for debugging
        # when the key is misconfigured (typo in .env, etc.).
        raise HTTPException(
            status_code=503,
            detail=(
                "Pexels API key not configured. Set PEXELS_API_KEY in .env "
                "to enable banner / cover images. The frontend will fall "
                "back to abstract gradients until then."
            ),
        )

    cache_key = (query.strip().lower(), type)
    now = time.time()
    if not bust:
        cached = _cache.get(cache_key)
        if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

    # GG1: when bust=true, randomize the page so we don't keep getting
    # the same five photos. Pexels' search returns 80 photos/page and
    # ~30 results in total per query is typical — page 1-5 keeps the
    # results topical without paginating off the relevance cliff.
    page = random.randint(1, 5) if bust else 1

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=_PEXELS_SSL_CONTEXT) as client:
            resp = await client.get(
                f"{PEXELS_BASE}/search",
                params={
                    "query": query,
                    "per_page": 5,
                    "page": page,
                    "orientation": "landscape",
                },
                headers={"Authorization": PEXELS_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        log.warning("Pexels HTTP %s: %s", exc.response.status_code, exc.response.text[:300])
        raise HTTPException(
            status_code=502,
            detail=f"Pexels returned {exc.response.status_code}",
        )
    except httpx.HTTPError as exc:
        log.warning("Pexels request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=f"Pexels request failed: {exc}",
        )

    photos = data.get("photos") or []
    results = [
        {
            "id": p.get("id"),
            "url": (p.get("src") or {}).get("large"),
            "thumb": (p.get("src") or {}).get("medium"),
            "alt": p.get("alt") or query,
            "photographer": p.get("photographer") or "",
            "photographerUrl": p.get("photographer_url") or "",
        }
        for p in photos
        if (p.get("src") or {}).get("large")
    ]
    payload = {"query": query, "results": results}
    # GG1: bust=true overwrites the cached entry with the fresh page
    # so the next non-bust call benefits from the new photos until
    # the TTL ages it out. The non-bust path also writes; same key
    # either way.
    _cache[cache_key] = (now, payload)
    return payload
