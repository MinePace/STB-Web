import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "@/Components/Links.css";
import { API_BASE } from "@/config";
import TrackForm, { EMPTY_TRACK, authHeader, saveLayout } from "./TrackForm";

const fromRow = (r) => ({
  id: r.Id,
  raceName: r.RaceName || "",
  name: r.Name || "",
  country: r.Country || "",
  countryCode: r.CountryCode || "",
  turns: r.Turns ?? "",
  length: r.Length ?? "",
  layoutUrl: r.LayoutUrl || null,
});
const FIELDS = ["raceName", "name", "country", "countryCode", "turns", "length"];

export default function EditTrackPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get("track")) || null;

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_TRACK);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    try {
      if (jwtDecode(localStorage.getItem("token") || "").role !== "Admin") navigate("/");
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const load = () =>
    fetch(`${API_BASE}/api/track`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setTracks((Array.isArray(rows) ? rows : []).map(fromRow)))
      .catch(() => setNotice({ type: "error", text: "Could not load the tracks." }))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  const selected = tracks.find((t) => t.id === selectedId) || null;
  useEffect(() => {
    setForm(selected ? { ...selected } : EMPTY_TRACK);
    setFile(null);
    // only when another track is chosen or the list reloads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tracks]);

  const changed = selected ? FIELDS.some((f) => String(form[f] ?? "") !== String(selected[f] ?? "")) : false;
  const dirty = changed || !!file;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tracks]
      .sort((a, b) => a.raceName.localeCompare(b.raceName))
      .filter((t) => !q || `${t.raceName} ${t.name} ${t.country}`.toLowerCase().includes(q));
  }, [tracks, query]);

  const choose = (id) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setNotice(null);
    setParams(id ? { track: String(id) } : {});
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    const done = [];
    try {
      if (changed) {
        const res = await fetch(`${API_BASE}/api/track/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() },
          body: JSON.stringify(form),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
        done.push("details saved");
      }
      if (file) {
        const up = await saveLayout(selected.id, file);
        if (!up.ok) throw new Error(`${done.length ? "Details were saved, but the image was not: " : ""}${up.message}`);
        done.push("layout image saved");
      }
      await load();
      setNotice({ type: "success", text: `${selected.raceName}: ${done.join(" and ")}.` });
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const removeLayout = async () => {
    if (!selected || !window.confirm("Remove the uploaded image? The track page falls back to the built-in image, if there is one.")) return;
    setRemoving(true);
    const res = await saveLayout(selected.id, null);
    setRemoving(false);
    if (!res.ok) return setNotice({ type: "error", text: res.message });
    await load();
    setNotice({ type: "success", text: res.message });
  };

  return (
    <div className="ta-page">
      <header className="ta-hero">
        <span className="eyebrow">Admin · Tracks</span>
        <h1>Edit Track</h1>
        <p className="ta-muted">Change a circuit’s details and its layout image (shown on the track page).</p>
      </header>

      {notice ? (
        <div className={`ta-notice ta-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      <div className="ta-split">
        <aside className="ta-card ta-list">
          <input type="search" placeholder="Search track or country…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {loading ? <p className="ta-muted">Loading…</p> : null}
          <ul>
            {shown.map((t) => (
              <li key={t.id}>
                <button type="button" className={t.id === selectedId ? "is-active" : ""} onClick={() => choose(t.id)}>
                  <img src={`/flags/${t.country}.png`} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <span>
                    <strong>{t.raceName}</strong>
                    <small className="ta-muted">
                      {t.name}
                      {t.layoutUrl ? " · 🖼" : ""}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/STB/Add/Track" className="ta-btn ta-btn--small">
            + Add track
          </Link>
        </aside>

        <section className="ta-card">
          {selected ? (
            <>
              <div className="ta-card__head">
                <h2>{selected.raceName}</h2>
                <Link to={`/STB/Track/${selected.id}`} className="ta-muted ta-link">
                  View track page ↗
                </Link>
              </div>
              <TrackForm
                value={form}
                onChange={setForm}
                layoutUrl={selected.layoutUrl}
                file={file}
                onFile={setFile}
                onRemoveLayout={removeLayout}
                removing={removing}
              />
              <div className="ta-actions ta-actions--end">
                {dirty ? (
                  <button
                    type="button"
                    className="ta-btn"
                    onClick={() => {
                      setForm({ ...selected });
                      setFile(null);
                    }}
                  >
                    Undo
                  </button>
                ) : null}
                <button type="button" className="ta-btn ta-btn--primary" onClick={save} disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          ) : (
            <p className="ta-muted">Choose a track on the left.</p>
          )}
        </section>
      </div>
    </div>
  );
}
