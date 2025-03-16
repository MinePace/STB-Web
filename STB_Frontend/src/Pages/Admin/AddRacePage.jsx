import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

function AddRacePage() {
  const [race, setRace] = useState({
    game: "",
    season: "",
    division: "",
    round: "",
    sprint: "",
    trackId: "",
    youtubeLink: "",
  });
  const [tracks, setTracks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
      const role = localStorage.getItem("role");
      if (role !== "Admin") {
        navigate("/"); // Stuur terug naar homepage als geen admin
      }
    }, [navigate]);

  useEffect(() => {
    // Haal beschikbare tracks op
    fetch("http://localhost:5110/api/race/tracks")
      .then((res) => res.json())
      .then((data) => setTracks(data))
      .catch((err) => console.error("Error fetching tracks:", err));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRace((prev) => ({ ...prev, [name]: value }));
  };

  const handleTrackChange = (e) => {
    const trackId = e.target.value;
    setRace((prev) => ({
      ...prev,
      trackId: trackId !== "" ? Number(trackId) : "", // Zorg dat het een nummer is
    }));
  };
  

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Verstuur racegegevens naar de backend
    const response = await fetch("http://localhost:5110/api/race", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(race),
    });
  
    if (response.ok) {
      alert("Race added successfully!");
      
      // Reset alleen de velden die je wilt resetten
      setRace((prev) => ({
        game: prev.game, // Blijft hetzelfde
        season: prev.season, // Blijft hetzelfde
        division: prev.division, // Blijft hetzelfde
        round: parseInt(prev.round, 10) + 1,
        sprint: prev.sprint,
        trackId: "",
        youtubeLink: "",
      }));
    } else {
      alert("Failed to add race. Please try again.");
    }
  };  

  return (
    <div className="add-race-page">
      <h1>Add Race</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="game"
          placeholder="Game"
          value={race.game}
          onChange={handleInputChange}
          required
        />
        <input
          type="number"
          name="season"
          placeholder="Season"
          value={race.season}
          onChange={handleInputChange}
          required
        />
        <input
          type="number"
          name="division"
          placeholder="Division"
          value={race.division}
          onChange={handleInputChange}
          required
        />
        <input
          type="number"
          name="round"
          placeholder="Round"
          value={race.round}
          onChange={handleInputChange}
          required
        />
        <select
          name="sprint"
          value={race.sprint}
          onChange={handleInputChange}
          required
        >
          <option value="">Sprint? (Yes/No)</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <select
          name="trackId"
          onChange={handleTrackChange} // Aangepaste handler voor tracks
          required
        >
          <option value="">Select Track</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name} ({track.country})
            </option>
          ))}
        </select>
        <input
          type="text"
          name="youtubeLink"
          placeholder="YouTube Link (optional)"
          value={race.youtubeLink}
          onChange={handleInputChange}
        />
        <button type="submit">Add Race</button>
      </form>
    </div>
  );
}

export default AddRacePage;
