import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/config";
import { getMapCandidates } from "@/trackMap";
import "./TrackAdmin.css";

export const EMPTY_TRACK = { raceName: "", name: "", country: "", countryCode: "", turns: "", length: "" };
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/svg+xml"];
const MAX_BYTES = 5 * 1024 * 1024;

export const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

/** Upload (or remove with file = null) the layout image of a track. Returns { ok, message, layoutUrl }. */
export async function saveLayout(trackId, file) {
  const opts = { method: file ? "POST" : "DELETE", headers: authHeader() };
  if (file) {
    const form = new FormData();
    form.append("file", file);
    opts.body = form;
  }
  const res = await fetch(`${API_BASE}/api/track/${trackId}/layout`, opts).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  return { ok: !!res?.ok, message: body.message || (res ? `HTTP ${res.status}` : "No connection"), layoutUrl: body.layoutUrl ?? null };
}

/** Preview of what the track page will show: uploaded image first, then the built-in images. */
function CurrentLayout({ track, layoutUrl }) {
  const candidates = useMemo(
    () => getMapCandidates({ Country: track.country, Name: track.name, LayoutUrl: layoutUrl }),
    [track.country, track.name, layoutUrl]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [candidates]);
  const src = candidates[idx];
  if (!src) return <div className="ta-layout__empty">No image yet</div>;
  return (
    <figure className="ta-layout__current">
      <img src={src} alt="" onError={() => setIdx((i) => i + 1)} />
      <figcaption className="ta-muted">{layoutUrl && idx === 0 ? "Uploaded image" : "Built-in image (from the website files)"}</figcaption>
    </figure>
  );
}

function LayoutPicker({ track, layoutUrl, file, onFile, onRemove, removing }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [problem, setProblem] = useState("");
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const take = (f) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setProblem("Use a PNG, JPG, WEBP, AVIF or SVG image.");
    if (f.size > MAX_BYTES) return setProblem("The image is larger than 5 MB.");
    setProblem("");
    onFile(f);
  };

  // Paste an image from the clipboard anywhere on the page
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (item) take(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ta-layout">
      <div className="ta-layout__col">
        <span className="ta-label">Now on the track page</span>
        <CurrentLayout track={track} layoutUrl={layoutUrl} />
        {layoutUrl && onRemove ? (
          <button type="button" className="ta-btn ta-btn--small ta-btn--danger" onClick={onRemove} disabled={removing}>
            {removing ? "Removing…" : "Remove uploaded image"}
          </button>
        ) : null}
      </div>
      <div className="ta-layout__col">
        <span className="ta-label">{file ? "New image (saved with the track)" : "Upload a new image"}</span>
        <div
          className={`ta-drop ${drag ? "is-drag" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="New layout" />
          ) : (
            <span>
              <strong>Drop an image here</strong>, click to choose,
              <br />
              or paste with Ctrl+V
              <br />
              <span className="ta-muted">PNG · JPG · WEBP · AVIF · SVG — max 5 MB. A transparent background looks best.</span>
            </span>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT.join(",")} hidden onChange={(e) => take(e.target.files?.[0])} />
        </div>
        {file ? (
          <button type="button" className="ta-btn ta-btn--small" onClick={() => onFile(null)}>
            Don’t use this image
          </button>
        ) : null}
        {problem ? <p className="ta-error">{problem}</p> : null}
      </div>
    </div>
  );
}

/** Track fields + layout image. Used by Add Track and Edit Track. */
export default function TrackForm({ value, onChange, layoutUrl, file, onFile, onRemoveLayout, removing }) {
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    fetch("/flags/1_manifest.json")
      .then((r) => r.json())
      .then((list) => setCountries((list || []).map((f) => f.replace(/\.png$/, ""))))
      .catch(() => {});
  }, []);
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const flagOk = countries.includes(value.country);

  return (
    <div className="ta-form">
      <div className="ta-grid">
        <label className="ta-field ta-field--wide">
          <span className="ta-label">Grand Prix name *</span>
          <input value={value.raceName} onChange={set("raceName")} placeholder="e.g. Austrian Grand Prix" required />
        </label>
        <label className="ta-field">
          <span className="ta-label">Circuit name *</span>
          <input value={value.name} onChange={set("name")} placeholder="e.g. Red Bull Ring" required />
        </label>
        <label className="ta-field">
          <span className="ta-label">Country *</span>
          <span className="ta-country">
            {flagOk ? <img src={`/flags/${value.country}.png`} alt="" /> : null}
            <input list="ta-countries" value={value.country} onChange={set("country")} placeholder="e.g. Austria" required />
          </span>
          <datalist id="ta-countries">
            {countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {value.country && !flagOk ? <span className="ta-hint">No flag with this name — check the spelling (it must match a flag, e.g. “Great Britain”).</span> : null}
        </label>
        <label className="ta-field">
          <span className="ta-label">Country code</span>
          <input value={value.countryCode || ""} onChange={set("countryCode")} placeholder="e.g. AT" maxLength={3} />
        </label>
        <label className="ta-field">
          <span className="ta-label">Turns</span>
          <input type="number" min="0" value={value.turns ?? ""} onChange={set("turns")} placeholder="e.g. 10" />
        </label>
        <label className="ta-field">
          <span className="ta-label">Length (km)</span>
          <input type="number" min="0" step="0.001" value={value.length ?? ""} onChange={set("length")} placeholder="e.g. 4.318" />
        </label>
      </div>

      <h3 className="ta-subtitle">Track layout</h3>
      <LayoutPicker track={value} layoutUrl={layoutUrl} file={file} onFile={onFile} onRemove={onRemoveLayout} removing={removing} />
    </div>
  );
}
