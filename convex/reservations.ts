import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { emitReservationEvent } from "./_lib/reservationEvents";
import {
  assertRole,
  assertStatus,
  getRoleOrThrow,
  loadReservationOrThrow,
} from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { acquireVehicleLocks, releaseVehicleLocks } from "./_lib/vehicleLocks";
import { userKey } from "./_lib/userKey";
import { authComponent } from "./auth";
import { internal } from "./_generated/api";
import { computeCancellationRefund, computeOwnerCancellationRefund, type CancellationPolicy } from "./_lib/cancellationPolicy";
import { computePricing } from "./_lib/config";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string) {
  if (!ISO_DATE.test(value)) throw new ConvexError("InvalidDateFormat");
}

function assertStartBeforeEnd(startDate: string, endDate: string) {
  if (endDate <= startDate) throw new ConvexError("InvalidDateRange");
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
    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .collect();

    return reservations
      .filter((r) => BLOCKING_STATUSES.has(r.status))
      .map((r) => ({
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
      }));
  },
});

export const getReservation = query({
  args: { id: v.id("reservations") },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return null; }
    if (!user) return null;
    const me = userKey(user);
    const r = await ctx.db.get(args.id);
    if (!r) return null;
    if (r.renterUserId !== me && r.ownerUserId !== me) throw new ConvexError("Forbidden");

    // Hydrate with vehicle info
    const vehicle = await ctx.db.get(r.vehicleId);
    const coverStorageId = vehicle?.imageUrls?.[0];
    const coverUrl = coverStorageId ? await ctx.storage.getUrl(coverStorageId as any) : null;

    return {
      ...r,
      vehicle: vehicle ? {
        title: vehicle.title,
        city: vehicle.city,
        coverUrl,
      } : null,
    };
  },
});

export const listReservationsForOwnerVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) return []; // Vehicle deleted — return empty
    if (String((vehicle as any).ownerUserId) !== ownerUserId) {
      throw new ConvexError("Forbidden");
    }

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

      // Check if this user already submitted checkin/checkout reports
      const myCheckin = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", "checkin").eq("role", "renter")
        )
        .unique();
      const myCheckout = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", "checkout").eq("role", "renter")
        )
        .unique();

      results.push({
        reservation: r,
        vehicle: vehicle ? { ...vehicle, coverUrl } : null,
        hasCheckinReport: !!myCheckin,
        hasCheckoutReport: !!myCheckout,
        hasReviewed: !!(await ctx.db.query("reviews").withIndex("by_reservation_author", (q) => q.eq("reservationId", r._id).eq("authorUserId", renterUserId)).first()),
      });
    }

    return results;
  },
});

