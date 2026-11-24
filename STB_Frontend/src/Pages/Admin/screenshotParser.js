// Turns OCR text from an F1 game results screen into result rows.
// Pure functions, no browser APIs, so this file can be unit-tested with Node.

// Common OCR mix-ups, applied to both sides before comparing names.
const OCR_FOLD = { 0: "o", 1: "l", i: "l", 5: "s", 8: "b", 3: "e", 4: "a", 7: "t", "|": "l" };

export function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9|]/g, "")
    .split("")
    .map((c) => OCR_FOLD[c] ?? c)
    .join("");
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

// ---------- Times ----------

// Order matters: longest/most specific patterns first.
const TIME_RE =
  /(\+?\s?\d+\s?laps?\b)|(\b(?:dnf|dsq|dns|ret)\b)|(\d{1,2}:\d{2}:\d{2}[.,]\d{3})|(\d{1,2}:\d{2}[.,]\d{3})|(\+?\d{1,3}[.,]\d{3})/gi;

export function parseTimeTokens(line) {
  const out = [];
  let m;
  TIME_RE.lastIndex = 0;
  while ((m = TIME_RE.exec(line))) {
    const raw = m[0];
    const at = m.index;
    if (m[1]) {
      const n = parseInt(raw.replace(/\D/g, ""), 10);
      out.push({ kind: "laps", value: `${n} ${n === 1 ? "Lap" : "Laps"}`, raw, at });
    } else if (m[2]) {
      out.push({ kind: "dnf", value: raw.toUpperCase(), raw, at });
    } else if (m[3]) {
      out.push({ kind: "total", value: raw.replace(",", "."), raw, at });
    } else if (m[4]) {
      const v = raw.replace(",", ".");
      const minutes = parseInt(v.split(":")[0], 10);
      // Lap times are under 3 minutes; race times are longer.
      out.push({ kind: minutes < 3 ? "lap" : "total", value: v, seconds: toSeconds(v), raw, at });
    } else if (m[5]) {
      out.push({ kind: "gap", value: raw.replace("+", "").replace(",", ".").trim(), raw, at });
    }
  }
  return out;
}

export function toSeconds(t) {
  const parts = String(t).split(":").map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

// ---------- Names ----------

// Best match of any candidate against windows of 1-3 consecutive words in the line.
function bestCandidateInLine(words, candidates) {
  let best = null;
  for (const cand of candidates) {
    const target = normalizeName(cand);
    if (target.length < 2) continue;
    for (let i = 0; i < words.length; i++) {
      for (let len = 1; len <= 3 && i + len <= words.length; len++) {
        const chunk = words.slice(i, i + len).join("");
        const score = similarity(chunk, cand);
        if (!best || score > best.score) best = { name: cand, score, start: i, end: i + len };
      }
    }
  }
  return best;
}

// ---------- Main ----------

/**
 * @param {string} text        Raw OCR text (one result row per line, roughly)
 * @param {object} opts
 * @param {string[]} opts.seasonDrivers  Drivers in this season/division (preferred)
 * @param {string[]} opts.allDrivers     Every known driver (fallback, stricter)
 * @param {string[]} opts.teams          Team names
 * @returns {{rows: object[], fastestLapPosition: number|null, unmatchedLines: string[]}}
 */
export function parseResultsText(text, { seasonDrivers = [], allDrivers = [], teams = [] } = {}) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/[“”"']/g, "").trim())
    .filter((l) => l.length > 3);

  const parsed = [];
  const unmatchedLines = [];

  for (const line of lines) {
    const times = parseTimeTokens(line);
    // Strip times so their digits aren't read as position/grid.
    let rest = line;
    for (const t of [...times].sort((a, b) => b.at - a.at)) {
      rest = rest.slice(0, t.at) + " ".repeat(t.raw.length) + rest.slice(t.at + t.raw.length);
    }

    const posMatch = rest.match(/^\D{0,3}?(\d{1,2})(?:st|nd|rd|th|\.)?\b/i);
    const position = posMatch ? parseInt(posMatch[1], 10) : null;
    const afterPos = posMatch ? rest.slice(posMatch[0].length) : rest;

    const words = afterPos.split(/\s+/).filter((w) => /[a-z]/i.test(w));
    let match = bestCandidateInLine(words, seasonDrivers);
    let source = "season";
    if (!match || match.score < 0.6) {
      const alt = bestCandidateInLine(words, allDrivers);
      if (alt && alt.score >= 0.8 && (!match || alt.score > match.score)) {
        match = alt;
        source = "all";
      }
    }
    const driverOk = match && (source === "season" ? match.score >= 0.6 : match.score >= 0.8);

    // Need at least a driver or a time to treat this as a result row.
    if (!driverOk && times.length === 0) {
      unmatchedLines.push(line);
      continue;
    }

    // Team: best fuzzy match in the words that are not part of the driver name.
    let team = null;
    if (teams.length) {
      const teamWords = driverOk ? [...words.slice(0, match.start), ...words.slice(match.end)] : words;
      const t = bestCandidateInLine(teamWords, teams);
      if (t && t.score >= 0.7) team = t.name;
    }

    // Grid: first small integer after the name, followed by a pit-stop count (0-6).
    let grid = null;
    const ints = afterPos.match(/\b\d{1,2}\b/g)?.map(Number) || [];
    if (ints.length >= 2 && ints[0] >= 1 && ints[0] <= 22 && ints[1] <= 6) grid = ints[0];

    const lap = times.find((t) => t.kind === "lap");
    const finish = times.find((t) => t.kind !== "lap");

    parsed.push({
      position,
      driver: driverOk ? match.name : "",
      driverScore: match ? Math.round(match.score * 100) / 100 : 0,
      driverSource: driverOk ? source : null,
      team,
      grid,
      bestLap: lap ? lap.value : null,
      bestLapSeconds: lap ? lap.seconds : null,
      raceTime: finish && finish.kind !== "dnf" ? finish.value : "",
      dnf: finish?.kind === "dnf",
      raw: line,
    });
  }

  // Fill missing positions from reading order, then keep the best row per position.
  let next = 1;
  for (const r of parsed) {
    if (!r.position || r.position > 22 || r.position < next) r.position = next;
    next = r.position + 1;
  }

  // A driver can only appear once: keep their best-scoring line.
  const byDriver = new Map();
  for (const r of parsed) {
    if (!r.driver) continue;
    const prev = byDriver.get(r.driver);
    if (!prev || r.driverScore > prev.driverScore) byDriver.set(r.driver, r);
  }
  for (const r of parsed) {
    if (r.driver && byDriver.get(r.driver) !== r) {
      r.driver = "";
      r.driverSource = null;
    }
  }

  const rows = [];
  const seen = new Set();
  for (const r of parsed) {
    if (seen.has(r.position)) continue;
    seen.add(r.position);
    rows.push(r);
  }
  rows.sort((a, b) => a.position - b.position);

  const withLap = rows.filter((r) => r.bestLapSeconds);
  const fastest = withLap.length >= Math.max(2, rows.length / 2)
    ? withLap.reduce((a, b) => (b.bestLapSeconds < a.bestLapSeconds ? b : a))
    : null;

  return { rows, fastestLapPosition: fastest ? fastest.position : null, unmatchedLines };
}
