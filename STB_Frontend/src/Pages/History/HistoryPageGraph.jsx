import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./HistoryPage.css";

const API_BASE = "https://stbleague.fly.dev/api/raceresult";
const TOP_N = 15;          // how many drivers to plot
const STEP_W = 70;         // px reserved per round label (controls spacing)

/* ---------- Legend (locked to final-championship order) ---------- */
function CustomLegend({ driversOrdered, colorByDriver }) {
  return (
    <div className="sp-legend">
      {driversOrdered.map((d) => (
        <div key={d.name} className="sp-legend-item">
          <span
            className="sp-legend-swatch"
            style={{ background: colorByDriver[d.name] }}
          />
          {d.name}
        </div>
      ))}
    </div>
  );
}

/* ---------- Tooltip (sorted by points scored in this round) ---------- */
function CustomTooltip({ active, payload, label, chartData, indexByLabel, colorByDriver }) {
  if (!active || !payload || payload.length === 0) return null;

  const idx = indexByLabel[label] ?? -1;
  const prev = idx > 0 ? chartData[idx - 1] : null;
  const cur = idx >= 0 ? chartData[idx] : null;
  if (!cur) return null;

  const rows = payload
    .map((p) => {
      const name = p.name ?? p.dataKey;
      const cum = cur[name] ?? 0;
      const prevCum = prev ? prev[name] ?? 0 : 0;
      return { name, roundPts: cum - prevCum, cum };
    })
    .sort((a, b) => (b.roundPts - a.roundPts) || (b.cum - a.cum));

  return (
    <div className="sp-tooltip">
      <div className="sp-tooltip-title">{label}</div>
      {rows.map((r) => (
        <div key={r.name} className="sp-tooltip-row">
          <span
            className="sp-tooltip-dot"
            style={{ background: colorByDriver[r.name] }}
          />
          <span className="sp-tooltip-name">{r.name}</span>
          <span className="sp-tooltip-val">{r.roundPts}</span>
        </div>
      ))}
      <div className="sp-tooltip-note">(values = points scored this round)</div>
    </div>
  );
}

/* ======================== Page ======================== */
export default function HistoryPage() {
  const [season, setSeason] = useState(28);
  const [division, setDivision] = useState(2);
  const [aggregateByRound, setAggregateByRound] = useState(true);

  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // fetch data
  useEffect(() => {
    const fetchIt = async () => {
      setLoading(true);
      setErr("");
      try {
        const url = `${API_BASE}/seasonprogress/${season}/${division}/race-points?aggregateByRound=${aggregateByRound}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        setSteps(Array.isArray(json) ? json : []);
      } catch (e) {
        setErr(e.message || "Failed to load data");
        setSteps([]);
      } finally {
        setLoading(false);
      }
    };
    fetchIt();
  }, [season, division, aggregateByRound]);

  // build rows, final order, colors, and label->index map
  const { chartData, driversOrdered, colorByDriver, indexByLabel } = useMemo(() => {
    if (!Array.isArray(steps) || steps.length === 0) {
      return { chartData: [], driversOrdered: [], colorByDriver: {}, indexByLabel: {} };
    }

    // gather all drivers
    const allDrivers = new Set();
    steps.forEach(s => (s.standings || []).forEach(st => allDrivers.add(st.driver)));
    const all = Array.from(allDrivers);

    // carry-forward cumulative points
    const lastCum = Object.fromEntries(all.map(d => [d, 0]));

    const rowsAll = steps.map((s, idx) => {
      const label = aggregateByRound ? `R${s.round}` : `R${s.round}${s.sprint ? " (S)" : ""}`;
      const row = { step: idx + 1, label };
      all.forEach(d => (row[d] = lastCum[d] || 0));
      (s.standings || []).forEach(st => {
        lastCum[st.driver] = st.cumulative || 0;
        row[st.driver] = st.cumulative || 0;
      });
      return row;
    });

    // final order (desc), keep TOP_N
    const ordered = Object.entries(lastCum)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, TOP_N)
      .map(([name, cumulative]) => ({ name, cumulative }));

    const selectedNames = ordered.map(d => d.name);

    const prunedRows = rowsAll.map(r => {
      const out = { step: r.step, label: r.label };
      selectedNames.forEach(n => (out[n] = r[n] || 0));
      return out;
    });

    // colors mapped by final order
    const COLORS = [
      "#3366CC","#DC3912","#FF9900","#109618","#990099",
      "#3B3EAC","#0099C6","#DD4477","#66AA00","#B82E2E",
      "#316395","#994499","#22AA99","#AAAA11","#6633CC",
      "#E67300","#8B0707","#329262","#5574A6","#3B3EAC",
    ];
    const colorMap = Object.fromEntries(
      ordered.map((d, i) => [d.name, COLORS[i % COLORS.length]])
    );

    const idxByLabel = Object.fromEntries(prunedRows.map((r, i) => [r.label, i]));

    return {
      chartData: prunedRows,
      driversOrdered: ordered,
      colorByDriver: colorMap,
      indexByLabel: idxByLabel,
    };
  }, [steps, aggregateByRound]);

  /* ----- make the chart width grow with number of rounds ----- */
  const scrollRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    if (!scrollRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, []);
  const chartWidth = Math.max(containerW, Math.max(chartData.length, 1) * STEP_W);

  return (
    <div className="history-page">
      <div className="sp-shell">
        <h1 className="sp-title">Season Progress</h1>

        {/* Controls */}
        <div className="sp-controls">
          <label>
            Season{" "}
            <input
              type="number"
              min={1}
              value={season}
              onChange={(e) => setSeason(parseInt(e.target.value || "0", 10))}
            />
          </label>
          <label>
            Tier{" "}
            <input
              type="number"
              min={1}
              value={division}
              onChange={(e) => setDivision(parseInt(e.target.value || "0", 10))}
            />
          </label>
          <label className="sp-check">
            <input
              type="checkbox"
              checked={aggregateByRound}
              onChange={(e) => setAggregateByRound(e.target.checked)}
            />
            Aggregate sprint + main per round
          </label>
        </div>

        {loading && <div className="sp-msg">Loading…</div>}
        {err && <div className="sp-msg sp-err">Error: {err}</div>}

        {!loading && !err && chartData.length === 0 && (
          <div className="sp-msg">No data for Season {season}, Tier {division}.</div>
        )}

        {!loading && !err && chartData.length > 0 && (
          <div className="sp-card">
            <div className="sp-chart-scroll" ref={scrollRef}>
              <div style={{ width: chartWidth }}>
                <ResponsiveContainer width="100%" height={520}>
                  <LineChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      tick={{ fill: "#eaf2ff", fontSize: 12 }}
                      tickMargin={10}
                      height={38}
                    />
                    <YAxis tick={{ fill: "#eaf2ff" }} domain={[0, "dataMax + 10"]} />
                    <Tooltip
                      content={(props) => (
                        <CustomTooltip
                          {...props}
                          chartData={chartData}
                          indexByLabel={indexByLabel}
                          colorByDriver={colorByDriver}
                        />
                      )}
                    />
                    {driversOrdered.map((d) => (
                      <Line
                        key={d.name}
                        type="monotone"
                        dataKey={d.name}
                        stroke={colorByDriver[d.name]}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      content={() => (
                        <CustomLegend
                          driversOrdered={driversOrdered}
                          colorByDriver={colorByDriver}
                        />
                      )}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
