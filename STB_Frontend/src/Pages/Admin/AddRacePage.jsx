import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AddRacePage() {
  const [race, setRace] = useState({
    game: "",
    season: "",
    division: "",
    round: "",
    sprint: "",
    trackId: "",
    youtubeLink: "",
    date: "", // 👈 Add date field to state
  });
  const [tracks, setTracks] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") {
      navigate("/"); // Redirect non-admins
    }
  }, [navigate]);

  useEffect(() => {
    // Fetch available tracks
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
      trackId: trackId !== "" ? Number(trackId) : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...race,
      date: race.date ? race.date : null, // Send date or null
    };

    const response = await fetch("http://localhost:5110/api/race", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      alert("Race added successfully!");
      // Reset fields except persistent ones
      setRace((prev) => {
        // If there's already a date, add 7 days to it
        const nextDate = prev.date
          ? new Date(prev.date) // parse existing date
          : new Date();         // or use today if no date yet

        nextDate.setDate(nextDate.getDate() + 7); // add 7 days

        // Format as YYYY-MM-DD for input value
        const formattedNextDate = nextDate.toISOString().split("T")[0];

        return {
          game: prev.game,
          season: prev.season,
          division: prev.division,
          round: parseInt(prev.round, 10) + 1,
          sprint: prev.sprint,
          trackId: "",
          youtubeLink: "",
          date: formattedNextDate, // 👈 set next date
        };
      });
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
          onChange={handleTrackChange}
          value={race.trackId}
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
        {/* 👇 Date Picker */}
        {/* <input
          type="date"
          name="date"
          placeholder="Race Date"
          value={race.date}
          onChange={handleInputChange}
        /> */}
        <button type="submit">Add Race</button>
      </form>
    </div>
  );
}

export default AddRacePage;