// ═══════════════════════════════════════════════════════
// OWNER: list received reservations with vehicle info
// ═══════════════════════════════════════════════════════
export const listOwnerReservationsWithVehicle = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .order("desc")
      .take(80);

    const results: any[] = [];
    for (const r of reservations) {
      const vehicle = await ctx.db.get(r.vehicleId);
      let coverUrl: string | null = null;
      if (vehicle?.imageUrls?.length) {
        coverUrl = await ctx.storage.getUrl(vehicle.imageUrls[0] as any) ?? null;
      }

      // Renter profile
      const renterProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", r.renterUserId))
        .unique();

      let renterAvatarUrl: string | null = null;
      if (renterProfile?.avatarStorageId) {
        renterAvatarUrl = await ctx.storage.getUrl(renterProfile.avatarStorageId) ?? null;
      }

      // Check if owner already submitted checkin/checkout reports
      const ownerCheckin = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", "checkin").eq("role", "owner")
        )
        .unique();
      const ownerCheckout = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", "checkout").eq("role", "owner")
        )
        .unique();

      const hasReviewed = !!(await ctx.db
        .query("reviews")
        .withIndex("by_reservation_author", (q) =>
          q.eq("reservationId", r._id).eq("authorUserId", ownerUserId)
        )
        .first());

      results.push({
        reservation: r,
        vehicle: vehicle ? { ...vehicle, coverUrl } : null,
        renterName: renterProfile?.displayName ?? "Locataire",
        renterAvatar: renterAvatarUrl,
        hasCheckinReport: !!ownerCheckin,
        hasCheckoutReport: !!ownerCheckout,
        hasReviewed,
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

    // 📲 Push notification to renter
    const vehicle = await ctx.db.get(r.vehicleId);
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: r.renterUserId,
      senderUserId: ownerUserId,
      vehicleTitle: vehicle?.title ?? "un véhicule",
      type: "reservation_accepted",
      reservationId: String(r._id),
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

    // 📲 Push notification to renter
    const vehicle = await ctx.db.get(r.vehicleId);
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: r.renterUserId,
      senderUserId: ownerUserId,
      vehicleTitle: vehicle?.title ?? "un véhicule",
      type: "reservation_rejected",
      reservationId: String(r._id),
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

    // 📲 Push notification to owner
    const vehicle = await ctx.db.get(r.vehicleId);
    if (r.ownerUserId) {
      await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
        targetUserId: String(r.ownerUserId),
        senderUserId: renterUserId,
        vehicleTitle: vehicle?.title ?? "un véhicule",
        type: "payment_captured",
        reservationId: String(r._id),
      });
    }

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

    const cancellable: ("requested" | "accepted_pending_payment" | "pickup_pending")[] = ["requested", "accepted_pending_payment", "pickup_pending"];
    assertStatus(r, cancellable);

    // ── Compute refund based on cancellation policy ──
    const vehicle = await ctx.db.get(r.vehicleId);
    const policy = ((vehicle as any)?.cancellationPolicy ?? "moderate") as CancellationPolicy;
    const isPaid = r.paymentStatus === "captured";
    const totalAmount = (r as any).totalAmount ?? ((vehicle?.pricePerDay ?? 0) * Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)));

    const refund = computeCancellationRefund(policy, r.startDate, totalAmount, isPaid);

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: renterUserId,
      nextStatus: "cancelled",
      eventType: "reservation_cancelled",
      idempotencyKey: `res:${String(r._id)}:reservation_cancelled`,
      patch: {
        cancelledAt: Date.now(),
        cancelledBy: "renter",
        cancellationPolicy: policy,
        refundPercent: refund.refundPercent,
        refundAmount: refund.refundAmount,
        penaltyAmount: refund.penaltyAmount,
        cancellationReason: refund.reason,
      },
      payload: {
        reason: "renter_cancelled",
        refundPercent: refund.refundPercent,
        refundAmount: refund.refundAmount,
        penaltyAmount: refund.penaltyAmount,
      },
    });

    // ✅ IMPORTANT: libérer locks si on annule
    await releaseVehicleLocks({
      ctx,
      vehicleId: r.vehicleId,
      reservationId: r._id,
      startDate: r.startDate,
      endDate: r.endDate,
    });

    // 📲 Push notification to owner
    if (r.ownerUserId) {
      await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
        targetUserId: String(r.ownerUserId),
        senderUserId: renterUserId,
        vehicleTitle: vehicle?.title ?? "un véhicule",
        type: "reservation_cancelled_by_renter",
        reservationId: String(r._id),
      });
    }

    return { ok: true, refund };
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

    // ── Owner cancels → full refund to renter ──
    const isPaid = r.paymentStatus === "captured";
    const vehicle = await ctx.db.get(r.vehicleId);
    const totalAmount = (r as any).totalAmount ?? ((vehicle?.pricePerDay ?? 0) * Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000)));
    const refund = computeOwnerCancellationRefund(totalAmount, isPaid);

    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: ownerUserId,
      actorUserId: ownerUserId,
      nextStatus: "cancelled",
      eventType: "reservation_cancelled",
      idempotencyKey: `res:${String(r._id)}:owner_cancelled`,
      patch: {
        cancelledAt: Date.now(),
        cancelledBy: "owner",
        cancellationPolicy: (vehicle as any)?.cancellationPolicy ?? "moderate",
        refundPercent: refund.refundPercent,
        refundAmount: refund.refundAmount,
        penaltyAmount: 0,
        cancellationReason: refund.reason,
      },
      payload: { reason: "owner_cancelled", refundAmount: refund.refundAmount },
    });

    await releaseVehicleLocks({
      ctx,
      vehicleId: r.vehicleId,
      reservationId: r._id,
      startDate: r.startDate,
      endDate: r.endDate,
    });

    // 📲 Push notification to renter
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: r.renterUserId,
      senderUserId: ownerUserId,
      vehicleTitle: vehicle?.title ?? "un véhicule",
      type: "reservation_cancelled_by_owner",
      reservationId: String(r._id),
    });

    return { ok: true, refund };
  },
});

