
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  logSetSchema,
  type LoggedSet,
} from "@/lib/workouts";

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
  const [deadline, setDeadline] = useState(0);
  const [tick, setTick] = useState(0);

  const [fields, setFields] = useState<
    Record<string, InputFields>
  >(() =>
    Object.fromEntries(
      exercises.map((exercise) => {
        const past = previousSets.find(
          (set) =>
            set.exerciseId === exercise.exerciseId
        );

        return [
          exercise.exerciseId,
          {
            reps: String(
              past?.reps ??
                exercise.targetRepsMin ??
                8
            ),
            weightKg: String(
              past?.weightKg ??
                exercise.targetWeightKg ??
                ""
            ),
            durationSeconds: String(
              past?.durationSeconds ??
                exercise.targetDurationSeconds ??
                30
            ),
            distanceMeters: String(
              past?.distanceMeters ??
                exercise.targetDistanceMeters ??
                20
            ),
          },
        ];
      })
    )
  );

  // Refresh sets stored in IndexedDB.
  const queueRefresh = useCallback(async () => {
    const items = await listQueued(userId, sessionId);
    setQueued(items);
    return items;
  }, [userId, sessionId]);

  // Refresh server-confirmed workout sets.
  const refreshSavedSets = useCallback(async () => {
    const response = await fetch(
      `/api/workouts/${sessionId}/offline-state`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) return;

    const result = (await response.json()) as {
      sets: LoggedSet[];
    };

    setLogs(result.sets);
  }, [sessionId]);

  // Initialize offline state and restore the rest timer.
  useEffect(() => {
    let active = true;

    void listQueued(userId, sessionId)
      .then((items) => {
        if (active) setQueued(items);
      })
      .catch(() => {
        // Browser storage may be unavailable.
      });

    const restKey = `gymtrack-rest:${sessionId}`;

    const initialClock = window.setTimeout(() => {
      try {
        const saved = Number(
          window.localStorage.getItem(restKey) ?? 0
        );

        if (saved > Date.now()) {
          setDeadline(saved);
        }
      } catch {
        // Local storage is optional for the timer.
      }

      setTick(Date.now());
    }, 0);

    const interval = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      active = false;
      window.clearTimeout(initialClock);
      window.clearInterval(interval);
    };
  }, [userId, sessionId]);

  // Retry locally queued sets.
  const sync = useCallback(async () => {
    if (syncInFlight.current) return;

    syncInFlight.current = true;

    try {
      await syncQueue(userId, sessionId);
      await queueRefresh();
      await refreshSavedSets();
      router.refresh();
    } catch {
      setError(
        "Could not synchronize. Your pending sets remain stored locally."
      );
    } finally {
      syncInFlight.current = false;
    }
  }, [
    userId,
    sessionId,
    queueRefresh,
    refreshSavedSets,
    router,
  ]);

  // Retry when connectivity returns or the service worker requests it.
  useEffect(() => {
    const handleReconnect = () => {
      void sync();
    };

    const handleWorkerMessage = (
      event: MessageEvent
    ) => {
      if (event.data?.type === "GYMTRACK_SYNC") {
        void sync();
      }
    };

    window.addEventListener(
      "online",
      handleReconnect
    );

    navigator.serviceWorker?.addEventListener(
      "message",
      handleWorkerMessage
    );

    const initialSync = window.setTimeout(() => {
      if (navigator.onLine) {
        void sync();
      }
    }, 0);

    return () => {
      window.clearTimeout(initialSync);

      window.removeEventListener(
        "online",
        handleReconnect
      );

      navigator.serviceWorker?.removeEventListener(
        "message",
        handleWorkerMessage
      );
    };
  }, [sync]);

  // Calculate the next set number.
  function nextSetNumber(exerciseId: string) {
    return (
      1 +
      Math.max(
        0,
        ...logs
          .filter(
            (set) => set.exerciseId === exerciseId
          )
          .map((set) => set.setNumber),
        ...queued
          .filter(
            (item) =>
              item.data.exerciseId === exerciseId
          )
          .map((item) => item.data.setNumber)
      )
    );
  }

  // Update controlled exercise inputs.
  function updateField(
    exerciseId: string,
    field: keyof InputFields,
    value: string
  ) {
    setFields((previous) => ({
      ...previous,
      [exerciseId]: {
        ...previous[exerciseId],
        [field]: value,
      },
    }));
  }

  // Save a workout set.
  async function logSet(exercise: ExerciseItem) {
    if (busy) return;

    setError("");

    const input = fields[exercise.exerciseId];
    if (!input) return;

    const payload: {
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

    if (exercise.trackingType.includes("REPS")) {
      payload.reps = Number(input.reps);
    }

    if (
      exercise.trackingType === "REPS_WEIGHT" &&
      input.weightKg !== ""
    ) {
      payload.weightKg = Number(input.weightKg);
    }

    if (exercise.trackingType === "DURATION") {
      payload.durationSeconds = Number(
        input.durationSeconds
      );
    }

    if (
      exercise.trackingType === "DISTANCE_WEIGHT"
    ) {
      payload.distanceMeters = Number(
        input.distanceMeters
      );

      if (input.weightKg !== "") {
        payload.weightKg = Number(input.weightKg);
      }
    }

    // Apply the existing server validation rules.
    const parsed = logSetSchema.safeParse(payload);

    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ??
          "Invalid set values."
      );
      return;
    }

    setBusy(true);

    try {
      // Persist the set locally first.
      await queueSet(
        userId,
        sessionId,
        parsed.data
      );

      await queueRefresh();

      // Start the rest timer.
      const end =
        Date.now() +
        exercise.restSeconds * 1000;

      try {
        window.localStorage.setItem(
          `gymtrack-rest:${sessionId}`,
          String(end)
        );
      } catch {
        // Timer continues for the current page.
      }

      setDeadline(end);
      setTick(Date.now());

      // Attempt to synchronize.
      await sync();
    } catch {
      setError(
        "Could not save this set locally. Check browser storage permissions."
      );
    } finally {
      setBusy(false);
    }
  }

  // Undo an existing saved set.
  async function undoSet(setId: string) {
    if (busy || queued.length) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/workouts/${sessionId}/sets/${setId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Cannot undo this set.");
      }

      setLogs((previous) =>
        previous.filter((set) => set.id !== setId)
      );

      router.refresh();
    } catch {
      setError(
        "Cannot undo this set. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  // Complete workout session.
  async function finishWorkout() {
    if (busy) return;

    setError("");

    try {
      const pending = await queueRefresh();

      if (pending.length > 0) {
        setError(
          "Resolve or synchronize all queued sets before finishing."
        );
        return;
      }
    } catch {
      setError(
        "Could not verify offline sets. Retry when storage is available."
      );
      return;
    }

    if (!window.confirm("Finish this workout?")) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        `/api/workouts/${sessionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "complete",
          }),
        }
      );

      if (!response.ok) {
        const result = (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(
          result.error ?? "Could not finish workout."
        );
      }

      router.push("/workouts/history");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not finish workout."
      );
    } finally {
      setBusy(false);
    }
  }

  const remaining = Math.max(
    0,
    Math.ceil((deadline - tick) / 1000)
  );

  return (
    <div className="stack">
      {/* Workout header */}
      <section className="card between">
        <div>
          <p className="eyebrow">In progress</p>
          <h1>{dayName}</h1>

          <p className="sub" aria-live="polite">
            {logs.length} sets saved ·{" "}
            {queued.length} queued
          </p>
        </div>

        <div className="panel">
          <p className="sub">Rest timer</p>

          <p className="stat">
            {String(
              Math.floor(remaining / 60)
            ).padStart(2, "0")}
            :
            {String(remaining % 60).padStart(
              2,
              "0"
            )}
          </p>

          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setDeadline(0);

              try {
                window.localStorage.removeItem(
                  `gymtrack-rest:${sessionId}`
                );
              } catch {
                // Storage may be blocked.
              }
            }}
          >
            Skip
          </button>
        </div>
      </section>

      {/* Error message */}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Offline queue */}
      {queued.length > 0 && (
        <section
          className="warn stack"
          aria-label="Offline queue"
        >
          <h3>
            Offline queue · {queued.length} sets
          </h3>

          {queued.map((item) => (
            <div
              className="panel between"
              key={item.id}
            >
              <span className="small">
                {exercises.find(
                  (e) =>
                    e.exerciseId ===
                    item.data.exerciseId
                )?.name ?? "Exercise"}{" "}
                · Set {item.data.setNumber} —{" "}
                {item.state}
              </span>

              {item.state === "conflict" && (
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      window.confirm(
                        "Discard this unsynced local set? This cannot be undone."
                      )
                    ) {
                      await discardConflict(
                        item.id
                      );

                      await queueRefresh();
                    }
                  }}
                >
                  Discard conflict
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => void sync()}
          >
            Sync pending sets
          </button>
        </section>
      )}

      {/* Natural language logging */}
      {queued.length === 0 ? (
        <NaturalLog
          sessionId={sessionId}
          exercises={exercises}
          initialSets={logs}
          onSaved={(sets) => {
            setLogs((previous) => [
              ...previous,
              ...sets.filter(
                (set) =>
                  !previous.some(
                    (old) => old.id === set.id
                  )
              ),
            ]);

            router.refresh();
          }}
        />
      ) : (
        <p className="sub">
          AI-assisted bulk logging is disabled
          until pending sets synchronize.
        </p>
      )}

      {/* Exercise list */}
      {exercises.map((exercise) => {
        const done = logs
          .filter(
            (set) =>
              set.exerciseId ===
              exercise.exerciseId
          )
          .sort(
            (a, b) =>
              a.setNumber - b.setNumber
          );

        const input =
          fields[exercise.exerciseId];

        if (!input) return null;

        return (
          <section
            className="card stack"
            key={exercise.id}
          >
            <div className="between">
              <div>
                <h2>{exercise.name}</h2>

                <p className="sub">
                  {exercise.targetSets} sets
                  planned ·{" "}
                  {exercise.restSeconds}s
                  rest
                </p>
              </div>

              <span className="badge">
                {done.length} saved
              </span>
            </div>

            {/* Training suggestion */}
            {exercise.suggestion && (
              <p className="success">
                <strong>
                  Training suggestion:
                </strong>{" "}
                {exercise.suggestion}
              </p>
            )}

            {/* Saved sets */}
            {done.map((set) => (
              <div
                className="panel between"
                key={set.id}
              >
                <span>
                  Set {set.setNumber} ·{" "}
                  {set.reps ??
                    set.durationSeconds ??
                    set.distanceMeters}
                  {set.reps !== undefined
                    ? " reps"
                    : set.durationSeconds !==
                        undefined
                      ? " sec"
                      : " m"}
                  {set.weightKg !== undefined
                    ? ` · ${set.weightKg} kg`
                    : ""}
                </span>

                <button
                  type="button"
                  className="btn ghost"
                  disabled={
                    busy || queued.length > 0
                  }
                  onClick={() =>
                    void undoSet(set.id)
                  }
                >
                  Undo
                </button>
              </div>
            ))}

            {/* Exercise input fields */}
            <div className="grid three">
              {exercise.trackingType.includes(
                "REPS"
              ) && (
                <label className="field">
                  Reps
                  <input
                    className="input"
                    type="number"
                    min={1}
                    aria-label={`Reps for ${exercise.name}`}
                    value={input.reps}
                    onChange={(event) =>
                      updateField(
                        exercise.exerciseId,
                        "reps",
                        event.target.value
                      )
                    }
                  />
                </label>
              )}

              {[
                "REPS_WEIGHT",
                "DISTANCE_WEIGHT",
              ].includes(
                exercise.trackingType
              ) && (
                <label className="field">
                  Weight (kg)
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.5"
                    aria-label={`Weight for ${exercise.name}`}
                    value={input.weightKg}
                    onChange={(event) =>
                      updateField(
                        exercise.exerciseId,
                        "weightKg",
                        event.target.value
                      )
                    }
                  />
                </label>
              )}

              {exercise.trackingType ===
                "DURATION" && (
                <label className="field">
                  Seconds
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={
                      input.durationSeconds
                    }
                    onChange={(event) =>
                      updateField(
                        exercise.exerciseId,
                        "durationSeconds",
                        event.target.value
                      )
                    }
                  />
                </label>
              )}

              {exercise.trackingType ===
                "DISTANCE_WEIGHT" && (
                <label className="field">
                  Distance (m)
                  <input
                    className="input"
                    type="number"
                    min={0.01}
                    step="any"
                    value={
                      input.distanceMeters
                    }
                    onChange={(event) =>
                      updateField(
                        exercise.exerciseId,
                        "distanceMeters",
                        event.target.value
                      )
                    }
                  />
                </label>
              )}
            </div>

            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                void logSet(exercise)
              }
            >
              ✓ Log set{" "}
              {nextSetNumber(
                exercise.exerciseId
              )}
            </button>
          </section>
        );
      })}

      {/* Finish workout */}
      <section className="card stack">
        <h2>Finish session</h2>

        <p className="sub">
          Offline sets must synchronize
          before the workout can be completed.
        </p>

        <button
          type="button"
          className="btn"
          disabled={
            busy ||
            logs.length === 0 ||
            queued.length > 0
          }
          onClick={() =>
            void finishWorkout()
          }
        >
          Finish workout
        </button>
      </section>
    </div>
  );
}
