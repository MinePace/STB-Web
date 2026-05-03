import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";
import bgImage from "../../assets/STBWeb.png";
import { useTranslation } from "react-i18next";

function HomePage() {
  const [latestRace, setLatestRace] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [latestError, setLatestError] = useState(null);

  const [leagueStats, setLeagueStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [standings, setStandings] = useState([]);
  const [currentTier, setCurrentTier] = useState(0);

  const { t } = useTranslation();

  const safeName = (entity) =>
    typeof entity === "object" ? entity?.Name ?? "Unknown" : entity ?? "Unknown";

  useEffect(() => {
    const fetchLatestRace = async () => {
      try {
        const res = await fetch("https://stbleaguedata.vercel.app/api/race/latest");
        if (!res.ok) throw new Error("Latest race failed");
        const data = await res.json();

        setLatestRace({
          Id: data.Race.Id,
          Name: data.Race.Track.Name,
          Country: data.Race.Track.Country,
          Division: data.Race.Division,
          Top3: data.Results.slice(0, 3).map((r) => ({
            Position: r.Position,
            Name: safeName(r.Driver),
            Team: safeName(r.Team),
            Points: r.Points,
          })),
        });
      } catch (err) {
        setLatestError(err.message);
      } finally {
        setLoadingLatest(false);
      }
    };

    fetchLatestRace();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("https://stbleaguedata.vercel.app/api/stats/league");
        const data = await res.json();

        setLeagueStats({
          totalSeasons: data.TotalSeasons,
          totalRaces: data.TotalRaces,
          totalDrivers: data.TotalDrivers,
          mostWins: data.MostWins,
          mostRaces: data.MostRaces,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const res = await fetch("https://stbleaguedata.vercel.app/api/championship/current");
        const data = await res.json();

        const mapped = data.map((tier) => ({
          tier: `Tier ${tier.Division}`,
          top3: tier.Top3.map((d) => ({
            name: safeName(d.Name),
            team: safeName(d.Team),
            points: d.TotalPoints,
          })),
        }));

        setStandings(mapped);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStandings();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (standings.length > 0)
        setCurrentTier((prev) => (prev + 1) % standings.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [standings]);

  return (
    <div 
      className="home-container"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="hero-overlay" />

      <div className="main-content">
        <h1 className="hero-title">STB Racing League</h1>
        <p className="hero-sub">{t("home.welcome")}</p>

        <div className="info-grid">
          <div className="info-card">
            <h2>🏁 {t("home.latest")}</h2>

            {loadingLatest ? (
              <p>{t("misc.loading")}</p>
            ) : latestRace ? (
              <>
                <h3 className="race-title">
                  {latestRace.Name} - {t(`countries.${latestRace.Country}`)} - Tier {latestRace.Division}
                </h3>

                <ul>
                  {latestRace.Top3.map((d, i) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <li key={i}>
                        {medals[i]} {d.Name} - {d.Team} ({d.Points})
                      </li>
                    );
                  })}
                </ul>

                <Link to={`/STB/race/${latestRace.Id}`} className="card-link">
                  {t("home.viewDetails")}
                </Link>
              </>
            ) : (
              <p>No race data</p>
            )}
          </div>

          <div className="info-card">
            <h2>🏆 {t("home.standings")}</h2>

            {standings.length > 0 && (
              <>
                <h3 className="tier-label">{standings[currentTier].tier}</h3>

                <ul>
                  {standings[currentTier].top3.map((d, i) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    return (
                      <li key={i}>
                        {medals[i]} {d.name} - {d.team} ({d.points})
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="info-card">
            <h2>📊 {t("home.stats.title")}</h2>

            {loadingStats ? (
              <p>{t("misc.loading")}</p>
            ) : leagueStats ? (
              <ul>
                <li>📅 {t("home.stats.seasons")}: {leagueStats.totalSeasons}</li>
                <li>🏁 {t("home.stats.races")}: {leagueStats.totalRaces}</li>
                <li>🧑‍🚀 {t("home.stats.drivers")}: {leagueStats.totalDrivers}</li>
                <li>🏆 {t("home.stats.mostWins")}: {leagueStats.mostWins.Driver.Name} ({leagueStats.mostWins.Wins} wins)</li>
                <li>🏁 {t("home.stats.mostRaces")}: {leagueStats.mostRaces.Driver.Name} ({leagueStats.mostRaces.Races} races)</li>
              </ul>
            ) : (
              <p>No stats</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;