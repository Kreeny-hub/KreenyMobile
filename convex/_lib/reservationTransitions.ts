import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { emitReservationEvent, type ReservationEventType } from "./reservationEvents";
import { assertReservationTransition } from "./reservationStateMachine";

export async function transitionReservationStatus(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  renterUserId: string;
  ownerUserId: string;
  actorUserId: string;

  nextStatus: string;
  eventType: ReservationEventType;

  patch?: Record<string, any>;
  payload?: any;
  idempotencyKey?: string;
}) {
  const { ctx } = opts;

  const reservation = await ctx.db.get(opts.reservationId);
  if (!reservation) throw new ConvexError("ReservationNotFound");

  const patch = opts.patch ?? {};
  const hasPatch = Object.keys(patch).length > 0;
  const sameStatus = reservation.status === opts.nextStatus;

  // ✅ 1) Même statut + rien à patch => rien à faire
  if (sameStatus && !hasPatch) {
    return { ok: true, skipped: true };
  }

  // ✅ 2) Même statut + patch déjà appliqué => rien à faire
  if (sameStatus && hasPatch) {
    const alreadyApplied = Object.entries(patch).every(
      ([k, v]) => (reservation as any)[k] === v
    );
    if (alreadyApplied) {
      return { ok: true, skipped: true };
    }
  }

  // ✅ 3) On vérifie la machine d’état UNIQUEMENT si on change de statut
  if (!sameStatus) {
    assertReservationTransition(reservation.status, opts.nextStatus);
  }

  const currentVersion = (reservation as any).version ?? 1;

  // ✅ Patch (status + autres champs)
  await ctx.db.patch(reservation._id, {
    status: opts.nextStatus,
    ...patch,
    version: currentVersion + 1,
  });

  // ✅ Event (idempotent si tu passes idempotencyKey)
  await emitReservationEvent({
    ctx,
    reservationId: reservation._id,
    renterUserId: opts.renterUserId,
    ownerUserId: opts.ownerUserId,
    type: opts.eventType,
    actorUserId: opts.actorUserId,
    payload: opts.payload,
    idempotencyKey: opts.idempotencyKey,
  });

  return { ok: true, skipped: false };
}