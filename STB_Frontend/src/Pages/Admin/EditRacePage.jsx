import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./EditRacePage.css";

function EditRacePage() {
  const navigate = useNavigate(); // Voor navigatie na een succesvolle update
  const [seasons, setSeasons] = useState([]); // Opslag voor beschikbare seizoenen
  const [selectedSeason, setSelectedSeason] = useState(""); // Geselecteerd seizoen
  const [races, setRaces] = useState([]); // Opslag voor races in het geselecteerde seizoen
  const [selectedRace, setSelectedRace] = useState(""); // Geselecteerde race
  const [formData, setFormData] = useState({
    f1_Game: "",
    season: "",
    division: "",
    round: "",
    sprint: "No",
    youtubeLink: "",
    trackName: "",
    trackCountry: "",
    trackRaceName: "",
    date: "",
  });

  useEffect(() => {
      const role = localStorage.getItem("role");
      if (role !== "Admin") {
        navigate("/"); // Stuur terug naar homepage als geen admin
      }
    }, [navigate]);

  // Haal beschikbare seizoenen op bij het laden van de pagina
  useEffect(() => {
    fetch(`http://localhost:5110/api/race/seasons`)
      .then((res) => res.json())
      .then((data) => setSeasons(data))
      .catch((err) => console.error("Error fetching seasons:", err));
  }, []);

  // Haal races op wanneer een seizoen wordt geselecteerd
  useEffect(() => {
    if (selectedSeason) {
      fetch(`http://localhost:5110/api/race/races/${selectedSeason}`)
        .then((res) => res.json())
        .then((data) => setRaces(data))
        .catch((err) => console.error("Error fetching races:", err));
    }
  }, [selectedSeason]);

  // Haal racegegevens op wanneer een race wordt geselecteerd
  useEffect(() => {
    if (selectedRace) {
      fetch(`http://localhost:5110/api/race/race/${selectedRace}`)
        .then((res) => res.json())
        .then((data) => {
          setFormData({
            f1_Game: data.f1_Game,
            season: data.season,
            division: data.division,
            round: data.round,
            sprint: data.sprint || "No",
            youtubeLink: data.youtubeLink || "",
            trackName: data.track.name,
            trackCountry: data.track.country,
            trackRaceName: data.track.raceName || "",
      date: data.date ? data.date.split("T")[0] : "",
          });
        })
        .catch((err) => console.error("Error fetching race data:", err));
    }
  }, [selectedRace]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    fetch(`http://localhost:5110/api/race/update/${selectedRace}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formData,
        track: {
          name: formData.trackName,
          country: formData.trackCountry,
          racename: formData.trackRaceName,
        },
      }),
    })
      .then((res) => {
        if (res.ok) {
          alert("Race updated successfully!");
        } else {
          return res.text().then((text) => {
            throw new Error(text);
          });
        }
      })
      .catch((err) => {
        console.error("Error updating race:", err);
        alert("Failed to update the race.");
      });
  };

  return (
    <div className="admin-edit-race">
      <h1>Edit Race</h1>

      {/* Dropdown voor het kiezen van een seizoen */}
      <label>
        Select Season:
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
        >
          <option value="">-- Select Season --</option>
          {seasons.map((season) => (
            <option key={season} value={season}>
              Season {season}
            </option>
          ))}
        </select>
      </label>

      {/* Dropdown voor het kiezen van een race */}
      {selectedSeason && (
        <label>
          Select Race:
          <select
            value={selectedRace}
            onChange={(e) => setSelectedRace(e.target.value)}
          >
            <option value="">-- Select Race --</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                Season: {race.season} - Round: {race.round} - Division:{race.division}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Formulier om de race te bewerken */}
      {selectedRace && (
        <form onSubmit={handleSubmit}>
          <label>
            F1 Game:
            <input
              type="number"
              name="f1_Game"
              value={formData.f1_Game}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Season:
            <input
              type="number"
              name="season"
              value={formData.season}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Division:
            <input
              type="number"
              name="division"
              value={formData.division}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Round:
            <input
              type="number"
              name="round"
              value={formData.round}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Sprint:
            <select
              name="sprint"
              value={formData.sprint}
              onChange={handleInputChange}
              required
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
          <label>
            Race Date:
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
            />
          </label>
          <label>
            YouTube Link:
            <input
              type="text"
              name="youtubeLink"
              value={formData.youtubeLink}
              onChange={handleInputChange}
            />
          </label>
          <h2>Track Details</h2>
          <label>
            Track Name:
            <input
              type="text"
              name="trackName"
              value={formData.trackName}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Track Country:
            <input
              type="text"
              name="trackCountry"
              value={formData.trackCountry}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Track RaceName:
            <input
              type="text"
              name="trackRaceName"
              value={formData.trackRaceName}
              onChange={handleInputChange}
              required
            />
          </label>
          <button type="submit">Save Changes</button>
        </form>
      )}
    </div>
  );
}

export default EditRacePage;
