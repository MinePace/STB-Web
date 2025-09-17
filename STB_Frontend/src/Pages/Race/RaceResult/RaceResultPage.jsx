import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import "./RaceResultPage.css";

function RaceResultPage() {
  const { raceId } = useParams(); // Haal "type" op uit de URL
  const [raceResults, setRaceResults] = useState([]);
  const [race, setRaceData] = useState();
const [fastestLap, setFastestLap] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(""); // Opslag voor de embed-URL

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
    fetch(`http://localhost:5110/api/race/race/${raceId}`)
      .then((res) => res.json())
      .then((data) => {
        // support either: { race, fastestLap } OR a race object with raceResults [+ optional fastestLap]
        const raceObj = data?.race ?? data;
        const flObj = data?.fastestLap ?? raceObj?.fastestLap ?? null;

        setRaceData(raceObj);
        setRaceResults(raceObj?.raceResults ?? []);
        setFastestLap(flObj);

        if (raceObj?.youtubeLink) {
          extractYouTubeEmbed(raceObj.youtubeLink);
        }
      })
      .catch((err) => console.error("Error fetching race results:", err));
  }, [raceId]);
  
  const teamColors = {
    "Red Bull": "rgb(23, 38, 122)",
    "Mercedes": "rgb(109, 230, 205)",
    "Ferrari": "rgb(231, 0, 0)",
    "McLaren": "rgb(255, 145, 19)",
    "Mclaren": "rgb(255, 145, 19)",
    "Alpine": "rgb(15, 148, 250)",
    "Alpha Tauri": "rgb(65, 102, 126)",
    "AlphaTauri": "rgb(65, 102, 126)",
    "Aston Martin": "rgb(43, 99, 85)",
    "Williams": "rgb(1, 90, 255)",
    "Haas": "rgb(178, 182, 185)",
    "Renault": "rgb(243, 240, 37)",
    "Alfa Romeo": "rgb(136, 1, 1)",
    "Manor": "rgb(12, 211, 247)",
    "Sauber": "rgb(18, 79, 160)",
    "Force India": "rgb(255, 130, 234)",
    "Toro Rosso": "rgb(0, 44, 238)",
    "RB": "rgb(0, 44, 238)",
    "KICK": "rgb(25, 225, 52)",
    "Racing Bulls": "rgb(245, 245, 245)",
    "Audi": "",
    "Cadillac": ""
  };

  // 📸 Function to capture screenshot
  const captureScreenshot = () => {
  const table = document.querySelector(".result-table");
  if (!table) return;
    html2canvas(table).then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Race_Results_${raceId}.png`;
      link.click();
    });
  };

  const hasAnyTime = raceResults.some(r => r.time && r.time.trim() !== "");

  return (
    <div className="race-page-container">
      {/* Check if raceResults has data before rendering */}
      {raceResults.length > 0 ? (
        <>
          {/* Container for video and table */}
          <div className="content-section">
            {/* YouTube Video Player */}
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
                ></iframe>
              </div>
            )}
            {/* Screenshot Button */}
            <button className="screenshot-btn" onClick={captureScreenshot}>
              📸 Save Screenshot
            </button>
  
            {/* Race Results Table */}
            <div className="table-container">
              <table className="result-table" border="1">
                <thead>
                  {/* New Table Headers Spanning Multiple Columns */}
                  <tr>
                    <th colSpan="6" className="table-title">
                      {race ? `Season ${race.season} • Round ${race.round} ${race.sprint === "Yes" ? "(Sprint)" : ""} • Tier ${race.division}` : "Loading..."}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="6" className="table-subtitle">
                      {race ? (
                        <div className="race-header">
                          {race.track.raceName}
                          {race.track.country && (
                            <img
                              src={`/flags/${race.track.country}.png`}
                              alt={race.track.country}
                              className="country-flag"
                              title={race.track.country}
                            />
                          )}
                        </div>
                      ) : (
                        "Loading..."
                      )}
                    </th>
                  </tr>
                  {/* Column Headers */}
                  <tr>
                    <th>Pos</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Points</th>
                    {hasAnyTime && <th>Time</th>}
                    <th>Grid</th>
                  </tr>
                </thead>
                <tbody>
                  {raceResults.map((row, index) => {
                    const isDNF = row.dnf === "Yes" || row.dnf === "DNF";
                    const isFastestLap =
                      fastestLap &&
                      (fastestLap.driver?.name ?? fastestLap.driver) === row.driver;

                    return (
                      <tr key={index}>
                        <td 
                          className={isDNF ? "dnf-cell" : ""} // Apply the special CSS class if DNF
                        >
                          {isDNF ? "DNF" : row.position}
                        </td>
                        <td>
                          <Link
                            to={`/STB/Driver/${encodeURIComponent(row.driver)}`}
                            className={`driver-link ${isFastestLap ? "fastest-lap" : ""}`}
                          >
                            {row.driver}
                          </Link>
                        </td>
                        <td className="team-name" style={{ color: teamColors[row.team] || "white" }}>
                          {row.team}
                        </td>
                        <td>{row.points}</td>
                        {hasAnyTime && (
                          <td>
                            {row.time
                              ? index === 0
                                ? row.time
                                : `+${row.time}`
                              : ""}
                          </td>
                        )}
                        <td>{row.qualifying}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="loading-message">Loading race results...</div>
      )}
    </div>
  );  
}

export default RaceResultPage;
