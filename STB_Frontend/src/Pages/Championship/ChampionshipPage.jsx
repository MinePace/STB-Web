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
      .then(res => res.json())
      .then(raceData => {
        if (!Array.isArray(raceData) || raceData.length === 0) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setRaces(raceData);
        // Build standings directly from races (which include raceResults)
        transformData(raceData);

        // fastest laps (if you still have this endpoint)
        fetch(`http://localhost:5110/api/fastestlap/${season}/${division}`)
          .then(res => res.json())
          .then(data => {
            setFastestLapData(Array.isArray(data) ? data : []);
            setLoading(false);
          })
          .catch(() => {
            setFastestLapData([]);
            setLoading(false);
          });
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [season, division]);

  const transformData = (races) => {
    const drivers = {};
    const raceNumbers = [];
    const racePositions = {};

    // Group by round (so sprint + main share a column)
    const groupedRaces = {};
    races.forEach((race) => {
      const roundKey = String(race.round);
      if (!groupedRaces[roundKey]) {
        groupedRaces[roundKey] = { mainRace: null, sprintRace: null };
      }
      if (race.sprint === "Yes") {
        groupedRaces[roundKey].sprintRace = race;
      } else {
        groupedRaces[roundKey].mainRace = race;
      }
    });

    Object.keys(groupedRaces).forEach((roundKey) => raceNumbers.push(roundKey));

    // Walk every race's results
    races.forEach((race) => {
      const roundKey = String(race.round);
      if (!race.raceResults) return;

      if (!racePositions[roundKey]) racePositions[roundKey] = {};
      const mainRaceId = groupedRaces[roundKey]?.mainRace?.id;

      race.raceResults.forEach((res) => {
        // init driver buckets
        if (!drivers[res.driver]) drivers[res.driver] = { totalPoints: 0 };
        if (drivers[res.driver][roundKey] == null) drivers[res.driver][roundKey] = 0;

        // prefer main-race finishing position for medals coloring
        if (race.id === mainRaceId || (!mainRaceId && race.sprint === "Yes")) {
          racePositions[roundKey][res.driver] = res.position;
        }

        // DNF? store "DNF", else add points
        if (res.dnf === "Yes" || res.dnf === "DNF") {
          drivers[res.driver][roundKey] = "DNF";
        } else {
          drivers[res.driver][roundKey] += res.points || 0;
          drivers[res.driver].totalPoints += res.points || 0;
        }
      });
    });
    
    const sorted = Object.entries(drivers)
      .map(([driver, rec]) => ({ driver, ...rec }))
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    setSortedDrivers({ drivers: sorted, raceNumbers, racePositions, groupedRaces });
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
