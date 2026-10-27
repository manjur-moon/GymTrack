import { requireUser } from "@/server/auth";
import { getProgress } from "@/server/progress";
import { TrainingCalendar, MuscleHeatmap } from "@/components/heatmaps";
export default async function Page() {
  const u = await requireUser();
  const d = await getProgress(u.id);
  return (
    <div className="container stack">
      <p className="eyebrow">Training visualizations</p>
      <h1>Training heatmaps</h1>
      <TrainingCalendar dates={d.calendar} />
      <MuscleHeatmap data={d.muscles} />
    </div>
  );
}
