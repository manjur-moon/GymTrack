"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type InviteResponse = { error?: string };

export function InviteClientForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      const response = await fetch("/api/coach/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = (await response.json()) as InviteResponse;
      if (!response.ok) throw new Error(result.error ?? "Unable to invite client.");
      setEmail("");
      setNotice("Invitation created. The client can accept it from My coaches.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setNotice(error instanceof Error ? error.message : "Unable to invite client.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="r2-invite-form" onSubmit={submit}>
      <label className="field" htmlFor="r2-client-email">
        Registered client&apos;s email
        <input
          id="r2-client-email"
          className="input"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          value={email}
          placeholder="client@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" className="btn" disabled={busy}>
        {busy ? "Creating invitation..." : "Invite client"}
      </button>
      {notice && (
        <p role={failed ? "alert" : "status"} className={failed ? "error" : "success"}>
          {notice}
        </p>
      )}
      <p className="sub">In-app invitations only. The client must already have a GymTrack account and approve access.</p>
    </form>
  );
}

export function ReinviteClientButton({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function reinvite() {
    if (busy) return;
    if (!window.confirm(`Invite ${email} again? They must explicitly accept.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/coach/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reinvite: true }),
      });
      const result = (await response.json()) as InviteResponse;
      if (!response.ok) throw new Error(result.error ?? "Could not re-invite.");
      setMessage("Invitation renewed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not re-invite.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack tight">
      <button type="button" className="btn secondary btn-small" disabled={busy} onClick={() => void reinvite()}>
        {busy ? "Sending..." : "Reinvite"}
      </button>
      {message && <span className="sub" role="status">{message}</span>}
    </div>
  );
}
