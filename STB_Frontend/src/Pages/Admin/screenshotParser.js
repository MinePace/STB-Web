// Turns OCR text from an F1 game results screen into result rows.
// Pure functions, no browser APIs, so this file can be unit-tested with Node.
//
// Expected row layout (F1 game, online lobby):
//   POS  [flag] [clan icon] [platform icon] DRIVER  | TEAM  GRID STOPS BEST TIME PTS

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

function normSimilarity(na, nb) {
  if (!na || !nb) return 0;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

export function similarity(a, b) {
  return normSimilarity(normalizeName(a), normalizeName(b));
}

// ---------- Times ----------

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
  return String(t).split(":").map(Number).reduce((acc, p) => acc * 60 + p, 0);
}

// ---------- Candidate matching ----------

// Driver names often carry a clan tag that changes between seasons ("IRT Soren" / "DRT Soren").
// Each driver is matched on the full name and, slightly penalised, on the name without the tag.
function prepareDrivers(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const forms = [{ n: normalizeName(name), factor: 1 }];
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2 && parts[0].length <= 4) {
      const core = normalizeName(parts.slice(1).join(""));
      if (core.length >= 4) forms.push({ n: core, factor: 0.92 });
    }
    out.push({ name, forms: forms.filter((f) => f.n.length >= 2) });
  }
  return out;
}

// Game team names are longer than the league's ("Mercedes-AMG Petronas" -> "Mercedes"),
// so a team also matches when its name is contained in the text.
function prepareTeams(names) {
  const byTrim = new Map();
  for (const name of names) {
    if (!name) continue;
    const key = String(name).trim();
    // Prefer the spelling without stray spaces when the DB has both.
    if (!byTrim.has(key) || name === key) byTrim.set(key, name);
  }
  return [...byTrim.values()].map((name) => ({ name, forms: [{ n: normalizeName(name), factor: 1 }], contain: true }));
}

function scoreChunk(chunkNorm, cand) {
  let best = 0;
  for (const f of cand.forms) {
    let s = normSimilarity(chunkNorm, f.n) * f.factor;
    if (cand.contain && f.n.length >= 4 && chunkNorm.includes(f.n)) s = Math.max(s, 0.9 + f.n.length / 1000);
    if (s > best) best = s;
  }
  return best;
}

// Best candidate against windows of 1-3 consecutive words in [from, to).
// If a different candidate scores (almost) as well, the match is ambiguous and is not trusted.
function bestMatch(words, cands, from = 0, to = words.length) {
  const bestPerName = new Map();
  for (let i = from; i < to; i++) {
    for (let len = 1; len <= 3 && i + len <= to; len++) {
      const chunk = normalizeName(words.slice(i, i + len).join(""));
      if (chunk.length < 2) continue;
      for (const cand of cands) {
        const score = scoreChunk(chunk, cand);
        const prev = bestPerName.get(cand.name);
        if (!prev || score > prev.score) bestPerName.set(cand.name, { name: cand.name, score, start: i, end: i + len });
      }
    }
  }
  const ranked = [...bestPerName.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const [best, second] = ranked;
  if (second && best.score - second.score < 0.03 && best.score < 0.999) return { ...best, score: 0, ambiguous: true };
  return best;
}

// OCR turns flags and icons into short junk tokens ("&", "®", "S", "7").
function cleanWords(text) {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9_\-.]+$/g, ""))
    .filter((w) => w.length >= 2 && /[a-z]/i.test(w));
}

// For a driver that is not in the database: the name sits between the platform icon
// (read as a lone symbol like "®" or "@") and the team colour bar (read as "|").
function rawDriverWords(textPart) {
  const tokens = textPart.split(/\s+/).filter(Boolean);
  const isSymbol = (t) => /^[^A-Za-z0-9]{1,2}$/.test(t);
  let end = tokens.length;
  const firstWord = tokens.findIndex((t) => /[a-z]/i.test(t) && t.length >= 2);
  const bar = tokens.findIndex((t, i) => i > firstWord && firstWord >= 0 && /^[|\[\]!]$/.test(t));
  if (bar > 0) end = bar;
  let start = 0;
  for (let i = 0; i < end; i++) if (isSymbol(tokens[i]) && tokens.slice(i + 1, end).some((t) => /[a-z]/i.test(t))) start = i + 1;
  return cleanWords(tokens.slice(start, end).join(" "));
}

const HEADER_RE = /\b(pos|driver|team|grid|stops|best|pts)\b/gi;

// ---------- Main ----------

