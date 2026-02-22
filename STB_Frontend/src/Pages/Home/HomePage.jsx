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

  const [timeLeft, setTimeLeft] = useState("");

  const [standings, setStandings] = useState([]);
  const navigate = useNavigate();

  // 🔸 helper to safely extract names
  const safeName = (entity) =>
    typeof entity === "object" ? entity?.Name ?? "Unknown" : entity ?? "Unknown";

  // Latest Race
  useEffect(() => {
    const fetchLatestRace = async () => {
      try {
        const response = await fetch("https://stbleaguedata.vercel.app/api/race/latest");
        if (!response.ok) throw new Error("Failed to fetch latest race.");
        const data = await response.json();

        setLatestRace({
          Id: data.Race.Id,
          Name: `${data.Race.Track.Name}`,
          Country: data.Race.Track.Country,
          Season: data.Race.Season,
          Division: data.Race.Division,
          Date: new Date().toLocaleDateString(),
          Top3: data.Results.slice(0, 3).map((r) => ({
            Position: r.Position,
            Name: safeName(r.Driver),
            Team: safeName(r.Team),
            Points: r.Points,
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
        const response = await fetch("https://stbleaguedata.vercel.app/api/stats/league");
        if (!response.ok) throw new Error("Failed to fetch league stats.");
        const data = await response.json();
        setLeagueStats({
          totalSeasons: data.TotalSeasons,
          totalRaces: data.TotalRaces,
          totalDrivers: data.TotalDrivers,
          mostWins: {
            name: safeName(data.MostWins?.Driver.Name),
            count: data.MostWins?.Wins ?? 0,
          },
          mostRaces: {
            name: safeName(data.MostRaces?.Driver.Name),
            count: data.MostRaces?.Races ?? 0,
          },
        });

        const currentSeasonResponse = await fetch("https://stbleaguedata.vercel.app/api/stats/season/30");
        if (!currentSeasonResponse.ok) throw new Error("Failed to fetch current season stats.");
        const currentSeasonData = await currentSeasonResponse.json();
        setSeasonStats({
          seasonTotalRaces: currentSeasonData.TotalRaces,
          racesCompleted: currentSeasonData.RacesCompleted,
          seasonMostPodium: currentSeasonData.MostPodium
            ? {
                name: safeName(currentSeasonData.MostPodium.Driver),
                count: currentSeasonData.MostPodium.Podium ?? 0,
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
        const res = await fetch("https://stbleaguedata.vercel.app/api/championship/current");
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
        top3: list.map((d) => (
          {
          name: safeName(d.driver ?? d.Driver ?? d.Name),
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
                  {latestRace.Name} - {latestRace.Country} - Tier {latestRace.Division}
                </h3>
                <ul>
                  {latestRace.Top3.map((Driver) => {
                    let medal =
                      Driver.Position === 1
                        ? "🥇"
                        : Driver.Position === 2
                        ? "🥈"
                        : "🥉";
                    return (
                      <li key={Driver.Position}>
                        {medal} {Driver.Name} - {Driver.Team} ({Driver.Points} pts)
                      </li>
                    );
                  })}
                </ul>
                <Link to={`/STB/race/${latestRace.Id}`}>View Full Results</Link>
              </>
            ) : (
              <p>No latest race data available.</p>
            )}
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
        </div>
      </div>
    </div>
  );
}

export default HomePage;
