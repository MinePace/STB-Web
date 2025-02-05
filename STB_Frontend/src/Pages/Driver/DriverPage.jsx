import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

function DriverPage() {
  const { driverName } = useParams();
  const [driverStats, setDriverStats] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5110/api/race/driver/stats/${driverName}`)
      .then((res) => res.json())
      .then((data) => setDriverStats(data))
      .catch((err) => console.error("Error fetching driver stats:", err));
  }, [driverName]);

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
    </div>
  );
}

export default DriverPage;
