// Run with: node --test STB_Frontend/src/Pages/Admin/screenshotParser.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResultsText, mergeResults, parseTimeTokens, similarity } from "./screenshotParser.js";

// Real names from the database (Teams table has a few duplicates with trailing spaces).
const allDrivers = [
  "AliStar711", "CGT Trolly", "CruKren89", "CSR Bullet", "DRT Davidgame", "DRT Salvador", "DRT Soren",
  "F1X JTeofilo", "Focaccia", "FRT Trolly", "IRT Salvador118", "IRT Villen", "Jrepo11", "KragoF1",
  "Matex", "PuR NyGraal", "RPR Rooster", "SKY AlexTer", "Toman", "Tomcox2002", "Speedy_NL",
];
const teams = [
  "Alfa Romeo", "Alfa Romeo ", "Alpha Tauri", "Alpine", "Aston Martin", "Ferrari", "Force India", "Haas",
  "KICK", "Manor", "McLaren", "Mercedes", "Racing Bulls", "Racing Point", "RB", "Red Bull", "Renault",
  "Sauber", "Toro Rosso", "Williams", "Williams ",
];
const opts = { seasonDrivers: allDrivers.slice(0, 18), allDrivers, teams };

// What OCR roughly makes of the two "Britain Sprint" screenshots: flags/icons become junk tokens.
const SHOT_1 = `
POS. DRIVER TEAM GRID STOPS BEST TIME PTS.
1 = & ® Jrepo11 | Haas 2 0 1:30.090 15:45.845 8
2 = 7 ® IRT VILLEN | Red Bull 1 0 1:30.372 +0.796 7
3 4 ® AliStar711 | Ferrari 5 0 1:29.878 +0.891 6
4 Bi % ® SKY AlexTer | Mercedes-AMG Petronas 11 0 1:30.594 +5.360 5
5 = ® RPR Rooster AlphaTauri 7 0 1:31.186 +5.810 4
6 | @ ® PuRa Matex | Aston Martin 16 1 1:30.474 +5.963 3
7 = 7 ® IRT Salvador118 | McLaren 17 0 1:30.941 +6.571 2
8 Bi © ® CSR Bullet | Williams Racing 18 1 1:30.537 +7.004 1
9 | S ® PuR NyGraal | Alpine 12 1 1:29.989 +14.971 0
10 ~ 7 ® IRTDavidgame | Mercedes-AMG Petronas 14 0 1:31.574 +15.510 0
11 & ® Smk Toman | Aston Martin 13 1 1:30.851 +15.589 0
12 = 7 ® IRT Soren | Ferrari 15 1 1:31.664 +15.595 0
13 Y ® Tomcox2002 | Alfa Romeo ORLEN 8 1 1:31.199 +19.323 0
14 ~ T ® F1X JTeofilo | Alpine 10 0 1:30.638 +19.801 0
`;
const SHOT_2 = `
POS. DRIVER TEAM GRID STOPS BEST TIME PTS.
5 = ® RPR Rooster AlphaTauri 7 0 1:31.186 +5.810 4
6 | @ ® PuRa Matex | Aston Martin 16 1 1:30.474 +5.963 3
7 = 7 ® IRT Salvador118 | McLaren 17 0 1:30.941 +6.571 2
8 Bi © ® CSR Bullet | Williams Racing 18 1 1:30.537 +7.004 1
9 | S ® PuR NyGraal | Alpine 12 1 1:29.989 +14.971 0
10 ~ 7 ® IRTDavidgame | Mercedes-AMG Petronas 14 0 1:31.574 +15.510 0
11 & ® Smk Toman | Aston Martin 13 1 1:30.851 +15.589 0
12 = 7 ® IRT Soren | Ferrari 15 1 1:31.664 +15.595 0
13 ® Tomcox2002 Alfa Romeo ORLEN 8 1 1:31.199 +19.323 0
14 ~ T ® F1X JTeofilo | Alpine 10 0 1:30.638 +19.801 0
15 ae ® ETE TROLLY | Haas 6 1 1:31.358 DNF 0
16 ae ® CruKreN89 | McLaren 3 1 1:31.479 DNF 0
17 | ® RCX FOCACCIA | Williams Racing 4 1 1:30.864 DNF 0
18 ~ ® KragoF1 | Red Bull 9 0 1:30.913 DNF 0
`;

test("time tokens", () => {
  const t = parseTimeTokens("1 MinePace Red Bull 1 1 1:32.456 50:35.041 25");
  assert.deepEqual(t.map((x) => [x.kind, x.value]), [["lap", "1:32.456"], ["total", "50:35.041"]]);
  assert.equal(parseTimeTokens("+5.592")[0].value, "5.592");
  assert.equal(parseTimeTokens("+2 Laps")[0].value, "2 Laps");
  assert.equal(parseTimeTokens("DNF")[0].kind, "dnf");
});

test("fuzzy names survive OCR mistakes", () => {
  assert.ok(similarity("Mine Pace", "MinePace") > 0.95);
  assert.ok(similarity("R0cketRacer", "RocketRacer") > 0.95);
});

