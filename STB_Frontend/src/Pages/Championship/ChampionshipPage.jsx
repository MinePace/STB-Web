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
  const username = localStorage.getItem("name") || "";
  const isLoggedIn = localStorage.getItem("token") !== null;
  const [claimedDriver, setClaimedDriver] = useState(null);

  useEffect(() => {
    if (!isLoggedIn || !username) return;
    fetch(`http://localhost:5110/api/driver/user/${username}`)
      .then(r => r.json())
      .then(d => setClaimedDriver(d))
      .catch(err => console.error("Error fetching claimed driver:", err));
  }, [isLoggedIn, username]);

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

    const roundAgg = {}; // { [roundKey]: { [driver]: { points, sprintPoints, mainDNF } } }

    // Walk every race's results
    races.forEach((race) => {
      const roundKey = String(race.round);
      if (!race.raceResults) return;

      if (!racePositions[roundKey]) racePositions[roundKey] = {};
      const mainRaceId = groupedRaces[roundKey]?.mainRace?.id;
      const isMainRace = race.id === mainRaceId; // undefined/false if no main race known

      if (!roundAgg[roundKey]) roundAgg[roundKey] = {};

      race.raceResults.forEach((res) => {
        // init driver totals
        if (!drivers[res.driver]) drivers[res.driver] = { totalPoints: 0 };
        if (!roundAgg[roundKey][res.driver]) {
          roundAgg[roundKey][res.driver] = { points: 0, sprintPoints: 0, mainDNF: false };
        }
        const agg = roundAgg[roundKey][res.driver];

        // prefer main-race finishing position for medals coloring
        if (isMainRace || (!mainRaceId && race.sprint === "Yes")) {
          racePositions[roundKey][res.driver] = res.position;
        }

        // accumulate points
        const pts = res.points || 0;
        agg.points += pts;
        if (race.sprint === "Yes") agg.sprintPoints += pts;

        // note main-race DNF (do NOT set output yet)
        const isDNF = res.dnf === "Yes" || res.dnf === "DNF";
        if (isMainRace && isDNF) agg.mainDNF = true;

        // keep overall championship total
        drivers[res.driver].totalPoints += pts;
      });
    });

    // Finalize per-round display after all races in the round are known
    Object.entries(roundAgg).forEach(([roundKey, perDriver]) => {
      Object.entries(perDriver).forEach(([driver, agg]) => {
        // Rule:
        // - DNF in MAIN + zero sprint points => show "DNF"
        // - otherwise show total points (even if sprint DNF or main DNF with sprint points)
        drivers[driver][roundKey] =
          agg.mainDNF && agg.sprintPoints === 0 ? "DNF" : agg.points;
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

  const raceCount = sortedDrivers.raceNumbers?.length || 0;

  const renderColGroup = () => (
    <colgroup>
      <col className="col-pos" />
      <col className="col-driver" />
      {Array.from({ length: raceCount }).map((_, i) => (
        <col key={i} className="col-race" />
      ))}
      <col className="col-points" />
    </colgroup>
  );

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
        {/* Fixed Header Table */}
        <table className="header-table" border="1">
          {renderColGroup()}

          <thead>
            <tr className="header-title">
              <th rowSpan={2} colSpan={2}>STB Championship</th>
              <th colSpan={raceCount}>Season {season}</th>
              <th rowSpan={2}>Tier {division}</th>
            </tr>

            <tr>
              {sortedDrivers.raceNumbers?.map((round) => {
                const groupedRace = sortedDrivers.groupedRaces?.[round];
                const country = groupedRace?.mainRace?.track?.country || groupedRace?.sprintRace?.track?.country;
                const Id = groupedRace?.mainRace?.track?.id || groupedRace?.sprintRace?.track?.id;

                return (
                  <th key={round}>
                    <Link to={`/STB/Track/${encodeURIComponent(Id)}`}>
                      {country ? <img src={`/flags/${country}.png`} alt={country} title={country} className="race-flag" /> : "N/A"}
                    </Link>
                  </th>
                );
              })}
            </tr>

            <tr>
              <th>#</th>
              <th>Driver</th>
              {sortedDrivers.raceNumbers?.map((round) => {
                const groupedRace = sortedDrivers.groupedRaces?.[round];
                const countryCode =
                  groupedRace?.mainRace?.track?.countryCode ||
                  groupedRace?.sprintRace?.track?.countryCode;
                return <th key={round}>{countryCode}</th>;
              })}
              <th>Points</th>
            </tr>
          </thead>
        </table>

        {/* Scrollable body */}
        <div className="scrollable-wrapper">
          <div className="scrollable-table">
            <table className="scrollable" border="1">
              {renderColGroup()}
              <tbody>
                {sortedDrivers.drivers?.map(({ driver, totalPoints, ...driversraces }, index) => (
                  <tr key={driver} className="table-row">
                    <td><strong>{index + 1}</strong></td>
                    <td>
                      <Link
                        to={`/STB/Driver/${encodeURIComponent(driver)}`}
                        className={`driver-link ${
                          claimedDriver && driver.trim().toLowerCase() === claimedDriver.name.trim().toLowerCase()
                            ? "driver-link--claimed"
                            : ""
                        }`}
                      >
                        {driver}
                      </Link>
                    </td>
                    {sortedDrivers.raceNumbers?.map((round) => {
                      const groupedRace = sortedDrivers.groupedRaces?.[round];
                      const RaceId = groupedRace?.mainRace?.id || groupedRace?.sprintRace?.id;

                      const pos = sortedDrivers.racePositions?.[round]?.[driver];
                      const bg =
                        pos === 1 ? "rgb(255, 215, 0)" :
                        pos === 2 ? "rgb(211, 211, 211)" :
                        pos === 3 ? "rgb(165, 107, 49)" : "transparent";

                      return (
                        <td key={round} style={{ backgroundColor: bg }}>
                          {driversraces[round] === "DNF" ? (
                            <Link to={`/STB/Race/${RaceId}`} className="race-dnf">DNF</Link>
                          ) : RaceId ? (
                            <Link to={`/STB/Race/${RaceId}`} className="race-link">
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
