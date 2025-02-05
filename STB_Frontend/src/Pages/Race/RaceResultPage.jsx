import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

function RaceResultPage() {
  const { season, round, division, type } = useParams(); // Haal "type" op uit de URL
  const [raceResults, setRaceResults] = useState([]);
  const [videoUrl, setVideoUrl] = useState(""); // Opslag voor de YouTube-video-URL
  const [embedUrl, setEmbedUrl] = useState(""); // Opslag voor de embed-URL

  useEffect(() => {
    // Haal race resultaten op
    fetch(`http://localhost:5110/api/race/results/${season}/${round}/${division}/${type}`)
      .then((res) => res.json())
      .then((data) => setRaceResults(data))
      .catch((err) => console.error("Error fetching race results:", err));
  }, [season, round, division, type]);

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
    "Force India": "rgb(255, 130, 234)",
    "Toro Rosso": "rgb(0, 44, 238)",
  };

  // Functie om de YouTube-video-URL te verwerken
  const handleVideoSubmit = () => {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = videoUrl.match(youtubeRegex);

    if (match && match[1]) {
      setEmbedUrl(`https://www.youtube.com/embed/${match[1]}`);
    } else {
      alert("Please enter a valid YouTube URL.");
    }
  };

  return (
    <div className="race-page-container">
      <h1>{type === "Sprint" ? "Sprint Race" : "Main Race"} {round} - Season {season}</h1>

      {/* YouTube Video Input en Speler */}
      <div className="video-section">
        <div className="video-input">
          <input
            type="text"
            placeholder="Enter YouTube Video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            style={{ width: "60%", padding: "10px", fontSize: "16px", marginRight: "10px" }}
          />
          <button
            onClick={handleVideoSubmit}
            style={{
              padding: "10px 15px",
              fontSize: "16px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Load Video
          </button>
        </div>

        {/* Videospeler */}
        {embedUrl && (
          <div className="video-player" style={{ marginTop: "20px" }}>
            <iframe
              width="100%"
              height="400px"
              src={embedUrl}
              title="YouTube Video Player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}
      </div>

      {/* Race Resultaten */}
      <div className="table-container">
        <table border="1">
          <thead>
            <tr>
              <th>Position</th>
              <th>Driver</th>
              <th>Team</th>
              <th>Points</th>
              <th>Qualifying</th>
            </tr>
          </thead>
          <tbody>
            {raceResults.map((row, index) => (
              <tr key={index}>
                <td>{row.position}</td>
                <td>{row.driver}</td>
                <td style={{ color: teamColors[row.team] || "white" }}>{row.team}</td>
                <td>{row.points}</td>
                <td>{row.qualifying}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RaceResultPage;
