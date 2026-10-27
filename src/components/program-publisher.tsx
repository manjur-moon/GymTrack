"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type PlanOption = { id: string; name: string };
type TemplateOption = { id: string; name: string };
export function ProgramPublisher({
  plans,
  templates,
}: {
  plans: PlanOption[];
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const r = await fetch("/api/coach/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, ...(templateId ? { templateId } : {}) }),
      });
      const result = (await r.json()) as { error?: string; version?: number };
      if (!r.ok) throw new Error(result.error ?? "Could not publish program.");
      setSuccess(`Published version ${result.version}.`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Publish a training program</h2>
      <p className="sub">
        Build a training plan using the existing plan builder, then publish an
        immutable version for assignment. Publishing does not modify any
        client&apos;s historical workout.
      </p>
      <label className="field">
        Source plan
        <select
          className="input"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          required
        >
          {plans.length === 0 ? (
            <option value="">No source plans yet</option>
          ) : (
            plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="field">
        Publishing action
        <select
          className="input"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Create a new reusable template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              Publish next version of {t.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn" type="submit" disabled={busy || !planId}>
        {busy ? "Publishing..." : "Publish version"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
    </form>
  );
}
