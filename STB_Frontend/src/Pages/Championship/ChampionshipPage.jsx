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
  const [fastestLapData, setFastestLapData] = useState([]); // New state for fastest lap data
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
              transformData(raceData, resultData); // Ensure data is transformed before state update
            } else {
              setSortedDrivers({
                drivers: [],
                raceNumbers: raceData.map((race) => `${race.round}`),
                racePositions: {},
              });
            }

            // Fetch fastest lap data for the championship
            fetch(`http://localhost:5110/api/fastestlap/${season}/${division}`)
              .then((res) => res.json())
              .then((fastestLapData) => {
                setFastestLapData(fastestLapData);
                setLoading(false); // Only stop loading when all data is fetched and transformed
              })
              .catch(() => {
                setFastestLapData([]);
                setLoading(false);
              });
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

    // Iterate through race results to build driver data
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
        racePositions[roundKey][result.driver] = result.position;
      } else if (!mainRaceId && raceId === sprintRaceId) {
        racePositions[roundKey][result.driver] = result.position;
      }

      // Check if driver DNF'd and set 'DNF' instead of points
      if (result.dnf === "Yes" || result.dnf === "DNF") {
        drivers[result.driver][roundKey] = "DNF";
      } else {
        drivers[result.driver][roundKey] += result.points || 0;
        drivers[result.driver].totalPoints += result.points || 0;
      }
    });

    // Mark the driver with the fastest lap in each race and apply color
    if (fastestLapData.length > 0) {
      fastestLapData.forEach((fastestLap) => {
        const raceId = fastestLap.raceId;
        const fastestLapDriver = fastestLap.driver.name;

        Object.keys(groupedRaces).forEach((roundKey) => {
          const groupedRace = groupedRaces[roundKey];
          const mainRaceId = groupedRace?.mainRace?.id;
          const sprintRaceId = groupedRace?.sprintRace?.id;

          if (raceId === mainRaceId || raceId === sprintRaceId) {
            // Check if the driver has the fastest lap and apply purple color
            if (drivers[fastestLapDriver]) {
              const driverIndex = drivers[fastestLapDriver];
              driverIndex[roundKey] = (
                <span style={{ color: "rgb(163, 35, 255)", fontWeight: "bold" }}>
                  {driverIndex[roundKey]}
                </span>
              );
            }
          }
        });
      });
    }

    // Sort drivers by total points
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
              <th colSpan={(sortedDrivers.raceNumbers?.length || 0) + 3}>
                Championship - Season {season} - Tier {division}
              </th>
            </tr>
            <tr>
              <th><strong>#</strong></th> {/* New Position Column */}
              <th>Driver</th>
              {sortedDrivers.raceNumbers?.map((round) => {
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
                {sortedDrivers.drivers?.map(({ driver, totalPoints, ...driversraces }, index) => (
                  <tr key={driver} className="table-row">
                    <td><strong>{index + 1}</strong></td> {/* Position column added */}
                    <td>
                      <Link to={`/STB/Driver/${encodeURIComponent(driver)}`} className="driver-link">
                        {driver}
                      </Link>
                    </td>
                    {sortedDrivers.raceNumbers?.map((round) => {
                      const groupedRace = sortedDrivers.groupedRaces?.[round];
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
                          {driversraces[round] === "DNF" ? (
                            <Link
                              to={`/STB/Race/${RaceId}`}
                              className="driver-link"
                              style={{ color: "rgb(200, 50, 50)", fontWeight: "bold" }}
                            >
                              DNF
                            </Link>
                          ) : RaceId ? (
                            <Link to={`/STB/Race/${RaceId}`} className="driver-link">
                              {driversraces[round] ?? "-"}
                            </Link>
                          ) : (
                            driversraces[round] ?? "-"
                        )}
                        </td>
                      );
                    })}
                    <td><strong>{totalPoints}</strong></td>
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
