"use client";
import { openDB } from "idb";

type Data = {
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  isWarmup: boolean;
};
export type QueuedSet = {
  id: string;
  userId: string;
  sessionId: string;
  data: Data;
  state: "pending" | "conflict";
  createdAt: number;
};
async function db() {
  return openDB("gymtrack-offline-v1", 1, {
    upgrade(d) {
      d.createObjectStore("sets", { keyPath: "id" });
    },
  });
}
export async function listQueued(userId: string, sessionId: string) {
  const entries = (await (await db()).getAll("sets")) as QueuedSet[];
  return entries
    .filter((x) => x.userId === userId && x.sessionId === sessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
}
export async function queueSet(userId: string, sessionId: string, data: Data) {
  const d = await db();
  const id = `${userId}:${sessionId}:${data.exerciseId}:${data.setNumber}`;
  await d.put("sets", {
    id,
    userId,
    sessionId,
    data,
    state: "pending",
    createdAt: Date.now(),
  } satisfies QueuedSet);
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sync = (
        reg as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        }
      ).sync;
      await sync?.register("gymtrack-sync");
    } catch {
      /* Foreground retry remains available. */
    }
  }
}
export async function syncQueue(userId: string, sessionId: string) {
  const d = await db();
  for (const row of await listQueued(userId, sessionId)) {
    if (row.state === "conflict") continue;
    try {
      const r = await fetch(`/api/workouts/${sessionId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.data),
      });
      if (r.ok) await d.delete("sets", row.id);
      else if ([400, 403, 404, 409].includes(r.status)) {
        await d.put("sets", { ...row, state: "conflict" });
        break;
      } else break;
    } catch {
      break;
    }
  }
}
export async function discardConflict(id: string) {
  await (await db()).delete("sets", id);
}
