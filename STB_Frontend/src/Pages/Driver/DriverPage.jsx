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

  return (
    <div className="driver-card">
      <div className="driver-header">
        <div className="driver-avatar">{driverStats.driver.charAt(0)}</div>
        <h1>{driverStats.driver}</h1>
        <p className="claimed-by">
          {driverStats.driverOBJ?.user?.username
            ? `Claimed by: ${driverStats.driverOBJ.user.username}`
            : "🚨 Unclaimed"}
        </p>
      </div>

      <div className="driver-stats-grid">
        <div className="stat-item">
          <span className="stat-value">{driverStats.totalPoints}</span>
          <span className="stat-label">Total Points</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{driverStats.wins}</span>
          <span className="stat-label">Wins 🏁</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{driverStats.podiums}</span>
          <span className="stat-label">Podiums 🏆</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{driverStats.poles}</span>
          <span className="stat-label">Poles 🎯</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{driverStats.averagePosition?.toFixed(2)}</span>
          <span className="stat-label">Avg Finish</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{driverStats.races}</span>
          <span className="stat-label">Races</span>
        </div>
      </div>

      {!driverStats.driverOBJ?.user?.username && user && !user.driverClaimed && (
        <button onClick={claimDriver} className="claim-button">
          🚀 Claim this Driver
        </button>
      )}
    </div>
  );
}

export default DriverPage;
