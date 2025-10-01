import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@/Components/Links.css";

function AddTrackPage() {
  const [track, setTrack] = useState({ name: "", raceName: "", country: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTrack((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("http://localhost:5110/api/race/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track), // includes raceName now
      });

      if (!response.ok) {
        let msg = "Failed to add track. Please try again.";
        try {
          const problem = await response.json();
          if (problem?.title) msg = problem.title;
          if (problem?.errors) {
            const first = Object.values(problem.errors)[0]?.[0];
            if (first) msg = first;
          }
        } catch {}
        throw new Error(msg);
      }

      alert("Track added successfully!");
      setTrack({ name: "", raceName: "", country: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
          name="raceName"
          placeholder="Grand Prix name (e.g., Austrian Grand Prix)"
          value={track.raceName}
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
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting} className="submit-button">
          {submitting ? "Saving..." : "Add Track"}
        </button>
      </form>
    </div>
  );
}

export default AddTrackPage;