/**
 * @param {string} text  Raw OCR text of ONE screenshot (one result row per line, roughly)
 * @param {object} opts
 * @param {string[]} opts.seasonDrivers  Drivers in this season/division (preferred)
 * @param {string[]} opts.allDrivers     Every known driver (fallback, stricter)
 * @param {string[]} opts.teams          Team names from the database
 * @returns {{rows: object[], fastestLapPosition: number|null, unmatchedLines: string[]}}
 *
 * Each row: { position, driver, driverFound, driverScore, team, teamFound, grid,
 *             bestLap, bestLapSeconds, raceTime, dnf, raw }
 * driver/team hold the database name when found, otherwise the text read from the screenshot.
 */
export function parseResultsText(text, opts = {}) {
  const seasonCands = prepareDrivers(opts.seasonDrivers || []);
  const allCands = prepareDrivers(opts.allDrivers || []);
  const teamCands = prepareTeams(opts.teams || []);

  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/[“”"']/g, "").trim())
    .filter((l) => l.length > 3);

  const parsed = [];
  const unmatchedLines = [];

  for (const line of lines) {
    if ((line.match(HEADER_RE) || []).length >= 3) {
      unmatchedLines.push(line);
      continue;
    }

    const times = parseTimeTokens(line);
    // Blank out times so their digits aren't read as position/grid.
    let rest = line;
    for (const t of [...times].sort((a, b) => b.at - a.at)) {
      rest = rest.slice(0, t.at) + " ".repeat(t.raw.length) + rest.slice(t.at + t.raw.length);
    }

    const posMatch = rest.match(/^\D{0,3}?(\d{1,2})(?:st|nd|rd|th|\.)?(?=\s|$)/i);
    const position = posMatch ? parseInt(posMatch[1], 10) : null;
    const afterPos = posMatch ? rest.slice(posMatch[0].length) : rest;

    // Numbers after the last word: GRID STOPS ... PTS
    const lastAlpha = afterPos.search(/[A-Za-z][^A-Za-z]*$/);
    const tailInts = (lastAlpha >= 0 ? afterPos.slice(lastAlpha + 1) : afterPos).match(/\b\d{1,2}\b/g)?.map(Number) || [];
    const textPart = lastAlpha >= 0 ? afterPos.slice(0, lastAlpha + 1) : "";
    const words = cleanWords(textPart);

    if (!words.length && times.length === 0) {
      unmatchedLines.push(line);
      continue;
    }

    // --- Driver ---
    let dm = bestMatch(words, seasonCands);
    let driverFound = !!dm && dm.score >= 0.6;
    if (!driverFound) {
      const alt = bestMatch(words, allCands);
      if (alt && alt.score >= 0.8) {
        dm = alt;
        driverFound = true;
      }
    }

    // --- Team: after the driver if we know where the driver is ---
    const teamFrom = driverFound ? dm.end : 0;
    const tm = bestMatch(words, teamCands, teamFrom);
    const teamFound = !!tm && tm.score >= 0.75;

    // --- Raw text where nothing was found ---
    let driver = driverFound ? dm.name : "";
    let team = teamFound ? tm.name : "";
    if (!driverFound) {
      let dw = rawDriverWords(textPart);
      if (teamFound) {
        // Cut off the team name if it ended up in the driver text.
        const teamNorm = normalizeName(tm.name);
        const cut = dw.findIndex((w, i) => normalizeName(dw.slice(i).join("")).startsWith(teamNorm.slice(0, 4)));
        if (cut > 0) dw = dw.slice(0, cut);
      }
      driver = dw.join(" ");
    }
    if (!teamFound && driverFound) {
      team = words.slice(dm.end).join(" ");
    }

    if (!driver && times.length === 0) {
      unmatchedLines.push(line);
      continue;
    }

    let grid = null;
    if (tailInts.length >= 2 && tailInts[0] >= 1 && tailInts[0] <= 22 && tailInts[1] <= 6) grid = tailInts[0];

    const lap = times.find((t) => t.kind === "lap");
    const finish = times.find((t) => t.kind !== "lap");

    parsed.push({
      position,
      driver,
      driverFound,
      driverScore: dm ? Math.round(dm.score * 100) / 100 : 0,
      team,
      teamFound,
      grid,
      bestLap: lap ? lap.value : null,
      bestLapSeconds: lap ? lap.seconds : null,
      raceTime: finish && finish.kind !== "dnf" ? finish.value : "",
      dnf: finish?.kind === "dnf",
      raw: line,
    });
  }

  // Positions read from the screen are trusted; missing ones follow reading order.
  let next = 1;
  for (const r of parsed) {
    if (!r.position || r.position > 22) r.position = next;
    next = r.position + 1;
  }

  return finalize(parsed, unmatchedLines);
}

function rowQuality(r) {
  return (r.driverFound ? 2 : r.driver ? 1 : 0) + r.driverScore + (r.teamFound ? 0.5 : 0) + (r.raceTime || r.dnf ? 0.5 : 0);
}

function finalize(parsed, unmatchedLines) {
  // One row per position: keep the best reading.
  const byPos = new Map();
  for (const r of parsed) {
    const prev = byPos.get(r.position);
    if (!prev || rowQuality(r) > rowQuality(prev)) byPos.set(r.position, r);
  }
  const rows = [...byPos.values()].sort((a, b) => a.position - b.position);

  // A database driver can only appear once: keep the best-scoring row, demote the others.
  const best = new Map();
  for (const r of rows) {
    if (!r.driverFound) continue;
    const prev = best.get(r.driver);
    if (!prev || r.driverScore > prev.driverScore) best.set(r.driver, r);
  }
  for (const r of rows) {
    if (r.driverFound && best.get(r.driver) !== r) {
      r.driverFound = false;
      r.driver = "";
    }
  }

  const withLap = rows.filter((r) => r.bestLapSeconds);
  const fastest =
    withLap.length >= Math.max(2, rows.length / 2)
      ? withLap.reduce((a, b) => (b.bestLapSeconds < a.bestLapSeconds ? b : a))
      : null;

  return { rows, fastestLapPosition: fastest ? fastest.position : null, unmatchedLines };
}

/** Combine the results of several screenshots of the same race (overlapping positions are fine). */
export function mergeResults(results) {
  const all = results.flatMap((r) => r.rows.map((row) => ({ ...row })));
  const unmatched = results.flatMap((r) => r.unmatchedLines);
  return finalize(all, unmatched);
}

// =====================================================================
// Column mode: uses word positions from the OCR and the header row
// (POS DRIVER TEAM GRID STOPS BEST TIME PTS) to know which column a word is in.
// Much more reliable than guessing from a line of text.
// =====================================================================

const HEADER_KEYS = [
  ["pos", /^p[o0]s/i],
  ["driver", /^driv/i],
  ["team", /^te[a4]m/i],
  ["grid", /^gr[i1l]d/i],
  ["stops", /^st[o0]p/i],
  ["best", /^b[e3]st/i],
  ["time", /^t[i1l]me/i],
  ["pts", /^pts/i],
];

function findHeader(lines) {
  for (let i = 0; i < lines.length; i++) {
    const cols = [];
    for (const w of lines[i].words || []) {
      const hit = HEADER_KEYS.find(([key, re]) => re.test(w.text) && !cols.some((c) => c.key === key));
      if (hit) cols.push({ key: hit[0], x: w.bbox.x0 });
    }
    const keys = cols.map((c) => c.key);
    if (cols.length >= 4 && keys.includes("driver") && (keys.includes("time") || keys.includes("best"))) {
      return { index: i, cols: cols.sort((a, b) => a.x - b.x) };
    }
  }
  return null;
}

// Letters OCR reads instead of digits in number columns.
const DIGIT_FOLD = { O: 0, o: 0, Q: 0, D: 0, U: 0, S: 5, s: 5, l: 1, I: 1, i: 1, "|": 1, "!": 1, L: 1, B: 8, Z: 2, z: 2, g: 9, q: 9, G: 6, b: 6, T: 7 };
export function digitize(s) {
  return String(s || "")
    .split("")
    .map((c) => (c in DIGIT_FOLD ? String(DIGIT_FOLD[c]) : c))
    .join("")
    .replace(/\D/g, "");
}

function intFrom(cell, min, max) {
  for (const t of cell) {
    const d = digitize(t);
    if (!d) continue;
    const n = parseInt(d, 10);
    return n >= min && n <= max ? n : null;
  }
  return null;
}

// "1:30.537." -> lap; "130.638" (colon lost) -> 1:30.638
export function parseLapCell(text) {
  const t = String(text || "").replace(/\s+/g, "");
  let m = t.match(/(\d):(\d{2})[.,](\d{3})/);
  if (m) return `${m[1]}:${m[2]}.${m[3]}`;
  m = t.match(/([12])(\d{2})[.,](\d{3})/);
  if (m && Number(m[2]) < 60) return `${m[1]}:${m[2]}.${m[3]}`;
  return null;
}

// Race time column: leader total, "+gap", "+n Laps" or DNF.
export function parseTimeCell(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/\b[DO0Q][NM][FE]\b|\bDNF|\bDSQ\b|\bDNS\b|\bRET\b/i.test(t)) return { dnf: true, value: "" };
  let m = t.match(/\+?\s?(\d+)\s?laps?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return { dnf: false, value: `${n} ${n === 1 ? "Lap" : "Laps"}` };
  }
  m = t.match(/(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})/);
  if (m) return { dnf: false, value: `${m[1]}:${m[2]}:${m[3]}.${m[4]}` };
  m = t.match(/(\d{1,2}):(\d{2})[.,](\d{3})/);
  if (m) return { dnf: false, value: `${parseInt(m[1], 10)}:${m[2]}.${m[3]}` };
  m = t.match(/\+?\s?(\d{1,3})[.,](\d{3})/);
  if (m) return { dnf: false, value: `${parseInt(m[1], 10)}.${m[2]}` };
  m = t.match(/\+\s?(\d{4,6})\b/); // "+5810": the dot got lost
  if (m) return { dnf: false, value: `${parseInt(m[1].slice(0, -3), 10)}.${m[1].slice(-3)}` };
  return null;
}

