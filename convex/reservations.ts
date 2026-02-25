import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { emitReservationEvent } from "./_lib/reservationEvents";
import {
  assertRole,
  assertStatus,
  getRoleOrThrow,
  loadReservationOrThrow,
} from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { acquireVehicleLocks, releaseVehicleLocks } from "./_lib/vehicleLocks";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";
import {
  BLOCKING_STATUSES,
  CANCELLABLE_STATUSES,
  assertDevOnly,
} from "./_lib/enums";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string) {
  if (!ISO_DATE.test(value)) throw new ConvexError("InvalidDateFormat");
}

function assertStartBeforeEnd(startDate: string, endDate: string) {
  if (endDate <= startDate) throw new ConvexError("InvalidDateRange");
}

// ✅ FIX: Interdire les réservations dans le passé
function assertNotInPast(startDate: string) {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  if (startDate < todayStr) throw new ConvexError("DateInPast");
}

// ✅ FIX: Limiter la durée max de réservation (90 jours)
function assertReasonableDuration(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 90) throw new ConvexError("DurationTooLong");
}

const BLOCKING_STATUSES = new Set([
  "requested",
  "accepted_pending_payment",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
]);

export const getReservationsForVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    // ✅ Optimisé + borné (un véhicule ne devrait pas avoir des milliers de résas)
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .take(500);

    return reservations
      .filter((r) => BLOCKING_STATUSES.has(r.status as any))
      .map((r) => ({
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      }));
  },
});

export const listReservationsForOwnerVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String((vehicle as any).ownerUserId) !== ownerUserId) {
      throw new ConvexError("Forbidden");
    }

    // ✅ Optimisé : utilise l'index by_vehicle
    return await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .order("desc")
      .take(50);
  },
});

export const listMyReservations = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    // ✅ Optimisé : utilise l'index by_renter
    return await ctx.db
      .query("reservations")
      .withIndex("by_renter", (q) => q.eq("renterUserId", renterUserId))
      .order("desc")
      .take(50);
  },
});

export const listMyReservationsWithVehicle = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_renter", (q) => q.eq("renterUserId", renterUserId))
      .order("desc")
      .take(50);

    const results: any[] = [];
    for (const r of reservations) {
      const vehicle = await ctx.db.get(r.vehicleId);
      let coverUrl: string | null = null;
      if (vehicle?.imageUrls?.length) {
        coverUrl = await ctx.storage.getUrl(vehicle.imageUrls[0] as any) ?? null;
      }
      results.push({
        reservation: r,
        vehicle: vehicle ? { ...vehicle, coverUrl } : null,
      });
    }

    return results;
  },
});

/** OWNER: accepte */
export const acceptReservation = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, ownerUserId);
    assertRole(role, ["owner"]);
    assertStatus(r, ["requested"]);

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: ownerUserId,
      actorUserId: ownerUserId,
      nextStatus: "accepted_pending_payment",
      eventType: "reservation_accepted",
      patch: { acceptedAt: Date.now() },
      idempotencyKey: `res:${String(r._id)}:reservation_accepted`,
    });

    return { ok: true };
  },
});

/** OWNER: rejette -> ✅ libère locks */
export const rejectReservation = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, ownerUserId);
    assertRole(role, ["owner"]);
    assertStatus(r, ["requested"]);

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: ownerUserId,
      actorUserId: ownerUserId,
      nextStatus: "rejected",
      eventType: "reservation_rejected",
      idempotencyKey: `res:${String(r._id)}:reservation_rejected`,
    });

    // ✅ IMPORTANT: libérer locks si on rejette
    await releaseVehicleLocks({
      ctx,
      vehicleId: r.vehicleId,
      reservationId: r._id,
      startDate: r.startDate,
      endDate: r.endDate,
    });

    return { ok: true };
  },
});

/** RENTER: init paiement (pas de changement de status) */
export const initPayment = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, renterUserId);
    assertRole(role, ["renter"]);
    assertStatus(r, ["accepted_pending_payment"]);

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: renterUserId,
      nextStatus: r.status,
      eventType: "payment_initialized",
      patch: { paymentStatus: "requires_action" },
      idempotencyKey: `res:${String(r._id)}:payment_initialized`,
    });

    return {
      ok: true,
      currency: r.currency ?? "MAD",
      totalAmount: r.totalAmount ?? 0,
      depositAmount: r.depositAmount ?? 0,
    };
  },
});