test("Britain sprint: two screenshots merged into 18 rows", () => {
  const merged = mergeResults([parseResultsText(SHOT_1, opts), parseResultsText(SHOT_2, opts)]);
  const { rows } = merged;
  assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.deepEqual(rows.map((r) => r.driver), [
    "Jrepo11", "IRT Villen", "AliStar711", "SKY AlexTer", "RPR Rooster", "Matex", "IRT Salvador118",
    "CSR Bullet", "PuR NyGraal", "DRT Davidgame", "Toman", "DRT Soren", "Tomcox2002", "F1X JTeofilo",
    "ETE TROLLY", "CruKren89", "Focaccia", "KragoF1",
  ]);
  // Every driver found in the database except ETE TROLLY (database has CGT/FRT Trolly -> not certain).
  assert.deepEqual(rows.filter((r) => !r.driverFound).map((r) => r.driver), ["ETE TROLLY"]);
  assert.deepEqual(rows.map((r) => r.team), [
    "Haas", "Red Bull", "Ferrari", "Mercedes", "Alpha Tauri", "Aston Martin", "McLaren", "Williams",
    "Alpine", "Mercedes", "Aston Martin", "Ferrari", "Alfa Romeo", "Alpine", "Haas", "McLaren", "Williams",
    "Red Bull",
  ]);
  assert.ok(rows.every((r) => r.teamFound));
  assert.deepEqual(rows.map((r) => r.grid), [2, 1, 5, 11, 7, 16, 17, 18, 12, 14, 13, 15, 8, 10, 6, 3, 4, 9]);
  assert.deepEqual(rows.slice(0, 4).map((r) => r.raceTime), ["15:45.845", "0.796", "0.891", "5.360"]);
  assert.deepEqual(rows.slice(14).map((r) => r.dnf), [true, true, true, true]);
  assert.equal(merged.fastestLapPosition, 3); // AliStar711 1:29.878
});

test("driver not in database: text from the screenshot is kept", () => {
  const { rows } = parseResultsText("1 ® Newbie_Racer99 | Ferrari 3 0 1:31.000 40:00.000 25", opts);
  assert.equal(rows[0].driver, "Newbie_Racer99");
  assert.equal(rows[0].driverFound, false);
  assert.equal(rows[0].team, "Ferrari");
  assert.equal(rows[0].teamFound, true);
});

test("team not in database: text from the screenshot is kept", () => {
  const { rows } = parseResultsText("1 ® Jrepo11 | Cadillac Formula 3 0 1:31.000 40:00.000 25", opts);
  assert.equal(rows[0].driver, "Jrepo11");
  assert.equal(rows[0].team, "Cadillac Formula");
  assert.equal(rows[0].teamFound, false);
});

test("missing positions are inferred from order", () => {
  const { rows } = parseResultsText(`Jrepo11 Haas 50:35.041\nToman Ferrari +4.000`, opts);
  assert.deepEqual(rows.map((r) => [r.position, r.driver]), [[1, "Jrepo11"], [2, "Toman"]]);
});

// ---------- Real OCR output (tesseract 5, same settings as the website) ----------
import { readFileSync } from "node:fs";
import { parseResultsOcr, parseTimeCell, parseLapCell } from "./screenshotParser.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.ocr.json`, import.meta.url)));

test("cell parsers handle OCR damage", () => {
  assert.equal(parseTimeCell("+5810").value, "5.810");
  assert.equal(parseTimeCell("+0.796").value, "0.796");
  assert.equal(parseTimeCell("15:45.845").value, "15:45.845");
  assert.equal(parseTimeCell("ONF").dnf, true);
  assert.equal(parseTimeCell("DNF").dnf, true);
  assert.equal(parseLapCell("1:30.537."), "1:30.537");
  assert.equal(parseLapCell("130.638"), "1:30.638");
});

test("real screenshots of Britain sprint: 18 rows, right order and data", () => {
  const merged = mergeResults([
    parseResultsOcr(fixture("britain-sprint-1"), opts),
    parseResultsOcr(fixture("britain-sprint-2"), opts),
  ]);
  const { rows } = merged;
  assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.deepEqual(rows.map((r) => r.driver), [
    "Jrepo11", "IRT Villen", "AliStar711", "SKY AlexTer", "RPR Rooster", "Matex", "IRT Salvador118",
    "CSR Bullet", "PuR NyGraal", "DRT Davidgame", "Toman", "DRT Soren", "Tomcox2002", "F1X JTeofilo",
    rows[14].driver, "CruKren89", "Focaccia", "KragoF1",
  ]);
  assert.equal(rows[14].driverFound, false); // ETE TROLLY: database has CGT Trolly and FRT Trolly
  assert.match(rows[14].driver, /TROLLY/);
  assert.deepEqual(rows.map((r) => r.team), [
    "Haas", "Red Bull", "Ferrari", "Mercedes", "Alpha Tauri", "Aston Martin", "McLaren", "Williams",
    "Alpine", "Mercedes", "Aston Martin", "Ferrari", "Alfa Romeo", "Alpine", "Haas", "McLaren", "Williams",
    "Red Bull",
  ]);
  assert.deepEqual(rows.map((r) => r.grid), [2, 1, 5, 11, 7, 16, 17, 18, 12, 14, 13, 15, 8, 10, 6, 3, 4, 9]);
  assert.deepEqual(rows.map((r) => r.raceTime), [
    "15:45.845", "0.796", "0.891", "5.360", "5.810", "5.963", "6.571", "7.004", "14.971", "15.510",
    "15.589", "15.595", "19.323", "19.801", "", "", "", "",
  ]);
  assert.deepEqual(rows.map((r) => r.dnf), [...Array(14).fill(false), true, true, true, true]);
  assert.equal(merged.fastestLapPosition, 3); // AliStar711 1:29.878
});
