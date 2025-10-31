import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import React from "react";
import "./DriverPage.css";
import "@/Components/Links.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function DriverPage() {
  const { driverName } = useParams();
  const [driverStats, setDriverStats] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [newCountry, setNewCountry] = useState("");
  const [savingCountry, setSavingCountry] = useState(false);
  const [flags, setFlags] = useState([]);

  useEffect(() => {
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

  useEffect(() => {
    fetch("/flags/1_manifest.json")
      .then(res => res.json())
      .then(setFlags)
      .catch(err => console.error("Error loading flags manifest:", err));
  }, []);

  const fetchDriverStats = async () => {
    try {
      const res = await fetch(`http://localhost:5110/api/driver/stats/${driverName}`);
      if (!res.ok) throw new Error("Failed to fetch driver stats");
      const data = await res.json();
      setDriverStats(data);
    } catch (err) {
      console.error(err);
      setError("No Driver has been claimed. Please claim a driver by going to Drivers profile and click the claim button.");
    } finally {
      setLoading(false);
    }
  };

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

  const updateDriverCountry = async () => {
    console.log("Inside updateDriverCountry ✅", {
      driverStats,
      driverId: driverStats?.driverOBJ?.id,
      newCountry,
    });

    if (!driverStats?.driverOBJ?.id || !newCountry) {
      console.warn("⛔ Exiting early — missing data", {
        driverId: driverStats?.driverOBJ?.id,
        newCountry,
      });
      return;
    }

    try {
      setSavingCountry(true);
      const driverId = driverStats.driverOBJ.id;
      console.log("Selected driver ID:", driverId, "New country:", newCountry);
      const res = await fetch(`http://localhost:5110/api/driver/updateCountry/${driverId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: newCountry }),
      });

      if (!res.ok) throw new Error("Failed to update country");

      const updated = await res.json();

      await fetchDriverStats();  // 👈 call the same fetcher as in useEffect

      setShowPopup(false);
    } catch (err) {
      console.error("Error updating country:", err);
      alert("Could not update driver country.");
    } finally {
      setSavingCountry(false);
    }
  };

  if (loading) return <div className="spinner">🏁 Loading driver stats...</div>;
  if (error) return <div className="error">❌ {error}</div>;
  if (!driverStats) return <div>No data available.</div>;

  const nat = driverStats?.driverOBJ?.country ?? "NAT";
  const flagPath = driverStats?.driverOBJ?.country
    ? `/flags/${driverStats.driverOBJ.country}.png`
    : null;

  function StartFinishHeatmap({ allRaces, driverName }) {
    console.log("[Heatmap] driverName prop:", driverName); // sanity check
    const matrix = getStartFinishMatrix(allRaces, driverName); // pass it through
    const max = Math.max(0, ...matrix.flat());

    return (
      <div className="sf-heatmap-wrap" style={{ display: "grid", gap: 12 }}>
        {/* Color legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.85 }}>Less</span>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(59,130,0,0.2), rgba(16,185,129,0.9))",
            }}
          />
          <span style={{ opacity: 0.85 }}>More</span>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto repeat(20, 1fr)",
            gap: 4,
          }}
        >
          {/* Column headers */}
          <div />
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={`col-${i}`}
              style={{
                textAlign: "center",
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              P{i + 1}
            </div>
          ))}

          {/* Rows */}
          {matrix.map((row, r) => (
            <React.Fragment key={r}>
              {/* Row label */}
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  whiteSpace: "nowrap",
                }}
              >
                Start P{r + 1}
              </div>
              {/* Cells */}
              {row.map((val, c) => (
                <div
                  key={`${r}-${c}`}
                  title={`Start P${r + 1} → Finish P${c + 1}: ${val}`}
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 3,
                    background: heatColor(val, max),
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  {val > 0 ? val : ""}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          *DNFs excluded — only races with valid start & finish positions shown.
        </div>
      </div>
    );
  }

  // --- tiny donut chart (no deps) ---
  function DonutChart({ data, size = 160, thickness = 28 }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const slices = total === 0
      ? [{ color: "#e5e7eb", value: 1, label: "No data" }]
      : data;

    // Build conic-gradient stops
    let acc = 0;
    const stops = slices.map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    }).join(", ");

    const radius = size / 2;
    const inner = radius - thickness;

    return (
      <div className="donut-wrap" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div
          aria-label="Race distribution donut chart"
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: `conic-gradient(${stops})`,
            position: "relative",
            flex: "0 0 auto",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: thickness,
              background: "var(--panel-bg, #0b0b0b)",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {total} races
          </div>
        </div>

        {/* Legend */}
        <ul className="donut-legend" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {data.map((d) => (
            <li key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: d.color,
                  display: "inline-block",
                }}
              />
              <span style={{ opacity: 0.9 }}>
                {d.label}: <strong>{d.value}</strong>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
              const top10 = results.filter(r => typeof r.position === "number" && r.position >= 1 && r.position <= 5)
                                  .slice(0, 5);

              // this driver's result
              const myResult = results.find(rr => rr.driver === driverStats.driver);
              const showMyExtra = myResult && (typeof myResult.position !== "number" || myResult.position > 5);

              return (
                <div className="last-race">
                  {/* meta */}
                  <div className="lr-meta">
                    <a href={`/STB/Championship/${race.season}/${race.division}?driver=${driverStats.driver}`} className= "primary-link">Season {race.season} Tier {race.division}</a>
                    <h>•</h>
                    <a href={`/STB/Race/${raceLabel}?driver=${driverStats.driver}`} className= "primary-link">{trackLabel}</a>
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
                          <a href={`/STB/Driver/${encodeURIComponent(res.driver)}`} className="primary-link">
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
                            <a href={`/STB/Driver/${encodeURIComponent(myResult.driver)}`} className="primary-link">
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
            {(() => {
              const lastFive = (driverStats.allRaces ?? []).slice(0, 5);

              return lastFive.length ? (
                <div className="race-chips">
                  {lastFive.map((race, idx) => {
                    const trackLabel = asTrackLabel(race.track);
                    const raceLabel  = asRaceLabel(race);
                    const results    = (race.raceResults ?? []).slice().sort((a,b)=>toPosSortKey(a)-toPosSortKey(b));
                    const myResult   = results.find(rr => rr.driver === driverStats.driver);

                    const labelPos = myResult ? (isDNF(myResult) ? "DNF" : `P${myResult.position}`) : "—";
                    const pts      = myResult && !isDNF(myResult) ? (myResult.points ?? 0) : 0;

                    const isSprint =
                      race?.isSprint === true ||
                      race?.sprint === true ||
                      race?.format === "Sprint" ||
                      race?.type === "Sprint";

                    const title = `${trackLabel} • ${labelPos}${isSprint ? " • Sprint" : ""}${myResult ? ` • ${pts} pts` : ""}`;

                    return (
                      <div
                        key={race.id ?? `${raceLabel}-${idx}`}
                        className="race-chip race-chip--stacked"
                        href={`/STB/Race/${raceLabel}`}
                        title={title}
                        aria-label={title}
                      >
                        <a href= {`/STB/Race/${raceLabel}?driver=${driverStats.driver}`} className="primary-link">{trackLabel}</a>
                        <span className="race-chip-divider" aria-hidden="true" />
                        <div className="race-chip-stats">
                          <span
                            className={`race-chip-badge ${
                              isDNF(myResult) ? "tp-medal tp-medal-dnf" : medalClass(myResult?.position)
                            }`}
                          >
                            {labelPos}
                          </span>
                          {myResult && !isDNF(myResult) && (
                            <span className="race-chip-pts">{pts}</span>
                          )}
                          {isSprint && <span className="race-chip-sprint">SPR</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">No recent races.</div>
              );
            })()}
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
                <div className="stat-value">{driverStats.fastestLaps ?? "—"}</div>
                <div className="stat-label">Fastest Laps</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.dnfs ?? "—"}</div>
                <div className="stat-label">DNF's</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.averagePosition != null ? driverStats.averagePosition.toFixed(2) : "—"}
                </div>
                <div className="stat-label">Avg Finish</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.averageQualifying != null ? driverStats.averageQualifying.toFixed(2) : "—"}
                </div>
                <div className="stat-label">Avg Qualifying</div>
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

        {/* Start vs Finish Heatmap */}
        <article className="panel panel--span2 panel--tall">
          <header className="panel-header">Start vs Finish (P1–P20)</header>
          <div className="panel-body">
            {Array.isArray(driverStats?.allRaces) && driverStats.allRaces.length ? (
              <StartFinishHeatmap allRaces={driverStats.allRaces} driverName={driverName} />
            ) : (
              <div className="empty">No race data yet.</div>
            )}
          </div>
        </article>

        {/* Points Positions Bar Chart */}
        <article className="panel">
          <header className="panel-header">Points Finishes (P1–P10)</header>
          <div className="panel-body">
            {(() => {
              const data = getPointsPositionsData(driverStats?.allRaces, driverStats?.driver ?? driverName);
              const total = data.reduce((sum, d) => sum + d.count, 0);

              return total === 0 ? (
                <div className="empty">No points finishes yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="position" tick={{ fill: "#fff" }} />
                    <YAxis tick={{ fill: "#fff" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "none", color: "#fff" }}
                      labelStyle={{ color: "#f8fafc" }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </article>

        {/* Race pie chart*/}
        <article className="panel">
          <header className="panel-header">Race Data</header>
          <div className="panel-body">
            {(() => {
              const buckets = aggregateRaceBucketsFromAll(
                driverStats?.driver ?? driverName,
                driverStats?.allRaces,           // ✅ pass the array of races
                driverStats?.driver              // ✅ driver label fallback
              );
              const data = [
                { key: "podiums",  label: "Podiums",      value: buckets.podiums,  color: "#f59e0b" }, // amber
                { key: "points",   label: "Points",       value: buckets.points,   color: "#3b82f6" }, // blue
                { key: "noPoints", label: "No Points",    value: buckets.noPoints, color: "#10b981" }, // emerald
                { key: "dnf",      label: "DNF",          value: buckets.dnf,      color: "#ef4444" }, // red
              ];

              const total = data.reduce((s,d) => s + d.value, 0);
              return total === 0 ? (
                <div className="empty">No race data yet.</div>
              ) : (
                <DonutChart data={data} />
              );
            })()}
          </div>
        </article>
      </div>

      {/* Dark overlay + popup */}
      <button
        className="floating-button"
        onClick={() => {
          setNewCountry(driverStats?.driverOBJ?.country || "");
          setShowPopup(true);
        }}
        aria-label="Edit Driver Country"
      >
        🌍
      </button>

      {/* Overlay + Slide-up Drawer */}
      {showPopup && (
      <div className="overlay" onClick={() => setShowPopup(false)}>
        <div
          className="country-drawer"
          onClick={(e) => e.stopPropagation()} // ✅ stop overlay from catching clicks
        >
          <header className="drawer-header">
            <h2>Change Driver Country</h2>
            <button className="drawer-close" onClick={() => setShowPopup(false)}>✖</button>
          </header>

          <div className="drawer-body">
            <label htmlFor="countrySelect">Select Country:</label>
            <select
              id="countrySelect"
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
            >
              <option value="">— Select a country —</option>
              {flags.map((flagFile) => {
                const country = flagFile.replace(".png", "");
                const flagSrc = `/flags/${flagFile}`;
                return (
                  <option key={country} value={country}>
                    {country}
                  </option>
                );
              })}
            </select>

            <button
              onClick={() => {
                console.log("💾 Save clicked");
                updateDriverCountry();
              }}
              className="save-button"
              disabled={savingCountry || !newCountry}
            >
              {savingCountry ? "Saving..." : "💾 Save"}
            </button>
          </div>
        </div>
      </div>
    )}
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
  if (position === "DNF") return "tp-medal tp-medal-dnf";
  return "";
};
const asTrackLabel = (t) =>
  typeof t === "string" ? t : t?.raceName ?? t?.name ?? "—";
const asRaceLabel = (r) =>
  typeof r === "string" ? r : r?.id ?? r?.id ?? "—";
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : "—";

const getPointsPositionsData = (allRaces, driverName) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const counts = Array(10).fill(0); // P1–P10

  for (const race of races) {
    const results = (race?.raceResults ?? []).slice().sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
    if (DEBUG_HEATMAP) {
      console.log("[Heatmap] driverName param:", driverName);
    }
    const me = results.find(
      (rr) =>
        rr?.driver?.toLowerCase?.() === (driverName ?? "").toLowerCase() ||
        rr?.driver === driverName
    );
    if (!me) continue;
    const pos = typeof me.position === "number" ? me.position : null;
    if (pos && pos >= 1 && pos <= 10) counts[pos - 1] += 1;
  }

  return counts.map((count, idx) => ({
    position: `${idx + 1}`,
    count,
  }));
};

// ONLY use allRaces; no fallbacks
const aggregateRaceBucketsFromAll = (driverName, allRaces, driverLabel) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const buckets = { podiums: 0, points: 0, noPoints: 0, dnf: 0 };

  for (const race of races) {
    const results = (race?.raceResults ?? [])
      .slice()
      .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

    const me = results.find(
      (rr) =>
        rr?.driver?.toLowerCase?.() === (driverName ?? "").toLowerCase() ||
        rr?.driver === driverLabel
    );
    if (!me) continue;

    const dnf = isDNF(me);
    const pos = typeof me.position === "number" ? me.position : null;
    const pts = typeof me.points === "number" ? me.points : 0;

    if (dnf) buckets.dnf += 1;
    else if (pos && pos >= 1 && pos <= 3) buckets.podiums += 1;
    else if (pts > 0) buckets.points += 1;
    else buckets.noPoints += 1;
  }
  return buckets;
};

const getStartFinishMatrix = (allRaces, driverNameRaw) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const m = Array.from({ length: 20 }, () => Array(20).fill(0));

  if (DEBUG_HEATMAP) {
    console.log("[Heatmap] allRaces length:", races.length);
  }

  let processed = 0;

  for (const race of races) {
    const results = Array.isArray(race?.raceResults) ? race.raceResults : null;
    if (!results) continue;

    const me = findMyRow(results, driverNameRaw);
    if (!me) continue;

    const dnf =
      me?.dnf === "Yes" ||
      me?.dnf === "DNF" ||
      me?.status === "DNF" ||
      me?.classified === false;

    // try multiple fields for start & finish
    const startPos =
      (typeof me.grid === "number" && me.grid) ||
      (typeof me.start === "number" && me.start) ||
      (typeof me.startingPosition === "number" && me.startingPosition) ||
      (typeof me.qualifying === "number" && me.qualifying) ||
      (typeof me.quali === "number" && me.quali) ||
      null;

    let finishPos = null;
    if (typeof me.position === "number") finishPos = me.position;
    else if (typeof me.position === "string" && /^P?\d+$/.test(me.position)) {
      finishPos = parseInt(me.position.replace("P",""), 10);
    }

    if (DEBUG_HEATMAP) {
      console.log("[Heatmap] race:", { id: race?.id, track: race?.track, date: race?.date },
        "me:", extractDriverName(me),
        "start:", startPos, "finish:", finishPos, "dnf:", dnf
      );
    }

    if (!startPos || !finishPos || dnf) continue;
    if (startPos < 1 || startPos > 20 || finishPos < 1 || finishPos > 20) continue;

    m[startPos - 1][finishPos - 1] += 1;
    processed++;
  }

  if (DEBUG_HEATMAP) {
    const total = m.flat().reduce((a,b)=>a+b,0);
    console.log("[Heatmap] processed rows:", processed, "total counts placed:", total);
  }

  return m;
};

// Simple color scale: returns an rgba() with intensity based on value/max
const heatColor = (value, max) => {
  if (max <= 0) return "rgba(59,130,246,0.08)"; // faint fallback
  const t = value / max;                 // 0..1
  const alpha = 0.15 + 0.75 * t;         // keep visible on dark bg
  // blue -> green blend (feel free to tweak)
  const r = Math.round(59 + (16 - 59) * t);
  const g = Math.round(130 + (185 - 130) * t);
  const b = Math.round(0 + (129 - 246) * t);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Turn off later
const DEBUG_HEATMAP = false;

// 1) Normalize any name to a canonical form (case/space/diacritics insensitive)
const canonicalize = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip accents
    .replace(/\s+/g, "")              // remove all spaces
    .toLowerCase()
    .trim();

// 2) Try to extract a driver name from a result row using common field names
const extractDriverName = (row) => {
  if (!row || typeof row !== "object") return "";
  // sometimes the driver is an object like { name: "...", username: "..." }
  const candidateObjs = [
    row.driver, row.driverOBJ, row.user, row.account, row.profile,
  ].filter(Boolean);

  for (const obj of candidateObjs) {
    if (typeof obj === "string") return obj;
    if (typeof obj === "object") {
      const v = obj.name || obj.username || obj.displayName || obj.tag || obj.handle;
      if (v) return v;
    }
  }

  // fall back to flat string fields on the row
  return (
    row.driver ||
    row.name ||
    row.username ||
    row.displayName ||
    row.tag ||
    row.handle ||
    ""
  );
};

// 3) Find the driver's row in raceResults using canonical comparison.
//    Also logs the available names when we can't find a match.
const findMyRow = (results, targetNameRaw) => {
  const target = canonicalize(targetNameRaw);

  for (const rr of results) {
    const name = extractDriverName(rr);
    if (canonicalize(name) === target) return rr;
  }

  // Not found: debug dump of what names exist
  if (DEBUG_HEATMAP) {
    const names = results.map((rr) => extractDriverName(rr));
    console.log("[Heatmap] could not match driver. target:",
      targetNameRaw,
      "canonical:", target,
      "available:", names
    );
  }
  return null;
};
