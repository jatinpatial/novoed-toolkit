"""Pexels image search proxy (Track-F-prep, polish-19b).

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
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

log = logging.getLogger(__name__)

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
) -> dict[str, Any]:
    """Search Pexels for landscape stock photography matching the
    query. Returns up to 5 results.

    - banner: lesson hero / module hero. Landscape orientation,
      moderate density.
    - cover: project card thumbnail. Same Pexels shape today; the
      `type` param is reserved so a future iteration can route to
      different orientations / sizes per surface without breaking
      existing callers.
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
    cached = _cache.get(cache_key)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{PEXELS_BASE}/search",
                params={
                    "query": query,
                    "per_page": 5,
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
    _cache[cache_key] = (now, payload)
    return payload
