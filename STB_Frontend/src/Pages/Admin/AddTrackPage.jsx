import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "@/Components/Links.css";
import { API_BASE } from "@/config";
import TrackForm, { EMPTY_TRACK, authHeader, saveLayout } from "./TrackForm";

export default function AddTrackPage() {
  const navigate = useNavigate();
  const [track, setTrack] = useState(EMPTY_TRACK);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [added, setAdded] = useState(null); // { id, name, layoutProblem }

  useEffect(() => {
    try {
      if (jwtDecode(localStorage.getItem("token") || "").role !== "Admin") navigate("/");
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(track),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
      const id = body.track?.Id;
      let layoutProblem = null;
      if (file && id) {
        const up = await saveLayout(id, file);
        if (!up.ok) layoutProblem = up.message;
      }
      setAdded({ id, name: body.track?.RaceName || track.raceName, layoutProblem });
      setTrack(EMPTY_TRACK);
      setFile(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setNotice({ type: "error", text: `The track was not added: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ta-page">
      <header className="ta-hero">
        <span className="eyebrow">Admin · Tracks</span>
        <h1>Add Track</h1>
        <p className="ta-muted">A new circuit for the calendar. The layout image is shown on the track page.</p>
      </header>

      {added ? (
        <div className="ta-card ta-done">
          <div>
            <strong>✓ {added.name} added</strong>
            {added.layoutProblem ? <p className="ta-error">The layout image was not saved: {added.layoutProblem}. Add it in Edit Track.</p> : null}
          </div>
          <div className="ta-actions">
            {added.id ? (
              <>
                <Link to={`/STB/Track/${added.id}`} className="ta-btn">
                  View track page
                </Link>
                <Link to={`/STB/Edit/Tracks?track=${added.id}`} className="ta-btn">
                  Edit
                </Link>
              </>
            ) : null}
            <button type="button" className="ta-btn" onClick={() => setAdded(null)}>
              Add another
            </button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={`ta-notice ta-notice--${notice.type}`} role="alert">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      {!added ? (
        <form className="ta-card" onSubmit={submit}>
          <TrackForm value={track} onChange={setTrack} layoutUrl={null} file={file} onFile={setFile} />
          <div className="ta-actions ta-actions--end">
            <Link to="/admin" className="ta-btn">
              Cancel
            </Link>
            <button type="submit" className="ta-btn ta-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Add track"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
