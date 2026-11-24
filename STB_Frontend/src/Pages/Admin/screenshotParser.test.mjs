// Run with: node --test STB_Frontend/src/Pages/Admin/screenshotParser.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseResultsText, parseTimeTokens, similarity } from "./screenshotParser.js";

const seasonDrivers = ["MinePace", "Speedy_NL", "TurboTim", "JanVanDam", "R0cketRacer", "Lotte F1"];
const allDrivers = [...seasonDrivers, "OldDriver123", "TurboTom"];
const teams = ["Red Bull Racing", "Ferrari", "Mercedes", "McLaren", "Aston Martin", "Williams"];

test("time tokens", () => {
  const t = parseTimeTokens("1 MinePace Red Bull 1 1 1:32.456 50:35.041 25");
  assert.deepEqual(t.map((x) => [x.kind, x.value]), [["lap", "1:32.456"], ["total", "50:35.041"]]);
  assert.equal(parseTimeTokens("+5.592")[0].value, "5.592");
  assert.equal(parseTimeTokens("+2 Laps")[0].value, "2 Laps");
  assert.equal(parseTimeTokens("+1 Lap")[0].value, "1 Lap");
  assert.equal(parseTimeTokens("DNF")[0].kind, "dnf");
});

test("fuzzy names survive OCR mistakes", () => {
  assert.ok(similarity("Mine Pace", "MinePace") > 0.95);
  assert.ok(similarity("R0cketRacer", "RocketRacer") > 0.95);
  assert.ok(similarity("Turb0Tirn", "TurboTim") > 0.7);
});

test("parses a typical results screen", () => {
  const ocr = `
RACE RESULTS
POS DRIVER TEAM GRID STOPS BEST TIME PTS
1 MinePace Red Bull Racing 2 1 1:32.456 50:35.041 25
2 Speedy NL Ferrari 1 1 1:32.101 +5.592 18
3 Turb0Tirn Mercedes 5 2 1:33.010 +10.961 15
4 JanVanDarn McLaren 4 1 1:32.999 +2 Laps 12
5 RocketRacer Williams 3 0 1:35.500 DNF 0
`;
  const { rows, fastestLapPosition, unmatchedLines } = parseResultsText(ocr, { seasonDrivers, allDrivers, teams });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.driver), ["MinePace", "Speedy_NL", "TurboTim", "JanVanDam", "R0cketRacer"]);
  assert.deepEqual(rows.map((r) => r.position), [1, 2, 3, 4, 5]);
  assert.deepEqual(rows.map((r) => r.team), ["Red Bull Racing", "Ferrari", "Mercedes", "McLaren", "Williams"]);
  assert.deepEqual(rows.map((r) => r.grid), [2, 1, 5, 4, 3]);
  assert.deepEqual(rows.map((r) => r.raceTime), ["50:35.041", "5.592", "10.961", "2 Laps", ""]);
  assert.equal(rows[4].dnf, true);
  assert.equal(fastestLapPosition, 2);
  assert.ok(unmatchedLines.some((l) => l.startsWith("RACE RESULTS")));
});

test("missing positions are inferred from order; unknown names left blank", () => {
  const ocr = `MinePace 50:35.041\nXyzzy Qwerty +3.210\nSpeedy_NL +4.000`;
  const { rows } = parseResultsText(ocr, { seasonDrivers, allDrivers, teams });
  assert.deepEqual(rows.map((r) => r.position), [1, 2, 3]);
  assert.deepEqual(rows.map((r) => r.driver), ["MinePace", "", "Speedy_NL"]);
});

test("falls back to all drivers only on a strong match", () => {
  const ocr = `1 OldDriver123 Ferrari 45:00.000\n2 TurboTom Ferrari +1.000`;
  const { rows } = parseResultsText(ocr, { seasonDrivers: ["MinePace"], allDrivers, teams });
  assert.equal(rows[0].driver, "OldDriver123");
  assert.equal(rows[0].driverSource, "all");
  assert.equal(rows[1].driver, "TurboTom");
});

test("same driver twice keeps the best line only", () => {
  const ocr = `1 MinePace 45:00.000\n2 MinePac +1.000`;
  const { rows } = parseResultsText(ocr, { seasonDrivers, allDrivers, teams });
  assert.equal(rows[0].driver, "MinePace");
  assert.equal(rows[1].driver, "");
});
