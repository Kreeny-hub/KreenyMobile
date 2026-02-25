import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ReservationStatus } from "./enums";

export type ReservationRole = "owner" | "renter";

export async function loadReservationOrThrow(
  ctx: MutationCtx,
  reservationId: Id<"reservations">
) {
  const r = await ctx.db.get(reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");
  return r;
}

export function getRoleOrThrow(r: any, userId: string): ReservationRole {
  if (r.ownerUserId === userId) return "owner";
  if (r.renterUserId === userId) return "renter";
  throw new ConvexError("Forbidden");
}

/** Vérifie que le statut courant est dans la liste autorisée (type-safe) */
export function assertStatus(r: { status: string }, allowed: ReservationStatus[]) {
  if (!allowed.includes(r.status as ReservationStatus)) {
    throw new ConvexError("InvalidStatus");
  }
}

export function assertRole(role: ReservationRole, allowed: ReservationRole[]) {
  if (!allowed.includes(role)) throw new ConvexError("Forbidden");
}
