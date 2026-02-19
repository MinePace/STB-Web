import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import html2canvas from "html2canvas";
import "./RaceResultPage.css";
import "@/Components/Links.css";

// helper: convert driver/team object → name string
const safeName = (entity) =>
  typeof entity === "object" ? entity?.name ?? "Unknown" : entity ?? "Unknown";

function RaceResultPage() {
  const { raceId } = useParams();
  const [searchParams] = useSearchParams();
  const prefillDriver = searchParams.get("driver");
  const [raceResults, setRaceResults] = useState([]);
  const [race, setRaceData] = useState();
  const [fastestLap, setFastestLap] = useState(null);
  const [embedUrl, setEmbedUrl] = useState("");

  const token = localStorage.getItem("token");

  let role = "user";

  if (token) {
    try {
      const decoded = jwtDecode(token);

      role = decoded.role;
    } catch (e) {
      console.log("JWT decode failed:", e);
    }
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // user fetch
  useEffect(() => {
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("name");
    if (!token || !name) return;

    fetch(`https://stbleague.fly.dev/api/user/${name}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUser(data))
      .catch((err) => console.error("Error fetching user data:", err));
  }, []);

  // YouTube embed parser
  const extractYouTubeEmbed = (url) => {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtube") && u.pathname.startsWith("/embed/")) {
        setEmbedUrl(u.toString());
        return;
      }
      let id = u.searchParams.get("v");
      if (!id) {
        const m =
          u.pathname.match(/^\/(?:shorts|v|embed)\/([A-Za-z0-9_-]{11})/) ||
          u.pathname.match(/^\/([A-Za-z0-9_-]{11})/);
        id = m?.[1] || null;
      }
      setEmbedUrl(id ? `https://www.youtube.com/embed/${id}` : "");
    } catch (e) {
      setEmbedUrl("");
    }
  };

  // main load
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`https://stbleaguedata.vercel.app/api/race/${raceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("This Race doesn't exist.");
        return res.json();
      })
      .then((data) => {
        const raceObj = data?.race ?? data;
        const flObj = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        // 🔥 convert incoming results into safe-name format
        const fixedResults = (raceObj?.raceResults ?? []).map((r) => ({
          ...r,
          driverName: safeName(r.driver),
          teamName: safeName(r.team)
        }));

        setRaceData(raceObj);
        setRaceResults(fixedResults);
        setFastestLap(flObj);

        if (raceObj?.youtubeLink) extractYouTubeEmbed(raceObj.youtubeLink);
      })
      .catch((err) => {
        console.error("Error fetching race results:", err);
        setError(err.message || "Failed to load race");
        setRaceData(undefined);
        setRaceResults([]);
        setFastestLap(null);
        setEmbedUrl("");
      })
      .finally(() => setLoading(false));
  }, [raceId]);

  const teamColors = {
    "Red Bull": "rgba(59, 73, 149, 1)",
    "Mercedes": "rgb(109, 230, 205)",
    "Ferrari": "rgb(231, 0, 0)",
    "McLaren": "rgb(255, 145, 19)",
    "Alpine": "rgb(15, 148, 250)",
    "Alpha Tauri": "rgb(65, 102, 126)",
    "Aston Martin": "rgb(43, 99, 85)",
    "Williams": "rgb(1, 90, 255)",
    "Haas": "rgb(178, 182, 185)",
    "Renault": "rgb(243, 240, 37)",
    "Alfa Romeo": "rgb(136, 1, 1)",
    "Manor": "rgb(12, 211, 247)",
    "Sauber": "rgb(18, 79, 160)",
    "Force India": "rgba(246, 185, 43, 1)",
    "Racing Point": "rgb(255, 130, 234)",
    "Toro Rosso": "rgb(0, 44, 238)",
    "RB": "rgb(0, 44, 238)",
    "KICK": "rgb(25, 225, 52)",
    "Racing Bulls": "rgba(246, 253, 255, 1)",
    "Audi": "",
    "Cadillac": ""
  };

  async function captureScreenshot({ raceId, season, tier, round }) {
    const table = document.querySelector(".result-table");
    if (!table) return;

    html2canvas(table, { backgroundColor: null, useCORS: true, scale: 2 })
      .then(async (canvas) => {
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png")
        );
        const file = new File([blob], `Round${round}.png`, {
          type: "image/png"
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Race_Results_Round${round}.png`;
        link.click();

        const formData = new FormData();
        formData.append("season", season);
        formData.append("tier", tier);
        formData.append("round", round);
        formData.append("file", file);
        formData.append("country", race.track?.country);
        formData.append("circuit", race.track?.name);

        try {
          const response = await fetch(
            `https://stbleaguedata.vercel.app/api/auth/upload-result`,
            { 
              method: "POST", 
              body: formData,
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );
        } catch (err) {
          console.error("Upload error:", err);
        }
      });
  }

  const hasAnyTime = raceResults.some((r) => r.time && r.time.trim() !== "");
  const season = race ? race.season : "unknown";
  const tier = race ? race.division : "unknown";
  const round = race ? race.round : "unknown";

  return (
    <div className="race-page-container">
      {loading ? (
        <div className="loading-message">Loading race results...</div>
      ) : error ? (
        <div className="error-message">❌ {error}</div>
      ) : !race ? (
        <div className="error-message">❌ This Race doesn't exist.</div>
      ) : (
        <>
          <div className="table-container">
            {raceResults.length > 0 && (
              <button
                className="download-button"
                onClick={() => captureScreenshot({ season, tier, round })}
              >
                📸 Save Screenshot
              </button>
            )}
            <table className="result-table" border="1">
              <thead>
                <tr>
                  <th colSpan="6" className="table-title">
                    {`Season ${race.season} • Tier ${race.division} • Round ${race.round} ${
                      race.sprint === "Yes" ? "(Sprint)" : ""
                    }`}
                  </th>
                </tr>
                <tr>
                  <th colSpan="6" className="table-subtitle">
                    <div className="race-header">
                      {race.track?.raceName ?? "—"}
                      {race.track?.country && (
                        <img
                          src={`/flags/${race.track.country}.png`}
                          alt={race.track.country}
                          className="country-flag"
                        />
                      )}
                    </div>
                  </th>
                </tr>

                {raceResults.length > 0 && (
                  <tr>
                    <th>Pos</th>
                    <th className="driver-col">Driver</th>
                    <th>Team</th>
                    {hasAnyTime && <th>Time</th>}
                    <th>Grid</th>
                  </tr>
                )}
              </thead>

              {raceResults.length > 0 && (
                <tbody>
                  {raceResults.map((row, index) => {
                    // 🔥 All conversions already done in transform!
                    const driverName = row.driverName;
                    const teamName = row.teamName;

                    const isDNF =
                      row.dnf === "Yes" || row.dnf === "DNF";

                    // 🔥 fastest lap fix
                    const isFastestLap =
                      fastestLap &&
                      safeName(fastestLap.driver) === driverName;

                    const isdriverPrefill =
                      prefillDriver &&
                      decodeURIComponent(prefillDriver).toLowerCase() ===
                        driverName.toLowerCase();

                    return (
                      <tr key={index}>
                        <td className={isDNF ? "dnf-cell" : ""}>
                          {isDNF ? "DNF" : row.position}
                        </td>

                        <td className="driver-col">
                          <Link
                            to={`/STB/Driver/${encodeURIComponent(
                              driverName
                            )}`}
                            className={`primary-link ${
                              isdriverPrefill
                                ? "driver-link-season"
                                : isFastestLap
                                ? "fastest-lap"
                                : ""
                            }`}
                          >
                            {driverName}
                          </Link>
                        </td>

                        <td
                          className="team-name"
                          style={{
                            color:
                              teamColors[teamName] ??
                              "white"
                          }}
                        >
                          {teamName}
                        </td>

                        {hasAnyTime && (
                          <td>
                            {row.time ? (
                              <>
                                {index === 0
                                  ? row.time
                                  : `+${row.time}`}
                                {row.penalty !== 0 &&
                                  row.penalty !== null && (
                                    <span
                                      className={
                                        row.penalty > 0
                                          ? "penalty-inline"
                                          : "bonus-inline"
                                      }
                                    >
                                      (
                                      {row.penalty > 0
                                        ? `+${row.penalty}s`
                                        : `${row.penalty}s`}
                                      )
                                    </span>
                                  )}
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                        )}

                        <td>{row.qualifying}</td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>

          {raceResults.length === 0 && (
            <div className="no-results-banner">
              No results are available for this race.
            </div>
          )}

          {role === "Admin" && raceResults.length === 0 && (
            <div className="admin-actions">
              <Link
                to={`/STB/Add/RaceResults?race=${race.id}`}
                className="primary-link add-results-link"
              >
                ➕ Add Race Results
              </Link>
            </div>
          )}

          {embedUrl && (
            <div className="video-player">
              <iframe
                width="100%"
                height="250px"
                src={embedUrl}
                title="YouTube Video Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RaceResultPage;
