import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./DriverPage.css";

function DriverPage() {
  const { driverName } = useParams();
  const [driverStats, setDriverStats] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchDriverStats = async () => {
      try {
        const res = await fetch(`http://localhost:5110/api/driver/stats/${driverName}`);
        const data = await res.json();
        setDriverStats(data);
        console.log(data);
      } catch (err) {
        console.error("Error fetching driver stats:", err);
      }
    };

    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      const name = localStorage.getItem("name");
      if (!token) return; // If no token, user is not logged in

      try {
        const res = await fetch(`http://localhost:5110/api/user/${name}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.result);
        } else {
          console.error("Failed to fetch user data");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    fetchDriverStats();
    fetchUser();
  }, [driverName]);

  const claimDriver = async () => {
    if (!user || !driverStats?.user.id) {
      console.error("User or Driver ID is missing");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return console.error("No authentication token found");

    try {;
      const response = await fetch(`http://localhost:5110/api/driver/claim/${driverStats.user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: user.username }),
      });

      if (response.ok) {
        const updatedDriver = await response.json();
        setDriverStats(updatedDriver);
      } else {
        alert("Failed to claim driver");
      }
    } catch (err) {
      console.error("Error claiming driver:", err);
    }
  };

  if (!driverStats) return <p>Loading...</p>;

  return (
    <div>
      <h1>Stats for {driverStats.driver}</h1>
      <p><strong>Total Points:</strong> {driverStats.totalPoints}</p>
      <p><strong>Poles:</strong> {driverStats.poles}</p>
      <p><strong>Wins:</strong> {driverStats.wins}</p>
      <p><strong>Podiums:</strong> {driverStats.podiums}</p>
      <p><strong>Average Finish Position:</strong> {driverStats.averagePosition.toFixed(2)}</p>
      <p><strong>Number of Races:</strong> {driverStats.races}</p>

      {driverStats.driverOBJ.user ? (
      <>
        <p><strong>Claimed by:</strong> {driverStats.driverOBJ.user.Name}</p>
        {console.log("Driver is already claimed.")}
      </>
    ) : (
      user && (
        <>
          {console.log("Button should be visible")}
          <button onClick={claimDriver} className="claim-button">
            Claim this Driver
          </button>
        </>
      )
    )}
    </div>
  );
}

export default DriverPage;
