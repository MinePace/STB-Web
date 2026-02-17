import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./HistoryPage.css";
import "@/Components/Links.css";

export default function HistoryPage() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await fetch("https://stbleague.fly.dev/api/history/champions");
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (alive) setSeasons(Array.isArray(json) ? json : []);
      } catch (e) {
        if (alive) setErr(e?.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => {
    const copy = (seasons ?? []).map(s => ({
      season: s.season,
      winners: Array.isArray(s.winners)
        ? [...s.winners].sort((a, b) => (a.division ?? 0) - (b.division ?? 0))
        : []
    }));
    copy.sort((a, b) => (a.season ?? 0) - (b.season ?? 0));
    return copy;
  }, [seasons]);

  return (
    <div className="hp-shell">
      {/* Banner (matches driver page look) */}
      <div className="hp-banner">
        <div className="hp-banner-title">Hall of Fame</div>
      </div>

      {loading && <div className="hp-state">Loading champions…</div>}
      {err && <div className="hp-state hp-state--err">Error: {err}</div>}

      {/* Panels grid (same layout as driver page) */}
      <div className="hp-panels">
        {grouped.map(({ season, winners }) => (
          <section key={season} className="hp-panel hp-panel--thin">
            <header className="hp-panel-header">Season {season}</header>
            <div className="hp-panel-body">
              {winners.length === 0 && (
                <div className="hp-row hp-row--ongoing">No divisions found for this season.</div>
              )}
              {winners.map(w => (
                <div key={`${season}-${w.division}`} className="hp-row">
                  <Link className="hp-row-left">Tier {w.division}</Link>
                  {w.finished ? (
                    <>
                      <Link to={`/STB/Driver/${encodeURIComponent(w.driver)}`} className="champions-link">
                        {w.driver ?? <span className="hp-no-data">—</span>}
                      </Link>
                      <div className="hp-row-stat">{w.points != null ? `${w.points} pts` : "–"}</div>
                      <div className="hp-row-stat">{w.wins != null ? `${w.wins} wins` : "–"}</div>
                    </>
                  ) : (
                    <div className="hp-row-ongoing">
                      {w.message || "Season has not yet finished"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && grouped.length === 0 && (
        <div className="hp-state">No seasons found from the API.</div>
      )}
    </div>
  );
}
