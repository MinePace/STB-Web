import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./TrackPage.css";

function TrackPage() {
  const { trackId } = useParams();

  const [trackInfo, setTrackInfo] = useState(null);
  const [trackRaces, setTrackRaces] = useState([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [errorRaces, setErrorRaces] = useState(null);
  const [mapOk, setMapOk] = useState(true);
  const [expanded, setExpanded] = useState({}); // { [raceId]: boolean }

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const res = await fetch(`http://localhost:5110/api/track/${encodeURIComponent(trackId || "")}`);
        if (!res.ok) {
          let msg = `Failed to fetch track info (${res.status})`;
          try { const body = await res.json(); if (body?.message) msg = body.message; } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        if (!abort) setTrackInfo(data);
      } catch (err) {
        if (!abort) setErrorInfo(err.message || "Could not load track info.");
      } finally {
        if (!abort) setLoadingInfo(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(`http://localhost:5110/api/track/races/${encodeURIComponent(trackId || "")}`);
        if (!res.ok) throw new Error(`Failed to fetch track races (${res.status})`);
        const races = await res.json();
        if (!abort) setTrackRaces(Array.isArray(races) ? races : []);
      } catch (err) {
        if (!abort) setErrorRaces(err.message || "Could not load track races.");
      } finally {
        if (!abort) setLoadingRaces(false);
      }
    })();

    return () => { abort = true; };
  }, [trackId]);

  const loading = loadingInfo || loadingRaces;

  if (loading) return <div className="tp-spinner">🏁 Loading track…</div>;
  if (!trackInfo) return <div className="tp-error">❌ {errorInfo || "Track not found."}</div>;

  const { name, raceName, country, length, turns } = trackInfo;
  const mapSrc = country ? `/track_map/${slugCountry(country)}.avif` : null;

  return (
    <div className="tp-container">
      {/* HERO */}
      <div className="tp-hero">
        <div className="tp-hero-main">
          <header className="tp-header">
            {country && (
              <img src={`/flags/${country}.png`} alt={`${country} flag`} title={country} className="tp-flag" aria-hidden="true" />
            )}
            <h1 className="tp-title">{name ?? "Unknown Track"}</h1>
            <p className="tp-subtitle">{[raceName, country].filter(Boolean).join(" · ") || "—"}</p>
          </header>

          <section className="tp-stats">
            <div className="tp-stat"><div className="tp-stat-value">{formatLength(length)}</div><div className="tp-stat-label">Track Length</div></div>
            <div className="tp-stat"><div className="tp-stat-value">{turns ?? "—"}</div><div className="tp-stat-label">Turns</div></div>
            <div className="tp-stat"><div className="tp-stat-value">{trackRaces.length}</div><div className="tp-stat-label">Events at Track</div></div>
          </section>
        </div>

        <aside className="tp-hero-aside">
          <div className="tp-map-card">
            {mapSrc && mapOk ? (
              <img src={mapSrc} alt={`${country} track map`} className="tp-map" onError={() => setMapOk(false)} loading="lazy" />
            ) : (
              <div className="tp-map-fallback">No map available</div>
            )}
          </div>
        </aside>
      </div>

      {/* EVENTS & RESULTS – 2 columns, top 10 + toggle */}
      <section className="tp-section">
        <h2 className="tp-section-title">Events & Results</h2>
        {errorRaces && <div className="tp-error">⚠️ {errorRaces}</div>}

        {trackRaces.length === 0 ? (
          <div className="tp-empty">No events found for this track.</div>
        ) : (
          <div className="tp-rounds tp-rounds-2">
            {trackRaces
              .slice()
              .sort(compareBySeasonRound)
              .map((r) => {
                const results = (r.raceResults ?? []).slice().sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
                const MAX = 3;
                const showAll = !!expanded[r.id];
                const visible = showAll ? results : results.slice(0, MAX);
                const hiddenCount = results.length - visible.length;

                return (
                  <article className="tp-round-card" key={r.id}>
                    <div className="tp-round-meta">
                      <div className="tp-round-title">{r.name}</div>
                      <div className="tp-round-sub">
                        Season {r.season} - Tier {r.division} - Round {r.round}
                        {r.date ? ` · ${formatDate(r.date)}` : ""}
                        {r.sprint === "Yes" ? <span className="tp-badge tp-badge-sprint">Sprint</span> : null}
                      </div>
                    </div>

                    <div className="tp-results">
                      <div className="tp-results-head">
                        <div>Pos</div>
                        <div>Driver</div>
                        <div className="tp-right">Pts</div>
                      </div>
                      <div className="tp-results-body">
                        {visible.map((res, i) => (
                          <div className="tp-result-row" key={i}>
                            <div className={`tp-pos ${medalClass(res.position)}`}>{posLabel(res)}</div>
                            <Link to={`/STB/Driver/${encodeURIComponent(res.driver)}`} className="tp-driver">{res.driver}</Link>
                            <div className="tp-right">
                              {isDNF(res) ? <span className="tp-tag tp-tag-dnf">DNF</span> : <span className="tp-tag">{res.points ?? 0}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="tp-showmore"
                        onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
                        aria-expanded={showAll}
                        aria-label={showAll ? "Show top 10" : `Show all ${results.length} results`}
                      >
                        {showAll ? "Show top 10" : `Show all (${results.length})`}
                      </button>
                    )}
                  </article>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */
function formatLength(val) {
  if (val == null) return "—";
  return `${Number(val).toFixed(3)} km`; // your API uses km like 4.259
}
function formatDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return d ?? "—";
  }
}
function isDNF(res) {
  return res?.dnf === "Yes" || res?.dnf === "DNF";
}
function posLabel(res) {
  if (typeof res?.position === "number") return `P${res.position}`;
  return isDNF(res) ? "DNF" : "—";
}
function toPosSortKey(res) {
  return typeof res?.position === "number" ? res.position : Number.POSITIVE_INFINITY;
}
function medalClass(position) {
  if (position === 1) return "tp-medal tp-medal-1";
  if (position === 2) return "tp-medal tp-medal-2";
  if (position === 3) return "tp-medal tp-medal-3";
  return "";
}
function slugCountry(c) {
  // e.g. "United States" -> "United_States"
  return encodeURIComponent(String(c).replace(/\s+/g, "_"));
}
function compareBySeasonRound(a, b) {
  const sa = Number(a.season ?? -Infinity);
  const sb = Number(b.season ?? -Infinity);
  if (sb !== sa) return sb - sa;              // season DESC (newest first)

  const ra = Number(a.round ?? -Infinity);
  const rb = Number(b.round ?? -Infinity);
  return rb - ra;                              // round DESC (latest first)
}


export default TrackPage;
