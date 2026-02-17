import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import "./TrackPage.css";
import "@/Components/Links.css";

/* ---------- maps & helpers at module scope ---------- */

const MAP_EXCEPTIONS = {
  "United States": {
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
};

function slugCountry(c) {
  return encodeURIComponent(String(c).trim().replace(/\s+/g, "_"));
}

function slugTrack(t) {
  return encodeURIComponent(String(t).trim().replace(/\s+/g, "_"));
}

const eqCI = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const incCI = (hay, needle) =>
  String(hay).toLowerCase().includes(String(needle).toLowerCase());

function getMapCandidates({ country, name }) {
  const out = [];

  if (country && MAP_EXCEPTIONS[country]) {
    const byCountry = MAP_EXCEPTIONS[country];

    if (byCountry[name]) out.push(byCountry[name]);
    else {
      const keys = Object.keys(byCountry);
      const k = keys.find(
        (key) => eqCI(key, name) || incCI(name, key) || incCI(key, name)
      );
      if (k) out.push(byCountry[k]);
    }
  }

  if (country && name) {
    out.push(`/track_map/${slugCountry(country)}_${slugTrack(name)}.avif`);
  }

  if (country) {
    out.push(`/track_map/${slugCountry(country)}.avif`);
  }

  return out;
}

/* ---------- component ---------- */

function TrackPage() {
  const { trackId } = useParams();

  const [trackInfo, setTrackInfo] = useState(null);
  const [trackRaces, setTrackRaces] = useState([]);

  const mostWins = useMemo(
    () => topWinnerFirstAchievedBySeason(trackRaces, { includeSprint: true }),
    [trackRaces]
  );

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingRaces, setLoadingRaces] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [errorRaces, setErrorRaces] = useState(null);

  const [mapOk, setMapOk] = useState(true);
  const [mapIdx, setMapIdx] = useState(0);
  const [expanded] = useState({});

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const res = await fetch(
          `https://stbleague.fly.dev/api/track/${encodeURIComponent(trackId || "")}`
        );
        if (!res.ok) throw new Error("Failed to fetch track info");
        const data = await res.json();
        if (!abort) setTrackInfo(data);
      } catch (err) {
        if (!abort) setErrorInfo(err.message);
      } finally {
        if (!abort) setLoadingInfo(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch(
          `https://stbleague.fly.dev/api/track/races/${encodeURIComponent(trackId || "")}`
        );
        if (!res.ok) throw new Error("Failed to fetch track races");
        const races = await res.json();
        if (!abort) setTrackRaces(Array.isArray(races) ? races : []);
      } catch (err) {
        if (!abort) setErrorRaces(err.message);
      } finally {
        if (!abort) setLoadingRaces(false);
      }
    })();

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

  const mapCandidates = getMapCandidates({ country, name });
  const mapSrc = mapOk && mapCandidates.length ? mapCandidates[mapIdx] : null;

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
                className="tp-flag"
              />
            )}
            <h1 className="tp-title">{name}</h1>
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

            <div className="tp-stat">
              <div className="tp-stat-value">{mostWins?.count ?? "—"}</div>
              <div className="tp-stat-sub">
                <span className="tp-stat-label">Most wins:</span>
                {mostWins?.name && (
                  <Link
                    to={`/STB/Driver/${encodeURIComponent(mostWins.name)}`}
                    className="primary-link tp-stat-winner"
                  >
                    {mostWins.name}
                  </Link>
                )}
              </div>
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
                  setMapIdx((i) => {
                    const next = i + 1;
                    if (next < mapCandidates.length) return next;
                    setMapOk(false);
                    return i;
                  });
                }}
              />
            ) : (
              <div className="tp-map-fallback">No map available</div>
            )}
          </div>
        </aside>
      </div>

      {/* EVENTS & RESULTS */}
      <section className="tp-section">
        <h2 className="tp-section-title">Events & Results</h2>

        {trackRaces.length === 0 ? (
          <div className="tp-empty">No events found.</div>
        ) : (
          <div className="tp-rounds tp-rounds-2">
            {trackRaces
              .slice()
              .sort(compareBySeasonRound)
              .map((r) => {
                const results = (r.raceResults ?? [])
                  .slice()
                  .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

                const visible = results.slice(0, 3);

                return (
                  <article className="tp-round-card" key={r.id}>
                    <div className="tp-round-meta">
                      <div className="tp-round-title">{r.name}</div>
                      <div className="tp-round-sub">
                        Season {r.season} · Tier {r.division} · Round {r.round}
                        {r.date ? ` - ${formatDate(r.date)}` : ""}
                        {r.sprint === "Yes" && (
                          <span className="tp-badge tp-badge-sprint">Sprint</span>
                        )}
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
                              to={`/STB/Driver/${encodeURIComponent(res.driver?.name ?? "")}`}
                              className="primary-link"
                            >
                              {res.driver?.name ?? "Unknown"}
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

                    {results.length > 3 && (
                      <Link to={`/STB/Race/${r.id}`} className="tp-showmore">
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
    return new Date(d).toLocaleDateString(undefined, {
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
  if (sb !== sa) return sb - sa;
  const ra = Number(a.round ?? -Infinity);
  const rb = Number(b.round ?? -Infinity);
  return rb - ra;
}

function topWinnerFirstAchievedBySeason(races, { includeSprint = true } = {}) {
  if (!Array.isArray(races) || races.length === 0) return null;

  const asc = [...races].sort((a, b) => {
    const sa = Number(a?.season);
    const sb = Number(b?.season);
    if (sa !== sb) return (isNaN(sa) ? Infinity : sa) - (isNaN(sb) ? Infinity : sb);

    const ra = Number(a?.round);
    const rb = Number(b?.round);
    return (isNaN(ra) ? Infinity : ra) - (isNaN(rb) ? Infinity : rb);
  });

  const counts = new Map();
  let leaderName = null;
  let leaderCount = 0;

  for (const r of asc) {
    if (!includeSprint && r?.sprint === "Yes") continue;

    const winner = (r?.raceResults || []).find(rr => rr?.position === 1);
    if (!winner?.driver?.name) continue;

    const driverName = winner.driver.name;

    const next = (counts.get(driverName) || 0) + 1;
    counts.set(driverName, next);

    if (next > leaderCount) {
      leaderCount = next;
      leaderName = driverName;
    }
  }

  if (!leaderName) return null;
  return { count: leaderCount, name: leaderName };
}

export default TrackPage;
