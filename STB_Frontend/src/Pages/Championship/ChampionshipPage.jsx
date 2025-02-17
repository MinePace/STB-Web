import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import "./ChampionshipPage.css";

function ChampionshipPage() {
  const { season } = useParams();
  const { division } = useParams();
  const [races, setRaces] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    fetch(`http://localhost:5110/api/race/championship-races/${season}/${division}`)
      .then((res) => res.json())
      .then((raceData) => {
        if (!raceData || raceData.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRaces(raceData);
        console.log(raceData)

        fetch(`http://localhost:5110/api/race/championship/${season}/${division}`)
          .then((res) => res.json())
          .then((resultData) => {
            if (!Array.isArray(resultData)) {
              setRaceResults([]);
              setNotFound(true);
              setLoading(false);
              return;
            }

            setRaceResults(resultData);
            transformData(raceData, resultData);
            setLoading(false);
          })
          .catch(() => {
            setNotFound(true);
            setLoading(false);
          });
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [season, division]);

  const transformData = (races, raceResults) => {
    const drivers = {};
    const raceNumbers = races.map((race) =>
      race.sprint === "Yes" ? `${race.round} S` : `${race.round}`
    );

    const racePositions = {};
    const raceSums = {};

    raceResults.forEach((result) => {
      if (!drivers[result.driver]) {
        drivers[result.driver] = { totalPoints: 0 };
      }

      const race = result.race;
      const raceLabel = race.sprint === "Yes" ? `${race.round} S` : `${race.round}`;
      drivers[result.driver][raceLabel] = result.points || 0;
      drivers[result.driver].totalPoints += result.points || 0;
      
      if (!raceSums[raceLabel]) {
        raceSums[raceLabel] = 0;
      }
      raceSums[raceLabel] += result.points || 0;

      if (!racePositions[raceLabel]) {
        racePositions[raceLabel] = {};
      }
      racePositions[raceLabel][result.driver] = result.position;
    });

    const sortedDrivers = Object.entries(drivers)
      .map(([driver, races]) => ({ driver, ...races }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

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

  if (loading) {
    return <div className="loading-bar">Loading Championship Data...</div>;
  }

  if (notFound) {
    return <div className="not-found">No races found for this championship.</div>;
  }

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
                    <Link to={`/STB/Driver/${encodeURIComponent(driver)}`} className="driver-link">
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
                          backgroundColor: isWinner ?"rgb(255, 215, 0)"
                            : isSecond ?"rgb(211, 211, 211)"
                            : isThird ?"rgb(165, 107, 49)"
                            : "transparent",
                        }}
                      >
                        <Link to={`/STB/Race/${season}/${race.replace(/\D/g, "")}/${division}/${race.includes("S") ? "Sprint" : "Main"}`} className="driver-link">
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
