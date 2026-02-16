import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("token") !== null);
  const [role, setRole] = useState(localStorage.getItem("role") || "user");
  const [currentTier, setCurrentTier] = useState(0);
  const [currentStatsView, setCurrentStatsView] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [latestRace, setLatestRace] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [latestError, setLatestError] = useState(null);

  const [leagueStats, setLeagueStats] = useState(null);
  const [seasonStats, setSeasonStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [nextRace, setNextRace] = useState(null);
  const [timeLeft, setTimeLeft] = useState("");

  const [standings, setStandings] = useState([]);
  const navigate = useNavigate();

  // 🔸 helper to safely extract names
  const safeName = (entity) =>
    typeof entity === "object" ? entity?.name ?? "Unknown" : entity ?? "Unknown";

  // Latest Race
  useEffect(() => {
    const fetchLatestRace = async () => {
      try {
        const response = await fetch("https://stbleague.onrender.com/api/race/latest");
        if (!response.ok) throw new Error("Failed to fetch latest race.");
        const data = await response.json();

        setLatestRace({
          id: data.race.id,
          name: `${data.race.track.name}`,
          country: data.race.track.country,
          season: data.race.season,
          division: data.race.division,
          date: new Date().toLocaleDateString(),
          top3: data.results.slice(0, 3).map((r) => ({
            position: r.position,
            name: safeName(r.driver),
            team: safeName(r.team),
            points: r.points,
          })),
        });
      } catch (err) {
        console.error(err);
        setLatestError(err.message);
      } finally {
        setLoadingLatest(false);
      }
    };

    fetchLatestRace();
  }, []);

  // League + Season Stats
  useEffect(() => {
    const fetchLeagueStats = async () => {
      try {
        const response = await fetch("https://stbleague.onrender.com/api/race/stats/league");
        if (!response.ok) throw new Error("Failed to fetch league stats.");
        const data = await response.json();
        setLeagueStats({
          totalSeasons: data.totalSeasons,
          totalRaces: data.totalRaces,
          totalDrivers: data.totalDrivers,
          mostWins: {
            name: safeName(data.mostWins?.driver),
            count: data.mostWins?.wins ?? 0,
          },
          mostRaces: {
            name: safeName(data.mostRaces?.driver),
            count: data.mostRaces?.races ?? 0,
          },
        });

        const currentSeasonResponse = await fetch("https://stbleague.onrender.com/api/race/stats/season/30");
        if (!currentSeasonResponse.ok) throw new Error("Failed to fetch current season stats.");
        const currentSeasonData = await currentSeasonResponse.json();
        setSeasonStats({
          seasonTotalRaces: currentSeasonData.totalRaces,
          racesCompleted: currentSeasonData.racesCompleted,
          seasonMostPodium: currentSeasonData.mostPodium
            ? {
                name: safeName(currentSeasonData.mostPodium.driver),
                count: currentSeasonData.mostPodium.podium,
              }
            : { name: "N/A", count: 0 },
        });
      } catch (err) {
        console.error(err);
        setStatsError(err.message);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchLeagueStats();
  }, []);

  // Standings
  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const res = await fetch("https://stbleague.onrender.com/api/championship/current");
        if (!res.ok) throw new Error("Failed to fetch current championships.");
        const data = await res.json();
        setStandings(normalizeStandings(data));
        setCurrentTier(0);
      } catch (err) {
        console.error(err);
        setStandings([]);
      }
    };
    fetchStandings();
  }, []);

  // Next Race
  useEffect(() => {
    const fetchNextRace = async () => {
      try {
        const response = await fetch("https://stbleague.onrender.com/api/race/nextrace");
        if (!response.ok) throw new Error("Failed to fetch next race.");
        const data = await response.json();
        const raceDate = new Date(data.date);

        setNextRace({
          name: data.track.raceName,
          country: data.track.country,
          division: data.division,
          track: data.track.name,
          date: raceDate,
        });

        const timer = setInterval(() => {
          const now = new Date();
          const distance = raceDate - now;
          if (distance <= 0) {
            setTimeLeft("🏁 Race is live!");
            clearInterval(timer);
          } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((distance / (1000 * 60)) % 60);
            const seconds = Math.floor((distance / 1000) % 60);
            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
          }
        }, 1000);

        return () => clearInterval(timer);
      } catch (err) {
        console.error(err);
        setTimeLeft("❌ Could not load race timer");
      }
    };

    fetchNextRace();
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsLoggedIn(false);
    setRole("user");
    alert("Logged out");
    navigate("/login");
  };

  // Auto slide stats
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) setCurrentStatsView((prev) => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered]);

  // Auto cycle tiers
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered && standings.length > 0)
        setCurrentTier((prev) => (prev + 1) % standings.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isHovered, standings.length]);

  // Normalize standings for new API
  const normalizeStandings = (data) => {
    const raw = Array.isArray(data) ? data : data.top3 ?? [];
    const mapped = raw.map((item) => {
      const division = item.division ?? item.Division ?? item.tier ?? item.Tier;
      const list = item.top3 ?? item.Top3 ?? item.standings ?? [];
      return {
        tier: typeof division === "number" ? `Tier ${division}` : String(division),
        top3: list.map((d) => ({
          name: safeName(d.driver ?? d.Driver ?? d.name),
          team: safeName(d.team ?? d.Team),
          points: d.totalPoints ?? d.TotalPoints ?? d.points ?? 0,
        })),
      };
    });

    const byTier = new Map();
    for (const row of mapped) if (!byTier.has(row.tier)) byTier.set(row.tier, row);
    return Array.from(byTier.values());
  };

  return (
    <div className="home-container">
      <div className="main-content">
        <h1>Welcome to the STB Website</h1>
        <p>Hover or Click over a season to select a division.</p>

        <div className="info-blocks">
          {/* Next Race Block */}
          <div className="info-block">
            {nextRace ? (
              <>
                <h2 style={{ marginBottom: "0.2em" }}>🏁 Next Race</h2>
                <h3 style={{ marginTop: 0, color: "#FFD700" }}>
                  {nextRace.name} - Tier {nextRace.division}
                </h3>
                <ul>
                  <li>
                    <strong>Track:</strong> {nextRace.track} ({nextRace.country})
                  </li>
                  <li>
                    <strong>Starts In:</strong> {timeLeft}
                  </li>
                </ul>
              </>
            ) : (
              <p>Loading next race...</p>
            )}
          </div>

          {/* Latest Race Block */}
          <div className="info-block">
            {loadingLatest ? (
              <p>Loading latest race...</p>
            ) : latestError ? (
              <p style={{ color: "red" }}>Error: {latestError}</p>
            ) : latestRace ? (
              <>
                <h2 style={{ marginBottom: "0.2em" }}>🏁 Latest Race</h2>
                <h3 style={{ marginTop: 0, color: "#FFD700" }}>
                  {latestRace.name} - {latestRace.country} - Tier {latestRace.division}
                </h3>
                <ul>
                  {latestRace.top3.map((driver) => {
                    let medal =
                      driver.position === 1
                        ? "🥇"
                        : driver.position === 2
                        ? "🥈"
                        : "🥉";
                    return (
                      <li key={driver.position}>
                        {medal} {driver.name} - {driver.team} ({driver.points} pts)
                      </li>
                    );
                  })}
                </ul>
                <Link to={`/STB/race/${latestRace.id}`}>View Full Results</Link>
              </>
            ) : (
              <p>No latest race data available.</p>
            )}
          </div>

          {/* League Stats Block */}
          <div
            className="info-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <h2 className="stats-header">
              {currentStatsView === 0 ? "📊 League Stats" : "📊 Season Stats"}
            </h2>

            <div className="standings-slider-wrapper">
              <div
                className="standings-slider"
                style={{ transform: `translateX(-${currentStatsView * 100}%)` }}
              >
                <div className="standings-slide">
                  {loadingStats ? (
                    <p>📊 Loading League Stats...</p>
                  ) : statsError ? (
                    <p style={{ color: "red" }}>Error: {statsError}</p>
                  ) : leagueStats ? (
                    <ul>
                      <li>📅 Total Seasons: {leagueStats.totalSeasons}</li>
                      <li>🏁 Total Races: {leagueStats.totalRaces}</li>
                      <li>🧑‍🚀 Drivers: {leagueStats.totalDrivers}</li>
                      <li>
                        🏆 Most Wins: {leagueStats.mostWins.name} ({leagueStats.mostWins.count})
                      </li>
                      <li>
                        🚦 Most Races: {leagueStats.mostRaces.name} ({leagueStats.mostRaces.count})
                      </li>
                    </ul>
                  ) : (
                    <p>No league stats available.</p>
                  )}
                </div>

                <div className="standings-slide">
                  {loadingStats ? (
                    <p>📊 Loading League Stats...</p>
                  ) : statsError ? (
                    <p style={{ color: "red" }}>Error: {statsError}</p>
                  ) : seasonStats ? (
                    <ul>
                      <li>
                        🏁 Races Completed: {seasonStats.racesCompleted}/
                        {seasonStats.seasonTotalRaces}
                      </li>
                      <li>
                        🏆 Most Podium: {seasonStats.seasonMostPodium.name} (
                        {seasonStats.seasonMostPodium.count})
                      </li>
                    </ul>
                  ) : (
                    <p>No season stats available.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="carousel-controls">
              <button onClick={() => setCurrentStatsView((currentStatsView - 1 + 2) % 2)}>
                ❮
              </button>
              <span>{currentStatsView + 1} / 2</span>
              <button onClick={() => setCurrentStatsView((currentStatsView + 1) % 2)}>
                ❯
              </button>
            </div>
          </div>

          {/* Standings Block */}
          <div
            className="info-block"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <h2>
              🏆 Championship Standings:{" "}
              <span className="tier-slider-wrapper">
                <span
                  className="tier-slider"
                  style={{ transform: `translateX(-${currentTier * 100}%)` }}
                >
                  {standings.map((tier, idx) => (
                    <span className="tier-slide" key={idx}>
                      {tier.tier}
                    </span>
                  ))}
                </span>
              </span>
            </h2>

            <div className="standings-slider-wrapper">
              <div
                className="standings-slider"
                style={{ transform: `translateX(-${currentTier * 100}%)` }}
              >
                {standings.map((tier, idx) => (
                  <div className="standings-slide" key={idx}>
                    <ul>
                      {tier.top3.map((driver, index) => {
                        const medals = ["🥇", "🥈", "🥉"];
                        return (
                          <li key={index}>
                            {medals[index]} {driver.name} - {driver.team} ({driver.points} pts)
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="carousel-controls">
              <button
                onClick={() =>
                  setCurrentTier((currentTier - 1 + standings.length) % standings.length)
                }
              >
                ❮
              </button>
              <span>
                {currentTier + 1} / {standings.length}
              </span>
              <button
                onClick={() =>
                  setCurrentTier((currentTier + 1) % standings.length)
                }
              >
                ❯
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