/** RENTER: paiement capturé (DEV) */
export const markReservationPaid = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    assertDevOnly(); // 🔒 DEV ONLY
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, renterUserId);
    assertRole(role, ["renter"]);

    assertStatus(r, ["accepted_pending_payment"]);
    if (r.paymentStatus !== "requires_action") throw new ConvexError("PaymentNotInitialized");

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: renterUserId,
      nextStatus: "pickup_pending",
      eventType: "payment_captured",
      patch: { paymentStatus: "captured" },
      idempotencyKey: `res:${String(r._id)}:payment_captured`,
    });

    return { ok: true };
  },
});

/** RENTER: annule -> ✅ libère locks */
export const cancelReservation = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, renterUserId);
    assertRole(role, ["renter"]);

    assertStatus(r, Array.from(CANCELLABLE_STATUSES));

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: renterUserId,
      nextStatus: "cancelled",
      eventType: "reservation_cancelled",
      idempotencyKey: `res:${String(r._id)}:reservation_cancelled`,
    });

    // ✅ IMPORTANT: libérer locks si on annule
    await releaseVehicleLocks({
      ctx,
      vehicleId: r.vehicleId,
      reservationId: r._id,
      startDate: r.startDate,
      endDate: r.endDate,
    });

    return { ok: true };
  },
});

/** OWNER: annule une réservation */
export const ownerCancelReservation = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const r = await loadReservationOrThrow(ctx, args.reservationId);

    const role = getRoleOrThrow(r, ownerUserId);
    assertRole(role, ["owner"]);

    const cancellable = new Set(["requested", "accepted_pending_payment", "pickup_pending"]);
    if (!cancellable.has(r.status)) throw new ConvexError("InvalidStatus");

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: ownerUserId,
      actorUserId: ownerUserId,
      nextStatus: "cancelled",
      eventType: "reservation_cancelled",
      idempotencyKey: `res:${String(r._id)}:owner_cancelled`,
      payload: { reason: "owner_cancelled" },
    });

    await releaseVehicleLocks({
      ctx,
      vehicleId: r.vehicleId,
      reservationId: r._id,
      startDate: r.startDate,
      endDate: r.endDate,
    });

    return { ok: true };
  },
});

/** DEV: in_progress -> dropoff_pending */
export const markDropoffPending = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    assertDevOnly(); // 🔒 DEV ONLY
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) throw new ConvexError("ReservationNotFound");

    if (r.renterUserId !== me && r.ownerUserId !== me) throw new ConvexError("Forbidden");
    if (r.status !== "in_progress") throw new ConvexError("InvalidStatus");

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: me,
      nextStatus: "dropoff_pending",
      eventType: "dropoff_pending",
      idempotencyKey: `phase:${String(r._id)}:dropoff_pending`,
    });

    return { ok: true };
  },
});

/** CREATE reservation + locks + rollback si problème */
export const createReservation = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    assertIsoDate(args.startDate);
    assertIsoDate(args.endDate);
    assertStartBeforeEnd(args.startDate, args.endDate);
    assertNotInPast(args.startDate);
    assertReasonableDuration(args.startDate, args.endDate);

    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    const cooldownMs = 60 * 60 * 1000;

    const existingSamePair = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle_renter", (q) =>
        q.eq("vehicleId", args.vehicleId).eq("renterUserId", renterUserId)
      )
      .order("desc")
      .take(1);

    const last = existingSamePair[0];
    if (last) {
      if (BLOCKING_STATUSES.has(last.status)) throw new ConvexError("AlreadyRequested");
      if (
        (last.status === "cancelled" || last.status === "rejected") &&
        Date.now() - last.createdAt < cooldownMs
      ) {
        throw new ConvexError("CooldownActive");
      }
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");

    const ownerUserId =
      (vehicle as any).ownerUserId ?? (vehicle as any).ownerId ?? (vehicle as any).owner ?? null;
    if (!ownerUserId) throw new ConvexError("VehicleMissingOwner");
    if (String(ownerUserId) === renterUserId) throw new ConvexError("CannotRentOwnVehicle");

    const depositAmount = (vehicle as any).depositSelected ?? (vehicle as any).depositMin ?? 3000;

    const days = Math.max(
      0,
      Math.round(
        (new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / 86400000
      )
    );

    const totalAmount = days * Number((vehicle as any).pricePerDay ?? 0);
    const commissionAmount = 0;

    // ✅ on crée la réservation, puis locks, avec rollback si besoin
    const reservationId = await ctx.db.insert("reservations", {
      vehicleId: args.vehicleId,
      renterUserId,
      ownerUserId: String(ownerUserId),
      startDate: args.startDate,
      endDate: args.endDate,
      status: "requested",
      createdAt: Date.now(),
      version: 1,

      depositAmount,
      currency: "MAD",
      totalAmount,
      commissionAmount,
      paymentStatus: "unpaid",
    });

    try {
      await acquireVehicleLocks({
        ctx,
        vehicleId: args.vehicleId,
        reservationId,
        startDate: args.startDate,
        endDate: args.endDate,
      });
    } catch (e) {
      // rollback: on supprime la réservation si on n'arrive pas à locker
      await ctx.db.delete(reservationId);
      throw e;
    }

    await emitReservationEvent({
      ctx,
      reservationId,
      renterUserId,
      ownerUserId: String(ownerUserId),
      type: "reservation_created",
      actorUserId: renterUserId,
    });

    return { reservationId };
  },
});

