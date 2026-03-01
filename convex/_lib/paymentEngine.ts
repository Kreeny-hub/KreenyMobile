/**
 * convex/_lib/paymentEngine.ts
 * ────────────────────────────────────────────────────
 * Deposit management — DB-only operations.
 * Called from mutations (disputes, reservations).
 * Updates deposit status in DB immediately.
 * Stripe API calls are handled separately by the caller (admin actions).
 */

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { emitReservationEvent } from "./reservationEvents";

// ═══════════════════════════════════════════════════════
// HOLD DEPOSIT (called when rental is confirmed)
// ═══════════════════════════════════════════════════════
export async function holdDepositDEV(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  actorUserId: string;
}) {
  const { ctx } = opts;
  const r = await ctx.db.get(opts.reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");

  if ((r as any).depositStatus === "held") return { ok: true, skipped: true };

  await ctx.db.patch(r._id, {
    depositStatus: "held",
    depositHoldRef: `DEV_HOLD_${String(r._id)}`,
  });

  await emitReservationEvent({
    ctx,
    reservationId: r._id,
    renterUserId: r.renterUserId,
    ownerUserId: String(r.ownerUserId ?? ""),
    type: "deposit_held" as any,
    actorUserId: opts.actorUserId,
    idempotencyKey: `pay:${String(r._id)}:deposit_held`,
  });

  return { ok: true };
}

// ═══════════════════════════════════════════════════════
// RELEASE DEPOSIT (clean return → no charge)
// ═══════════════════════════════════════════════════════
export async function releaseDepositDEV(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  actorUserId: string;
}) {
  const { ctx } = opts;
  const r = await ctx.db.get(opts.reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");

  if ((r as any).depositStatus === "released") return { ok: true, skipped: true };

  await ctx.db.patch(r._id, { depositStatus: "released" });

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

// ═══════════════════════════════════════════════════════
// RETAIN DEPOSIT (dispute → charge partial or full)
// ═══════════════════════════════════════════════════════
export async function retainDepositDEV(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  actorUserId: string;
  retainedAmount: number;
  partial: boolean;
}) {
  const { ctx } = opts;
  const r = await ctx.db.get(opts.reservationId);
  if (!r) throw new ConvexError("ReservationNotFound");

  await ctx.db.patch(r._id, {
    depositStatus: opts.partial ? "partially_retained" : "retained",
  });

  return { ok: true };
}
