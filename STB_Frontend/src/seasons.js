import { useEffect, useState } from "react";
import { API_BASE } from "@/config";

// Seasons and divisions now come from the database (GET /api/seasons).
// This list is only a fallback while loading or when the API is unreachable.
export const SEASONS = [
  { year: 31, divisions: ["1", "2", "3", "4", "5"] },
  { year: 30, divisions: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { year: 29, divisions: ["1", "2", "3", "4"] },
  { year: 28, divisions: ["1", "2", "3"] },
  { year: 27, divisions: ["1", "2", "3"] },
  { year: 26, divisions: ["1", "2", "3"] },
  { year: 25, divisions: ["1", "2", "3"] },
  { year: 24, divisions: ["1", "2", "3"] },
  { year: 23, divisions: ["1", "2", "3"] },
  { year: 22, divisions: ["1", "2", "3"] },
  { year: 21, divisions: ["1", "2", "3"] },
  { year: 15, divisions: ["1"] },
  { year: 8, divisions: ["1"] },
];

export const CURRENT_SEASON = SEASONS[0].year;

const FALLBACK = { seasons: SEASONS, current: CURRENT_SEASON, latestWithResults: CURRENT_SEASON };

// One request per page load, shared by every component that asks.
let cache = null;
function loadSeasons() {
  if (!cache) {
    cache = fetch(`${API_BASE}/api/seasons`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        const seasons = (data.seasons || []).map((s) => ({
          year: s.season,
          divisions: (s.divisions || []).map(String),
        }));
        if (!seasons.length) return FALLBACK;
        return {
          seasons,
          current: data.current ?? seasons[0].year,
          latestWithResults: data.latestWithResults ?? data.current ?? seasons[0].year,
        };
      })
      .catch(() => {
        cache = null; // try again on the next page
        return FALLBACK;
      });
  }
  return cache;
}

/** { seasons: [{ year, divisions: ["1", ...] }], current, latestWithResults } */
export function useSeasons() {
  const [state, setState] = useState(FALLBACK);
  useEffect(() => {
    let alive = true;
    loadSeasons().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
