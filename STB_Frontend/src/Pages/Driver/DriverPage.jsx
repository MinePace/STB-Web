import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import React from "react";
import "./DriverPage.css";
import DriverLoader from "@/Components/Loaders/DriverLoader";
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
  const [roleState, setRoleState] = useState("user");
  const [name, setUsername] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
      setToken(localStorage.getItem("token"));
      let role = "user";
    
      if (token) {
        try {
          const decoded = jwtDecode(token);
    
          role = decoded.role;
          setRoleState(role);
  
          const username = decoded.username
          setUsername(username);
        } catch (e) {
          console.log("JWT decode failed:", e);
        }
      }
    }, []);

  useEffect(() => {
    const fetchUser = async () => {

      if (!token || !name) return;

      try {
        const res = await fetch(`https://stbleaguedata.vercel.app/api/user/${name}`, {
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
      setLoading(true);
      setDriverStats(null);
      setError(null);
      const res = await fetch(`https://stbleaguedata.vercel.app/api/driver/stats/${driverName}`);
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
      const response = await fetch(`https://stbleaguedata.vercel.app/api/driver/claim/${driverStats.Driver}`, {
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
      driverId: driverStats?.driverOBJ?.Id,
      newCountry,
    });

    if (!driverStats?.driverOBJ?.Id || !newCountry) {
      console.warn("⛔ Exiting early — missing data", {
        driverId: driverStats?.driverOBJ?.Id,
        newCountry,
      });
      return;
    }

    try {
      setSavingCountry(true);
      const driverId = driverStats.driverOBJ.Id;
      console.log("Selected driver ID:", driverId, "New country:", newCountry);
      const res = await fetch(`https://stbleaguedata.vercel.app/api/driver/updateCountry/${driverId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: newCountry }),
      });

      if (!res.ok) throw new Error("Failed to update country");

      await res.json();
      await fetchDriverStats();
      setShowPopup(false);
    } catch (err) {
      console.error("Error updating country:", err);
      alert("Could not update driver country.");
    } finally {
      setSavingCountry(false);
    }
  };

  if (loading) return <DriverLoader />;
  if (error) return <div className="error">❌ {error}</div>;
  if (!driverStats) return <div>No data available.</div>;

  const nat = driverStats?.driverOBJ?.Country ?? "NAT";
  const flagPath = driverStats?.driverOBJ?.Country
    ? `/flags/${driverStats.driverOBJ.Country}.png`
    : null;
  console.log("country:", driverStats?.driverOBJ?.Country);

  function StartFinishHeatmap({ allRaces, driverName }) {
    const [selectedCell, setSelectedCell] = useState(null);

    const flyoutRef = useRef(null);
    useEffect(() => {
      if (!selectedCell) return;

      const handleClickOutside = (e) => {
        if (flyoutRef.current?.contains(e.target)) return;
        if (e.target.closest(".sf-cell")) return;
        setSelectedCell(null);
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [selectedCell]);

    const matrix = React.useMemo(
      () => getStartFinishMatrixDetailed(allRaces, driverName),
      [allRaces, driverName]
    );

    const max = Math.max(
      0,
      ...matrix.flat().map((cell) => cell.length)
    );

    return (
      <div className="sf-heatmap-wrap" style={{ display: "grid", gap: 12 }}>
        {/* legend */}
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

        {/* grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto repeat(20, 1fr)",
            gap: 4,
          }}
        >
          <div />
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={`col-${i}`}
              style={{ textAlign: "center", fontSize: 12, opacity: 0.7 }}
            >
              P{i + 1}
            </div>
          ))}

          {matrix.map((row, r) => (
            <React.Fragment key={r}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                P{r + 1}
              </div>

              {row.map((cellRaces, c) => {
                const count = cellRaces.length;

                return (
                  <div
                    key={`${r}-${c}`}
                    title={`Start P${r + 1} → Finish P${c + 1}: ${count}`}
                    onClick={(e) => {
                      if (!count) return;

                      const cellRect = e.currentTarget.getBoundingClientRect();
                      const containerRect =
                        e.currentTarget
                          .closest(".sf-heatmap-wrap")
                          .getBoundingClientRect();

                      setSelectedCell({
                        start: r + 1,
                        finish: c + 1,
                        races: cellRaces,
                        x: cellRect.right - containerRect.left,
                        y: cellRect.top - containerRect.top,
                      });
                    }}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 3,
                      background: heatColor(count, max),
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.9)",
                      cursor: count > 0 ? "pointer" : "default",
                      transition: "transform 0.12s ease",
                    }}
                    className={`sf-cell ${selectedCell?.start === r + 1 && selectedCell?.finish === c + 1 ? "sf-cell--active" : ""}`}
                  >
                    {count > 0 ? count : ""}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          *DNFs excluded — only races with valid start & finish positions shown.
        </div>

        {/* popup */}
        {selectedCell && (
          <div
            ref={flyoutRef} 
            className="heatmap-flyout"
            style={{
              left: selectedCell.x,
              top: selectedCell.y,
            }}
          >
            <div className="heatmap-flyout-title">
              Start P{selectedCell.start} → Finish P{selectedCell.finish}
            </div>

            <div className="heatmap-flyout-list">
              {selectedCell.races.map((race) => (
                <Link
                  key={race.Id}
                  to={`/STB/Race/${race.Id}`}
                  className="heatmap-flyout-link"
                  onClick={() => setSelectedCell(null)}
                >
                  {asTrackLabel(race.Track)} — S{race.Season} T{race.Division}
                </Link>
              ))}
            </div>

            <button
              className="heatmap-flyout-close"
              onClick={() => setSelectedCell(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- tiny donut chart (no deps) ---
  function DonutChart({ data, size = 160, thickness = 28 }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const slices =
      total === 0
        ? [{ color: "#e5e7eb", value: 1, label: "No data" }]
        : data;

    let acc = 0;
    const stops = slices
      .map((s) => {
        const start = (acc / total) * 360;
        acc += s.value;
        const end = (acc / total) * 360;
        return `${s.color} ${start}deg ${end}deg`;
      })
      .join(", ");

    return (
      <div
        className="donut-wrap"
        style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}
      >
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

        <ul
          className="donut-legend"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {data.map((d) => (
            <li
              key={d.key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
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

              const trackLabel = asTrackLabel(race.Track);
              const raceLabel = asRaceLabel(race);
              const dateLabel = fmtDate(race.Date);

              const results = (race.RaceResults ?? [])
                .slice()
                .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

              const top10 = results
                .filter(
                  (r) =>
                    typeof r.Position === "number" &&
                    r.Position >= 1 &&
                    r.Position <= 5
                )
                .slice(0, 5);

              // use helper to find this driver's row (handles driver objects)
              const myResult = findMyRow(results, driverStats.Driver);
              const showMyExtra =
                myResult &&
                (typeof myResult.Position !== "number" ||
                  myResult.Position > 5);

              return (
                <div className="last-race">
                  <div className="lr-meta">
                    <Link
                      to={`/STB/Championship/${race.Season}/${race.Division}?driver=${driverStats.driver}`}
                      className="primary-link"
                    >
                      Season {race.Season} Tier {race.Division}
                    </Link>
                    <h>•</h>
                    <Link
                      to={`/STB/Race/${raceLabel}?driver=${driverStats.driver}`}
                      className="primary-link"
                    >
                      {trackLabel}
                    </Link>
                    <div>
                      <strong>Date:</strong> {dateLabel}
                    </div>
                  </div>

                  <div className="tp-results" style={{ marginTop: 12 }}>
                    <div className="tp-results-head">
                      <div>Pos</div>
                      <div>Driver</div>
                      <div className="tp-right">Pts</div>
                    </div>

                    <div className="tp-results-body">
                      {top10.map((res) => {
                        const name = extractDriverName(res);
                        return (
                          <div
                            className="tp-result-row"
                            key={res.Id ?? `${name}-${res.Position}`}
                          >
                            <div
                              className={`tp-pos ${medalClass(
                                res.Position
                              )}`}
                            >
                              {posLabel(res)}
                            </div>
                            <Link
                              to={`/STB/Driver/${encodeURIComponent(name)}`}
                              className="primary-link"
                            >
                              {name}
                            </Link>
                            <div className="tp-right">
                              {isDNF(res) ? (
                                <span className="tp-tag tp-tag-dnf">
                                  DNF
                                </span>
                              ) : (
                                <span className="tp-tag">
                                  {res.Points ?? 0}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {showMyExtra && myResult && (
                        <>
                          <div className="tp-divider" aria-hidden="true" />
                          {(() => {
                            const myName = extractDriverName(myResult);
                            return (
                              <div
                                className="tp-result-row tp-result-row--me"
                                key={myResult.Id ?? "me"}
                              >
                                <div
                                  className={`tp-pos ${medalClass(
                                    myResult.Position
                                  )}`}
                                >
                                  {posLabel(myResult)}
                                </div>
                                <Link
                                  to={`/STB/Driver/${encodeURIComponent(
                                    myName
                                  )}`}
                                  className="primary-link"
                                >
                                  {myName}
                                </Link>
                                <div className="tp-right">
                                  {isDNF(myResult) ? (
                                    <span className="tp-tag tp-tag-dnf">
                                      DNF
                                    </span>
                                  ) : (
                                    <span className="tp-tag">
                                      {myResult.Points ?? 0}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
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
                    const trackLabel = asTrackLabel(race.Track);
                    const raceLabel = asRaceLabel(race);
                    const results = (race.RaceResults ?? [])
                      .slice()
                      .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));
                    const myResult = findMyRow(
                      results,
                      driverName
                    );
                    const isSprint =
                      race?.isSprint === true ||
                      race?.Sprint === true ||
                      race?.format === "Sprint" ||
                      race?.type === "Sprint";

                    let labelPos = "—";
                    let pts = 0;

                    if (myResult) {
                      if (isDNF(myResult)) {
                        labelPos = "DNF";
                      } else {
                        labelPos = `P${myResult.Position}`;
                      }
                      if (!isDNF(myResult)) {
                        pts = myResult.Points ?? 0;
                      }
                    }

                    const title = `${trackLabel} • ${labelPos}${
                      isSprint ? " • Sprint" : ""
                    }${myResult ? ` • ${pts} pts` : ""}`;

                    return (
                      <div
                        key={race.Id ?? `${raceLabel}-${dx}`}
                        className="race-chip race-chip--stacked"
                        to={`/STB/Race/${raceLabel}`}
                        title={title}
                        aria-label={title}
                      >
                        <Link
                          to={`/STB/Race/${raceLabel}?driver=${driverStats.driver}`}
                          className="primary-link"
                        >
                          {trackLabel}
                        </Link>
                        <span
                          className="race-chip-divider"
                          aria-hidden="true"
                        />
                        <div className="race-chip-stats">
                          <span
                            className={`race-chip-badge ${
                              isDNF(myResult)
                                ? "tp-medal tp-medal-dnf"
                                : medalClass(myResult?.Position)
                            }`}
                          >
                            {labelPos}
                          </span>
                          {myResult && !isDNF(myResult) && (
                            <span className="race-chip-pts">
                              {pts}
                            </span>
                          )}
                          {isSprint && (
                            <span className="race-chip-sprint">
                              SPR
                            </span>
                          )}
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
                <div className="stat-value">
                  {driverStats.totalPoints ?? "—"}
                </div>
                <div className="stat-label">Total Points</div>
              </div>
              <div className="stat">
                <div className="stat-value">{driverStats.wins ?? "—"}</div>
                <div className="stat-label">Wins</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.podiums ?? "—"}
                </div>
                <div className="stat-label">Podiums</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.poles ?? "—"}
                </div>
                <div className="stat-label">Poles</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.fastestLaps ?? "—"}
                </div>
                <div className="stat-label">Fastest Laps</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.dnfs ?? "—"}
                </div>
                <div className="stat-label">DNF's</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.averagePosition != null
                    ? driverStats.averagePosition.toFixed(2)
                    : "—"}
                </div>
                <div className="stat-label">Avg Finish</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.averageQualifying != null
                    ? driverStats.averageQualifying.toFixed(2)
                    : "—"}
                </div>
                <div className="stat-label">Avg Qualifying</div>
              </div>
              <div className="stat">
                <div className="stat-value">
                  {driverStats.races ?? "—"}
                </div>
                <div className="stat-label">Races</div>
              </div>
            </div>

            <p className="claimed-by">
              {driverStats.driverOBJ?.Username
                ? `Claimed by: ${driverStats.driverOBJ.Username}`
                : "🚨 Unclaimed"}
            </p>

            {!driverStats.driverOBJ?.Username &&
              user &&
              !user.driverClaimed && (
                <button onClick={claimDriver} className="claim-button">
                  🚀 Claim this Driver
                </button>
              )}
          </div>
        </article>

        {/* Start vs Finish Heatmap */}
        <article className="panel panel--span2 panel--tall">
          <header className="panel-header">
            Start vs Finish (P1–P20)
          </header>
          <div className="panel-body">
            {Array.isArray(driverStats?.allRaces) &&
            driverStats.allRaces.length ? (
              <StartFinishHeatmap
                allRaces={driverStats.allRaces}
                driverName={driverName}
              />
            ) : (
              <div className="empty">No race data yet.</div>
            )}
          </div>
        </article>

        {/* Points Positions Bar Chart */}
        <article className="panel">
          <header className="panel-header">
            Points Finishes (P1–P10)
          </header>
          <div className="panel-body">
            {(() => {
              const data = getPointsPositionsData(
                driverStats?.allRaces,
                driverStats?.driver ?? driverName
              );
              const total = data.reduce(
                (sum, d) => sum + d.count,
                0
              );

              return total === 0 ? (
                <div className="empty">
                  No points finishes yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.2}
                    />
                    <XAxis
                      dataKey="position"
                      tick={{ fill: "#fff" }}
                    />
                    <YAxis
                      tick={{ fill: "#fff" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#f8fafc" }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </article>

        {/* Race pie chart */}
        <article className="panel">
          <header className="panel-header">Race Data</header>
          <div className="panel-body">
            {(() => {
              const buckets = aggregateRaceBucketsFromAll(
                driverStats?.driver ?? driverName,
                driverStats?.allRaces,
                driverStats?.driver
              );
              const data = [
                {
                  key: "podiums",
                  label: "Podiums",
                  value: buckets.podiums,
                  color: "#f59e0b",
                },
                {
                  key: "points",
                  label: "Points",
                  value: buckets.points,
                  color: "#3b82f6",
                },
                {
                  key: "noPoints",
                  label: "No Points",
                  value: buckets.noPoints,
                  color: "#10b981",
                },
                {
                  key: "dnf",
                  label: "DNF",
                  value: buckets.dnf,
                  color: "#ef4444",
                },
              ];

              const total = data.reduce(
                (s, d) => s + d.value,
                0
              );
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

      {showPopup && (
        <div
          className="overlay"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="country-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer-header">
              <h2>Change Driver Country</h2>
              <button
                className="drawer-close"
                onClick={() => setShowPopup(false)}
              >
                ✖
              </button>
            </header>

            <div className="drawer-body">
              <label htmlFor="countrySelect">
                Select Country:
              </label>
              <select
                id="countrySelect"
                value={newCountry}
                onChange={(e) =>
                  setNewCountry(e.target.value)
                }
              >
                <option value="">
                  — Select a country —
                </option>
                {flags.map((flagFile) => {
                  const country = flagFile.replace(".png", "");
                  return (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  );
                })}
              </select>

              <button
                onClick={updateDriverCountry}
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

// --- shared helpers ---
const isDNF = (res) => res?.DNF === "Yes" || res?.DNF === "DNF";

const toPosSortKey = (res) =>
  typeof res?.Position === "number"
    ? res.Position
    : Number.POSITIVE_INFINITY;

const posLabel = (res) =>
  typeof res?.Position === "number"
    ? `P${res.Position}`
    : isDNF(res)
    ? "DNF"
    : "—";

const medalClass = (position) => {
  if (position === 1) return "tp-medal tp-medal-1";
  if (position === 2) return "tp-medal tp-medal-2";
  if (position === 3) return "tp-medal tp-medal-3";
  if (position === "DNF") return "tp-medal tp-medal-dnf";
  return "";
};

const asTrackLabel = (t) =>
  typeof t === "string"
    ? t
    : t?.RaceName ?? t?.Name ?? "—";

const asRaceLabel = (r) =>
  typeof r === "string" ? r : r?.Id ?? r?.Id ?? "—";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "—";

// use canonical name matching + findMyRow for *all* data
const getPointsPositionsData = (allRaces, driverName) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const counts = Array(10).fill(0);

  for (const race of races) {
    const results = (race?.RaceResults ?? [])
      .slice()
      .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

    const me = findMyRow(results, driverName);
    if (!me) continue;

    const pos =
      typeof me.Position === "number" ? me.Position : null;
    if (pos && pos >= 1 && pos <= 10) counts[pos - 1] += 1;
  }

  return counts.map((count, idx) => ({
    position: `${idx + 1}`,
    count,
  }));
};

const aggregateRaceBucketsFromAll = (
  driverName,
  allRaces,
  driverLabel
) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const buckets = {
    podiums: 0,
    points: 0,
    noPoints: 0,
    dnf: 0,
  };

  for (const race of races) {
    const results = (race?.RaceResults ?? [])
      .slice()
      .sort((a, b) => toPosSortKey(a) - toPosSortKey(b));

    const me =
      findMyRow(results, driverName) ||
      findMyRow(results, driverLabel);
    if (!me) continue;

    const dnf = isDNF(me);
    const pos =
      typeof me.Position === "number" ? me.Position : null;
    const pts =
      typeof me.Points === "number" ? me.Points : 0;

    if (dnf) buckets.dnf += 1;
    else if (pos && pos >= 1 && pos <= 3)
      buckets.podiums += 1;
    else if (pts > 0) buckets.points += 1;
    else buckets.noPoints += 1;
  }
  return buckets;
};

const getStartFinishMatrix = (allRaces, driverNameRaw) => {
  const races = Array.isArray(allRaces) ? allRaces : [];
  const m = Array.from({ length: 20 }, () =>
    Array(20).fill(0)
  );

  if (DEBUG_HEATMAP) {
    console.log("[Heatmap] allRaces length:", races.length);
  }

  let processed = 0;

  for (const race of races) {
    const results = Array.isArray(race?.RaceResults)
      ? race.RaceResults
      : null;
    if (!results) continue;

    const me = findMyRow(results, driverNameRaw);
    if (!me) continue;

    const dnf =
      me?.DNF === "Yes" ||
      me?.DNF === "DNF" ||
      me?.status === "DNF" ||
      me?.classified === false;

    const startPos =
      (typeof me.grid === "number" && me.grid) ||
      (typeof me.start === "number" && me.start) ||
      (typeof me.startingPosition === "number" &&
        me.startingPosition) ||
      (typeof me.qualifying === "number" && me.qualifying) ||
      (typeof me.Qualifying === "number" && me.Qualifying) ||
      (typeof me.quali === "number" && me.quali) ||
      null;

    let finishPos = null;
    if (typeof me.Position === "number")
      finishPos = me.Position;
    else if (
      typeof me.Position === "string" &&
      /^P?\d+$/.test(me.Position)
    ) {
      finishPos = parseInt(
        me.Position.replace("P", ""),
        10
      );
    }

    if (DEBUG_HEATMAP) {
      console.log(
        "[Heatmap] race:",
        { id: race?.Id, track: race?.Track, date: race?.Date },
        "me:",
        extractDriverName(me),
        "start:",
        startPos,
        "finish:",
        finishPos,
        "dnf:",
        dnf
      );
    }

    if (!startPos || !finishPos || dnf) continue;
    if (
      startPos < 1 ||
      startPos > 20 ||
      finishPos < 1 ||
      finishPos > 20
    )
      continue;

    m[startPos - 1][finishPos - 1] += 1;
    processed++;
  }

  if (DEBUG_HEATMAP) {
    const total = m.flat().reduce((a, b) => a + b, 0);
    console.log(
      "[Heatmap] processed rows:",
      processed,
      "total counts placed:",
      total
    );
  }

  return m;
};

const heatColor = (value, max) => {
  if (max <= 0) return "rgba(59,130,246,0.08)";
  const t = value / max;
  const alpha = 0.15 + 0.75 * t;
  const r = Math.round(59 + (16 - 59) * t);
  const g = Math.round(130 + (185 - 130) * t);
  const b = Math.round(0 + (129 - 246) * t);
  return `rgba(${r},${g},${b},${alpha})`;
};

const DEBUG_HEATMAP = false;

const canonicalize = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();

const extractDriverName = (row) => {
  if (!row || typeof row !== "object") return "";
  const candidateObjs = [
    row.Driver,
    row.driverOBJ,
    row.user,
    row.account,
    row.profile,
    row.DriverName
  ].filter(Boolean);

  for (const obj of candidateObjs) {
    if (typeof obj === "string") return obj;
    if (typeof obj === "object") {
      const v =
        obj.Name ||
        obj.username ||
        obj.displayName ||
        obj.tag ||
        obj.handle;
      if (v) return v;
    }
  }

  return (
    row.driver ||
    row.Name ||
    row.username ||
    row.displayName ||
    row.tag ||
    row.handle ||
    ""
  );
};

const getStartFinishMatrixDetailed = (allRaces, driverNameRaw) => {
  const races = Array.isArray(allRaces) ? allRaces : [];

  const m = Array.from({ length: 20 }, () =>
    Array.from({ length: 20 }, () => [])
  );

  for (const race of races) {
    const results = Array.isArray(race?.RaceResults)
      ? race.RaceResults
      : null;
    if (!results) continue;

    const me = findMyRow(results, driverNameRaw);
    if (!me) continue;

    const dnf =
      me?.DNF === "Yes" ||
      me?.DNF === "DNF" ||
      me?.classified === false;

    const startPos =
      me?.Qualifying ??
      me?.qualifying ??
      me?.grid ??
      null;

    const finishPos =
      typeof me.Position === "number"
        ? me.Position
        : null;

    if (!startPos || !finishPos || dnf) continue;
    if (startPos < 1 || startPos > 20) continue;
    if (finishPos < 1 || finishPos > 20) continue;

    m[startPos - 1][finishPos - 1].push(race);
  }

  return m;
};

const findMyRow = (results, targetNameRaw) => {
  const target = canonicalize(targetNameRaw);

  for (const rr of results) {
    const name = extractDriverName(rr);
    if (canonicalize(name) === target) return rr;
  }

  if (DEBUG_HEATMAP) {
    const names = results.map((rr) => extractDriverName(rr));
    console.log(
      "[Heatmap] could not match driver. target:",
      targetNameRaw,
      "canonical:",
      target,
      "available:",
      names
    );
  }
  return null;
};
