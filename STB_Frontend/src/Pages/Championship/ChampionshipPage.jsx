import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ChampionshipPage.css";

function ChampionshipPage() {
  const { season, division } = useParams();
  const [races, setRaces] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    fetch(`http://localhost:5110/api/championship/races/${season}/${division}`)
      .then((res) => res.json())
      .then((raceData) => {
        if (!raceData || raceData.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRaces(raceData);

        fetch(`http://localhost:5110/api/championship/${season}/${division}`)
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

    raceResults.forEach((result) => {
      if (!drivers[result.driver]) {
        drivers[result.driver] = { totalPoints: 0 };
      }

      const raceLabel = result.race.sprint === "Yes" ? `${result.race.round} S` : `${result.race.round}`;
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

    setSortedDrivers({ drivers: sortedDrivers, raceNumbers, racePositions });
  };

  if (loading) {
    return <div className="loading-bar">Loading Championship Data...</div>;
  }

  if (notFound) {
    return <div className="not-found">No races found for this championship.</div>;
  }

  return (
    <div className="table-container">
      {/* Fixed Header Table */}
      <table className="header-table" border="1">
        <thead>
          <tr>
            <th colSpan={(sortedDrivers.raceNumbers?.length || 0) + 2}>
              Championship - Season {season} - Tier {division}
            </th>
          </tr>
          <tr>
            <th>Driver</th>
            {races.map((race) => (
              <th key={race.id}>
                <img
                  src={`/flags/${race.track.country}.png`}
                  alt={race.country}
                  title={race.country}
                  className="race-flag"
                />
              </th>
            ))}
            <th>Points</th>
          </tr>
        </thead>
      </table>
  
      {/* Scrollable Table */}
      <div className="scrollable-table">
        <table className="scrollable" border="1">
          <tbody>
            {sortedDrivers.drivers?.map(({ driver, totalPoints, ...driversraces }) => (
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
                  let RaceId = null;
  
                  for (let i = 0; i < races.length; i++) {
                    if (race.includes("S")) {
                      if (races[i].round == race.replace(/\D/g, "") && races[i].sprint == "Yes") {
                        RaceId = races[i].id;
                        break;
                      }
                    } else {
                      if (races[i].round == race.replace(/\D/g, "") && races[i].sprint == "No") {
                        RaceId = races[i].id;
                        break;
                      }
                    }
                  }
                  return (
                    <td
                      key={race}
                      style={{
                        backgroundColor: isWinner ? "rgb(255, 215, 0)"
                          : isSecond ? "rgb(211, 211, 211)"
                          : isThird ? "rgb(165, 107, 49)"
                          : "transparent",
                      }}
                    >
                      <Link to={`/STB/Race/${RaceId}`} className="driver-link">
                        {driversraces[race] ?? "-"}
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
  );
  
}

export default ChampionshipPage;
