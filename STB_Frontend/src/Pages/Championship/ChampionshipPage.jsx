import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import "./ChampionshipPage.css";
import "@/Components/Links.css";
import RaceLoader from "@/Components/Loaders/RaceLoader";

// 🔹 helper to safely extract driver/team name
const safeName = (entity) =>
  typeof entity === "object" ? entity?.name ?? "Unknown" : entity ?? "Unknown";

function ChampionshipPage() {
  const { season, division } = useParams();
  const [searchParams] = useSearchParams();
  const prefillDriver = searchParams.get("driver");
  const navigate = useNavigate();

  // NEW: Constructors mode
  const mode = searchParams.get("c") === "constructors" ? "constructors" : "drivers";

  const [races, setRaces] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState([]);
  const [constructors, setConstructors] = useState([]); // NEW
  const [fastestLapData, setFastestLapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const tableRef = useRef(null);

  const username = localStorage.getItem("name") || "";
  const isLoggedIn = localStorage.getItem("token") !== null;
  const [claimedDriver, setClaimedDriver] = useState(null);
  const [token, setToken] = useState("");

  // fetch claimed driver
  useEffect(() => {
    if (!isLoggedIn || !username) return;
    fetch(`https://stbleague.fly.dev/api/driver/user/${username}`)
      .then((r) => r.json())
      .then((d) => setClaimedDriver(d))
      .catch((err) => console.error("Error fetching claimed driver:", err));
  }, [isLoggedIn, username]);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  // MAIN fetch
  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    fetch(`https://stbleaguedata.vercel.app/api/championship/${season}/${division}`)
      .then((res) => res.json())
      .then((raceData) => {
      if (!Array.isArray(raceData) || raceData.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 🔥 NORMALIZE SUPABASE RESPONSE → MATCH OLD .NET SHAPE
      const normalized = raceData.map(race => ({
        id: race.Id,
        round: race.Round,
        sprint: race.Sprint,
        track: race.Tracks
          ? {
              id: race.Tracks.Id,
              country: race.Tracks.Country,
              countryCode: race.Tracks.CountryCode,
              name: race.Tracks.Name
            }
          : null,

        raceResults: (race.RaceResults || []).map(res => ({
          position: res.Position,
          points: Number(res.Points) || 0,
          dnf: res.DNF,
          driver: res.Drivers
            ? { name: res.Drivers.Name }
            : res.Driver,
          team: res.Teams
            ? { name: res.Teams.Name }
            : res.Team
        }))
      }));

      setRaces(normalized);
      transformData(normalized);
      setConstructors(computeConstructors(normalized));

        // fastest laps fetch
        fetch(`https://stbleaguedata.vercel.app/api/fastestlap/${season}/${division}`)
          .then((res) => res.json())
          .then((data) => {
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

  const toggleChampionshipMode = () => {
    if (mode === "constructors") {
      // go back to drivers (remove query param)
      navigate(`/STB/Championship/${season}/${division}`);
    } else {
      // go to constructors
      navigate(`/STB/Championship/${season}/${division}?c=constructors`);
    }
  };

  // 🔹 NORMAL DRIVER CHAMPIONSHIP LOGIC — UNCHANGED
  const transformData = (races) => {
    const drivers = {};
    const raceNumbers = [];
    const racePositions = {};

    const groupedRaces = {};

    // Group sprint/main
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

    const roundAgg = {};

    races.forEach((race) => {
      const roundKey = String(race.round);
      if (!race.raceResults) return;

      if (!racePositions[roundKey]) racePositions[roundKey] = {};
      const mainRaceId = groupedRaces[roundKey]?.mainRace?.id;
      const isMainRace = race.id === mainRaceId;

      if (!roundAgg[roundKey]) roundAgg[roundKey] = {};

      race.raceResults.forEach((res) => {
        const driverName = safeName(res.driver);

        if (!drivers[driverName]) drivers[driverName] = { totalPoints: 0 };

        if (!roundAgg[roundKey][driverName]) {
          roundAgg[roundKey][driverName] = {
            points: 0,
            sprintPoints: 0,
            mainDNF: false,
          };
        }

        const agg = roundAgg[roundKey][driverName];

        // record finishing positions
        if (isMainRace || (!mainRaceId && race.sprint === "Yes")) {
          racePositions[roundKey][driverName] = res.position;
        }

        const pts = res.points || 0;
        agg.points += pts;

        if (race.sprint === "Yes") agg.sprintPoints += pts;

        const isDNF = res.dnf === "Yes" || res.dnf === "DNF";
        if (isMainRace && isDNF) agg.mainDNF = true;

        drivers[driverName].totalPoints += pts;
      });
    });

    Object.entries(roundAgg).forEach(([roundKey, perDriver]) => {
      Object.entries(perDriver).forEach(([driverName, agg]) => {
        drivers[driverName][roundKey] =
          agg.mainDNF && agg.sprintPoints === 0 ? "DNF" : agg.points;
      });
    });

    const sorted = Object.entries(drivers)
      .map(([driverName, rec]) => ({
        driver: driverName,
        ...rec,
      }))
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    setSortedDrivers({
      drivers: sorted,
      raceNumbers,
      racePositions,
      groupedRaces,
    });
  };

  // 🔥 NEW — Constructors championship
  const computeConstructors = (races) => {
    const teams = {};

    races.forEach((race) => {
      if (!race.raceResults) return;

      race.raceResults.forEach((res) => {
        const teamName = safeName(res.team);
        const pts = res.points || 0;

        if (!teams[teamName]) teams[teamName] = 0;
        teams[teamName] += pts;
      });
    });

    return Object.entries(teams)
      .map(([team, total]) => ({ team, total }))
      .sort((a, b) => b.total - a.total);
  };

  // now with BACKEND UPLOAD.
  const downloadTableAsImage = async () => {
    const root = tableRef.current;
    if (!root) return;

    const ROOT_SELECTOR = root.id ? `#${root.id}` : "[data-championship-root]";
    const totalW = root.scrollWidth;
    const totalH = root.scrollHeight;

    const SCALE   = 2;
    const TILE_W  = 1400;
    const TILE_H  = 1000;
    const MAX_DIM = 16000;

    const oneShotOK =
      totalW * SCALE <= MAX_DIM && totalH * SCALE <= MAX_DIM;

    const makeShot = (vx, vy, vw, vh, scale = SCALE) =>
      html2canvas(root, {
        scale,
        useCORS: true,
        backgroundColor: null,
        windowWidth: vw,
        windowHeight: vh,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          doc.body.style.background = "transparent";

          const clonedRoot =
            doc.querySelector(ROOT_SELECTOR) || doc.body.firstElementChild;

          const scroller = clonedRoot?.querySelector(".scrollable-wrapper");
          if (scroller) {
            scroller.style.overflow   = "hidden";
            scroller.style.maxHeight  = "none";
            scroller.style.maxWidth   = "none";
            scroller.style.visibility = "visible";
            scroller.scrollLeft = vx;
            scroller.scrollTop  = vy;

            // Hide rows after 25
            const rows = scroller.querySelectorAll("tbody tr");
            rows.forEach((row, i) => {
              if (i >= 50) row.style.display = "none";
            });
          }

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
      const safeScale = Math.min(
        SCALE,
        MAX_DIM / Math.max(1, totalW),
        MAX_DIM / Math.max(1, totalH)
      );
      finalCanvas = await makeShot(0, 0, totalW, totalH, safeScale);
    } else {
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

          ctx.drawImage(
            tile,
            0, 0, tile.width, tile.height,
            Math.floor(vx * SCALE), Math.floor(vy * SCALE),
            Math.floor(vw * SCALE), Math.floor(vh * SCALE)
          );
        }
      }
    }

    // Convert to blob
    const blob = await new Promise((resolve) =>
      finalCanvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;

    // -------------------------------
    // 1️⃣ LOCAL DOWNLOAD
    // -------------------------------
    const localFileName =
      mode === "constructors"
        ? "championship-constructors.png"
        : "championship-drivers.png";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = localFileName;
    a.click();
    URL.revokeObjectURL(url);

    // -------------------------------
    // 2️⃣ UPLOAD TO BACKEND
    // -------------------------------

    // Find latest race WITH results
    const latestRace = [...races]        // copy
      .filter((r) => Array.isArray(r.raceResults) && r.raceResults.length > 0)
      .sort((a, b) => b.round - a.round)[0];

    const country = latestRace?.track?.country || "";
    const circuit = latestRace?.track?.name || "";

    const file = new File([blob], localFileName, { type: "image/png" });

    const formData = new FormData();
    formData.append("season", season);
    formData.append("tier", division);
    formData.append("mode", mode);     // "drivers" or "constructors"
    formData.append("country", country);
    formData.append("circuit", circuit);
    formData.append("file", file);

    try {
      const response = await fetch(
        "https://stbleaguedata.vercel.app/api/auth/upload-championship",
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const json = await response.json();
      console.log("🏆 Championship upload complete:", json);
    } catch (err) {
      console.error("❌ Championship upload failed:", err);
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

  if (loading)
    return <RaceLoader season={season} division={division} />;

  if (notFound)
    return <div className="not-found">No races found for this championship.</div>;

  // =====================================================================================
  // ⭐ NEW — CONSTRUCTORS TABLE RENDER OVERRIDE
  // =====================================================================================
  if (mode === "constructors") {
    return (
      <div className="table-container constructors-view">

        <div className="championship-buttons">
          <div className="championship-buttons-inner">
            <button onClick={downloadTableAsImage} className="download-button">
              Download Table
            </button>

            <button
              onClick={toggleChampionshipMode}
              className="download-button"
            >
              {mode === "constructors"
                ? "View Drivers Championship"
                : "View Constructors Championship"}
            </button>
          </div>
        </div>

        <div
          ref={tableRef}
          id="championship-table"
          className="constructors-table-wrapper"
        >
          <table className="header-table constructors-header">
            <caption className="header-caption">
              Season {season} • Tier {division} <br />
              Constructors Championship
            </caption>

            <colgroup>
              <col className="col-pos" />
              <col className="col-team" />
              <col className="col-points" />
            </colgroup>

            <thead>
              <tr className="header-cols">
                <th>#</th>
                <th>Team</th>
                <th>Points</th>
              </tr>
            </thead>

            <tbody>
              {constructors.map((team, index) => (
                <tr key={team.team}>
                  <td><strong>{index + 1}</strong></td>

                  <td className="team-cell">
                    <img
                      className="team-logo"
                      src={`/team-logos/${team.team}.png`}
                      alt={team.team}
                    />
                    <span>{team.team}</span>
                  </td>

                  <td className="points-cell">{team.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =====================================================================================
  // ORIGINAL DRIVER TABLE (UNTOUCHED)
  // =====================================================================================

  return (
    <div className="table-container">
      <div className="championship-buttons">
        <div className="championship-buttons-inner">
          <button onClick={downloadTableAsImage} className="download-button">
            Download Table
          </button>

          <button
            onClick={toggleChampionshipMode}
            className="download-button"
          >
            {mode === "constructors"
              ? "View Drivers Championship"
              : "View Constructors Championship"}
          </button>
        </div>
      </div>

      <div ref={tableRef} id="championship-table">
        <table className="header-table">
          <caption className="header-caption">
            Season {season} • Tier {division}
          </caption>
          {renderColGroup()}

          <thead>
            {/* original header unchanged */}
            <tr className="header-cols">
              <th rowSpan={2} colSpan={2}>STB Championship</th>
              <th colSpan={raceCount}>Season {season}</th>
              <th rowSpan={2}>Tier {division}</th>
            </tr>

            <tr>
              {sortedDrivers.raceNumbers?.map((round) => {
                const grouped = sortedDrivers.groupedRaces?.[round];
                const country =
                  grouped?.mainRace?.track?.country ||
                  grouped?.sprintRace?.track?.country;
                const trackId =
                  grouped?.mainRace?.track?.id ||
                  grouped?.sprintRace?.track?.id;

                return (
                  <th key={round}>
                    <Link to={`/STB/Track/${encodeURIComponent(trackId)}`}>
                      {country ? (
                        <img
                          src={`/flags/${country}.png`}
                          alt={country}
                          className="race-flag"
                        />
                      ) : (
                        "N/A"
                      )}
                    </Link>
                  </th>
                );
              })}
            </tr>

            <tr className="header-cols">
              <th>#</th>
              <th>Driver</th>

              {sortedDrivers.raceNumbers?.map((round) => {
                const grouped = sortedDrivers.groupedRaces?.[round];
                const raceId =
                  grouped?.mainRace?.id || grouped?.sprintRace?.id;
                const cc =
                  grouped?.mainRace?.track?.countryCode ||
                  grouped?.sprintRace?.track?.countryCode;

                return (
                  <th key={round}>
                    <Link className="primary-link" to={`/STB/Race/${raceId}`}>
                      {cc}
                    </Link>
                  </th>
                );
              })}

              <th>Points</th>
            </tr>
          </thead>
        </table>

        <div className="scrollable-wrapper">
          <div className="scrollable-table">
            <table className="scrollable">
              {renderColGroup()}
              <tbody>
                {sortedDrivers.drivers?.map(
                  ({ driver, totalPoints, ...driversraces }, index) => (
                    <tr key={driver}>
                      <td><strong>{index + 1}</strong></td>

                      <td>
                        <Link
                          to={`/STB/Driver/${encodeURIComponent(driver)}`}
                          className={`primary-link`}
                            // ${
                            //   (claimedDriver?.name &&
                            //     driver.toLowerCase() ===
                            //       claimedDriver.name.toLowerCase()) ||
                            //   prefillDriver === driver
                            //     ? "driver-link-season"
                            //     : ""
                            //   }
                        >
                          {driver}
                        </Link>
                      </td>

                      {sortedDrivers.raceNumbers?.map((round) => {
                        const grouped =
                          sortedDrivers.groupedRaces?.[round];
                        const raceId =
                          grouped?.mainRace?.id ||
                          grouped?.sprintRace?.id;

                        const fastestLap = fastestLapData.some(
                          (lap) =>
                            lap.raceId === raceId &&
                            safeName(lap.driver) === driver
                        );

                        const pos =
                          sortedDrivers.racePositions?.[round]?.[driver];

                        const bg =
                          pos === 1
                            ? "rgb(255, 215, 0)"
                            : pos === 2
                            ? "rgb(211, 211, 211)"
                            : pos === 3
                            ? "rgb(165, 107, 49)"
                            : "transparent";

                        const textColor =
                          fastestLap ? "rgba(225, 116, 255, 1)" : "white";

                        return (
                          <td
                            key={round}
                            style={{ backgroundColor: bg, color: textColor }}
                          >
                            {driversraces[round] === "DNF" ? (
                              <Link
                                to={`/STB/Race/${raceId}`}
                                className="race-dnf"
                              >
                                DNF
                              </Link>
                            ) : raceId ? (
                              <Link
                                to={`/STB/Race/${raceId}`}
                                className="race-link"
                              >
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
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChampionshipPage;