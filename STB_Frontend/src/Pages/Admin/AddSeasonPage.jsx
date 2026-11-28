import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./AddSeasonPage.css";
import "@/Components/Links.css";
import { API_BASE } from "@/config";

function AddSeasonPage() {
  const navigate = useNavigate();

  const [notice, setNotice] = useState(null); // in-page message instead of browser pop-ups
  const notify = (text, type = "error") => {
    setNotice({ text, type });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [header, setHeader] = useState({
    game: "",
    season: "",
    division: "",
  });
  
  // ---------- Access control ----------
  const token = localStorage.getItem("token");
  
  let role = "user";

  if (token) {
    try {
      const decoded = jwtDecode(token);

      role = decoded.role;
    } catch (e) {
      console.log("JWT decode failed:", e);
    }
  }

  const [importSeason, setImportSeason] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [tracks, setTracks] = useState([]);

  const [rounds, setRounds] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      round: i + 1,
      trackId: "",
      sprintWeekend: false,
      raceDate: "",
      raceYoutube: "",
      sprintDate: "",
      sprintYoutube: "",
    }))
  );

  // NEW — modal state
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateConfig, setDateConfig] = useState({
    startDate: "",
    breakRounds: "",
    breakWeeks: 1,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Geen token? Meteen terug naar home/login
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const role = decoded.role;

      if (role !== "Admin") {
        navigate("/");
      }
    } catch (e) {
      console.log("JWT decode failed:", e);
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/api/track`)
      .then((r) => r.json())
      .then(setTracks)
      .catch((e) => console.error("Error fetching tracks:", e));
  }, []);

  const updateHeader = (e) => {
    const { name, value } = e.target;
    setHeader((h) => ({ ...h, [name]: value }));
  };

  const updateRound = (index, field, value) => {
    setRounds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const setRoundCount = (count) => {
    const n = Math.max(1, Math.min(30, Number(count) || 1));
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
      return next.map((r, i) => ({ ...r, round: i + 1 }));
    });
  };

  // NEW — apply dates with multiple breaks
  const applyAutoFillDates = () => {
    if (!dateConfig.startDate) {
      notify("Select a start date");
      return;
    }

    const breakRounds = dateConfig.breakRounds
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Boolean);

    const breakWeeks = Number(dateConfig.breakWeeks) || 1;

    let currentDate = new Date(dateConfig.startDate);

    setRounds((prev) =>
      prev.map((r, i) => {
        if (i !== 0) {
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 7);

          if (breakRounds.includes(i)) {
            currentDate.setDate(currentDate.getDate() + breakWeeks * 7);
          }
        }

        return {
          ...r,
          raceDate: currentDate.toISOString().split("T")[0],
        };
      })
    );

    setShowDateModal(false);
  };

  // IMPORT TRACKS
  const importRacesFromSeason = async () => {
    if (!importSeason) return notify("Enter a season");

    setIsImporting(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/race/season/${importSeason}`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }

      const races = await res.json();

      if (!Array.isArray(races) || races.length === 0) {
        notify("No races found for this season");
        return;
      }

      // Maak casing veilig: werkt met Round én round, TrackId én trackId, etc.
      const normalizedRaces = races.map((r) => ({
        id: r.Id ?? r.id,
        game: r.Game ?? r.game,
        season: r.Season ?? r.season,
        division: r.Division ?? r.division,
        round: r.Round ?? r.round,
        sprint: r.Sprint ?? r.sprint,
        trackId: r.TrackId ?? r.trackId,
        youtubeLink: r.YoutubeLink ?? r.youtubeLink,
        date: r.Date ?? r.date,
        track: r.Tracks ?? r.Track ?? r.track,
      }));

      const firstDivision = normalizedRaces[0].division;

      const divisionRaces = normalizedRaces.filter(
        (r) => r.division === firstDivision
      );

      const roundsMap = {};

      for (const r of divisionRaces) {
        const roundNr = Number(r.round);

        if (!roundNr) continue;

        if (!roundsMap[roundNr]) {
          roundsMap[roundNr] = {
            trackId: r.trackId ?? "",
            sprintWeekend: false,
          };
        }

        const isSprint =
          r.sprint === true ||
          String(r.sprint).toLowerCase() === "yes" ||
          String(r.sprint).toLowerCase() === "true";

        if (isSprint) {
          roundsMap[roundNr].sprintWeekend = true;
        } else if (r.trackId) {
          roundsMap[roundNr].trackId = r.trackId;
        }
      }

      const roundNumbers = Object.keys(roundsMap).map(Number);
      const maxRound = Math.max(...roundNumbers);

      if (!maxRound || maxRound < 1) {
        notify("No valid rounds found in this season");
        return;
      }

      setRoundCount(maxRound);

      setRounds(
        Array.from({ length: maxRound }, (_, i) => {
          const round = i + 1;
          const data = roundsMap[round] || {};

          return {
            round,
            trackId: data.trackId ?? "",
            sprintWeekend: data.sprintWeekend ?? false,
            raceDate: "",
            raceYoutube: "",
            sprintDate: "",
            sprintYoutube: "",
          };
        })
      );

      notify(`Imported races from season ${importSeason}`, "success");
    } catch (error) {
      console.error("Import failed:", error);
      notify(error.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const validateHeader = () => {
    if (!header.game || !header.season || !header.division) {
      notify("Fill Game, Season, Division");
      return false;
    }
    return true;
  };

  const validateRounds = () => {
    for (const r of rounds) {
      if (!r.trackId) return notify(`Round ${r.round}: select a track.`);
    }
    return true;
  };

  const toRaceRequest = ({ round, trackId, youtubeLink, date, sprintFlag }) => ({
    game: String(header.game),
    season: String(header.season),
    division: String(header.division),
    round: Number(round),
    sprint: sprintFlag ? "Yes" : "No",
    trackId: Number(trackId),
    youtubeLink: youtubeLink || "",
    date: date || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateHeader() || !validateRounds()) return;

    const payloads = [];

    for (const r of rounds) {
      payloads.push({
        Game: String(header.game),
        Season: String(header.season),
        Division: String(header.division),
        Round: Number(r.round),
        Sprint: "No",
        TrackId: Number(r.trackId),
        YoutubeLink: r.raceYoutube || "",
        Date: r.raceDate || null,
      });

      if (r.sprintWeekend) {
        payloads.push({
          Game: String(header.game),
          Season: String(header.season),
          Division: String(header.division),
          Round: Number(r.round),
          Sprint: "Yes",
          TrackId: Number(r.trackId),
          YoutubeLink: r.sprintYoutube || "",
          Date: r.sprintDate || r.raceDate || null,
        });
      }
    }

    for (const p of payloads) {
      const res = await fetch(`${API_BASE}/api/race`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(p),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed payload:", p);
        notify(err.message || "Adding a race failed");
        return;
      }
    }

    notify("Season added!", "success");
  };

  return (
    <div className="add-season-page">
      <header className="ss-hero">
        <span className="eyebrow">Admin · Seasons</span>
        <h1>Add Season</h1>
        <p className="ss-muted">Create the calendar for a new season and division: tracks, dates and stream links per round.</p>
      </header>

      {notice ? (
        <div className={`ss-notice ss-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      <div className="card">
        <div className="header-grid">
          <label className="ss-field"><span>Game (e.g. 25)</span><input className="input" name="game" placeholder="Game" value={header.game} onChange={updateHeader}/></label>
          <label className="ss-field"><span>Season</span><input className="input" name="season" placeholder="Season" value={header.season} onChange={updateHeader}/></label>
          <label className="ss-field"><span>Division</span><input className="input" name="division" placeholder="Division" value={header.division} onChange={updateHeader}/></label>

          <label className="ss-field"><span>Copy tracks from season</span><input className="input" type="number" placeholder="e.g. 31" value={importSeason} onChange={(e)=>setImportSeason(e.target.value)}/></label>
          <button type="button" className="button-date" onClick={importRacesFromSeason}>
            Import Tracks
          </button>

          <label className="ss-field"><span>Number of rounds</span><input className="input" type="number" value={rounds.length} onChange={(e)=>setRoundCount(e.target.value)}/></label>

          <button type="button" className="button-date" onClick={()=>setShowDateModal(true)}>
            Auto-fill Weekly Dates
          </button>
        </div>
      </div>

      {/* MODAL */}
      {showDateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Auto Fill Dates</h3>

            <label>Start date</label>
            <input type="date" className="input"
              value={dateConfig.startDate}
              onChange={(e)=>setDateConfig(c=>({...c,startDate:e.target.value}))}
            />

            <label>Break after rounds (comma separated)</label>
            <input className="input"
              placeholder="5, 10, 15"
              value={dateConfig.breakRounds}
              onChange={(e)=>setDateConfig(c=>({...c,breakRounds:e.target.value}))}
            />

            <label>Weeks per break</label>
            <input type="number" className="input"
              value={dateConfig.breakWeeks}
              onChange={(e)=>setDateConfig(c=>({...c,breakWeeks:e.target.value}))}
            />

            <div className="ss-modal-actions">
              <button className="submit-button" onClick={applyAutoFillDates}>
                Apply
              </button>
              <button className="button-ghost" onClick={()=>setShowDateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <select value={r.trackId} onChange={(e)=>updateRound(idx,"trackId",Number(e.target.value)||"")}>
                      <option value="">Select Track</option>
                      {tracks.map(t=>(
                        <option key={t.Id} value={t.Id}>{t.Country} ({t.Name})</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox"
                      checked={r.sprintWeekend}
                      onChange={(e)=>updateRound(idx,"sprintWeekend",e.target.checked)}
                    />
                  </td>
                  <td>
                    <input type="date"
                      value={r.raceDate}
                      onChange={(e)=>updateRound(idx,"raceDate",e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="text"
                      value={r.raceYoutube}
                      onChange={(e)=>updateRound(idx,"raceYoutube",e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="date"
                      disabled={!r.sprintWeekend}
                      value={r.sprintDate}
                      onChange={(e)=>updateRound(idx,"sprintDate",e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="text"
                      disabled={!r.sprintWeekend}
                      value={r.sprintYoutube}
                      onChange={(e)=>updateRound(idx,"sprintYoutube",e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button type="submit" className="submit-button">Add Season</button>
        </div>
      </form>
    </div>
  );
}

export default AddSeasonPage;
