import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas"; // Import html2canvas
import "./ChampionshipPage.css";

function ChampionshipPage() {
  const { season, division } = useParams();
  const [races, setRaces] = useState([]);
  const [raceResults, setRaceResults] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const tableRef = useRef(null);

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
            setRaceResults(Array.isArray(resultData) ? resultData : []);

            if (Array.isArray(resultData) && resultData.length > 0) {
              transformData(raceData, resultData);
            } else {
              setSortedDrivers({
                drivers: [],
                raceNumbers: raceData.map((race) => `${race.round}`),
                racePositions: {},
              });
            }

            setLoading(false);
          })
          .catch(() => {
            setRaceResults([]);
            setSortedDrivers({
              drivers: [],
              raceNumbers: raceData.map((race) => `${race.round}`),
              racePositions: {},
            });
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
    const raceNumbers = [];
    const racePositions = {};

    // Group races by round (merge sprint and main race)
    const groupedRaces = {};
    races.forEach((race) => {
        const roundKey = `${race.round}`;
        if (!groupedRaces[roundKey]) {
            groupedRaces[roundKey] = { mainRace: null, sprintRace: null };
        }
        if (race.sprint === "Yes") {
            groupedRaces[roundKey].sprintRace = race;
        } else {
            groupedRaces[roundKey].mainRace = race;
        }
    });

    Object.keys(groupedRaces).forEach((roundKey) => {
        raceNumbers.push(roundKey);
    });

    raceResults.forEach((result) => {
        const roundKey = `${result.race.round}`;

        // Ensure driver exists in object
        if (!drivers[result.driver]) {
            drivers[result.driver] = { totalPoints: 0 };
        }
        if (!drivers[result.driver][roundKey]) {
            drivers[result.driver][roundKey] = 0;
        }

        // Prioritize main race position for racePositions
        const raceId = result.race.id;
        const mainRaceId = groupedRaces[roundKey]?.mainRace?.id;
        const sprintRaceId = groupedRaces[roundKey]?.sprintRace?.id;

        if (!racePositions[roundKey]) {
            racePositions[roundKey] = {};
        }

        if (raceId === mainRaceId) {
            // Store only main race position
            racePositions[roundKey][result.driver] = result.position;
        } else if (!mainRaceId && raceId === sprintRaceId) {
            // Only use sprint race position if there is NO main race
            racePositions[roundKey][result.driver] = result.position;
        }

        // Sum points from both races (since sprint race points still count)
        drivers[result.driver][roundKey] += result.points || 0;
        drivers[result.driver].totalPoints += result.points || 0;
    });

    const sortedDrivers = Object.entries(drivers)
        .map(([driver, races]) => ({ driver, ...races }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    setSortedDrivers({ drivers: sortedDrivers, raceNumbers, racePositions, groupedRaces });
  };

  // Function to download table as an image
  const downloadTableAsImage = () => {
    if (tableRef.current) {
      const scrollableWrapper = document.querySelector(".scrollable-wrapper");
  
      // Backup original styles
      const originalOverflow = scrollableWrapper.style.overflow;
      const originalMaxHeight = scrollableWrapper.style.maxHeight;
      const originalVisibility = scrollableWrapper.style.visibility;
  
      // Hide the scrollbar but keep content visible
      scrollableWrapper.style.overflow = "hidden"; // Prevent scrollbar from appearing
      scrollableWrapper.style.maxHeight = "none"; // Allow full capture
      scrollableWrapper.style.visibility = "visible"; // Ensure it's not hidden
  
      html2canvas(tableRef.current, {
        scale: 2, // High quality
        useCORS: true,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: tableRef.current.scrollHeight,
      }).then((canvas) => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `Championship_Season_${season}_Tier_${division}.png`;
        link.click();
  
        // Restore the original styles
        scrollableWrapper.style.overflow = originalOverflow;
        scrollableWrapper.style.maxHeight = originalMaxHeight;
        scrollableWrapper.style.visibility = originalVisibility;
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
    <div className="table-container">
      <button onClick={downloadTableAsImage} className="download-button">
        Download Table
      </button>

      <div ref={tableRef} id="championship-table">
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
              {sortedDrivers.raceNumbers?.map((round) => {
                // Ensure groupedRaces exists before accessing properties
                const groupedRace = sortedDrivers.groupedRaces?.[round];
                const country = groupedRace?.mainRace?.track?.country || groupedRace?.sprintRace?.track?.country;

                return (
                  <th key={round}>
                    {country ? (
                      <img
                        src={`/flags/${country}.png`}
                        alt={country}
                        title={country}
                        className="race-flag"
                      />
                    ) : (
                      "N/A" // Fallback text if country is missing
                    )}
                  </th>
                );
              })}
              <th>Points</th>
            </tr>
          </thead>
        </table>

        {/* Scrollable Table */}
        <div className="scrollable-wrapper">
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
                    {sortedDrivers.raceNumbers?.map((round) => {
                      const groupedRace = sortedDrivers.groupedRaces?.[round];

                      // Determine the correct RaceId (use mainRace if available, otherwise sprintRace)
                      let RaceId = groupedRace?.mainRace?.id || groupedRace?.sprintRace?.id;

                      const isWinner = sortedDrivers.racePositions?.[round]?.[driver] === 1;
                      const isSecond = sortedDrivers.racePositions?.[round]?.[driver] === 2;
                      const isThird = sortedDrivers.racePositions?.[round]?.[driver] === 3;

                      return (
                        <td
                          key={round}
                          style={{
                            backgroundColor: isWinner ? "rgb(255, 215, 0)"
                              : isSecond ? "rgb(211, 211, 211)"
                              : isThird ? "rgb(165, 107, 49)"
                              : "transparent",
                          }}
                        >
                          {RaceId ? (
                            <Link to={`/STB/Race/${RaceId}`} className="driver-link">
                              {driversraces[round] ?? "-"}
                            </Link>
                          ) : (
                            driversraces[round] ?? "-" // No link if no RaceId
                          )}
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
    </div>
  );
}

export default ChampionshipPage;
