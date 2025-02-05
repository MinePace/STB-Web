import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image"; // Import html-to-image
import "./ChampionshipPage.css";

function ChampionshipPage() {
  const { season } = useParams();
  const { division } = useParams();
  const [data, setData] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5110/api/race/championship/${season}/${division}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        transformData(data);
      })
      .catch((err) => console.error("Error fetching data:", err));
  }, [season]);

  const transformData = (data) => {
    const drivers = {};
    const raceNumbers = new Set();
    const racePositions = {};

    data.forEach((row) => {
      if (!drivers[row.driver]) {
        drivers[row.driver] = { totalPoints: 0 };
      }

      const raceLabel = row.sprint === "1" ? `${row.round} S` : `${row.round}`;

      drivers[row.driver][raceLabel] = row.points;
      drivers[row.driver].totalPoints += row.points;
      raceNumbers.add(raceLabel);

      if (!racePositions[raceLabel]) {
        racePositions[raceLabel] = {};
      }
      racePositions[raceLabel][row.driver] = row.position;
    });

    const sortedRaceNumbers = [...raceNumbers].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      if (numA === numB) return a.includes("S") ? 1 : -1;
      return numA - numB;
    });

    const sortedDrivers = Object.entries(drivers)
      .map(([driver, races]) => ({ driver, ...races }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    setSortedDrivers({ drivers: sortedDrivers, raceNumbers: sortedRaceNumbers, racePositions });
  };

  const handleExportToPng = () => {
    const tableContainer = document.querySelector(".table-container"); // Selecteer het element
    if (tableContainer) {
      toPng(tableContainer, {
        backgroundColor: window.getComputedStyle(document.body).backgroundColor, // Haal de huidige achtergrondkleur op
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
        {/* Header tabel */}
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

        {/* Scrollbare body tabel */}
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
                    const isWinner =
                      sortedDrivers.racePositions?.[race]?.[driver] === 1;
                    const isSecond =
                      sortedDrivers.racePositions?.[race]?.[driver] === 2;
                    const isThird =
                      sortedDrivers.racePositions?.[race]?.[driver] === 3;
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
