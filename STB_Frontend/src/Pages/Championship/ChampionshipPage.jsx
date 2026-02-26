import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import html2canvas from "html2canvas";
import "./ChampionshipPage.css";
import "@/Components/Links.css";
import RaceLoader from "@/Components/Loaders/RaceLoader";

// helper to safely extract driver/team name
const safeName = (entity) =>
  typeof entity === "object" ? entity?.name ?? "Unknown" : entity ?? "Unknown";

const isDNF = (dnf) => dnf === "Yes" || dnf === "DNF" || dnf === true;

function ChampionshipPage() {
  const { season, division } = useParams();
  const [searchParams] = useSearchParams();
  const prefillDriver = searchParams.get("driver");
  const navigate = useNavigate();

  // constructors mode
  const mode = searchParams.get("c") === "constructors" ? "constructors" : "drivers";

  const [races, setRaces] = useState([]);
  const [sortedDrivers, setSortedDrivers] = useState(null);
  const [constructors, setConstructors] = useState([]);
  const [fastestLapData, setFastestLapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showStandings, setShowStandings] = useState(false);

  const tableRef = useRef(null);

  const username = localStorage.getItem("name") || "";
  const isLoggedIn = localStorage.getItem("token") !== null;
  const [claimedDriver, setClaimedDriver] = useState(null);
  const [token, setToken] = useState("");

  let role = "user";
  if (token) {
    try {
      const decoded = jwtDecode(token);
      role = decoded.role;
    } catch {
      // ignore
    }
  }

  // fetch claimed driver
  useEffect(() => {
    if (!isLoggedIn || !username) return;
    fetch(`https://stbleaguedata.vercel.app/api/driver/user/${username}`)
      .then((r) => r.json())
      .then((d) => setClaimedDriver(d))
      .catch((err) => console.error("Error fetching claimed driver:", err));
  }, [isLoggedIn, username]);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
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

        // Normalize supabase shape → keep what we need for overview + standings table
        const normalized = raceData.map((race) => ({
          id: race.Id,
          round: race.Round,
          sprint: race.Sprint,
          track: race.Tracks
            ? {
                id: race.Tracks.Id,
                country: race.Tracks.Country,
                countryCode: race.Tracks.CountryCode,
                name: race.Tracks.Name,
              }
            : null,
          date: race.Date ?? null,
          youtubeLink: race.YoutubeLink ?? null,

          raceResults: (race.RaceResults || []).map((res) => ({
            position: res.Position,
            points: Number(res.Points) || 0,
            dnf: res.DNF,
            qualifying: typeof res.Qualifying === "number" ? res.Qualifying : Number(res.Qualifying) || null,
            posChange: typeof res.Pos_Change === "number" ? res.Pos_Change : Number(res.Pos_Change) || 0,
            penalty: typeof res.Penalty === "number" ? res.Penalty : Number(res.Penalty) || 0,
            time: res.Time ?? null,

            driver: res.Drivers ? { name: res.Drivers.Name } : res.Driver,
            team: res.Teams ? { name: res.Teams.Name } : res.Team,
          })),
        }));

        setRaces(normalized);
        setSortedDrivers(transformData(normalized));
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
      navigate(`/STB/Championship/${season}/${division}`);
    } else {
      navigate(`/STB/Championship/${season}/${division}?c=constructors`);
    }
  };

  // ---------------------------
  // Standings transformation (same logic, but return object instead of setState)
  // ---------------------------
  const transformData = (racesArr) => {
    const drivers = {};
    const raceNumbers = [];
    const racePositions = {};
    const groupedRaces = {};

    // Group sprint/main per round
    racesArr.forEach((race) => {
      const roundKey = String(race.round);
      if (!groupedRaces[roundKey]) groupedRaces[roundKey] = { mainRace: null, sprintRace: null };
      if (race.sprint === "Yes") groupedRaces[roundKey].sprintRace = race;
      else groupedRaces[roundKey].mainRace = race;
    });

    Object.keys(groupedRaces).forEach((roundKey) => raceNumbers.push(roundKey));

    const roundAgg = {};

    racesArr.forEach((race) => {
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

        // finishing positions for medal coloring
        if (isMainRace || (!mainRaceId && race.sprint === "Yes")) {
          racePositions[roundKey][driverName] = res.position;
        }

        const pts = res.points || 0;
        agg.points += pts;
        if (race.sprint === "Yes") agg.sprintPoints += pts;

        if (isMainRace && isDNF(res.dnf)) agg.mainDNF = true;

        drivers[driverName].totalPoints += pts;
      });
    });

    Object.entries(roundAgg).forEach(([roundKey, perDriver]) => {
      Object.entries(perDriver).forEach(([driverName, agg]) => {
        drivers[driverName][roundKey] = agg.mainDNF && agg.sprintPoints === 0 ? "DNF" : agg.points;
      });
    });

    const sorted = Object.entries(drivers)
      .map(([driverName, rec]) => ({
        driver: driverName,
        ...rec,
      }))
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    return {
      drivers: sorted,
      raceNumbers,
      racePositions,
      groupedRaces,
    };
  };

  // Constructors
  const computeConstructors = (racesArr) => {
    const teams = {};
    racesArr.forEach((race) => {
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

  // ---------------------------
  // Overview helpers
  // ---------------------------
  const latestRaceWithResults = useMemo(() => {
    const candidates = [...races]
      .filter((r) => Array.isArray(r.raceResults) && r.raceResults.length > 0)
      .sort((a, b) => (b.round || 0) - (a.round || 0));
    return candidates[0] || null;
  }, [races]);

  const latestPodium = useMemo(() => {
    if (!latestRaceWithResults) return [];
    return [...latestRaceWithResults.raceResults]
      .filter((x) => typeof x.position === "number")
      .sort((a, b) => a.position - b.position)
      .slice(0, 3)
      .map((r) => ({
        position: r.position,
        driver: safeName(r.driver),
        team: safeName(r.team),
        points: r.points || 0,
      }));
  }, [latestRaceWithResults]);

  const overviewStats = useMemo(() => {
    // stats based on MAIN races only by default (you can change if you want)
    const mainRaces = races.filter((r) => r.sprint !== "Yes");

    const perDriver = new Map();

    const ensure = (name) => {
      if (!perDriver.has(name)) {
        perDriver.set(name, {
          wins: 0,
          podiums: 0,
          dnfs: 0,
          points: 0,
          penalty: 0,
          posGain: 0,
          qualySum: 0,
          qualyCount: 0,
        });
      }
      return perDriver.get(name);
    };

    for (const race of mainRaces) {
      for (const res of race.raceResults || []) {
        const name = safeName(res.driver);
        const d = ensure(name);

        d.points += res.points || 0;
        d.penalty += res.penalty || 0;
        d.posGain += res.posChange || 0;

        if (isDNF(res.dnf)) d.dnfs += 1;
        if (res.position === 1) d.wins += 1;
        if (res.position >= 1 && res.position <= 3) d.podiums += 1;

        if (res.qualifying && res.qualifying > 0) {
          d.qualySum += res.qualifying;
          d.qualyCount += 1;
        }
      }
    }

    const arr = Array.from(perDriver.entries()).map(([driver, s]) => ({
      driver,
      ...s,
      avgQualy: s.qualyCount > 0 ? s.qualySum / s.qualyCount : null,
    }));

    const pickMax = (key) => arr.reduce((best, cur) => (cur[key] > (best?.[key] ?? -Infinity) ? cur : best), null);
    const pickMinAvg = () =>
      arr
        .filter((x) => x.avgQualy !== null)
        .reduce((best, cur) => (cur.avgQualy < (best?.avgQualy ?? Infinity) ? cur : best), null);

    return {
      mostWins: pickMax("wins"),
      mostPodiums: pickMax("podiums"),
      mostDNFs: pickMax("dnfs"),
      mostPosGained: pickMax("posGain"),
      bestAvgQualy: pickMinAvg(),
    };
  }, [races]);

  // ---------------------------
  // Download table screenshot (same as you had, unchanged except text)
  // ---------------------------
  const downloadTableAsImage = async () => {
    const root = tableRef.current;
    if (!root) return;

    const ROOT_SELECTOR = root.id ? `#${root.id}` : "[data-championship-root]";
    const totalW = root.scrollWidth;
    const totalH = root.scrollHeight;

    const SCALE = 2;
    const TILE_W = 1400;
    const TILE_H = 1000;
    const MAX_DIM = 16000;

    const oneShotOK = totalW * SCALE <= MAX_DIM && totalH * SCALE <= MAX_DIM;

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

          const clonedRoot = doc.querySelector(ROOT_SELECTOR) || doc.body.firstElementChild;
          const scroller = clonedRoot?.querySelector(".scrollable-wrapper");
          if (scroller) {
            scroller.style.overflow = "hidden";
            scroller.style.maxHeight = "none";
            scroller.style.maxWidth = "none";
            scroller.style.visibility = "visible";
            scroller.scrollLeft = vx;
            scroller.scrollTop = vy;

            // Hide rows after 50 (same as your code)
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
      const safeScale = Math.min(SCALE, MAX_DIM / Math.max(1, totalW), MAX_DIM / Math.max(1, totalH));
      finalCanvas = await makeShot(0, 0, totalW, totalH, safeScale);
    } else {
      const cols = Math.ceil(totalW / TILE_W);
      const rows = Math.ceil(totalH / TILE_H);

      finalCanvas = document.createElement("canvas");
      finalCanvas.width = Math.min(totalW * SCALE, MAX_DIM);
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
            0,
            0,
            tile.width,
            tile.height,
            Math.floor(vx * SCALE),
            Math.floor(vy * SCALE),
            Math.floor(vw * SCALE),
            Math.floor(vh * SCALE)
          );
        }
      }
    }

    const blob = await new Promise((resolve) => finalCanvas.toBlob(resolve, "image/png"));
    if (!blob) return;

    // Local download
    const localFileName =
      mode === "constructors" ? "championship-constructors.png" : "championship-drivers.png";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = localFileName;
    a.click();
    URL.revokeObjectURL(url);

    // Upload to backend
    const latestRace = [...races]
      .filter((r) => Array.isArray(r.raceResults) && r.raceResults.length > 0)
      .sort((a, b) => (b.round || 0) - (a.round || 0))[0];

    const country = latestRace?.track?.country || "";
    const circuit = latestRace?.track?.name || "";

    const file = new File([blob], localFileName, { type: "image/png" });

    const formData = new FormData();
    formData.append("season", season);
    formData.append("tier", division);
    formData.append("mode", mode);
    formData.append("country", country);
    formData.append("circuit", circuit);
    formData.append("file", file);

    try {
      const response = await fetch("https://stbleaguedata.vercel.app/api/auth/upload-championship", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();
      console.log("🏆 Championship upload complete:", json);

      // Notify Discord bot (admin only)
      if (role === "admin") {
        try {
          await fetch("http://localhost:3000/api/notify-championship", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              season,
              tier: division,
              mode,
              country,
              circuit,
              imagePath: `${json.publicUrl}`,
            }),
          });
          console.log("🤖 Bot notified successfully");
        } catch (err) {
          console.error("❌ Failed to notify Discord bot:", err);
        }
      }
    } catch (err) {
      console.error("❌ Championship upload failed:", err);
    }
  };

  // ---------------------------
  // Table helpers
  // ---------------------------
  const raceCount = sortedDrivers?.raceNumbers?.length || 0;

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

  // ---------------------------
  // UI: loading / error
  // ---------------------------
  if (loading) return <RaceLoader season={season} division={division} />;
  if (notFound) return <div className="not-found">No races found for this championship.</div>;

  // ---------------------------
  // Overview top10
  // ---------------------------
  const top10 = (sortedDrivers?.drivers || []).slice(0, 10);

  return (
    <div className="championship-page">
      {/* Top bar */}
      <div className="championship-topbar">
        <div className="championship-title">
          <div className="championship-title-main">Season {season} • Tier {division}</div>
          <div className="championship-title-sub">
            {mode === "constructors" ? "Constructors Overview" : "Championship Overview"}
          </div>
        </div>

        <div className="championship-topbar-actions">
          <button onClick={toggleChampionshipMode} className="btn btn-secondary">
            {mode === "constructors" ? "View Drivers" : "View Constructors"}
          </button>

          <button onClick={() => setShowStandings(true)} className="btn btn-primary">
            Full Standings
          </button>
        </div>
      </div>

      {/* Overview grid (no page scroll) */}
      <div className="overview-grid">
        {/* Card: Top 10 */}
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top 10 Championship</div>
              <div className="card-subtitle">Current standings snapshot</div>
            </div>
            <button onClick={() => setShowStandings(true)} className="btn btn-ghost">
              Expand
            </button>
          </div>

          {mode === "constructors" ? (
            <div className="card-body">
              <div className="mini-table">
                <div className="mini-head">
                  <span>#</span><span>Team</span><span className="mini-right">Pts</span>
                </div>
                {constructors.slice(0, 10).map((t, i) => (
                  <div className="mini-row" key={`${t.team}-${i}`}>
                    <span className="mini-rank">{i + 1}</span>
                    <span className="mini-name">
                      <img
                        className="mini-logo"
                        src={`/team-logos/${t.team}.png`}
                        alt={t.team}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      {t.team}
                    </span>
                    <span className="mini-right mini-pts">{t.total}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card-body">
              <div className="mini-table">
                <div className="mini-head">
                  <span>#</span><span>Driver</span><span className="mini-right">Pts</span>
                </div>

                {top10.map((d, i) => (
                  <div className="mini-row" key={d.driver}>
                    <span className="mini-rank">{i + 1}</span>
                    <Link
                      to={`/STB/Driver/${encodeURIComponent(d.driver)}`}
                      className={`mini-name primary-link ${
                        ((claimedDriver?.name && d.driver.toLowerCase() === claimedDriver.name.toLowerCase()) ||
                          prefillDriver === d.driver)
                          ? "driver-link-season"
                          : ""
                      }`}
                    >
                      {d.driver}
                    </Link>
                    <span className="mini-right mini-pts">{d.totalPoints}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Card: Race results (scrollable) */}
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Race Results</div>
              <div className="card-subtitle">All rounds</div>
            </div>
          </div>

          <div className="card-body race-results-body">
            <div className="results-list">
              {[...races]
                .filter((r) => Array.isArray(r.raceResults) && r.raceResults.length > 0)
                .sort((a, b) => (b.round || 0) - (a.round || 0))
                .map((race) => {
                  const podium = [...race.raceResults]
                    .filter((x) => typeof x.position === "number")
                    .sort((a, b) => a.position - b.position)
                    .slice(0, 3);

                  return (
                    <Link
                      key={race.id}
                      to={`/STB/Race/${race.id}`}
                      className="result-row"
                    >
                      <div className="result-track">
                        {race.track?.name ?? "Unknown Track"}
                        <span className="result-round">
                          {" "}• R{race.round}
                        </span>
                      </div>

                      <div className="result-podium">
                        {podium.map((p) => (
                          <span key={p.position} className={`p-badge p${p.position}`}>
                            P{p.position} {safeName(p.driver)}
                          </span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        </section>

        {/* Card: Season stats */}
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Season Stats</div>
              <div className="card-subtitle">Main races only</div>
            </div>
          </div>

          <div className="card-body stats">
            <StatRow
              label="Most Wins"
              value={overviewStats.mostWins ? `${overviewStats.mostWins.driver} (${overviewStats.mostWins.wins})` : "—"}
              link={overviewStats.mostWins ? `/STB/Driver/${encodeURIComponent(overviewStats.mostWins.driver)}` : null}
            />
            <StatRow
              label="Most Podiums"
              value={overviewStats.mostPodiums ? `${overviewStats.mostPodiums.driver} (${overviewStats.mostPodiums.podiums})` : "—"}
              link={overviewStats.mostPodiums ? `/STB/Driver/${encodeURIComponent(overviewStats.mostPodiums.driver)}` : null}
            />
            <StatRow
              label="Best Avg. Qualifying"
              value={
                overviewStats.bestAvgQualy
                  ? `${overviewStats.bestAvgQualy.driver} (${overviewStats.bestAvgQualy.avgQualy.toFixed(2)})`
                  : "—"
              }
              link={overviewStats.bestAvgQualy ? `/STB/Driver/${encodeURIComponent(overviewStats.bestAvgQualy.driver)}` : null}
            />
            <StatRow
              label="Most Positions Gained"
              value={overviewStats.mostPosGained ? `${overviewStats.mostPosGained.driver} (${overviewStats.mostPosGained.posGain})` : "—"}
              link={overviewStats.mostPosGained ? `/STB/Driver/${encodeURIComponent(overviewStats.mostPosGained.driver)}` : null}
            />
            <StatRow
              label="Most DNFs"
              value={overviewStats.mostDNFs ? `${overviewStats.mostDNFs.driver} (${overviewStats.mostDNFs.dnfs})` : "—"}
              link={overviewStats.mostDNFs ? `/STB/Driver/${encodeURIComponent(overviewStats.mostDNFs.driver)}` : null}
            />
          </div>
        </section>
      </div>

      {/* Modal with full standings table */}
      {showStandings && (
        <StandingsModal
          onClose={() => setShowStandings(false)}
          title={`Season ${season} • Tier ${division}`}
        >
          <div className="modal-toolbar">
            <button onClick={downloadTableAsImage} className="btn btn-primary">
              Download Table
            </button>

            <button onClick={toggleChampionshipMode} className="btn btn-secondary">
              {mode === "constructors" ? "View Drivers Championship" : "View Constructors Championship"}
            </button>

            <button onClick={() => setShowStandings(false)} className="btn btn-ghost">
              Close
            </button>
          </div>

          {/* IMPORTANT: the capture ref stays on the table container */}
          <div ref={tableRef} id="championship-table" data-championship-root>
            {mode === "constructors" ? (
              <ConstructorsTable
                season={season}
                division={division}
                constructors={constructors}
              />
            ) : (
              <DriversTable
                season={season}
                division={division}
                sortedDrivers={sortedDrivers}
                fastestLapData={fastestLapData}
                renderColGroup={renderColGroup}
              />
            )}
          </div>
        </StandingsModal>
      )}
    </div>
  );
}

function StatRow({ label, value, link }) {
  return (
    <div className="stat-row">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {link ? (
          <Link className="primary-link" to={link}>
            {value}
          </Link>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function StandingsModal({ title, onClose, children }) {
  // close on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------
// Full standings tables (mostly your original render)
// ---------------------------
function ConstructorsTable({ season, division, constructors }) {
  return (
    <div className="table-container constructors-view">
      <div className="constructors-table-wrapper">
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
                <td>
                  <strong>{index + 1}</strong>
                </td>

                <td className="team-cell">
                  <img
                    className="team-logo"
                    src={`/team-logos/${team.team}.png`}
                    alt={team.team}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
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

function DriversTable({ season, division, sortedDrivers, fastestLapData, renderColGroup }) {
  const raceCount = sortedDrivers?.raceNumbers?.length || 0;

  return (
    <div className="table-container">
      <table className="header-table">
        <caption className="header-caption">Season {season} • Tier {division}</caption>
        {renderColGroup()}

        <thead>
          <tr className="header-cols">
            <th rowSpan={2} colSpan={2}>STB Championship</th>
            <th colSpan={raceCount}>Season {season}</th>
            <th rowSpan={2}>Tier {division}</th>
          </tr>

          <tr>
            {sortedDrivers.raceNumbers?.map((round) => {
              const grouped = sortedDrivers.groupedRaces?.[round];
              const country = grouped?.mainRace?.track?.country || grouped?.sprintRace?.track?.country;
              const trackId = grouped?.mainRace?.track?.id || grouped?.sprintRace?.track?.id;

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
              const raceId = grouped?.mainRace?.id || grouped?.sprintRace?.id;
              const cc = grouped?.mainRace?.track?.countryCode || grouped?.sprintRace?.track?.countryCode;

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
              {sortedDrivers.drivers?.map(({ driver, totalPoints, ...driversraces }, index) => (
                <tr key={driver}>
                  <td><strong>{index + 1}</strong></td>

                  <td>
                    <Link
                      to={`/STB/Driver/${encodeURIComponent(driver)}`}
                      className="primary-link"
                    >
                      {driver}
                    </Link>
                  </td>

                  {sortedDrivers.raceNumbers?.map((round) => {
                    const grouped = sortedDrivers.groupedRaces?.[round];
                    const raceId = grouped?.mainRace?.id || grouped?.sprintRace?.id;

                    const fastestLap = fastestLapData.some(
                      (lap) => lap.raceId === raceId && safeName(lap.driver) === driver
                    );

                    const pos = sortedDrivers.racePositions?.[round]?.[driver];

                    const bg =
                      pos === 1 ? "rgb(255, 215, 0)" :
                      pos === 2 ? "rgb(211, 211, 211)" :
                      pos === 3 ? "rgb(165, 107, 49)" :
                      "transparent";

                    const textColor = fastestLap ? "rgba(225, 116, 255, 1)" : "white";

                    return (
                      <td key={round} style={{ backgroundColor: bg, color: textColor }}>
                        {driversraces[round] === "DNF" ? (
                          <Link to={`/STB/Race/${raceId}`} className="race-dnf">
                            DNF
                          </Link>
                        ) : raceId ? (
                          <Link to={`/STB/Race/${raceId}`} className="race-link">
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
  );
}

export default ChampionshipPage;