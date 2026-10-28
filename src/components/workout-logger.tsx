"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  CloudUpload,
  Dumbbell,
  RotateCcw,
  WifiOff,
} from "lucide-react";

import { logSetSchema, type LoggedSet } from "@/lib/workouts";
import {
  queueSet,
  listQueued,
  syncQueue,
  discardConflict,
  type QueuedSet,
} from "@/lib/offline-queue";
import { NaturalLog } from "@/components/natural-log";

export type ExerciseItem = {
  id: string;
  exerciseId: string;
  name: string;
  trackingType: string;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  restSeconds: number;
  suggestion?: string;
};

type Props = {
  userId: string;
  sessionId: string;
  dayName: string;
  exercises: ExerciseItem[];
  initialSets: LoggedSet[];
  previousSets: LoggedSet[];
};

type InputFields = {
  reps: string;
  weightKg: string;
  durationSeconds: string;
  distanceMeters: string;
};

function formatSeconds(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(
    value % 60,
  ).padStart(2, "0")}`;
}

function setDescription(set: LoggedSet) {
  const quantity =
    set.reps !== undefined
      ? `${set.reps} reps`
      : set.durationSeconds !== undefined
        ? `${set.durationSeconds} sec`
        : set.distanceMeters !== undefined
          ? `${set.distanceMeters} m`
          : "Recorded set";

  return `${quantity}${set.weightKg !== undefined ? ` · ${set.weightKg} kg` : ""}`;
}

export function WorkoutLogger({
  userId,
  sessionId,
  dayName,
  exercises,
  initialSets,
  previousSets,
}: Props) {
  const router = useRouter();
  const syncInFlight = useRef(false);
  const [logs, setLogs] = useState<LoggedSet[]>(initialSets);
  const [queued, setQueued] = useState<QueuedSet[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [tick, setTick] = useState(0);
  const [online, setOnline] = useState(true);

  const [fields, setFields] = useState<Record<string, InputFields>>(() =>
    Object.fromEntries(
      exercises.map((exercise) => {
        const past = previousSets.find(
          (set) => set.exerciseId === exercise.exerciseId,
        );
        return [
          exercise.exerciseId,
          {
            reps: String(past?.reps ?? exercise.targetRepsMin ?? 8),
            weightKg: String(past?.weightKg ?? exercise.targetWeightKg ?? ""),
            durationSeconds: String(
              past?.durationSeconds ?? exercise.targetDurationSeconds ?? 30,
            ),
            distanceMeters: String(
              past?.distanceMeters ?? exercise.targetDistanceMeters ?? 20,
            ),
          },
        ];
      }),
    ),
  );

  const queueRefresh = useCallback(async () => {
    const items = await listQueued(userId, sessionId);
    setQueued(items);
    return items;
  }, [userId, sessionId]);

  const refreshSavedSets = useCallback(async () => {
    const response = await fetch(`/api/workouts/${sessionId}/offline-state`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const result = (await response.json()) as { sets: LoggedSet[] };
    setLogs(result.sets);
  }, [sessionId]);

  // Browser APIs are read after mount, not during React rendering.
  useEffect(() => {
    let active = true;
    void listQueued(userId, sessionId)
      .then((items) => {
        if (active) setQueued(items);
      })
      .catch(() => {
        // Private browsing modes may restrict IndexedDB.
      });

    const initial = window.setTimeout(() => {
      setOnline(navigator.onLine);
      try {
        const value = Number(
          window.localStorage.getItem(`gymtrack-rest:${sessionId}`) ?? 0,
        );
        if (value > Date.now()) setDeadline(value);
      } catch {
        // Rest timer still works within this tab.
      }
      setTick(Date.now());
    }, 0);

    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [userId, sessionId]);

  const sync = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      await syncQueue(userId, sessionId);
      await queueRefresh();
      await refreshSavedSets();
      router.refresh();
    } catch {
      setError("Sync could not finish. Pending sets remain in your browser.");
    } finally {
      setSyncing(false);
      syncInFlight.current = false;
    }
  }, [userId, sessionId, queueRefresh, refreshSavedSets, router]);

  useEffect(() => {
    const reconnect = () => {
      setOnline(true);
      void sync();
    };
    const disconnect = () => setOnline(false);
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "GYMTRACK_SYNC") void sync();
    };

    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    navigator.serviceWorker?.addEventListener("message", workerMessage);

    const initialRetry = window.setTimeout(() => {
      if (navigator.onLine) void sync();
    }, 0);

    return () => {
      window.clearTimeout(initialRetry);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
      navigator.serviceWorker?.removeEventListener("message", workerMessage);
    };
  }, [sync]);

  const nextSetNumber = (exerciseId: string) =>
    1 +
    Math.max(
      0,
      ...logs
        .filter((set) => set.exerciseId === exerciseId)
        .map((set) => set.setNumber),
      // Count conflicts too: never overwrite a locally queued set.
      ...queued
        .filter((item) => item.data.exerciseId === exerciseId)
        .map((item) => item.data.setNumber),
    );

  function updateField(
    exerciseId: string,
    field: keyof InputFields,
    value: string,
  ) {
    setFields((current) => ({
      ...current,
      [exerciseId]: { ...current[exerciseId], [field]: value },
    }));
  }

  async function logSet(exercise: ExerciseItem) {
    if (busy || syncing) return;
    const input = fields[exercise.exerciseId];
    if (!input) return;
    setError("");

    const data: {
      exerciseId: string;
      setNumber: number;
      reps?: number;
      weightKg?: number;
      durationSeconds?: number;
      distanceMeters?: number;
      isWarmup: boolean;
    } = {
      exerciseId: exercise.exerciseId,
      setNumber: nextSetNumber(exercise.exerciseId),
      isWarmup: false,
    };

    if (exercise.trackingType.includes("REPS")) data.reps = Number(input.reps);
    if (exercise.trackingType === "REPS_WEIGHT" && input.weightKg !== "") {
      data.weightKg = Number(input.weightKg);
    }
    if (exercise.trackingType === "DURATION") {
      data.durationSeconds = Number(input.durationSeconds);
    }
    if (exercise.trackingType === "DISTANCE_WEIGHT") {
      data.distanceMeters = Number(input.distanceMeters);
      if (input.weightKg !== "") data.weightKg = Number(input.weightKg);
    }

    const parsed = logSetSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your set values.");
      return;
    }

    setBusy(true);
    try {
      await queueSet(userId, sessionId, parsed.data);
      await queueRefresh();

      const restEnd = Date.now() + exercise.restSeconds * 1000;
      setDeadline(restEnd);
      setTick(Date.now());
      try {
        window.localStorage.setItem(`gymtrack-rest:${sessionId}`, String(restEnd));
      } catch {
        // Saving the rest timer is optional.
      }

      await sync();
    } catch {
      setError("Unable to save this set locally. Check browser storage permissions.");
    } finally {
      setBusy(false);
    }
  }

  async function undoSet(setId: string) {
    if (busy || syncing || queued.length > 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/workouts/${sessionId}/sets/${setId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      setLogs((current) => current.filter((set) => set.id !== setId));
      router.refresh();
    } catch {
      setError("Could not undo this set. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finishWorkout() {
    if (busy || syncing || logs.length === 0) return;
    setError("");
    try {
      const pending = await queueRefresh();
      if (pending.length > 0) {
        setError("Sync or resolve all pending sets before completing the workout.");
        return;
      }
    } catch {
      setError("Could not verify locally queued sets. Try again.");
      return;
    }
    if (!window.confirm("Finish this workout?")) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/workouts/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error ?? "Unable to finish workout.");
      }
      router.push(`/workouts/${sessionId}/summary`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not finish workout.");
    } finally {
      setBusy(false);
    }
  }

  const savedSets = logs.filter((set) => !set.isWarmup).length;
  const targetSets = exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
  const percentage = targetSets
    ? Math.min(100, Math.round((savedSets / targetSets) * 100))
    : 0;
  const remaining = Math.max(0, Math.ceil((deadline - tick) / 1000));
  const disabled = busy || syncing;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#536477] hover:text-[#0e8074]"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Dashboard
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#dce7e6] bg-white px-3 py-2 text-xs font-semibold text-[#36546a]">
          {queued.length > 0 ? (
            <><CloudUpload size={15} aria-hidden="true" /> {queued.length} awaiting sync</>
          ) : !online ? (
            <><WifiOff size={15} aria-hidden="true" /> Offline</>
          ) : syncing ? (
            <><RotateCcw size={15} aria-hidden="true" /> Checking sync...</>
          ) : (
            <><CheckCircle2 size={15} className="text-[#0e8074]" aria-hidden="true" /> No pending sets</>
          )}
        </span>
      </div>

      <section className="rounded-3xl bg-[#14283b] p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="grid gap-2">
            <p className="text-xs font-extrabold tracking-[0.16em] text-[#95e5cf]">WORKOUT IN PROGRESS</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{dayName}</h1>
            <p className="text-sm text-[#d3e0e9]">{savedSets} confirmed working sets · {exercises.length} exercises</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 sm:min-w-44">
            <p className="flex items-center gap-2 text-xs text-[#c4dbe6]"><Clock3 size={16} aria-hidden="true" /> Rest timer</p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-white" aria-label={`${remaining} seconds remaining`}>
              {formatSeconds(remaining)}
            </p>
            <button
              type="button"
              className="mt-2 text-xs font-bold text-[#a8f1d9] underline-offset-4 hover:underline"
              onClick={() => {
                setDeadline(0);
                try { window.localStorage.removeItem(`gymtrack-rest:${sessionId}`); } catch { /* Storage may be blocked. */ }
              }}
            >
              Skip rest
            </button>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 text-sm font-semibold">
          <span>Workout progress</span>
          <span className="tabular-nums">{savedSets}/{targetSets} target sets</span>
        </div>
        <div
          role="progressbar"
          aria-label="Workout set progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full bg-[#7ce0c1] transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </section>

      {error && <div className="error" role="alert">{error}</div>}

      {queued.length > 0 && (
        <section className="grid gap-3 rounded-2xl border border-[#f0d196] bg-[#fffaee] p-4" aria-label="Offline set queue">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#704f22]">Sets waiting to sync</h2>
              <p className="text-xs text-[#815f32]">Complete your workout only after these sets are confirmed.</p>
            </div>
            <button type="button" className="btn secondary" disabled={disabled} onClick={() => void sync()}>
              <CloudUpload size={16} aria-hidden="true" /> Sync now
            </button>
          </div>
          {queued.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#efd7a9] bg-white p-3 text-sm">
              <span className="font-medium text-[#4c4c46]">
                {exercises.find((e) => e.exerciseId === item.data.exerciseId)?.name ?? "Exercise"} · Set {item.data.setNumber} · {item.state}
              </span>
              {item.state === "conflict" && (
                <button
                  type="button"
                  disabled={disabled}
                  className="text-xs font-bold text-[#9b3b31] underline"
                  onClick={async () => {
                    if (window.confirm("Discard this unsynced local set? This cannot be undone.")) {
                      await discardConflict(item.id);
                      await queueRefresh();
                    }
                  }}
                >
                  Discard conflict
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-[#14263d]">Your exercises</h2>
          <p className="text-sm text-[#536477]">Log each set as you finish it.</p>
        </div>
        <span className="rounded-full bg-[#e5f5f0] px-3 py-1.5 text-xs font-bold text-[#0b675b]">{exercises.length} exercises</span>
      </div>

      {exercises.map((exercise, index) => {
        const done = logs
          .filter((set) => set.exerciseId === exercise.exerciseId)
          .sort((a, b) => a.setNumber - b.setNumber);
        const input = fields[exercise.exerciseId];
        if (!input) return null;
        const exerciseComplete = done.filter((set) => !set.isWarmup).length >= exercise.targetSets;
        const past = previousSets.filter((set) => set.exerciseId === exercise.exerciseId);

        return (
          <section key={exercise.id} className="grid gap-5 rounded-2xl border border-[#e1e8ef] bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f5f0] font-bold text-[#0e8074]">
                  {index + 1}
                </span>
                <div className="grid gap-1">
                  <h3 className="text-lg font-extrabold text-[#14263d]">{exercise.name}</h3>
                  <p className="text-sm text-[#536477]">
                    {exercise.targetSets} sets · {exercise.restSeconds}s rest
                    {exercise.targetRepsMin != null && ` · ${exercise.targetRepsMin}${exercise.targetRepsMax != null ? `–${exercise.targetRepsMax}` : ""} reps`}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${exerciseComplete ? "bg-[#e5f5f0] text-[#0e8074]" : "bg-[#eef2f7] text-[#536477]"}`}>
                {exerciseComplete ? <><Check size={14} className="mr-1 inline" aria-hidden="true" /> Target reached</> : `${done.length}/${exercise.targetSets} saved`}
              </span>
            </div>

            {past.length > 0 && (
              <div className="rounded-xl bg-[#f5f8fb] px-4 py-3 text-sm text-[#4b6074]">
                <span className="font-semibold">Last session: </span>
                {setDescription(past[past.length - 1])}
              </div>
            )}

            {exercise.suggestion && (
              <p className="success"><strong>Suggestion:</strong> {exercise.suggestion}</p>
            )}

            {done.length > 0 && (
              <div className="grid gap-2" aria-label={`Saved sets for ${exercise.name}`}>
                {done.map((set) => (
                  <div key={set.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6ecef] bg-[#fbfcfd] px-3 py-2.5">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e5f5f0] text-[#0e8074]"><Check size={15} aria-hidden="true" /></span>
                      <span><strong className="text-[#14263d]">Set {set.setNumber}</strong> <span className="text-[#536477]">· {setDescription(set)}</span></span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled || queued.length > 0}
                      className="text-xs font-bold text-[#536477] hover:text-[#b6404a] disabled:opacity-50"
                      onClick={() => void undoSet(set.id)}
                      aria-label={`Undo ${exercise.name} set ${set.setNumber}`}
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {exercise.trackingType.includes("REPS") && (
                <label className="field">Reps
                  <input className="input" type="number" min={1} max={1000} value={input.reps}
                    onChange={(event) => updateField(exercise.exerciseId, "reps", event.target.value)}
                    aria-label={`Reps for ${exercise.name}`} />
                </label>
              )}
              {["REPS_WEIGHT", "DISTANCE_WEIGHT"].includes(exercise.trackingType) && (
                <label className="field">Weight (kg)
                  <input className="input" type="number" min={0} max={2000} step="0.5" value={input.weightKg}
                    onChange={(event) => updateField(exercise.exerciseId, "weightKg", event.target.value)}
                    aria-label={`Weight for ${exercise.name}`} />
                </label>
              )}
              {exercise.trackingType === "DURATION" && (
                <label className="field">Seconds
                  <input className="input" type="number" min={1} max={36000} value={input.durationSeconds}
                    onChange={(event) => updateField(exercise.exerciseId, "durationSeconds", event.target.value)}
                    aria-label={`Seconds for ${exercise.name}`} />
                </label>
              )}
              {exercise.trackingType === "DISTANCE_WEIGHT" && (
                <label className="field">Distance (m)
                  <input className="input" type="number" min={0.01} max={100000} step="any" value={input.distanceMeters}
                    onChange={(event) => updateField(exercise.exerciseId, "distanceMeters", event.target.value)}
                    aria-label={`Distance for ${exercise.name}`} />
                </label>
              )}
            </div>

            <button type="button" className="btn w-full sm:w-auto" disabled={disabled}
              onClick={() => void logSet(exercise)}>
              <Dumbbell size={17} aria-hidden="true" /> Log set {nextSetNumber(exercise.exerciseId)}
            </button>
          </section>
        );
      })}

      {queued.length === 0 ? (
        <NaturalLog
          sessionId={sessionId}
          exercises={exercises}
          initialSets={logs}
          onSaved={(sets) => {
            setLogs((current) => [
              ...current,
              ...sets.filter((set) => !current.some((existing) => existing.id === set.id)),
            ]);
            router.refresh();
          }}
        />
      ) : (
        <p className="text-sm text-[#536477]">AI-assisted logging is unavailable until your pending sets are synced.</p>
      )}

      <section className="grid gap-4 rounded-2xl border border-[#d7e8e2] bg-[#edf8f3] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#0e8074]"><CheckCircle2 size={23} aria-hidden="true" /></div>
          <div>
            <h2 className="text-xl font-extrabold text-[#14263d]">Finish your workout</h2>
            <p className="mt-1 text-sm text-[#536477]">Finish after all pending sets have synchronized. Your completed workout will appear in history.</p>
          </div>
        </div>
        <button
          type="button"
          className="btn w-full"
          disabled={disabled || logs.length === 0 || queued.length > 0}
          onClick={() => void finishWorkout()}
        >
          <CheckCircle2 size={18} aria-hidden="true" /> Finish workout
        </button>
      </section>
    </div>
  );
}
