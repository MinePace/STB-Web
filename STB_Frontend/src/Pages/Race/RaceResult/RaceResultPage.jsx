import { useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import "./RaceResultPage.css";
import "@/Components/Links.css";

function RaceResultPage() {
  const { raceId } = useParams(); // Haal "type" op uit de URL
  const [searchParams] = useSearchParams();
  const prefillDriver = searchParams.get("driver"); // e.g. ?driver=Joey1854
  const [raceResults, setRaceResults] = useState([]);
  const [race, setRaceData] = useState();
  const [fastestLap, setFastestLap] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(""); // Opslag voor de embed-URL
  
  const role = localStorage.getItem("role") || "user";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const name = localStorage.getItem("name");
    if (!token || !name) return;

    fetch(`http://localhost:5110/api/user/${name}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setUser(data))
      .catch(err => console.error("Error fetching user data:", err));
  }, []);

  // 🎥 turn any YouTube URL into an <iframe> embed URL
  const extractYouTubeEmbed = (url) => {
    try {
      const u = new URL(url);
      // already an /embed/ url
      if (u.hostname.includes("youtube") && u.pathname.startsWith("/embed/")) {
        setEmbedUrl(u.toString());
        return;
      }

      // standard watch?v=ID
      let id = u.searchParams.get("v");

      // youtu.be/ID or /shorts/ID or /v/ID
      if (!id) {
        const m =
          u.pathname.match(/^\/(?:shorts|v|embed)\/([A-Za-z0-9_-]{11})/) ||
          u.pathname.match(/^\/([A-Za-z0-9_-]{11})/); // youtu.be/ID
        id = m?.[1] || null;
      }

      if (id) {
        setEmbedUrl(`https://www.youtube.com/embed/${id}`);
      } else {
        // not a valid YouTube URL
        setEmbedUrl("");
        console.warn("extractYouTubeEmbed: no video id in", url);
      }
    } catch (e) {
      // invalid URL string
      setEmbedUrl("");
      console.warn("extractYouTubeEmbed: invalid URL", url);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`http://localhost:5110/api/race/race/${raceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("This Race doesn't exist.");
        return res.json();
      })
      .then((data) => {
        const raceObj = data?.race ?? data;
        const flObj = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        setRaceData(raceObj);
        setRaceResults(raceObj?.raceResults ?? []);
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
    "Red Bull": "rgb(23, 38, 122)",
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

  // 📸 Function to capture screenshot with transparent corners/background
  const captureScreenshot = () => {
    const table = document.querySelector(".result-table");
    if (!table) return;

    html2canvas(table, {
      backgroundColor: null,   // ← keep alpha channel (no white background)
      useCORS: true,           // if you load any images/fonts
      scale: 2                 // optional: sharper export
    }).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png"); // PNG supports transparency
      link.download = `Race_Results_${raceId}.png`;
      link.click();
    });
  };


  const hasAnyTime = raceResults.some(r => r.time && r.time.trim() !== "");

  return (
    <div className="race-page-container">
      {loading ? (
        <div className="loading-message">Loading race results...</div>
      ) : error ? (
        <div className="error-message">❌ {error}</div>
      ) : !race ? (
        <div className="error-message">❌ This Race doensn't exist.</div>
      ) : (
        <>
          {/* Header & basic info always visible */}
          <div className="table-container">
            {raceResults.length > 0 && (
              <button className="download-button" onClick={captureScreenshot}>
                📸 Save Screenshot
              </button>
            )}
            <table className="result-table" border="1">
              <thead>
                <tr>
                  <th colSpan="6" className="table-title">
                    {`Season ${race.season} • Tier ${race.division} • Round ${race.round} ${race.sprint === "Yes" ? "(Sprint)" : ""}`}
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
                          title={race.track.country}
                        />
                      )}
                    </div>
                  </th>
                </tr>

                {/* Only show column headers if we actually have rows */}
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
                    const isDNF = row.dnf === "Yes" || row.dnf === "DNF";
                    const isFastestLap =
                      fastestLap &&
                      (fastestLap.driver?.name ?? fastestLap.driver) === row.driver;
                    const isdriverPrefill =
                      prefillDriver &&
                      decodeURIComponent(prefillDriver).toLowerCase() === row.driver.toLowerCase();

                    return (
                      <tr key={index}>
                        <td className={isDNF ? "dnf-cell" : ""}>
                          {isDNF ? "DNF" : row.position}
                        </td>
                        <td className="driver-col">
                          <Link
                            to={`/STB/Driver/${encodeURIComponent(row.driver)}`}
                            className={`primary-link ${isdriverPrefill ? "driver-link-season" : (isFastestLap ? "fastest-lap" : "")}`}
                          >
                            {row.driver}
                          </Link>
                        </td>
                        <td className="team-name" style={{ color: teamColors[row.team] || "white" }}>
                          {row.team}
                        </td>
                        {hasAnyTime && (
                          <td>
                            {row.time ? (index === 0 ? row.time : `+${row.time}`) : ""}
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

          {/* No-results notice */}
          {raceResults.length === 0 && (
            <div className="no-results-banner">
              No results are available for this race.
            </div>
          )}

          {role === "Admin" && raceResults.length === 0 && (
            <div className="admin-actions">
              <Link
                to={`/STB/Add/RaceResults?race=${race.id}`}
                className="primary-link"
              >
                ➕ Add Race Results
              </Link>
            </div>
          )}

          {/* Optional: video & screenshot only when results exist (or keep them always) */}
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
