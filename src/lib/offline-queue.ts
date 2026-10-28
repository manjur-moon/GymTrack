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
    upgrade(database) {
      database.createObjectStore("sets", {
        keyPath: "id",
      });
    },
  });
}

export async function listQueued(userId: string, sessionId: string) {
  const entries = (await (await db()).getAll("sets")) as QueuedSet[];

  return entries
    .filter((item) => item.userId === userId && item.sessionId === sessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function queueSet(userId: string, sessionId: string, data: Data) {
  const database = await db();

  const id = `${userId}:${sessionId}:${data.exerciseId}:${data.setNumber}`;

  // Save locally first.
  await database.put("sets", {
    id,
    userId,
    sessionId,
    data,
    state: "pending",
    createdAt: Date.now(),
  } satisfies QueuedSet);

  // Background sync is optional.
  // Do not block foreground saving or synchronization.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (!registration) return;

        const sync = (
          registration as ServiceWorkerRegistration & {
            sync?: {
              register: (tag: string) => Promise<void>;
            };
          }
        ).sync;

        return sync?.register("gymtrack-sync");
      })
      .catch(() => {
        // Foreground synchronization remains available.
      });
  }
}

export async function syncQueue(userId: string, sessionId: string) {
  const database = await db();

  for (const row of await listQueued(userId, sessionId)) {
    if (row.state === "conflict") continue;

    try {
      const response = await fetch(`/api/workouts/${sessionId}/sets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row.data),
      });

      if (response.ok) {
        await database.delete("sets", row.id);
      } else if ([400, 403, 404, 409].includes(response.status)) {
        await database.put("sets", {
          ...row,
          state: "conflict",
        });

        break;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

export async function discardConflict(id: string) {
  await (await db()).delete("sets", id);
}
