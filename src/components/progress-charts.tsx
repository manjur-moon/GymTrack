"use client";

import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type VolumePoint = { date: string; volume: number };
type WeightPoint = { date: string; weightKg: number };
type StrengthPoint = { date: string; value: number | null };

const axisTick = { fill: "#52677c", fontSize: 11 };
const gridStroke = "#e2e8ef";
const tooltipStyle = { borderRadius: 10, border: "1px solid #e0e7ef", color: "#14263d" };
const formatDate = (value: unknown) => String(value).slice(5);

export function ProgressCharts({ volume, weights, strength }: {
  volume: VolumePoint[];
  weights: WeightPoint[];
  strength: StrengthPoint[];
}) {
  return <div className="grid two">
    <section className="card stack" aria-label="Weekly training volume chart">
      <h2>Weekly training volume</h2><p className="sub">External load × repetitions (kg-reps)</p>
      <div style={{ height: 255, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volume} accessibilityLayer>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={axisTick} tickFormatter={formatDate} />
            <YAxis tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="volume" name="Volume (kg-reps)" fill="#0e8074" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="card stack" aria-label="Estimated strength trend chart">
      <h2>Strength trend</h2><p className="sub">Best estimated 1RM from compatible working sets</p>
      <div style={{ height: 255, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={strength} accessibilityLayer>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={axisTick} tickFormatter={formatDate} />
            <YAxis tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line dataKey="value" name="Est. 1RM (kg)" stroke="#1a7096" strokeWidth={3} connectNulls={false} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="card stack" aria-label="Body weight history chart">
      <h2>Body-weight measurements</h2><p className="sub">Logged kilograms over time, not estimates</p>
      <div style={{ height: 255, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weights} accessibilityLayer>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={axisTick} tickFormatter={formatDate} />
            <YAxis tick={axisTick} domain={["auto", "auto"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line dataKey="weightKg" name="Body weight (kg)" stroke="#7e56b5" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  </div>;
}
