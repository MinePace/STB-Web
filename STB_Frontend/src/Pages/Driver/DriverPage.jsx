import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./DriverPage.css";

function DriverPage() {
  const { driverName } = useParams();
  const [driverStats, setDriverStats] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** ✅ Fetch Driver Stats */
  useEffect(() => {
    const fetchDriverStats = async () => {
      try {
        const res = await fetch(`http://localhost:5110/api/driver/stats/${driverName}`);
        const data = await res.json();
        console.log("Fetched Driver Stats:", data);
        setDriverStats(data);
      } catch (err) {
        console.error("Error fetching driver stats:", err);
      }
    };

    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("name");

      if (!token || !name) {
        console.log("No user logged in.");
        return;
      }

      try {
        const res = await fetch(`http://localhost:5110/api/user/${name}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          console.log("Fetched User:", data);
          setUser(data);
        } else {
          console.error("Failed to fetch user data");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchDriverStats();
    fetchUser();
    setLoading(false);
  }, [driverName]);

  /** ✅ Claim Driver Function */
  const claimDriver = async () => {
    if (!user) {
      console.error("User not logged in.");
      return;
    }

    if (driverStats?.driverOBJ?.user) {
      console.error("Driver is already claimed.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No authentication token found");
      return;
    }

    try {
      console.log(`Attempting to claim driver: ${driverStats.driver}`);
      console.log("User:", user);
      const response = await fetch(
        `http://localhost:5110/api/driver/claim/${driverStats.driver}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user.username }),
        }
      );

      if (response.ok) {
        const updatedDriver = await response.json();
        console.log("Successfully claimed driver:", updatedDriver);
        setDriverStats(updatedDriver);
      } else {
        console.error("Failed to claim driver");
        alert("Failed to claim driver");
      }
    } catch (err) {
      console.error("Error claiming driver:", err);
    }
  };

  /** ✅ Show Loading Screen */
  if (loading || !driverStats) return <p>Loading...</p>;

  return (
    <div className="driver-stats-container">
      <h1>Stats for {driverStats.driver}</h1>
      <p><strong>Total Points:</strong> {driverStats.totalPoints}</p>
      <p><strong>Poles:</strong> {driverStats.poles}</p>
      <p><strong>Wins:</strong> {driverStats.wins}</p>
      <p><strong>Podiums:</strong> {driverStats.podiums}</p>
      <p><strong>Average Finish Position:</strong> {driverStats.averagePosition?.toFixed(2)}</p>
      <p><strong>Number of Races:</strong> {driverStats.races}</p>

      {!driverStats.driverOBJ?.userId && user && !user.driverClaimed ? (
        <button onClick={claimDriver} className="claim-button">
        Claim this Driver
        </button>
      ) : driverStats.driverOBJ?.userId ? (
        <p>Claimed by: <strong>{driverStats.driverOBJ?.user?.username}</strong></p>
      ) : <p>Driver not yet claimed</p>}
    </div>
  );
}

export default DriverPage;