/** DEV: in_progress -> dropoff_pending */
export const markDropoffPending = mutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
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

    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const renterUserId = userKey(user);

    // ✅ KYC check: renter must be verified to book
    const renterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", renterUserId))
      .first();
    if (!renterProfile || renterProfile.kycStatus !== "verified") {
      throw new ConvexError("KycRequired");
    }

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

    const ownerUserId = vehicle.ownerUserId ?? null;
    if (!ownerUserId) throw new ConvexError("VehicleMissingOwner");
    if (ownerUserId === renterUserId) throw new ConvexError("CannotRentOwnVehicle");

    // Check owner-blocked dates
    const blockedSet = new Set((vehicle as any).ownerBlockedDates ?? []);
    if (blockedSet.size > 0) {
      const start = new Date(`${args.startDate}T00:00:00Z`);
      const end = new Date(`${args.endDate}T00:00:00Z`);
      for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
        const iso = d.toISOString().split("T")[0];
        if (blockedSet.has(iso)) throw new ConvexError("OwnerBlockedDates");
      }
    }

    const depositAmount = (vehicle as any).depositSelected ?? (vehicle as any).depositMin ?? 3000;

    const days = Math.max(
      0,
      Math.round(
        (new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / 86400000
      )
    );

    const totalAmount = days * Number((vehicle as any).pricePerDay ?? 0);
    const { serviceFee, ownerPayout } = computePricing({
      days,
      pricePerDay: Number((vehicle as any).pricePerDay ?? 0),
    });
    const commissionAmount = serviceFee;

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
      ownerPayout,
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

    // 📲 Push notification to owner
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: String(ownerUserId),
      senderUserId: renterUserId,
      vehicleTitle: vehicle.title,
      type: "reservation_requested",
      reservationId: String(reservationId),
    });

    return { reservationId };
  },
});

/** Backfills */
export const backfillOwnerUserIdForSeeds = mutation({
  args: {},
  handler: async (ctx) => {
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

/** Preview what happens if the renter cancels — used by the UI to show refund info */
export const getCancellationPreview = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;
    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) return null;

    const vehicle = await ctx.db.get(r.vehicleId);
    if (!vehicle) return null;

    const role = r.renterUserId === me ? "renter" : r.ownerUserId === me ? "owner" : null;
    if (!role) return null;

    const policy = ((vehicle as any).cancellationPolicy ?? "moderate") as CancellationPolicy;
    const isPaid = r.paymentStatus === "captured";
    const days = Math.max(1, Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86_400_000));
    const totalAmount = (r as any).totalAmount ?? (vehicle.pricePerDay * days);

    if (role === "renter") {
      const refund = computeCancellationRefund(policy, r.startDate, totalAmount, isPaid);
      return { ...refund, policy, role, totalAmount };
    } else {
      const refund = computeOwnerCancellationRefund(totalAmount, isPaid);
      return { ...refund, policy, role, totalAmount };
    }
  },
});

export const getMyRoleForReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return null; }
    if (!user) return null;

    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) return null;

    if (r.ownerUserId === me) return "owner";
    if (r.renterUserId === me) return "renter";

    return null;
  },
});

/**
 * DEV / maintenance:
 * annule les réservations acceptées mais jamais payées
 */
export const expireUnpaidReservations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ttlMs = 30 * 60 * 1000; // 30 minutes

    const reservations = await ctx.db
      .query("reservations")
      .withIndex("by_status", (q) => q.eq("status", "accepted_pending_payment"))
      .collect();

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
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
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