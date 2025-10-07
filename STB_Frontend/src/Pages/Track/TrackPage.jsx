import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "./TrackPage.css";

/* ---------- maps & helpers at module scope ---------- */

const MAP_EXCEPTIONS = {
  "United States": {
    // you can keep short labels; loose matcher will still find them
    "Circuit of the Americas": "/track_map/United_States_COTA.avif",
    "Miami": "/track_map/United_States_Miami.avif",
    "Las Vegas": "/track_map/United_States_Las_Vegas.avif",
  },
  Italy: {
    "Monza": "/track_map/Italy_Monza.avif",
    "Imola": "/track_map/Italy_Imola.avif",
  },
  Malaysia: {
    "Sepang": "/track_map/Malaysia.png"
  }
  // add more…
};

function slugCountry(c) {
  return encodeURIComponent(String(c).trim().replace(/\s+/g, "_"));
}
function slugTrack(t) {
  return encodeURIComponent(String(t).trim().replace(/\s+/g, "_"));
}

// case-insensitive equality
const eqCI = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// case-insensitive “includes”
const incCI = (hay, needle) =>
  String(hay).toLowerCase().includes(String(needle).toLowerCase());

/** Build the ordered list of map candidates for this track */
function getMapCandidates({ country, name }) {
  const out = [];

  if (country && MAP_EXCEPTIONS[country]) {
    const byCountry = MAP_EXCEPTIONS[country];

    // 1a) exact key match
    if (byCountry[name]) out.push(byCountry[name]);
    else {
      // 1b) loose match: any exception key contained in the track name (or vice versa)
      const keys = Object.keys(byCountry);
      const k = keys.find(
        (key) => eqCI(key, name) || incCI(name, key) || incCI(key, name)
      );
      if (k) out.push(byCountry[k]);
    }
  }

  // 2) country + track (follow your underscore convention)
  if (country && name) {
    out.push(`/track_map/${slugCountry(country)}_${slugTrack(name)}.avif`);
  }

  // 3) country fallback
  if (country) {
    out.push(`/track_map/${slugCountry(country)}.avif`);
  }

  console.log("[TrackPage] Map candidates for:", { country, name }, "→", out);
  return out;
}

/* ---------- component ---------- */

