import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { emitReservationEvent } from "./reservationEvents";

export async function holdDepositDEV(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  actorUserId: string; // "system" dans la plupart des cas
}) {
  const { ctx } = opts;
  const r = await ctx.db.get(opts.reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");

  // idempotent
  if ((r as any).depositStatus === "held") return { ok: true, skipped: true };

  // DEV: on simule un hold réussi
  await ctx.db.patch(r._id, {
    depositStatus: "held",
    depositHoldRef: `DEV_HOLD_${String(r._id)}`,
  });

  await emitReservationEvent({
    ctx,
    reservationId: r._id,
    renterUserId: r.renterUserId,
    ownerUserId: String(r.ownerUserId ?? ""),
    type: "deposit_held" as any, // on l’ajoutera proprement après
    actorUserId: opts.actorUserId,
    idempotencyKey: `pay:${String(r._id)}:deposit_held`,
  });

  return { ok: true };
}

export async function releaseDepositDEV(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  actorUserId: string;
}) {
  const { ctx } = opts;
  const r = await ctx.db.get(opts.reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");

  // idempotent
  if ((r as any).depositStatus === "released") return { ok: true, skipped: true };

  await ctx.db.patch(r._id, {
    depositStatus: "released",
  });

  await emitReservationEvent({
    ctx,
    reservationId: r._id,
    renterUserId: r.renterUserId,
    ownerUserId: String(r.ownerUserId ?? ""),
    type: "deposit_released" as any,
    actorUserId: opts.actorUserId,
    idempotencyKey: `pay:${String(r._id)}:deposit_released`,
  });

  return { ok: true };
}