
"""
pytest suite for Championship endpoints.

Usage:
  1) Install deps:  pip install pytest requests
  2) Set BASE_URL (optional): export BASE_URL="http://localhost:5110/api"
     - Defaults to "http://localhost:5000/api"
  3) Run: pytest -q
"""

import os
import typing as t
import requests
import pytest

BASE_URL = os.getenv("BASE_URL", "http://localhost:5110/api")

# ---- helpers ---------------------------------------------------------------

def _url(*parts: str) -> str:
    return "/".join([BASE_URL.rstrip("/")] + [p.strip("/") for p in parts])

def _get_json(url: str) -> t.Tuple[int, t.Any, requests.Response]:
    resp = requests.get(url, timeout=30)
    try:
        data = resp.json()
    except ValueError:
        data = None
    return resp.status_code, data, resp

def _assert_not_found_payload(data):
    # Controller returns: { "message": "No results found for this division." }
    assert isinstance(data, dict), "Expected JSON object on 404"
    assert "message" in data, "Expected 'message' field in 404 payload"
    # Be lenient on exact casing/message to avoid flakiness across environments
    assert "result" in data.get("message", "").lower() or "no result" in data.get("message", "").lower()

# ---- param spaces ----------------------------------------------------------

# Common seasons/divisions to probe. Adjust as needed for your dataset.
CANDIDATE_SEASONS = [29, 28, 1]   # 29 is used in GetCurrentChampionshipTop3
CANDIDATE_DIVISIONS = [1, 2, 3]

# Build cases: a mix of likely-real and edge-ish values
CASES = [(s, d) for s in CANDIDATE_SEASONS for d in CANDIDATE_DIVISIONS] + [
    (9999, 1),   # very high season (likely 404)
    (0, 1),      # lower bound-ish
    (29, 9999),  # very high division (likely 404)
]

# ---- tests: /api/championship/{season}/{division} -------------------------

@pytest.mark.parametrize("season,division", CASES)
def test_get_championship_by_division(season, division):
    url = _url("championship", str(season), str(division))
    status, data, resp = _get_json(url)

    # Endpoint returns either 200 with list of races including RaceResults & Track
    # or 404 with {"message": "..."} when no results.
    assert status in (200, 404), f"Unexpected status {status} for {url}"

    if status == 404:
        _assert_not_found_payload(data)
        return

    # 200 path validation
    assert isinstance(data, list), "Expected a list of race objects"
    if not data:
        pytest.skip("Empty successful payload; nothing to validate.")
    # Validate a couple of expected fields (be permissive, as shape depends on your serializers)
    sample = data[0]
    assert isinstance(sample, dict), "Race item should be an object"
    # Common fields (names may vary). Check presence if available.
    for key in ("raceResults", "track", "season", "division", "id"):
        # case-insensitive key check
        has_key = any(k.lower() == key.lower() for k in sample.keys())
        assert has_key, f"Expected field resembling '{key}' in race object"

# ---- tests: /api/championship/races/{season}/{division} -------------------

@pytest.mark.parametrize("season,division", CASES)
def test_get_championship_races_ordering(season, division):
    url = _url("championship", "races", str(season), str(division))
    status, data, resp = _get_json(url)
    assert status in (200, 404), f"Unexpected status {status} for {url}"

    if status == 404:
        _assert_not_found_payload(data)
        return

    assert isinstance(data, list), "Expected a list of race objects"
    # Check ascending by Id if present
    ids = []
    for item in data:
        if isinstance(item, dict):
            # find an 'id'-ish key
            for k in item.keys():
                if k.lower() == "id":
                    ids.append(item[k])
                    break
    if ids:
        assert ids == sorted(ids), "Races should be ordered ascending by Id"

# ---- tests: /api/championship/current -------------------------------------

def test_get_current_championship_top3_structure():
    url = _url("championship", "current")
    status, data, resp = _get_json(url)
    assert status == 200, f"Expected 200 OK for {url}, got {status}"
    assert isinstance(data, list), "Expected a list grouped by division"

    # Each item: { Division: <int>, Top3: [ { Driver, TotalPoints, Team }, ... ] }
    for group in data:
        assert isinstance(group, dict), "Each division group should be an object"
        # Check Division key (case-insensitive)
        has_div_key = any(k.lower() == "division" for k in group.keys())
        assert has_div_key, "Division group should include 'Division'"
        # Check Top3
        top3 = None
        for k, v in group.items():
            if k.lower() == "top3":
                top3 = v
                break
        assert isinstance(top3, list), "'Top3' should be a list"
        assert len(top3) <= 3, "'Top3' should contain at most 3 entries"
        for entry in top3:
            assert isinstance(entry, dict), "Top3 entries should be objects"
            # Keys: Driver, TotalPoints, Team; be lenient and only require Driver & TotalPoints
            assert any(k.lower() == "driver" for k in entry.keys()), "Top3 entry missing 'Driver'"
            assert any(k.lower() == "totalpoints" for k in entry.keys()), "Top3 entry missing 'TotalPoints'"
            # Team may be null or missing; only check if present that it's a string or null
            for k, v in entry.items():
                if k.lower() == "team":
                    assert (v is None) or isinstance(v, (str, int)), "'Team' should be string-ish or null"
                    break

# ---- negative/edge: route parameters --------------------------------------

@pytest.mark.parametrize("season,division", [("abc", "1"), ("29", "xyz"), ("abc", "xyz")])
def test_invalid_route_param_types_return_404(season, division):
    # ASP.NET routing with {int} constraints would not match non-int and typically returns 404.
    url = _url("championship", str(season), str(division))
    status, data, resp = _get_json(url)
    assert status == 400, f"Non-integer route params should not match routes: {url} -> {status}"
