import React, { useState } from "react";

function AddTrackPage() {
  const [track, setTrack] = useState({ name: "", country: "" });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTrack((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verstuur trackgegevens naar de backend
    const response = await fetch("http://localhost:5110/api/race/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    });

    if (response.ok) {
      alert("Track added successfully!");
      setTrack({ name: "", country: "" }); // Reset het formulier
    } else {
      alert("Failed to add track. Please try again.");
    }
  };

  return (
    <div className="add-track-page">
      <h1>Add Track</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Circuit Name"
          value={track.name}
          onChange={handleInputChange}
          required
        />
        <input
          type="text"
          name="country"
          placeholder="Country"
          value={track.country}
          onChange={handleInputChange}
          required
        />
        <button type="submit">Add Track</button>
      </form>
    </div>
  );
}

export default AddTrackPage;
