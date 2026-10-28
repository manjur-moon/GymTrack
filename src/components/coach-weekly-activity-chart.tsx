"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CoachWeeklyActivity } from "@/types/coach-analytics";

type Props = {
  activity: CoachWeeklyActivity[];
};

const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

const fullDateLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parseUTCDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function CoachWeeklyActivityChart({ activity }: Props) {
  const data = activity.map((day) => ({
    date: day.date,
    weekday: dayLabel.format(parseUTCDate(day.date)),
    fullDate: fullDateLabel.format(parseUTCDate(day.date)),
    completed: day.completedSessions,
    notCompleted: Math.max(
      0,
      day.scheduledSessions - day.completedSessions,
    ),
    scheduled: day.scheduledSessions,
  }));

  const totalScheduled = data.reduce(
    (sum, day) => sum + day.scheduled,
    0,
  );
  const totalCompleted = data.reduce(
    (sum, day) => sum + day.completed,
    0,
  );

  if (totalScheduled === 0) {
    return (
      <div className="empty-state">
        <h3>No scheduled workouts in this period</h3>
        <p className="muted">
          Seven-day activity will appear here when your approved clients
          have scheduled workouts in active assignments.
        </p>
      </div>
    );
  }

  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <div
        aria-label="Completed and not completed coached workouts for the last seven UTC calendar days"
        style={{ width: "100%", minWidth: 0, height: 270 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            accessibilityLayer
            barCategoryGap="28%"
            margin={{ top: 8, right: 10, left: -14, bottom: 2 }}
          >
            <CartesianGrid
              stroke="var(--line)"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="weekday"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              width={34}
            />
            <Tooltip
              labelFormatter={(label) => {
                const item = data.find(
                  (day) => day.weekday === String(label),
                );
                return item?.fullDate ?? String(label);
              }}
              contentStyle={{
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
              labelStyle={{ color: "var(--text)", fontWeight: 700 }}
              itemStyle={{ color: "var(--text)" }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
            <Bar
              dataKey="completed"
              name="Completed"
              stackId="scheduled"
              fill="var(--accent)"
              maxBarSize={34}
              isAnimationActive={false}
            />
            <Bar
              dataKey="notCompleted"
              name="Not completed"
              stackId="scheduled"
              fill="var(--accent-soft)"
              stroke="var(--line-strong)"
              maxBarSize={34}
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sub" style={{ marginTop: 10 }}>
        {totalCompleted} of {totalScheduled} scheduled sessions completed in
        this seven-day window. Dates are grouped by scheduled day (UTC).
      </figcaption>

      <details style={{ marginTop: 14 }}>
        <summary className="text-link" style={{ cursor: "pointer" }}>
          View exact daily totals
        </summary>
        <div className="r2-table-scroll" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Scheduled</th>
                <th scope="col">Completed</th>
                <th scope="col">Not completed</th>
              </tr>
            </thead>
            <tbody>
              {data.map((day) => (
                <tr key={day.date}>
                  <td>{day.fullDate}</td>
                  <td>{day.scheduled}</td>
                  <td>{day.completed}</td>
                  <td>{day.notCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
