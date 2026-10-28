"use client";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string };
type Program = { id: string; name: string; version: number; dayCount: number };
const dayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
function suggestDays(count: number) {
  return count === 1
    ? [1]
    : count === 2
      ? [1, 4]
      : count === 3
        ? [1, 3, 5]
        : count === 4
          ? [1, 2, 4, 5]
          : Array.from({ length: count }, (_, i) => i + 1);
}
export function ProgramAssigner({
  clients,
  programs,
  initialClientId,
  initialVersionId,
  minStartDate,
}: {
  clients: Client[];
  programs: Program[];
  initialClientId?: string;
  initialVersionId?: string;
  minStartDate: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(
    clients.some((c) => c.id === initialClientId)
      ? initialClientId!
      : (clients[0]?.id ?? ""),
  );
  const [versionId, setVersionId] = useState(
    programs.some((p) => p.id === initialVersionId)
      ? initialVersionId!
      : (programs[0]?.id ?? ""),
  );
  const program = programs.find((p) => p.id === versionId);
  const [startDate, setStartDate] = useState(minStartDate);
  const [daysByVersion, setDaysByVersion] = useState<Record<string, number[]>>(
    {},
  );
  const weekdays = useMemo(
    () =>
      program
        ? (daysByVersion[versionId] ?? suggestDays(program.dayCount))
        : [],
    [program, daysByVersion, versionId],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The key is stable across retries, but changes whenever the form meaningfully changes.
  const requestKey = useRef<string | null>(null);
  function invalidate() {
    requestKey.current = null;
    setError("");
  }
  function toggleDay(n: number) {
    if (!program) return;
    const next = weekdays.includes(n)
      ? weekdays.filter((x) => x !== n)
      : weekdays.length < program.dayCount
        ? [...weekdays, n]
        : weekdays;
    setDaysByVersion((p) => ({ ...p, [versionId]: next }));
    invalidate();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !program || !clientId) return;
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/coach/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          versionId,
          startDate,
          weekdays,
          idempotencyKey: requestKey.current,
        }),
      });
      const result = (await response.json()) as { error?: string; id?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to assign program.");
      router.push("/coach/assignments");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to assign.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <label className="field">
        Client (approved relationships only)
        <select
          className="input"
          required
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            invalidate();
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Published program version
        <select
          className="input"
          required
          value={versionId}
          onChange={(e) => {
            setVersionId(e.target.value);
            invalidate();
          }}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · v{p.version} · {p.dayCount} days/week
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Start date (UTC calendar date)
        <input
          className="input"
          type="date"
          min={minStartDate}
          required
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            invalidate();
          }}
        />
      </label>
      {program && (
        <fieldset className="r3-days">
          <legend>Select exactly {program.dayCount} training weekdays</legend>
          <div className="r3-day-options">
            {dayLabels.map((label, i) => (
              <label className="r3-day-option" key={label}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(i + 1)}
                  onChange={() => toggleDay(i + 1)}
                />
                {label.slice(0, 3)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="info-note">
        Creates a four-week schedule, makes this the client&apos;s active plan
        and archives their previous active plan. Existing completed sessions are
        preserved. Only one active coach assignment is maintained.
      </p>
      <button
        type="submit"
        className="btn"
        disabled={
          busy || !clientId || !program || weekdays.length !== program.dayCount
        }
      >
        {busy ? "Assigning..." : "Confirm & assign program"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
