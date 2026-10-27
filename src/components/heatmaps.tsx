// import type { ReactNode } from "react";
const COLORS = ["#e2e8ee", "#bfe9dc", "#8bd5be", "#3aab93", "#08786c"];
function level(n: number, max: number) {
  if (!n) return 0;
  return Math.max(1, Math.min(4, Math.ceil((n / (max || 1)) * 4)));
}
export function TrainingCalendar({ dates }: { dates: string[] }) {
  const today = new Date();
  const first = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
      364 * 86400000,
  );
  const counts: Record<string, number> = {};
  for (const d of dates) counts[d] = (counts[d] || 0) + 1;
  const pad = first.getUTCDay();
  const days = Array.from({ length: pad + 365 }, (_, i) =>
    i < pad
      ? null
      : new Date(first.getTime() + (i - pad) * 86400000)
          .toISOString()
          .slice(0, 10),
  );
  return (
    <div className="card stack">
      <div className="between">
        <h2>365-day training calendar</h2>
        <span className="badge">{Object.keys(counts).length} active days</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridTemplateRows: "repeat(7,12px)",
            gridAutoColumns: 12,
            gap: 4,
            width: "max-content",
            padding: 5,
          }}
        >
          {days.map((d, i) => (
            <span
              key={i}
              title={d ? `${d}: ${counts[d] ?? 0} workouts` : undefined}
              aria-label={d ? `${d}: ${counts[d] ?? 0} workouts` : undefined}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: d
                  ? COLORS[Math.min(4, counts[d] ?? 0)]
                  : "transparent",
              }}
            />
          ))}
        </div>
      </div>
      <p className="sub">
        Colors represent completed sessions per UTC day · no workout → light
        gray, 4+ → deep teal.
      </p>
    </div>
  );
}
const groups = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "QUADRICEPS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "BICEPS",
  "TRICEPS",
  "CORE",
  "FULL_BODY",
];
function Region({
  name,
  paths,
  data,
  max,
}: {
  name: string;
  paths: string[];
  data: Record<string, number>;
  max: number;
}) {
  const volume = data[name] ?? 0;
  return (
    <g fill={COLORS[level(volume, max)]} stroke="#536477" strokeWidth="1.8">
      <title>
        {name.replaceAll("_", " ")}: {Math.round(volume)} kg-reps
      </title>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}
function Body({
  back,
  data,
  max,
  x,
}: {
  back: boolean;
  data: Record<string, number>;
  max: number;
  x: number;
}) {
  const r = (name: string, paths: string[]) => (
    <Region key={name} name={name} paths={paths} data={data} max={max} />
  );
  return (
    <g transform={`translate(${x} 48)`}>
      <g stroke="#6d849c" strokeWidth="2" fill="#152436">
        <circle cx="110" cy="28" r="19" />
        <path d="M80 72L140 72L151 178L130 211L139 353L113 353L107 221L101 221L95 353L69 353L76 211L65 178Z" />
        <path d="M79 78L57 80L27 210L47 217L81 117Z M141 78L163 80L193 210L173 217L139 117Z" />
      </g>
      {r("SHOULDERS", [
        "M77 78Q60 75 54 95L48 125L67 126L86 96Z",
        "M143 78Q160 75 166 95L172 125L153 126L134 96Z",
      ])}
      {back ? (
        <>
          {r("BACK", [
            "M87 93L108 97L108 175L91 182L78 137Z",
            "M112 97L133 93L142 137L129 182L112 175Z",
          ])}
          {r("TRICEPS", [
            "M52 126L70 122L56 169L41 180Z",
            "M150 122L168 126L179 180L164 169Z",
          ])}
          {r("GLUTES", [
            "M81 184L108 184L108 217L90 233L73 208Z",
            "M112 184L139 184L147 208L130 233L112 217Z",
          ])}
          {r("HAMSTRINGS", [
            "M79 233L96 235L91 284L70 285Z",
            "M124 235L141 233L150 285L129 284Z",
          ])}
        </>
      ) : (
        <>
          {r("CHEST", [
            "M83 91L108 94L108 132Q91 136 76 117Z",
            "M112 94L137 91L144 117Q129 136 112 132Z",
          ])}
          {r("BICEPS", [
            "M52 126L70 122L56 169L41 180Z",
            "M150 122L168 126L179 180L164 169Z",
          ])}
          {r("CORE", [
            "M90 138L108 140L108 184L92 185Z",
            "M112 140L130 138L128 185L112 184Z",
          ])}
          {r("QUADRICEPS", [
            "M79 230L98 233L93 288L68 288Z",
            "M122 233L141 230L152 288L127 288Z",
          ])}
        </>
      )}
      {r("CALVES", [
        "M71 295L93 295L89 346L74 346Z",
        "M127 295L149 295L146 346L131 346Z",
      ])}
    </g>
  );
}
export function MuscleHeatmap({ data }: { data: Record<string, number> }) {
  const max = Math.max(
    0,
    ...groups.map((g) => (g === "FULL_BODY" ? 0 : (data[g] ?? 0))),
  );
  return (
    <div className="card stack">
      <h2>Muscle activity · last 7 days</h2>
      <p className="sub">
        External-load working-set volume by primary muscle. Diagrams are
        simplified and not anatomical assessments.
      </p>
      <div className="grid two">
        <svg
          viewBox="0 0 510 410"
          role="img"
          aria-label="Front and back muscle heatmap colored by recent weight times repetitions"
          style={{ width: "100%" }}
        >
          <text x="130" y="23" fill="#4a6176" textAnchor="middle">
            FRONT
          </text>
          <text x="378" y="23" fill="#4a6176" textAnchor="middle">
            BACK
          </text>
          <Body x={20} data={data} max={max} back={false} />
          <Body x={270} data={data} max={max} back />
        </svg>
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Primary muscle</th>
                <th>Kg-reps</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g}>
                  <td>{g.replaceAll("_", " ")}</td>
                  <td>{Math.round(data[g] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
