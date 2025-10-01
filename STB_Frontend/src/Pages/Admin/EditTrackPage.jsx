import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@/Components/Links.css";

function EditTrackPage() {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [editedTrack, setEditedTrack] = useState({
    name: "",
    country: "",
    raceName: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is an admin
    const role = localStorage.getItem("role");
    if (role !== "Admin") {
      navigate("/"); // Redirect non-admins
    }

    // Fetch all tracks
    fetch("http://localhost:5110/api/race/tracks")
      .then((res) => res.json())
      .then((data) => {
        setTracks(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching tracks:", err);
        setError("Failed to load tracks.");
        setLoading(false);
      });
  }, [navigate]);

  // Handle track selection
  const handleSelectTrack = (trackId) => {
    const track = tracks.find((t) => t.id === Number(trackId));
    setSelectedTrack(track);
    setEditedTrack({
      raceName: track?.raceName || "",
      name: track?.name || "",
      country: track?.country || "",
      countryCode: track?.countryCode || "",
      turns: track?.turns || "",
      length: track?.length || ""
    }); // Pre-fill input fields
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedTrack((prev) => ({ ...prev, [name]: value }));
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedTrack) return;

    const updatedTrack = { ...editedTrack, id: selectedTrack.id }; // ensure id is included

    console.log("Saving track:", updatedTrack);

    const response = await fetch(
      `http://localhost:5110/api/track/update/${selectedTrack.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTrack),
      }
    );

    if (response.ok) {
      alert("Track updated successfully!");
      setTracks((prevTracks) =>
        prevTracks.map((t) =>
          t.id === selectedTrack.id ? { ...t, ...updatedTrack } : t
        )
      );
    } else {
      alert("Failed to update track.");
    }
  };

  return (
    <div className="edit-track-container">
      <h1>Edit Track</h1>

      {loading ? (
        <p>Loading tracks...</p>
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          {/* Track Selection Dropdown */}
          <div>
            <label>Select Track: </label>
            <select onChange={(e) => handleSelectTrack(e.target.value)}>
              <option value="">-- Choose a Track --</option>
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.raceName} ({track.name})
                </option>
              ))}
            </select>
          </div>

          {/* Edit Track Form */}
          {selectedTrack && (
            <div className="track-edit-form">
              <h2>Editing: {selectedTrack.raceName}</h2>

              <label>Race Name:</label>
              <input
                type="text"
                name="raceName"
                value={editedTrack.raceName}
                onChange={handleInputChange}
              />

              <label>Track Name:</label>
              <input
                type="text"
                name="name"
                value={editedTrack.name}
                onChange={handleInputChange}
              />

              <label>Country:</label>
              <input
                type="text"
                name="country"
                value={editedTrack.country}
                onChange={handleInputChange}
              />

              <label>Country Code:</label>
              <input
                type="text"
                name="countryCode"
                value={editedTrack.countryCode || ""}
                onChange={handleInputChange}
              />

              <label>Turns:</label>
              <input
                type="text"
                name="turns"
                value={editedTrack.turns || ""}
                onChange={handleInputChange}
              />

              <label>Length:</label>
              <input
                type="text"
                name="length"
                value={editedTrack.length || ""}
                onChange={handleInputChange}
              />

              <button className="submit-button" onClick={handleSave}>
                Save Changes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EditTrackPage;
