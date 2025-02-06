import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./RaceResultPage.css";

function RaceResultPage() {
  const { season, round, division, type } = useParams(); // Haal "type" op uit de URL
  const [raceResults, setRaceResults] = useState([]);
  const [race, setRaceData] = useState();
  const [embedUrl, setEmbedUrl] = useState(""); // Opslag voor de embed-URL

  useEffect(() => {
    // Fetch race results
    fetch(`http://localhost:5110/api/race/results/${season}/${round}/${division}/${type}`)
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
  }, [season, round, division, type]);

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

  return (
    <div className="race-page-container">
      <h1>{type === "Sprint" ? "Sprint Race" : "Main Race"} {round} - Season {season}</h1>

      {/* Container voor video en tabel */}
      <div className="content-section">
        {/* YouTube Video Speler */}
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

        {/* Race Resultaten */}
        <div className="table-container">
          <table className="result-table" border="1">
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
                  <td>
                    <Link
                      to={`/STB/Driver/${encodeURIComponent(row.driver)}`}
                      className="driver-link"
                    >
                      {row.driver}
                    </Link>
                  </td>
                  <td style={{ color: teamColors[row.team] || "white" }}>{row.team}</td>
                  <td>{row.points}</td>
                  <td>{row.qualifying}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default RaceResultPage;
