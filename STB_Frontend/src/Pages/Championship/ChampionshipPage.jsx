import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas"; // Import html2canvas
import "./ChampionshipPage.css";
import "@/Components/Links.css"

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


  // Robust "no-UI-change" capture for the championship table.
const downloadTableAsImage = async () => {
  const root = tableRef.current;             // wrap BOTH header + scroll body
  if (!root) return;

  // Prefer an id to find the element in the cloned DOM
  const ROOT_SELECTOR = root.id ? `#${root.id}` : "[data-championship-root]";

  const totalW = root.scrollWidth;           // full table size
  const totalH = root.scrollHeight;

  // Quality + tiling knobs
  const SCALE   = 2;                          // image sharpness
  const TILE_W  = 1400;                       // viewport width per tile
  const TILE_H  = 1000;                       // viewport height per tile
  const MAX_DIM = 16000;                      // bitmap safety guard (Chrome)

  // Decide if one shot is enough
  const oneShotOK =
    totalW * SCALE <= MAX_DIM && totalH * SCALE <= MAX_DIM;

  const makeShot = (vx, vy, vw, vh, scale = SCALE) =>
    html2canvas(root, {
      scale,
      useCORS: true,
      backgroundColor: null,                  // keep alpha; set to '#0b4e8b' to force blue
      windowWidth: vw,
      windowHeight: vh,
      scrollX: 0,
      scrollY: 0,
      onclone: (doc) => {
        // Transparent background in the cloned document
        doc.body.style.background = "transparent";

        const clonedRoot =
          doc.querySelector(ROOT_SELECTOR) || doc.body.firstElementChild;

        // Expand the scroller ONLY in the clone, and position to our tile
        const scroller = clonedRoot?.querySelector(".scrollable-wrapper");
        if (scroller) {
          scroller.style.overflow   = "hidden";
          scroller.style.maxHeight  = "none";
          scroller.style.maxWidth   = "none";
          scroller.style.visibility = "visible";
          scroller.scrollLeft = vx;
          scroller.scrollTop  = vy;
        }

        // hide scrollbars in the clone (nice clean capture)
        const css = doc.createElement("style");
        css.textContent = `
          .scrollable-wrapper { scrollbar-width: none !important; }
          .scrollable-wrapper::-webkit-scrollbar { display: none !important; }
        `;
        doc.head.appendChild(css);
      },
    });

  let finalCanvas;

  if (oneShotOK) {
    // Single capture (fast path, no UI change)
    const safeScale = Math.min(
      SCALE,
      MAX_DIM / Math.max(1, totalW),
      MAX_DIM / Math.max(1, totalH)
    );
    finalCanvas = await makeShot(0, 0, totalW, totalH, safeScale);
  } else {
    // Tiled capture (still no UI change because it happens in the clone)
    const cols = Math.ceil(totalW / TILE_W);
    const rows = Math.ceil(totalH / TILE_H);

    finalCanvas = document.createElement("canvas");
    finalCanvas.width  = Math.min(totalW * SCALE, MAX_DIM);
    finalCanvas.height = Math.min(totalH * SCALE, MAX_DIM);
    const ctx = finalCanvas.getContext("2d");

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const vx = c * TILE_W;
        const vy = r * TILE_H;
        const vw = Math.min(TILE_W, totalW - vx);
        const vh = Math.min(TILE_H, totalH - vy);

        const tile = await makeShot(vx, vy, vw, vh, SCALE);

        // Place the tile's pixels at the right spot
        ctx.drawImage(
          tile,
          0, 0, tile.width, tile.height,
          Math.floor(vx * SCALE), Math.floor(vy * SCALE),
          Math.floor(vw * SCALE), Math.floor(vh * SCALE)
        );
      }
    }
  }

  // Download (blob avoids enormous data URLs)
  finalCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Championship_Season_${season}_Tier_${division}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
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
        <table className="header-table">
          <caption className="header-caption">
            Season {season} • Tier {division}
          </caption>
          {renderColGroup()}

          <thead>
            <tr className="header-cols">
              <th rowSpan={2} colSpan={2}>STB Championship</th>
              <th colSpan={raceCount} >Season {season}</th>
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

            <tr className="header-cols">
              <th className="col col-pos">#</th>
              <th className="col col-driver">Driver</th>

              {sortedDrivers.raceNumbers?.map((round) => {
                const groupedRace = sortedDrivers.groupedRaces?.[round];
                const RaceId = groupedRace?.mainRace?.id || groupedRace?.sprintRace?.id;
                const countryCode =
                  groupedRace?.mainRace?.track?.countryCode ||
                  groupedRace?.sprintRace?.track?.countryCode;

                return (
                  <th key={round} className="col col-race">
                    <Link className="primary-link" to={`/STB/Race/${RaceId}`}>
                      {countryCode}
                    </Link>
                  </th>
                );
              })}

              <th className="col col-points">Points</th>
            </tr>
          </thead>
        </table>

        {/* Scrollable body */}
        <div className="scrollable-wrapper">
          <div className="scrollable-table">
            <table className="scrollable">
              {renderColGroup()}
              <tbody>
                {sortedDrivers.drivers?.map(({ driver, totalPoints, ...driversraces }, index) => (
                  <tr key={driver} className="table-row">
                    <td><strong>{index + 1}</strong></td>
                    <td>
                      <Link
                        to={`/STB/Driver/${encodeURIComponent(driver)}`}
                        className={`primary-link ${
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