function TrackPage() {
  const { trackId } = useParams();

  const [trackInfo, setTrackInfo] = useState(null);
  const [trackRaces, setTrackRaces] = useState([]);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [errorRaces, setErrorRaces] = useState(null);

  const [mapOk, setMapOk] = useState(true);
  const [mapIdx, setMapIdx] = useState(0); // index into candidates
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const res = await fetch(
          `http://localhost:5110/api/track/${encodeURIComponent(trackId || "")}`
        );
        if (!res.ok) {
          let msg = `Failed to fetch track info (${res.status})`;
          try {
            const body = await res.json();
            if (body?.message) msg = body.message;
          } catch {}
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
        const res = await fetch(
          `http://localhost:5110/api/track/races/${encodeURIComponent(
            trackId || ""
          )}`
        );
        if (!res.ok) throw new Error(`Failed to fetch track races (${res.status})`);
        const races = await res.json();
        if (!abort) setTrackRaces(Array.isArray(races) ? races : []);
      } catch (err) {
        if (!abort) setErrorRaces(err.message || "Could not load track races.");
      } finally {
        if (!abort) setLoadingRaces(false);
      }
    })();

    // reset map fallback state whenever the track changes
    setMapOk(true);
    setMapIdx(0);

    return () => {
      abort = true;
    };
  }, [trackId]);

  const loading = loadingInfo || loadingRaces;

  if (loading) return <div className="tp-spinner">🏁 Loading track…</div>;
  if (!trackInfo) return <div className="tp-error">❌ {errorInfo || "Track not found."}</div>;

  const { name, raceName, country, length, turns } = trackInfo;

  // build candidates and pick current one
  const mapCandidates = getMapCandidates({ country, name });
  const mapSrc = mapOk && mapCandidates.length ? mapCandidates[mapIdx] : null;
  console.log("[TrackPage] Using map candidate index", mapIdx, "→", mapSrc);

  return (
    <div className="tp-container">
      {/* HERO */}
      <div className="tp-hero">
        <div className="tp-hero-main">
          <header className="tp-header">
            {country && (
              <img
                src={`/flags/${country}.png`}
                alt={`${country} flag`}
                title={country}
                className="tp-flag"
                aria-hidden="true"
              />
            )}
            <h1 className="tp-title">{name ?? "Unknown Track"}</h1>
            <p className="tp-subtitle">
              {[raceName, country].filter(Boolean).join(" · ") || "—"}
            </p>
          </header>

          <section className="tp-stats">
            <div className="tp-stat">
              <div className="tp-stat-value">{formatLength(length)}</div>
              <div className="tp-stat-label">Track Length</div>
            </div>
            <div className="tp-stat">
              <div className="tp-stat-value">{turns ?? "—"}</div>
              <div className="tp-stat-label">Turns</div>
            </div>
            <div className="tp-stat">
              <div className="tp-stat-value">{trackRaces.length}</div>
              <div className="tp-stat-label">Events at Track</div>
            </div>
          </section>
        </div>

        <aside className="tp-hero-aside">
          <div className="tp-map-card">
            {mapSrc && mapOk ? (
              <img
                src={mapSrc}
                alt={`${country} track map`}
                className="tp-map"
                loading="lazy"
                onError={() => {
                  console.warn("[TrackPage] Failed to load map:", mapSrc);
                  setMapIdx((i) => {
                    const next = i + 1;
                    if (next < mapCandidates.length) {
                      console.log(
                        "[TrackPage] Trying next map candidate:",
                        mapCandidates[next]
                      );
                      return next;
                    }
                    setMapOk(false);
                    return i;
                  });
                }}
              />
            ) : (
              <div className="tp-map-fallback">
                No map available
                {mapCandidates?.length ? (
                  <details style={{ marginTop: 8 }}>
                    <summary>Tried paths</summary>
                    <ul style={{ marginTop: 6 }}>
                      {mapCandidates.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* EVENTS & RESULTS */}
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
                const results = (r.raceResults ?? [])
                  .slice()
                  .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
                const MAX = 3;
                const showAll = !!expanded[r.id];
                const visible = showAll ? results : results.slice(0, MAX);
                const hiddenCount = results.length - visible.length;

                return (
                  <article className="tp-round-card" key={r.id}>
                    <div className="tp-round-meta">
                      <div className="tp-round-title">{r.name}</div>
                      <div className="tp-round-sub">
                        Season {r.season} · Tier {r.division} · Round {r.round}
                        {r.date ? ` - ${formatDate(r.date)}` : ""}
                        {r.sprint === "Yes" ? (
                          <span className="tp-badge tp-badge-sprint">Sprint</span>
                        ) : null}
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
                            <div className={`tp-pos ${medalClass(res.position)}`}>
                              {posLabel(res)}
                            </div>
                            <Link
                              to={`/STB/Driver/${encodeURIComponent(res.driver)}`}
                              className="tp-driver"
                            >
                              {res.driver}
                            </Link>
                            <div className="tp-right">
                              {isDNF(res) ? (
                                <span className="tp-tag tp-tag-dnf">DNF</span>
                              ) : (
                                <span className="tp-tag">{res.points ?? 0}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {hiddenCount > 0 && (
                      <Link
                        to={`/STB/Race/${r.id}`}
                        className="tp-showmore"
                        aria-label={`Go to results for race ${r.id}`}
                      >
                        View Race Result
                      </Link>
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
  return `${Number(val).toFixed(3)} km`;
}
function formatDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
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
  return typeof res?.position === "number"
    ? res.position
    : Number.POSITIVE_INFINITY;
}
function medalClass(position) {
  if (position === 1) return "tp-medal tp-medal-1";
  if (position === 2) return "tp-medal tp-medal-2";
  if (position === 3) return "tp-medal tp-medal-3";
  return "";
}
function compareBySeasonRound(a, b) {
  const sa = Number(a.season ?? -Infinity);
  const sb = Number(b.season ?? -Infinity);
  if (sb !== sa) return sb - sa; // season DESC
  const ra = Number(a.round ?? -Infinity);
  const rb = Number(b.round ?? -Infinity);
  return rb - ra; // round DESC
}

export default TrackPage;
