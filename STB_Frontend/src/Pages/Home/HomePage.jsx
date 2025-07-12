import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem("token") !== null);
  const [role, setRole] = useState(localStorage.getItem("role") || "user");
  const [currentTier, setCurrentTier] = useState(0);
  const [currentStatsView, setCurrentStatsView] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  // Mock Data
  const latestRace = {
    id: 89,
    name: "Silverstone GP",
    season: 28,
    date: "July 2, 2025",
    top3: [
      { position: 1, name: "John Doe", team: "Red Bull", points: 25 },
      { position: 2, name: "Jane Smith", team: "Ferrari", points: 18 },
      { position: 3, name: "Max Johnson", team: "Mercedes", points: 15 },
    ],
  };

  const stats = {
    totalRaces: 235,
    totalDrivers: 87,
    mostWins: { name: "John Doe", count: 45 },
    mostPodiums: { name: "Jane Doe", count: 103 },
  };

  const nextRace = {
    name: "Monza GP",
    date: new Date("2025-07-15T14:00:00"), // Example date
  };

  const standings = [
    {
      tier: "Tier 1",
      top3: [
        { name: "John Doe", team: "Red Bull", points: 220 },
        { name: "Jane Smith", team: "Ferrari", points: 198 },
        { name: "Max Johnson", team: "Mercedes", points: 185 },
      ],
    },
    {
      tier: "Tier 2",
      top3: [
        { name: "Amy Lee", team: "McLaren", points: 200 },
        { name: "Tim Brown", team: "Alpine", points: 190 },
        { name: "Jack Black", team: "AlphaTauri", points: 175 },
      ],
    },
    {
      tier: "Tier 3",
      top3: [
        { name: "Sam Fox", team: "Haas", points: 180 },
        { name: "Lisa Ray", team: "Williams", points: 170 },
        { name: "Emma Stone", team: "Aston Martin", points: 160 },
      ],
    },
  ];

  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const distance = nextRace.date - now;

      if (distance <= 0) {
        setTimeLeft("Race is live!");
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
  }, [nextRace.date]);

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

  return (
    <div className="home-container">
      <div className="main-content">
        <h1>Welcome to the STB Website</h1>
        <p>Hover over a season to select a division.</p>

        <div className="info-blocks">
          {/* Next Race Block */}
          <div className="info-block">
            <h2>⏱ Next Race: {nextRace.name}</h2>
            <p>{nextRace.date.toLocaleString()}</p>
            <p><strong>Starts In:</strong> {timeLeft}</p>
          </div>

          {/* Latest Race Block */}
          <div className="info-block">
            <h2>🏁 Latest Race: {latestRace.name}</h2>
            <p>{latestRace.date} - Season {latestRace.season}</p>
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
                  <ul>
                    <li>📅 Total Seasons: 28</li>
                    <li>🏁 Total Races: 235</li>
                    <li>🧑‍🚀 Drivers: 87</li>
                    <li>🏆 Most Wins: John Doe (102)</li>
                    <li>🔥 Longest Streak: Jane Smith (8)</li>
                  </ul>
                </div>

                {/* Season Stats */}
                <div className="standings-slide">
                  <ul>
                    <li>📅 Current Season: 29</li>
                    <li>🏁 Races Completed: 7/15</li>
                    <li>🏎️ Avg Lap: 1:31.456</li>
                    <li>🥇 Wins Leader: Jane Smith (4)</li>
                    <li>🏆 Points Leader: John Doe (192 pts)</li>
                  </ul>
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
