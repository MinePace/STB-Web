import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("token") !== null);
  const [role, setRole] = useState(localStorage.getItem("role") || "user");
  const [currentTier, setCurrentTier] = useState(0);
  const [currentStatsView, setCurrentStatsView] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const [latestRace, setLatestRace] = useState(null); // 👈 use state for API data
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [latestError, setLatestError] = useState(null);

  const [leagueStats, setLeagueStats] = useState(null);
  const [seasonStats, setSeasonStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [nextRace, setNextRace] = useState(null); // 👈 fetched from API
  const [timeLeft, setTimeLeft] = useState("");

  const [standings, setStandings] = useState([]);

  // Latest Race
  useEffect(() => {
    const fetchLatestRace = async () => {
      try {
        const response = await fetch("http://localhost:5110/api/race/latest");
        if (!response.ok) {
          throw new Error("Failed to fetch latest race.");
        }
        const data = await response.json();
        // Shape data for UI
        setLatestRace({
          id: data.race.id,
          name: `${data.race.track.name}`,
          country: data.race.track.country,
          season: data.race.season,
          division: data.race.division,
          date: new Date().toLocaleDateString(), // You could add date in API later
          top3: data.results.slice(0, 3).map((r, idx) => ({
            position: r.position,
            name: r.driver,
            team: r.team,
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

  useEffect(() => {
    const fetchLeagueStats = async () => {
      try {
        const response = await fetch("http://localhost:5110/api/race/stats/league");
        if (!response.ok) {
          throw new Error("Failed to fetch league stats.");
        }
        const data = await response.json();
        setLeagueStats({
          totalSeasons: data.totalSeasons,
          totalRaces: data.totalRaces,
          totalDrivers: data.totalDrivers,
          mostWins: {
            name: data.mostWins.driver,
            count: data.mostWins.wins,
          },
          mostRaces: {
            name: data.mostRaces.driver,
            count: data.mostRaces.races,
          },
        });

        const currentSeasonResponse = await fetch("http://localhost:5110/api/race/stats/season/29");
        if (!currentSeasonResponse.ok) {
          throw new Error("Failed to fetch current season stats.");
        }
        const currentSeasonData = await currentSeasonResponse.json();
        setSeasonStats({
          seasonTotalRaces: currentSeasonData.totalRaces,
          racesCompleted: currentSeasonData.racesCompleted,
          seasonMostPodium: currentSeasonData.mostPodium
            ? {
                name: currentSeasonData.mostPodium.driver,
                count: currentSeasonData.mostPodium.podium,
              }
            : {
                name: "N/A",
                count: 0,
              },
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

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const res = await fetch("http://localhost:5110/api/championship/current");
        if (!res.ok) throw new Error("Failed to fetch current championships.");
        const data = await res.json();
        setStandings(normalizeStandings(data));
        setCurrentTier(0); // reset to first tier after load
      } catch (err) {
        console.error(err);
        setStandings([]); // keep it safe
      }
    };
    fetchStandings();
  }, []);

  useEffect(() => {
    const fetchNextRace = async () => {
      try {
        const response = await fetch("http://localhost:5110/api/race/nextrace");
        if (!response.ok) throw new Error("Failed to fetch next race.");
        const data = await response.json();

        // Convert API date to JS Date
        const raceDate = new Date(data.date);

        setNextRace({
          name: data.track.raceName,
          country: data.track.country,
          division: data.division,
          track: data.track.name,
          date: raceDate,
        });

        // Start countdown timer
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setIsLoggedIn(false);
    setRole("user");
    alert("Logged out");
    navigate("/login");
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentStatsView((prev) => (prev + 1) % 2);
      }
    }, 5000); // Change every 5s

    return () => clearInterval(interval);
  }, [isHovered]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setCurrentTier((prev) => (prev + 1) % standings.length);
      }
    }, 5000); // Change tier every 5s

    return () => clearInterval(interval);
  }, [isHovered, standings.length]);

  const normalizeStandings = (data) => {
    const raw = Array.isArray(data) ? data : (data.top3 ?? []); // supports { top3: [...] } or [...]
    // Map to a consistent shape
    const mapped = raw.map(item => {
      const division = item.division ?? item.Division ?? item.tier ?? item.Tier;
      const list = item.top3 ?? item.Top3 ?? item.standings ?? [];
      return {
        tier: typeof division === "number" ? `Tier ${division}` : String(division),
        top3: list.map(d => ({
          name: d.driver ?? d.Driver ?? d.name,
          team: d.team ?? d.Team, // may be undefined if your API doesn't include it
          points: d.totalPoints ?? d.TotalPoints ?? d.points ?? 0,
        })),
      };
    });

    // De-dupe by tier string
    const byTier = new Map();
    for (const row of mapped) {
      if (!byTier.has(row.tier)) byTier.set(row.tier, row);
    }
    return Array.from(byTier.values());
  };

  return (
    <div className="home-container">
      <div className="main-content">
        <h1>Welcome to the STB Website</h1>
        <p>Hover over a season to select a division.</p>

        <div className="info-blocks">
          {/* Next Race Block */}
          <div className="info-block">
            {nextRace ? (
              <>
                <h2 style={{ marginBottom: "0.2em" }}>🏁 Next Race</h2>
                <h3 style={{ marginTop: "0", color: "#FFD700" }}>{nextRace.name} - Tier {nextRace.division}</h3>
                <ul>
                  <li><strong>Track:</strong> {nextRace.track} ({nextRace.country})</li>
                  <li><strong>Starts In:</strong> {timeLeft}</li>
                </ul>
              </>
            ) : (
              <p>Loading next race...</p> // 👈 fallback while waiting for API
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
                <h3 style={{ marginTop: "0", color: "#FFD700" }}>{latestRace.name} - {latestRace.country} - Tier {latestRace.division}</h3>
                <ul>
                  {latestRace.top3.map(driver => {
                    let medal;
                    if (driver.position === 1) medal = "🥇";
                    else if (driver.position === 2) medal = "🥈";
                    else if (driver.position === 3) medal = "🥉";

                    return (
                      <li key={driver.position}>
                        {medal} {driver.name} - {driver.team} ({driver.points} pts)
                      </li>
                    );
                  })}
                </ul>
                <Link to={`/STB/race/${latestRace.id}`}>
                  View Full Results
                </Link>
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

            {/* Sliding Stats */}
            <div className="standings-slider-wrapper">
              <div
                className="standings-slider"
                style={{ transform: `translateX(-${currentStatsView * 100}%)` }}
              >
                {/* League Stats */}
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

                {/* Season Stats */}
                <div className="standings-slide">
                  {loadingStats ? (
                    <p>📊 Loading League Stats...</p>
                  ) : statsError ? (
                    <p style={{ color: "red" }}>Error: {statsError}</p>
                  ) : leagueStats ? (
                  <ul>
                    <li>🏁 Races Completed: {seasonStats.racesCompleted}/{seasonStats.seasonTotalRaces}</li>
                    <li>🏆 Points Podium: {seasonStats.seasonMostPodium.name} ({seasonStats.seasonMostPodium.count})</li>
                  </ul>
                  ) : (
                    <p>No league stats available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="carousel-controls">
              <button
                onClick={() =>
                  setCurrentStatsView((currentStatsView - 1 + 2) % 2)
                }
              >
                ❮
              </button>
              <span>{currentStatsView + 1} / 2</span>
              <button
                onClick={() =>
                  setCurrentStatsView((currentStatsView + 1) % 2)
                }
              >
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

            {/* Sliding standings */}
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
              <span>{currentTier + 1} / {standings.length}</span>
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
