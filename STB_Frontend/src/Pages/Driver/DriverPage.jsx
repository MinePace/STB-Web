import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./DriverPage.css";

function DriverPage() {
  const { driverName } = useParams();
  const [driverStats, setDriverStats] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDriverStats = async () => {
      try {
        const res = await fetch(`http://localhost:5110/api/driver/stats/${driverName}`);
        if (!res.ok) throw new Error("Failed to fetch driver stats");
        const data = await res.json();
        setDriverStats(data);
      } catch (err) {
        console.error(err);
        setError("Could not load driver stats.");
      } finally {
        setLoading(false);
      }
    };

    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("name");
      if (!token || !name) return;

      try {
        const res = await fetch(`http://localhost:5110/api/user/${name}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchDriverStats();
    fetchUser();
  }, [driverName]);

  const claimDriver = async () => {
    if (!user || driverStats?.driverOBJ?.user) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5110/api/driver/claim/${driverStats.driver}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });

      if (response.ok) {
        const updatedDriver = await response.json();
        setDriverStats(updatedDriver.driver);
      } else {
        alert("Failed to claim driver");
      }
    } catch (err) {
      console.error("Error claiming driver:", err);
    }
  };

  if (loading) return <div className="spinner">🏁 Loading driver stats...</div>;
  if (error) return <div className="error">❌ {error}</div>;
  if (!driverStats) return <div>No data available.</div>;

  const nat = driverStats?.driverOBJ?.country ?? "NAT";
  const flagPath = driverStats?.driverOBJ?.country
    ? `/flags/${driverStats.driverOBJ.country}.png`
    : null;

  return (
    <div className="driver-page">
      {/* Banner */}
      <section className="profile-banner">
        <div className="banner-title">Driver Profile</div>
        <div className="banner-meta">
          <div className="nat-badge" title={nat}>
            {flagPath && (
              <img
                src={flagPath}
                alt={`${nat} flag`}
                className="country-flag"
                aria-hidden="true"
              />
            )}
            <span className="nat-text">{nat}</span>
          </div>
          <h1 className="driver-name">{driverStats.driver}</h1>
        </div>
      </section>

      {/* 3-column layout */}
      <div className="panels">
        {/* Last Race */}
        <article className="panel">
          <header className="panel-header">Last Race</header>
          <div className="panel-body">
            {!driverStats.lastRace ? (
              <div className="empty">No race recorded.</div>
            ) : (() => {
              const race = driverStats.lastRace;

              const trackLabel = asTrackLabel(race.track);
              const raceLabel = asRaceLabel(race);
              const dateLabel = fmtDate(race.date);

              // full results sorted by finish
              const results = (race.raceResults ?? [])
                .slice()
                .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

              // top 10
              const top10 = results.filter(r => typeof r.position === "number" && r.position >= 1 && r.position <= 3)
                                  .slice(0, 3);

              // this driver's result
              const myResult = results.find(rr => rr.driver === driverStats.driver);
              const showMyExtra = myResult && (typeof myResult.position !== "number" || myResult.position > 3);

              return (
                <div className="last-race">
                  {/* meta */}
                  <div className="lr-meta">
                    <a href={`/STB/Race/${raceLabel}`}>{trackLabel}</a>
                    <div><strong>Date:</strong> {dateLabel}</div>
                  </div>

                  {/* table (same structure as TrackPage) */}
                  <div className="tp-results" style={{ marginTop: 12 }}>
                    <div className="tp-results-head">
                      <div>Pos</div>
                      <div>Driver</div>
                      <div className="tp-right">Pts</div>
                    </div>

                    <div className="tp-results-body">
                      {top10.map((res) => (
                        <div className="tp-result-row" key={res.id ?? `${res.driver}-${res.position}`}>
                          <div className={`tp-pos ${medalClass(res.position)}`}>{posLabel(res)}</div>
                          <a href={`/STB/Driver/${encodeURIComponent(res.driver)}`} className="tp-driver">
                            {res.driver}
                          </a>
                          <div className="tp-right">
                            {isDNF(res) ? (
                              <span className="tp-tag tp-tag-dnf">DNF</span>
                            ) : (
                              <span className="tp-tag">{res.points ?? 0}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* divider + my driver row if outside top 10 */}
                      {showMyExtra && (
                        <>
                          <div className="tp-divider" aria-hidden="true" />
                          <div className="tp-result-row tp-result-row--me" key={myResult.id ?? "me"}>
                            <div className={`tp-pos ${medalClass(myResult.position)}`}>{posLabel(myResult)}</div>
                            <a href={`/STB/Driver/${encodeURIComponent(myResult.driver)}`} className="tp-driver">
                              {myResult.driver}
                            </a>
                            <div className="tp-right">
                              {isDNF(myResult) ? (
                                <span className="tp-tag tp-tag-dnf">DNF</span>
                              ) : (
                                <span className="tp-tag">{myResult.points ?? 0}</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </article>

        {/* Last 5 Races */}
        <article className="panel">
          <header className="panel-header">Last 5 Races</header>
          <div className="panel-body">
            {Array.isArray(driverStats.lastFiveRaces) && driverStats.lastFiveRaces.length ? (
              <div className="races-stack">
                {driverStats.lastFiveRaces.map((race, idx) => {
                  const trackLabel = asTrackLabel(race.track);
                  const raceLabel  = asRaceLabel(race);
                  const dateLabel  = fmtDate(race.date);

                  // find this driver's result
                  const results  = (race.raceResults ?? []).slice().sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
                  const myResult = results.find(rr => rr.driver === driverStats.driver);

                  return (
                    <div className="last-race" key={race.id ?? `${raceLabel}-${idx}`}>
                      {/* race title as link + date */}
                      <div className="lr-meta">
                        <a href={`/STB/Race/${raceLabel}`}>{trackLabel}</a>
                      </div>

                      {/* only this driver's row */}
                      <div className="tp-results" style={{ marginTop: 12 }}>
                        <div className="tp-results-body">
                          {myResult ? (
                            <div className="tp-result-row tp-result-row--me" key={myResult.id ?? `me-${idx}`}>
                              <div className={`tp-pos ${medalClass(myResult.position)}`}>{posLabel(myResult)}</div>
                              <a href={`/STB/Driver/${encodeURIComponent(myResult.driver)}`} className="tp-driver">
                                {myResult.driver}
                              </a>
                              <div className="tp-right">
                                {isDNF(myResult) ? (
                                  <span className="tp-tag tp-tag-dnf">DNF</span>
                                ) : (
                                  <span className="tp-tag">{myResult.points ?? 0}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="empty" style={{ marginTop: 8 }}>No result recorded for this driver.</div>
                          )}
                        </div>
                      </div>

                      {idx < driverStats.lastFiveRaces.length - 1 && (
                        <div className="tp-divider" style={{ margin: '16px 0' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">No recent races.</div>
            )}
          </div>
        </article>

        {/* Stats */}
        <article className="panel">
          <header className="panel-header">Stats</header>
          <div className="panel-body">
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-value">{driverStats.totalPoints ?? "—"}</div>
                <div className="stat-label">Total Points</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.wins ?? "—"}</div>
                <div className="stat-label">Wins</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.podiums ?? "—"}</div>
                <div className="stat-label">Podiums</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.poles ?? "—"}</div>
                <div className="stat-label">Poles</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.averagePosition != null ? driverStats.averagePosition.toFixed(2) : "—"}
                </div>
                <div className="stat-label">Avg Finish</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.races ?? "—"}</div>
                <div className="stat-label">Races</div>
              </div>
            </div>

            <p className="claimed-by">
              {driverStats.driverOBJ?.user?.username
                ? `Claimed by: ${driverStats.driverOBJ.user.username}`
                : "🚨 Unclaimed"}
            </p>

            {!driverStats.driverOBJ?.user?.username && user && !user.driverClaimed && (
              <button onClick={claimDriver} className="claim-button">
                🚀 Claim this Driver
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

export default DriverPage;

// --- shared helpers (copied from TrackPage for consistency) ---
const isDNF = (res) => res?.dnf === "Yes" || res?.dnf === "DNF";
const toPosSortKey = (res) =>
  typeof res?.position === "number" ? res.position : Number.POSITIVE_INFINITY;
const posLabel = (res) =>
  typeof res?.position === "number" ? `P${res.position}` : isDNF(res) ? "DNF" : "—";
const medalClass = (position) => {
  if (position === 1) return "tp-medal tp-medal-1";
  if (position === 2) return "tp-medal tp-medal-2";
  if (position === 3) return "tp-medal tp-medal-3";
  return "";
};
const asTrackLabel = (t) =>
  typeof t === "string" ? t : t?.raceName ?? t?.name ?? "—";
const asRaceLabel = (r) =>
  typeof r === "string" ? r : r?.id ?? r?.id ?? "—";
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : "—";