// The platform icon (Xbox/PlayStation) is read as "@", "(N", "(Q)" etc. right before the name.
const ICON_RE = /[@©®()[\]{}%]/;
function driverFromCell(tokens) {
  let start = -1;
  for (let i = 0; i < tokens.length; i++) if (ICON_RE.test(tokens[i])) start = i;
  let name;
  if (start >= 0) {
    const first = tokens[start].replace(/^.*[@©®()[\]{}%]+/, "");
    name = [first, ...tokens.slice(start + 1)];
  } else {
    // No icon found: drop short junk from flags/clan logos at the front.
    name = [...tokens];
    while (name.length > 1 && (name[0].length <= 3 || !/[a-z]/i.test(name[0]))) name.shift();
  }
  return cleanWords(name.join(" "));
}

/**
 * @param {{text: string, lines?: {words: {text: string, bbox: {x0:number}}[]}[], width?: number}} ocr
 *        Output of tesseract.js recognize() (data). Falls back to text mode without a header row.
 */
export function parseResultsOcr(ocr, opts = {}) {
  const lines = ocr?.lines || [];
  const header = findHeader(lines);
  if (!header) return parseResultsText(ocr?.text || "", opts);

  const seasonCands = prepareDrivers(opts.seasonDrivers || []);
  const allCands = prepareDrivers(opts.allDrivers || []);
  const teamCands = prepareTeams(opts.teams || []);

  const width = ocr.width || Math.max(...lines.flatMap((l) => l.words.map((w) => w.bbox.x1 || w.bbox.x0)), 1000);
  const margin = width * 0.01;
  const starts = header.cols.map((c) => ({ key: c.key, start: c.x - margin }));

  const parsed = [];
  const unmatchedLines = lines.slice(0, header.index + 1).map((l) => l.text);

  for (const line of lines.slice(header.index + 1)) {
    const cell = {};
    for (const w of line.words) {
      let key = null;
      for (const s of starts) if (w.bbox.x0 >= s.start) key = s.key;
      if (!key) key = starts[0].key;
      (cell[key] ||= []).push(w.text);
    }
    const join = (k) => (cell[k] || []).join(" ");

    const time = parseTimeCell(join("time"));
    const bestLap = parseLapCell(join("best"));
    if (!time && !bestLap) {
      unmatchedLines.push(line.text);
      continue;
    }

    // --- Driver ---
    const words = cleanWords(join("driver"));
    const nameWords = driverFromCell(cell.driver || []);
    let dm = bestMatch(words, seasonCands);
    let driverFound = !!dm && dm.score >= 0.6;
    if (!driverFound) {
      const alt = bestMatch(words, allCands);
      if (alt && alt.score >= 0.8) {
        dm = alt;
        driverFound = true;
      }
    }

    // --- Team ---
    const teamWords = cleanWords(join("team"));
    const tm = bestMatch(teamWords, teamCands);
    const teamFound = !!tm && tm.score >= 0.75;

    parsed.push({
      position: intFrom(cell.pos || [], 1, 22),
      driver: driverFound ? dm.name : nameWords.join(" "),
      driverFound,
      driverScore: dm ? Math.round(dm.score * 100) / 100 : 0,
      team: teamFound ? tm.name : teamWords.join(" "),
      teamFound,
      grid: intFrom(cell.grid || [], 1, 22),
      bestLap,
      bestLapSeconds: bestLap ? toSeconds(bestLap) : null,
      raceTime: time && !time.dnf ? time.value : "",
      dnf: !!time?.dnf,
      raw: line.text,
    });
  }

  // Repair positions: they must count up by one; fill misreads from the neighbours.
  for (let i = 0; i < parsed.length; i++) {
    const prev = parsed[i - 1]?.position;
    const p = parsed[i].position;
    if (prev && (!p || p <= prev || p > prev + 3)) parsed[i].position = prev + 1;
  }
  for (let i = parsed.length - 2; i >= 0; i--) {
    const next = parsed[i + 1].position;
    if (!parsed[i].position && next) parsed[i].position = next - 1;
  }
  let n = 1;
  for (const r of parsed) {
    if (!r.position || r.position < 1) r.position = n;
    n = r.position + 1;
  }

  return finalize(parsed, unmatchedLines);
}
