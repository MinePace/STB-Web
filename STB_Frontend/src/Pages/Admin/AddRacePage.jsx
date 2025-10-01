import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddRacePage.css";
import "@/Components/Links.css";

function AddRacePage() {
  const navigate = useNavigate();

  // Header (applies to all rounds)
  const [header, setHeader] = useState({
    game: "",
    season: "",
    division: "",
    startDate: "", // optional helper to auto-fill dates
  });

  // Track list
  const [tracks, setTracks] = useState([]);

  // Rounds table
  const [rounds, setRounds] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      round: i + 1,
      trackId: "",
      sprintWeekend: false,
      raceDate: "", // optional
      raceYoutube: "",
      sprintDate: "", // optional (can be same day or earlier)
      sprintYoutube: "",
    }))
  );

  // Basic guard
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  // Load tracks
  useEffect(() => {
    fetch("http://localhost:5110/api/race/tracks")
      .then((r) => r.json())
      .then(setTracks)
      .catch((e) => console.error("Error fetching tracks:", e));
  }, []);

  // Handy lookup for track names
  const trackById = useMemo(
    () =>
      tracks.reduce((map, t) => {
        map[t.id] = t;
        return map;
      }, {}),
    [tracks]
  );

  // Header handlers
  const updateHeader = (e) => {
    const { name, value } = e.target;
    setHeader((h) => ({ ...h, [name]: value }));
  };

  // Round handlers
  const updateRound = (index, field, value) => {
    setRounds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setRoundCount = (count) => {
    const n = Math.max(1, Math.min(30, Number(count) || 1)); // cap it sensibly
    setRounds((prev) => {
      const next = [...prev];
      if (n > prev.length) {
        for (let i = prev.length; i < n; i++) {
          next.push({
            round: i + 1,
            trackId: "",
            sprintWeekend: false,
            raceDate: "",
            raceYoutube: "",
            sprintDate: "",
            sprintYoutube: "",
          });
        }
      } else if (n < prev.length) {
        next.length = n;
      }
      // ensure round numbers are 1..n
      return next.map((r, i) => ({ ...r, round: i + 1 }));
    });
  };

  const autoFillDatesWeekly = () => {
    if (!header.startDate) return;
    const base = new Date(header.startDate);
    setRounds((prev) =>
      prev.map((r, i) => {
        const raceDate = new Date(base);
        raceDate.setDate(base.getDate() + i * 7);
        // For sprints, default to the day before (common format), but editable.
        const sprintDate = new Date(raceDate);
        sprintDate.setDate(raceDate.getDate() - 1);
        return {
          ...r,
          raceDate: raceDate.toISOString().split("T")[0],
          sprintDate: r.sprintWeekend
            ? sprintDate.toISOString().split("T")[0]
            : r.sprintDate,
        };
      })
    );
  };

  const validateHeader = () => {
    if (!header.game || !header.season || !header.division) {
      alert("Please fill Game, Season, and Division.");
      return false;
    }
    return true;
  };

  const validateRounds = () => {
    for (const r of rounds) {
      if (!r.trackId) {
        alert(`Round ${r.round}: select a track.`);
        return false;
      }
    }
    return true;
  };

  const toRaceRequest = ({
    round,
    trackId,
    youtubeLink,
    date,
    sprintFlag,
  }) => ({
    game: String(header.game),
    season: String(header.season),
    division: String(header.division),
    round: Number(round),
    sprint: sprintFlag ? "Yes" : "No", // backend expects "Yes"/"No" like your old page
    trackId: Number(trackId),
    youtubeLink: youtubeLink || "",
    date: date || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateHeader() || !validateRounds()) return;

    // Build all race payloads
    const payloads = [];
    for (const r of rounds) {
      // Main race (always)
      payloads.push(
        toRaceRequest({
          round: r.round,
          trackId: r.trackId,
          youtubeLink: r.raceYoutube,
          date: r.raceDate,
          sprintFlag: false,
        })
      );

      // Sprint race (optional)
      if (r.sprintWeekend) {
        payloads.push(
          toRaceRequest({
            round: r.round,
            trackId: r.trackId,
            youtubeLink: r.sprintYoutube,
            date: r.sprintDate || r.raceDate, // fallback to same day if not set
            sprintFlag: true,
          })
        );
      }
    }

    // Submit sequentially so you get readable errors and avoid flooding the API
    const failures = [];
    for (const p of payloads) {
      try {
        const res = await fetch("http://localhost:5110/api/race", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          failures.push({ payload: p, message: txt || "Request failed" });
        }
      } catch (err) {
        failures.push({ payload: p, message: String(err) });
      }
    }

    if (failures.length === 0) {
      alert("Season added successfully! 🎉");
      // keep header, clear rows but keep count
      setRounds((prev) =>
        prev.map((r, i) => ({
          round: i + 1,
          trackId: "",
          sprintWeekend: false,
          raceDate: "",
          raceYoutube: "",
          sprintDate: "",
          sprintYoutube: "",
        }))
      );
    } else {
      console.error("Some races failed:", failures);
      alert(
        `Season partially added. ${payloads.length - failures.length}/${
          payloads.length
        } succeeded.\nOpen console for details.`
      );
    }
  };

  return (
  <div className="add-season-page">
    <h1>Add Season</h1>

    {/* Header card */}
    <div className="card">
      <div className="header-grid">
        <input
          className="input"
          type="text"
          name="game"
          placeholder="Game"
          value={header.game}
          onChange={updateHeader}
          required
        />
        <input
          className="input"
          type="number"
          name="season"
          placeholder="Season"
          value={header.season}
          onChange={updateHeader}
          required
        />
        <input
          className="input"
          type="number"
          name="division"
          placeholder="Division"
          value={header.division}
          onChange={updateHeader}
          required
        />
        <input
          className="input"
          type="date"
          name="startDate"
          placeholder="Start date (optional)"
          value={header.startDate}
          onChange={updateHeader}
          title="Used for Auto-Fill Dates"
        />
        <div className="inline-row">
          <label htmlFor="roundCount"># Rounds</label>
          <input
            className="input"
            id="roundCount"
            type="number"
            min={1}
            max={30}
            value={rounds.length}
            onChange={(e) => setRoundCount(e.target.value)}
          />
        </div>
        <button type="button" className="button-date" onClick={autoFillDatesWeekly}>
          Auto-fill Weekly Dates
        </button>
      </div>
    </div>

    {/* Rounds table */}
    <form onSubmit={handleSubmit}>
      <div className="table-wrap">
        <table className="season-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Track</th>
              <th>Sprint WKND</th>
              <th>Race Date</th>
              <th>Race YouTube</th>
              <th>Sprint Date</th>
              <th>Sprint YouTube</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, idx) => (
              <tr key={idx}>
                <td>{r.round}</td>
                <td>
                  <select
                    className="cell-select"
                    value={r.trackId}
                    onChange={(e) =>
                      updateRound(idx, "trackId", e.target.value ? Number(e.target.value) : "")
                    }
                    required
                  >
                    <option value="">Select Track</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.country})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.sprintWeekend}
                    onChange={(e) => updateRound(idx, "sprintWeekend", e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={r.raceDate}
                    onChange={(e) => updateRound(idx, "raceDate", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="text"
                    placeholder="https://youtube..."
                    value={r.raceYoutube}
                    onChange={(e) => updateRound(idx, "raceYoutube", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="date"
                    value={r.sprintDate}
                    onChange={(e) => updateRound(idx, "sprintDate", e.target.value)}
                    disabled={!r.sprintWeekend}
                  />
                </td>
                <td>
                  <input
                    className="cell-input"
                    type="text"
                    placeholder="https://youtube..."
                    value={r.sprintYoutube}
                    onChange={(e) => updateRound(idx, "sprintYoutube", e.target.value)}
                    disabled={!r.sprintWeekend}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button type="submit" className="submit-button">Add Season</button>
        <button
          type="button"
          className="button-ghost"
          onClick={() =>
            setRounds((prev) =>
              prev.map((r, i) => ({
                ...r,
                round: i + 1,
                trackId: "",
                sprintWeekend: false,
                raceDate: "",
                raceYoutube: "",
                sprintDate: "",
                sprintYoutube: "",
              }))
            )
          }
        >
          Clear Rounds
        </button>
      </div>
    </form>
  </div>
);

}

const th = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const td = {
  padding: "8px 12px",
  borderBottom: "1px solid #f0f0f0",
};

const tdCenter = { ...td, textAlign: "center" };

export default AddRacePage;