/** Backfills */
export const backfillOwnerUserIdForSeeds = mutation({
  args: {},
  handler: async (ctx) => {
    assertDevOnly(); // 🔒 DEV ONLY
    const reservations = await ctx.db.query("reservations").collect();

    for (const r of reservations) {
      if ((r as any).ownerUserId) continue;

      const vehicle = await ctx.db.get(r.vehicleId);
      const ownerUserId = (vehicle as any)?.ownerUserId ?? "seed-owner";

      await ctx.db.patch(r._id, { ownerUserId: String(ownerUserId) });
    }

    return { ok: true };
  },
});

export const backfillReservationDeposits = mutation({
  args: {},
  handler: async (ctx) => {
    assertDevOnly(); // 🔒 DEV ONLY
    const reservations = await ctx.db.query("reservations").collect();

    for (const r of reservations) {
      if ((r as any).depositAmount) continue;

      const vehicle = await ctx.db.get(r.vehicleId);
      const depositAmount =
        (vehicle as any)?.depositSelected ?? (vehicle as any)?.depositMin ?? 3000;

      await ctx.db.patch(r._id, { depositAmount });
    }

    return { ok: true };
  },
});

export const getMyRoleForReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) throw new ConvexError("ReservationNotFound");

    if (r.ownerUserId === me) return "owner";
    if (r.renterUserId === me) return "renter";

    throw new ConvexError("Forbidden");
  },
});

/**
 * DEV / maintenance:
 * annule les réservations acceptées mais jamais payées
 */
// ✅ FIX: internalMutation — seul le cron peut l'appeler, pas les utilisateurs
export const expireUnpaidReservations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ttlMs = 30 * 60 * 1000; // 30 minutes

    // ✅ Optimisé : utilise l'index by_status
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_status", (q) => q.eq("status", "accepted_pending_payment"))
      .take(200);

    let count = 0;

    for (const r of reservations) {
      const acceptedAt = (r as any).acceptedAt ?? r.createdAt;
      if (now - acceptedAt < ttlMs) continue;

      // 1) annuler
      await transitionReservationStatus({
        ctx,
        reservationId: r._id,
        renterUserId: r.renterUserId,
        ownerUserId: String(r.ownerUserId ?? ""),
        actorUserId: "system",
        nextStatus: "cancelled",
        eventType: "reservation_cancelled",
        idempotencyKey: `expire:${String(r._id)}`,
        payload: { reason: "payment_timeout" },
      });

      // 2) libérer les dates
      await releaseVehicleLocks({
        ctx,
        vehicleId: r.vehicleId,
        reservationId: r._id,
        startDate: r.startDate,
        endDate: r.endDate,
      });

      count++;
    }

    return { ok: true, expired: count };
  },
});

/** Cron: passe automatiquement en dropoff_pending les locations dont la date de fin est dépassée */
export const autoTransitionExpiredRentals = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const reservations = await ctx.db
      .query("reservations")
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .collect();

    let count = 0;

    for (const r of reservations) {
      if (r.endDate > todayStr) continue;

      await transitionReservationStatus({
        ctx,
        reservationId: r._id,
        renterUserId: r.renterUserId,
        ownerUserId: String(r.ownerUserId ?? ""),
        actorUserId: "system",
        nextStatus: "dropoff_pending",
        eventType: "dropoff_pending",
        idempotencyKey: `auto_return:${String(r._id)}`,
        payload: { reason: "end_date_reached" },
      });

      count++;
    }

    return { ok: true, transitioned: count };
  },
});