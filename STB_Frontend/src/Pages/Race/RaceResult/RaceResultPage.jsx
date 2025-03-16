import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import "./RaceResultPage.css";

function RaceResultPage() {
  const { raceId } = useParams(); // Haal "type" op uit de URL
  const [raceResults, setRaceResults] = useState([]);
  const [race, setRaceData] = useState();
  const [embedUrl, setEmbedUrl] = useState(""); // Opslag voor de embed-URL

  useEffect(() => {
    // Fetch race results
    fetch(`http://localhost:5110/api/race/results/${raceId}`)
      .then((res) => res.json())
      .then((data) => {
        setRaceResults(data); 
        console.log("Race Results:", data);

        if (data.length > 0) {
          const raceId = data[0].race.id; // Haal de raceId van de eerste race-resultaten
          fetchRaceInfo(raceId); // Gebruik raceId om race-informatie op te halen
        }
      })
      .catch((err) => console.error("Error fetching race results:", err));
  }, [raceId]);

  // Functie om race-informatie op te halen
  const fetchRaceInfo = (raceId) => {
    fetch(`http://localhost:5110/api/race/race/${raceId}`)
      .then((res) => res.json())
      .then((race) => {
        setRaceData(race);
        console.log("Race Info:", race);

        if (race.youtubeLink) {
          extractYouTubeEmbed(race.youtubeLink); // Stel embed URL in als een YouTube-link bestaat
        }
      })
      .catch((err) => console.error("Error fetching race info:", err));
  };
  
  // 🎥 Converteer de YouTube-link naar de embed-versie
  const extractYouTubeEmbed = (url) => {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    if (match && match[1]) {
      setEmbedUrl(`https://www.youtube.com/embed/${match[1]}`);
    } else {
      console.error("Invalid YouTube URL:", url);
    }
  };
  
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
                    <th colSpan="5" className="table-title">
                      {race ? `Season ${race.season} - Round ${race.round} ${race.sprint === "Yes" ? "(Sprint)" : ""}` : "Loading..."}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="5" className="table-subtitle">
                      {race ? race.track.raceName : "Loading..."}
                    </th>
                  </tr>

                  {/* Column Headers */}
                  <tr>
                    <th>Position</th>
                    <th>Driver</th>
                    <th>Team</th>
                    <th>Points</th>
                    <th>Qualifying</th>
                  </tr>
                </thead>
                <tbody>
  {raceResults.map((row, index) => {
    const isDNF = row.dnf === "Yes" || row.dnf === "DNF";
    return (
      <tr key={index}>
        <td 
          className={isDNF ? "dnf-cell" : ""} // Apply the special CSS class if DNF
        >
          {isDNF ? "DNF" : row.position}
        </td>
        <td>
          <Link to={`/STB/Driver/${encodeURIComponent(row.driver)}`} className="driver-link">
            {row.driver}
          </Link>
        </td>
        <td className="team-name" style={{ color: teamColors[row.team] || "white" }}>
          {row.team}
        </td>
        <td>{row.points}</td>
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
