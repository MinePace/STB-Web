import React, { useCallback, useEffect, useRef, useState } from "react";
import { parseResultsText } from "./screenshotParser";
import "./ScreenshotAssist.css";

// Free OCR that runs in the admin's browser. Loaded on first use only.
// Swap readScreenshot() for an AI call later without touching the rest of the page.
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

let tesseractPromise = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT_URL;
      s.async = true;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => {
        tesseractPromise = null;
        reject(new Error("OCR library could not be loaded (check your connection)."));
      };
      document.head.appendChild(s);
    });
  }
  return tesseractPromise;
}

// Results screens are light text on dark rows: upscale, grayscale and invert
// so Tesseract sees dark text on a light background.
function preprocess(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.width < 2000 ? 2 : 1;
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = g > 140 ? 0 : 255; // bright text -> black, background -> white
        px[i] = px[i + 1] = px[i + 2] = v;
      }
      ctx.putImageData(d, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error("Image could not be read."));
    img.src = url;
  });
}

async function readScreenshot(url, onProgress) {
  const Tesseract = await loadTesseract();
  const canvas = await preprocess(url);
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

/**
 * Props:
 *  - disabled: boolean (no race selected yet)
 *  - seasonDrivers, allDrivers, teams: string[]
 *  - onApply({ rows, fastestLapPosition }): fill the results table
 */
export default function ScreenshotAssist({ disabled, seasonDrivers, allDrivers, teams, onApply }) {
  const [images, setImages] = useState([]); // [{ url, name }]
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [rawText, setRawText] = useState("");
  const fileRef = useRef(null);

  const addFiles = useCallback((files) => {
    const imgs = Array.from(files || [])
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name || "screenshot" }));
    if (!imgs.length) return;
    setImages((prev) => {
      setActive(prev.length);
      return [...prev, ...imgs];
    });
    setStatus("");
  }, []);

  // Ctrl+V of an image anywhere on the page (text pastes are left alone).
  useEffect(() => {
    const onPaste = (e) => {
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile());
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  useEffect(() => () => images.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((_, i) => i !== idx);
      setActive((a) => Math.max(0, Math.min(a, next.length - 1)));
      return next;
    });
  };

  const handleRead = async () => {
    if (!images.length) return;
    setBusy(true);
    setRawText("");
    try {
      let text = "";
      for (let i = 0; i < images.length; i++) {
        setStatus(`Reading screenshot ${i + 1} of ${images.length}…`);
        setProgress(0);
        text += (await readScreenshot(images[i].url, setProgress)) + "\n";
      }
      setRawText(text);
      const result = parseResultsText(text, { seasonDrivers, allDrivers, teams });
      const found = result.rows.filter((r) => r.driver).length;
      if (!result.rows.length) {
        setStatus("No result rows recognised. Fill in by hand, or try a sharper / cropped screenshot.");
      } else {
        onApply(result);
        setStatus(
          `Filled ${result.rows.length} rows (${found} drivers recognised). ` +
            "Yellow cells were filled automatically — check them against the screenshot."
        );
      }
    } catch (err) {
      setStatus(`Reading failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`sa-panel ${disabled ? "sa-disabled" : ""}`}>
      <div className="sa-header">
        <h2>Screenshot</h2>
        <span className="sa-hint">Paste (Ctrl+V), drop or choose a screenshot of the results screen</span>
      </div>

      {images.length === 0 ? (
        <div
          className="sa-drop"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <strong>Drop screenshot here</strong>
          <span>or click to choose a file</span>
        </div>
      ) : (
        <>
          <div className="sa-tabs">
            {images.map((img, i) => (
              <span key={img.url} className={`sa-tab ${i === active ? "is-active" : ""}`}>
                <button type="button" onClick={() => setActive(i)}>Screenshot {i + 1}</button>
                <button type="button" className="sa-x" aria-label="Remove" onClick={() => removeImage(i)}>×</button>
              </span>
            ))}
            <button type="button" className="sa-add" onClick={() => fileRef.current?.click()}>+ Add</button>
            <button type="button" className="sa-add" onClick={() => setZoom((z) => !z)}>
              {zoom ? "Fit" : "Zoom"}
            </button>
          </div>
          <div className={`sa-view ${zoom ? "is-zoom" : ""}`}>
            <img src={images[active]?.url} alt="Race results screenshot" />
          </div>
          <div className="sa-actions">
            <button type="button" className="sa-read" disabled={disabled || busy} onClick={handleRead}>
              {busy ? `Reading… ${progress}%` : "Auto-fill table from screenshot (beta)"}
            </button>
            {disabled && <span className="sa-hint">Select a race first.</span>}
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {status && <p className="sa-status">{status}</p>}
      {rawText && (
        <details className="sa-raw">
          <summary>Recognised text</summary>
          <pre>{rawText}</pre>
        </details>
      )}
    </div>
  );
}
