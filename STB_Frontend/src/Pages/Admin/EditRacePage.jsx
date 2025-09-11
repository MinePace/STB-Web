import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import "./EditRacePage.css";

function EditRacePage() {
  const navigate = useNavigate();

  // Seasons & races
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState("");

  // Race form (no track fields here anymore)
  const [formData, setFormData] = useState({
    f1_Game: "",
    season: "",
    division: "",
    round: "",
    sprint: "No",
    youtubeLink: "",
    date: "",
  });

  // Tracks list + chosen track
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState("");

  // Auth guard
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // Load seasons on mount
  useEffect(() => {
    fetch(`http://localhost:5110/api/race/seasons`)
      .then((res) => res.json())
      .then(setSeasons)
      .catch((err) => console.error("Error fetching seasons:", err));
  }, []);

  // Load races when season picked
  useEffect(() => {
    if (!selectedSeason) return;
    fetch(`http://localhost:5110/api/race/races/${selectedSeason}`)
      .then((res) => res.json())
      .then(setRaces)
      .catch((err) => console.error("Error fetching races:", err));
  }, [selectedSeason]);

  // Load tracks list once
  useEffect(() => {
    let abort = false;
    setTracksLoading(true);
    setTracksError(null);

    (async () => {
      try {
        // 🔧 put your correct endpoint here (the one you said is right)
        const res = await fetch("http://localhost:5110/api/track");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        console.log("[tracks] raw response:", json); // 👀 inspect in DevTools

        // Normalize: accept several common shapes
        let arr = [];
        if (Array.isArray(json)) arr = json;
        else if (Array.isArray(json?.data)) arr = json.data;
        else if (Array.isArray(json?.tracks)) arr = json.tracks;
        else {
          // fallback: first array-like property in the object
          const firstArray = Object.values(json).find(Array.isArray);
          if (firstArray) arr = firstArray;
        }

        if (!Array.isArray(arr)) {
          throw new Error("Response did not contain a track list array.");
        }

        if (!abort) setTracks(arr);
      } catch (e) {
        if (!abort) setTracksError(e.message || "Failed to load tracks");
      } finally {
        if (!abort) setTracksLoading(false);
      }
    })();

    return () => { abort = true; };
  }, []);

  // Load a race’s data when picked
  useEffect(() => {
    if (!selectedRace) return;

    fetch(`http://localhost:5110/api/race/race/${selectedRace}`)
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          f1_Game: data.race.f1_Game,
          season: data.race.season,
          division: data.race.division,
          round: data.race.round,
          sprint: data.race.sprint || "No",
          youtubeLink: data.race.youtubeLink || "",
          date: data.race.date ? data.race.date.split("T")[0] : "",
        });

        // Preselect the current track
        const tid = data?.race?.track?.id ?? data?.race?.trackId ?? "";
        setSelectedTrackId(String(tid));
      })
      .catch((err) => console.error("Error fetching race data:", err));
  }, [selectedRace]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRace) return;
    if (!selectedTrackId) {
      alert("Please select a track.");
      return;
    }

    try {
      // 1) Find the chosen track in the list
      let chosen = tracks.find(t => String(t.id) === String(selectedTrackId));

      // 2) If your track list is minimal, fetch full details
      //    (uncomment if needed)
      if (!chosen || chosen.length == null || chosen.turns == null || chosen.raceName == null) {
        const tr = await fetch(`http://localhost:5110/api/track/${selectedTrackId}`);
        if (!tr.ok) throw new Error(`Failed to load full track (${tr.status})`);
        chosen = await tr.json();
      }

      // 3) Build the exact Track payload your API expects
      const { id, name, raceName, country, length, turns } = chosen;
      const payload = {
        ...formData,
        // IMPORTANT: do NOT also send trackId when API expects the full object
        track: { id, name, raceName, country, length, turns },
      };
      console.log("Submitting payload:", payload);
      if (!payload.date) payload.date = null; // handle empty date

      // 4) Update
      const res = await fetch(`http://localhost:5110/api/race/update/${selectedRace}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      alert("Race updated successfully!");
    } catch (err) {
      console.error("Error updating race:", err);
      alert("Failed to update the race.");
    }
  };

  // Derived preview of selected track
  const selectedTrack = useMemo(
    () => tracks.find((t) => String(t.id) === String(selectedTrackId)),
    [tracks, selectedTrackId]
  );

  return (
    <div className="admin-edit-race">
      <h1>Edit Race</h1>

      {/* Season selector */}
      <label>
        Select Season:
        <select
          value={selectedSeason}
          onChange={(e) => {
            setSelectedSeason(e.target.value);
            setSelectedRace("");
          }}
        >
          <option value="">-- Select Season --</option>
          {seasons.map((season) => (
            <option key={season} value={season}>
              Season {season}
            </option>
          ))}
        </select>
      </label>

      {/* Race selector */}
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
                Season {race.season} · Round {race.round} · Tier {race.division}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Form (no track text inputs) */}
      {selectedRace && (
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-grid">
            <div className="admin-col">
              <label>
                F1 Game:
                <input type="number" name="f1_Game" value={formData.f1_Game} onChange={handleInputChange} required />
              </label>
              <label>
                Season:
                <input type="number" name="season" value={formData.season} onChange={handleInputChange} required />
              </label>
              <label>
                Division:
                <input type="number" name="division" value={formData.division} onChange={handleInputChange} required />
              </label>
              <label>
                Round:
                <input type="number" name="round" value={formData.round} onChange={handleInputChange} required />
              </label>
              <label>
                Sprint:
                <select name="sprint" value={formData.sprint} onChange={handleInputChange} required>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
              <label>
                Race Date:
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} />
              </label>
              <label>
                YouTube Link:
                <input type="text" name="youtubeLink" value={formData.youtubeLink} onChange={handleInputChange} />
              </label>
            </div>

            {/* Track selector & preview */}
            <div className="admin-col">
              <div className="track-select">
                <div className="track-select-header">Track</div>
                {tracksLoading ? (
                  <div className="muted">Loading tracks…</div>
                ) : tracksError ? (
                  <div className="error">Failed to load tracks</div>
                ) : (
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Track --</option>
                    {tracks
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.raceName} · {t.country}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div className="track-preview">
                <div className="track-preview-title">Track Preview</div>
                {selectedTrack ? (
                  <div className="track-preview-body">
                    <div className="row">
                      <span>Name</span>
                      <strong>{selectedTrack.name}</strong>
                    </div>
                    <div className="row">
                      <span>Race</span>
                      <strong>{selectedTrack.raceName || "—"}</strong>
                    </div>
                    <div className="row">
                      <span>Country</span>
                      <strong>{selectedTrack.country}</strong>
                    </div>
                    <div className="row">
                      <span>Length</span>
                      <strong>{selectedTrack.length != null ? `${Number(selectedTrack.length).toFixed(3)} km` : "—"}</strong>
                    </div>
                    <div className="row">
                      <span>Turns</span>
                      <strong>{selectedTrack.turns ?? "—"}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="muted">No track selected</div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" className="primary" disabled={!selectedTrackId}>
            Save Changes
          </button>
        </form>
      )}
    </div>
  );
}

export default EditRacePage;
