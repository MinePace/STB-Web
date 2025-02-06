import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image"; // Import html-to-image
import "./ChampionshipPage.css";

function ChampionshipPage() {
  const { season } = useParams();
  const { division } = useParams();
  const [races, setRaces] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);

  useEffect(() => {
    // Stap 1: Haal alle races op
    fetch(`http://localhost:5110/api/race/championship-races/${season}/${division}`)
      .then((res) => res.json())
      .then((raceData) => {
        setRaces(raceData);
        
        // Stap 2: Haal race results op nadat races geladen zijn
        fetch(`http://localhost:5110/api/race/championship/${season}/${division}`)
          .then((res) => res.json())
          .then((resultData) => {
            setRaceResults(resultData);
            transformData(raceData, resultData);
          })
          .catch((err) => console.error("Error fetching race results:", err));
      })
      .catch((err) => console.error("Error fetching races:", err));
  }, [season, division]);

  const transformData = (races, raceResults) => {
    console.log("Races:", races); // Controleer races
    console.log("RaceResults:", raceResults); // Controleer race results
    
    const drivers = {};
    const raceNumbers = races.map((race) =>
      race.sprint === "Yes" ? `${race.round} S` : `${race.round}`
    );
    console.log("RaceNumbers:", raceNumbers); // Controleer race labels
    
    const racePositions = {};
    
    raceResults.forEach((result) => {
      if (!drivers[result.driver]) {
        drivers[result.driver] = { totalPoints: 0 };
      }
  
      // Gebruik de `race`-eigenschap van `result` om het label te genereren
      const race = result.race;
      const raceLabel = race.sprint === "Yes" ? `${race.round} S` : `${race.round}`;
      console.log(`Driver: ${result.driver}, RaceLabel: ${raceLabel}, Points: ${result.points}`);
      
      drivers[result.driver][raceLabel] = result.points || 0;
      drivers[result.driver].totalPoints += result.points || 0;
      
      if (!racePositions[raceLabel]) {
        racePositions[raceLabel] = {};
      }
      racePositions[raceLabel][result.driver] = result.position;
    });
    
    const sortedDrivers = Object.entries(drivers)
      .map(([driver, races]) => ({ driver, ...races }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    
    console.log("SortedDrivers:", sortedDrivers); // Controleer de uiteindelijke output
    
    setSortedDrivers({ drivers: sortedDrivers, raceNumbers, racePositions });
  };

  const handleExportToPng = () => {
    const tableContainer = document.querySelector(".table-container");
    if (tableContainer) {
      toPng(tableContainer, {
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
      })
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `championship-season-${season}-tier-${division}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((error) => {
          console.error("Error generating PNG:", error);
        });
    }
  };

  return (
    <div>
      <button onClick={handleExportToPng} className="export-button">
        Export to PNG
      </button>
      <div className="table-container">
        <table className="header-table" border="1">
          <thead>
            <tr>
              <th colSpan={(sortedDrivers.raceNumbers?.length || 0) + 2}>
                Championship - Season {season} - Tier {division}
              </th>
            </tr>
            <tr>
              <th>Driver</th>
              {sortedDrivers.raceNumbers?.map((race) => (
                <th key={race}>{race}</th>
              ))}
              <th>Total Points</th>
            </tr>
          </thead>
        </table>

        <div className="scrollable-table">
          <table className="scrollable" border="1">
            <tbody>
              {sortedDrivers.drivers?.map(({ driver, totalPoints, ...races }) => (
                <tr key={driver} className="table-row">
                  <td>
                    <Link
                      to={`/STB/Driver/${encodeURIComponent(driver)}`}
                      className="driver-link"
                    >
                      {driver}
                    </Link>
                  </td>
                  {sortedDrivers.raceNumbers?.map((race) => {
                    const isWinner = sortedDrivers.racePositions?.[race]?.[driver] === 1;
                    const isSecond = sortedDrivers.racePositions?.[race]?.[driver] === 2;
                    const isThird = sortedDrivers.racePositions?.[race]?.[driver] === 3;
                    return (
                      <td
                        key={race}
                        style={{
                          backgroundColor: isWinner
                            ? "#FFD700"
                            : isSecond
                            ? "#D3D3D3"
                            : isThird
                            ? "#CD7F32"
                            : "transparent",
                        }}
                      >
                        <Link
                          to={`/STB/Race/${season}/${race.replace(/\D/g, "")}/${division}/${
                            race.includes("S") ? "Sprint" : "Main"
                          }`}
                          className="driver-link"
                        >
                          {races[race] ?? "-"}
                        </Link>
                      </td>
                    );
                  })}
                  <td>
                    <strong>{totalPoints}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ChampionshipPage;
