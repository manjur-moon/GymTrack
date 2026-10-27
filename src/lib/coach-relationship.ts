/**
 * Domain transitions are intentionally independent of Next.js and Prisma.
 * A client must explicitly consent before a coach can view training data.
 */
export type RelationshipStatus =
  | "PENDING"
  | "ACTIVE"
  | "DECLINED"
  | "REVOKED";

export type ClientRelationshipAction =
  | "accept"
  | "decline"
  | "revoke"
  | "weight-on"
  | "weight-off";

export type RelationshipUpdate = {
  status?: RelationshipStatus;
  shareBodyWeight?: boolean;
};

export function clientRelationshipUpdate(
  status: RelationshipStatus,
  action: ClientRelationshipAction,
): RelationshipUpdate | null {
  if (status === "PENDING") {
    if (action === "accept") return { status: "ACTIVE", shareBodyWeight: false };
    if (action === "decline") return { status: "DECLINED", shareBodyWeight: false };
  }

  if (status === "ACTIVE") {
    if (action === "revoke") return { status: "REVOKED", shareBodyWeight: false };
    if (action === "weight-on") return { shareBodyWeight: true };
    if (action === "weight-off") return { shareBodyWeight: false };
  }

  return null;
}

export function mayReinvite(status: RelationshipStatus): boolean {
  return status === "DECLINED" || status === "REVOKED";
}
