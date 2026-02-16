import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddSeasonPage.css";
import "@/Components/Links.css";

function AddSeasonPage() {
  const navigate = useNavigate();

  const [header, setHeader] = useState({
    game: "",
    season: "",
    division: "",
  });

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
    const role = localStorage.getItem("role");
    if (role !== "Admin") navigate("/");
  }, [navigate]);

  useEffect(() => {
    fetch("https://stbleague.onrender.com/api/race/tracks")
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
      alert("Select a start date");
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
    if (!importSeason) return alert("Enter a season");

    setIsImporting(true);

    try {
      const res = await fetch(
        `https://stbleague.onrender.com/api/race/races/${importSeason}`
      );
      const races = await res.json();

      const firstDivision = races[0].division;
      const divisionRaces = races.filter(r => r.division === firstDivision);

      const roundsMap = {};

      for (const r of divisionRaces) {
        const roundNr = Number(r.round);

        if (!roundsMap[roundNr]) {
          roundsMap[roundNr] = {
            trackId: r.trackId ?? "",
            sprintWeekend: false,
          };
        }

        const isSprint =
          r.sprint === true ||
          String(r.sprint).toLowerCase() === "yes";

        if (isSprint) roundsMap[roundNr].sprintWeekend = true;
        else if (r.trackId) roundsMap[roundNr].trackId = r.trackId;
      }

      const maxRound = Math.max(...Object.keys(roundsMap).map(Number));
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

      alert(`Imported from season ${importSeason}`);
    } catch {
      alert("Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const validateHeader = () => {
    if (!header.game || !header.season || !header.division) {
      alert("Fill Game, Season, Division");
      return false;
    }
    return true;
  };

  const validateRounds = () => {
    for (const r of rounds) {
      if (!r.trackId) return alert(`Round ${r.round}: select a track.`);
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
      payloads.push(toRaceRequest({
        round: r.round,
        trackId: r.trackId,
        youtubeLink: r.raceYoutube,
        date: r.raceDate,
        sprintFlag: false,
      }));

      if (r.sprintWeekend) {
        payloads.push(toRaceRequest({
          round: r.round,
          trackId: r.trackId,
          youtubeLink: r.sprintYoutube,
          date: r.sprintDate || r.raceDate,
          sprintFlag: true,
        }));
      }
    }

    for (const p of payloads) {
      await fetch("https://stbleague.onrender.com/api/race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
    }

    alert("Season added!");
  };

  return (
    <div className="add-season-page">
      <h1>Add Season</h1>

      <div className="card">
        <div className="header-grid">
          <input className="input" name="game" placeholder="Game" value={header.game} onChange={updateHeader}/>
          <input className="input" name="season" placeholder="Season" value={header.season} onChange={updateHeader}/>
          <input className="input" name="division" placeholder="Division" value={header.division} onChange={updateHeader}/>

          <input className="input" type="number" placeholder="Import season" value={importSeason} onChange={(e)=>setImportSeason(e.target.value)}/>
          <button type="button" className="button-date" onClick={importRacesFromSeason}>
            Import Tracks
          </button>

          <div className="inline-row">
            <label># Rounds</label>
            <input className="input" type="number" value={rounds.length} onChange={(e)=>setRoundCount(e.target.value)}/>
          </div>

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

            <div style={{marginTop:15,display:"flex",gap:10}}>
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
                        <option key={t.id} value={t.id}>{t.country} ({t.name})</option>
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
