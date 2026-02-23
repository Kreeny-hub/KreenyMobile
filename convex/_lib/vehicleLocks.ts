import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

function enumerateDays(startDate: string, endDate: string) {
  // start inclus, end exclus
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

/**
 * Atomique: réserve les dates dans un "bucket" unique par véhicule.
 * Si une date est déjà prise => throw VehicleUnavailable
 */
export async function acquireVehicleLocks(opts: {
  ctx: MutationCtx;
  vehicleId: Id<"vehicles">;
  reservationId: Id<"reservations">;
  startDate: string;
  endDate: string;
}) {
  const { ctx, vehicleId, reservationId, startDate, endDate } = opts;
  const days = enumerateDays(startDate, endDate);

  // 1) bucket (1 doc par véhicule)
  const bucket =
    (await ctx.db
      .query("vehicleLockBuckets")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId))
      .unique()) ??
    null;

  if (!bucket) {
    // Crée bucket vide
    const bucketId = await ctx.db.insert("vehicleLockBuckets", {
      vehicleId,
      dates: {},
      updatedAt: Date.now(),
    });

    // Re-charge pour patcher proprement
    const fresh = await ctx.db.get(bucketId);
    if (!fresh) throw new ConvexError("LockBucketNotFound");
    return await acquireVehicleLocks({
      ctx,
      vehicleId,
      reservationId,
      startDate,
      endDate,
    });
  }

  // 2) vérifie dispo
  for (const day of days) {
    if (bucket.dates[day]) {
      throw new ConvexError("VehicleUnavailable");
    }
  }

  // 3) patch atomique (sur le même doc => anti race)
  const nextDates = { ...bucket.dates };
  for (const day of days) nextDates[day] = reservationId;

  await ctx.db.patch(bucket._id, {
    dates: nextDates,
    updatedAt: Date.now(),
  });

  // 4) Optionnel: garder aussi reservationLocks (audit / debug)
  for (const day of days) {
    await ctx.db.insert("reservationLocks", {
      vehicleId,
      date: day,
      reservationId,
      createdAt: Date.now(),
    });
  }

  return { ok: true, days };
}

/**
 * Libère les dates pour une réservation (si elles lui appartiennent)
 */
export async function releaseVehicleLocks(opts: {
  ctx: MutationCtx;
  vehicleId: Id<"vehicles">;
  reservationId: Id<"reservations">;
  startDate: string;
  endDate: string;
}) {
  const { ctx, vehicleId, reservationId, startDate, endDate } = opts;
  const days = enumerateDays(startDate, endDate);

  const bucket = await ctx.db
    .query("vehicleLockBuckets")
    .withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId))
    .unique();

  if (bucket) {
    const nextDates = { ...bucket.dates };
    let changed = false;

    for (const day of days) {
      // on ne supprime que si ça pointe vers cette réservation
      if (nextDates[day] === reservationId) {
        delete nextDates[day];
        changed = true;
      }
    }

    if (changed) {
      await ctx.db.patch(bucket._id, { dates: nextDates, updatedAt: Date.now() });
    }
  }

  // supprimer aussi reservationLocks (si tu veux garder la table propre)
  const locks = await ctx.db
    .query("reservationLocks")
    .withIndex("by_reservation", (q) => q.eq("reservationId", reservationId))
    .collect();

  for (const l of locks) await ctx.db.delete(l._id);

  return { ok: true };
}