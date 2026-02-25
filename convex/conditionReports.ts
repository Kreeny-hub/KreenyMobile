import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { holdDepositDEV, releaseDepositDEV } from "./_lib/paymentEngine";
import { emitReservationEvent } from "./_lib/reservationEvents";
import { assertStatus, getRoleOrThrow, loadReservationOrThrow } from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

const REQUIRED_SLOTS = [
  "front",
  "front_left",
  "front_right",
  "back",
  "back_left",
  "back_right",
  "interior_front",
  "interior_back",
  "dashboard",
] as const;

function assertRequiredSlots(requiredPhotos: Record<string, unknown>) {
  for (const slot of REQUIRED_SLOTS) {
    if (!requiredPhotos[slot]) {
      throw new ConvexError("MissingRequiredPhotos");
    }
  }
}

export const getConditionReport = query({
  args: {
    reservationId: v.id("reservations"),
    phase: v.union(v.literal("checkin"), v.literal("checkout")),
    role: v.union(v.literal("owner"), v.literal("renter")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new ConvexError("ReservationNotFound");

    // ✅ seuls le loueur et le locataire peuvent lire
    if (reservation.renterUserId !== me && reservation.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    return await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase_role", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", args.phase).eq("role", args.role)
      )
      .unique();
  },
});

// ✅ version “spectateur” : renvoie des URLs lisibles par l’app
export const getConditionReportWithUrls = query({
  args: {
    reservationId: v.id("reservations"),
    phase: v.union(v.literal("checkin"), v.literal("checkout")),
    role: v.union(v.literal("owner"), v.literal("renter")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new ConvexError("ReservationNotFound");

    // ✅ seuls le loueur et le locataire peuvent lire
    if (reservation.renterUserId !== me && reservation.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const report = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase_role", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", args.phase).eq("role", args.role)
      )
      .unique();

    if (!report) return null;

    const requiredUrls: Record<string, string | null> = {};
    for (const [slot, storageId] of Object.entries(report.requiredPhotos)) {
      requiredUrls[slot] = await ctx.storage.getUrl(storageId);
    }

    const detailUrls = await Promise.all(
      report.detailPhotos.map(async (d) => ({
        url: await ctx.storage.getUrl(d.storageId),
        note: d.note ?? "",
      }))
    );

    const videoUrl = report.video360StorageId ? await ctx.storage.getUrl(report.video360StorageId) : null;

    return {
      _id: report._id,
      reservationId: report.reservationId,
      phase: report.phase,
      role: report.role,
      requiredUrls,
      detailUrls,
      videoUrl,
      submittedByUserId: report.submittedByUserId,
      completedAt: report.completedAt,
    };
  },
});

export const canSubmitConditionReport = query({
  args: {
    reservationId: v.id("reservations"),
    phase: v.union(v.literal("checkin"), v.literal("checkout")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw new ConvexError("ReservationNotFound");

    const isOwner = reservation.ownerUserId === me;
    const isRenter = reservation.renterUserId === me;

    if (!isOwner && !isRenter) throw new ConvexError("Forbidden");

    const role = isOwner ? "owner" : "renter";

    // Status attendu selon la phase
    const expectedStatus = args.phase === "checkin" ? "pickup_pending" : "dropoff_pending";

    // Si pas au bon moment, on refuse (mais on explique)
    if (reservation.status !== expectedStatus) {
      return {
        canSubmit: false,
        reason: "InvalidStatus" as const,
        role,
        expectedStatus,
        currentStatus: reservation.status,
      };
    }

    // Déjà soumis ?
    const existing = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase_role", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", args.phase).eq("role", role)
      )
      .unique();

    if (existing) {
      return { canSubmit: false, reason: "AlreadySubmitted" as const, role };
    }

    return { canSubmit: true, reason: null, role };
  },
});

export const submitConditionReport = mutation({
  args: {
    reservationId: v.id("reservations"),
    phase: v.union(v.literal("checkin"), v.literal("checkout")),
    role: v.union(v.literal("owner"), v.literal("renter")),

    requiredPhotos: v.record(v.string(), v.id("_storage")),
    detailPhotos: v.array(
      v.object({
        storageId: v.id("_storage"),
        note: v.optional(v.string()),
      })
    ),
    video360StorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const submittedByUserId = userKey(user);
    const reservation = await loadReservationOrThrow(ctx, args.reservationId);

    // ✅ qui suis-je sur cette réservation (owner ou renter) ?
    const realRole = getRoleOrThrow(reservation, submittedByUserId);

    // ✅ empêcher de mentir sur le rôle dans l'URL
    if (args.role !== realRole) throw new ConvexError("Forbidden");

    // ✅ phase autorisée selon le status
    if (args.phase === "checkin") {
      assertStatus(reservation, ["pickup_pending"]);
    }
    if (args.phase === "checkout") {
      assertStatus(reservation, ["dropoff_pending"]);
    }

    // 🔒 anti-triche: une seule fois
    const existing = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase_role", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", args.phase).eq("role", args.role)
      )
      .unique();

    if (existing) throw new ConvexError("AlreadySubmitted");

    assertRequiredSlots(args.requiredPhotos);

    if (args.detailPhotos.length > 6) throw new ConvexError("TooManyDetailPhotos");

    const reportId = await ctx.db.insert("conditionReports", {
      reservationId: args.reservationId,
      phase: args.phase,
      role: args.role,
      requiredPhotos: args.requiredPhotos,
      detailPhotos: args.detailPhotos,
      video360StorageId: args.video360StorageId,
      submittedByUserId,
      completedAt: Date.now(),
    });

    await emitReservationEvent({
      ctx,
      reservationId: reservation._id,
      renterUserId: reservation.renterUserId,
      ownerUserId: String(reservation.ownerUserId ?? ""),
      type: "condition_report_submitted",
      actorUserId: submittedByUserId,
      payload: { phase: args.phase, role: args.role, reportId },
      // idempotent : si retry upload, pas de doublon de message
      idempotencyKey: `report:${String(reportId)}`,
    });

    // Vérifie si les deux reports existent pour cette phase
    const reportsForPhase = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", args.phase)
      )
      .take(4); // max 2 par phase (owner + renter)

    const ownerDone = reportsForPhase.some(r => r.role === "owner");
    const renterDone = reportsForPhase.some(r => r.role === "renter");

    if (ownerDone && renterDone) {
      // ✅ anti-race condition: on relit la réservation au moment exact
      // pour éviter de déclencher 2 fois les transitions + cautions.
      const fresh = await ctx.db.get(reservation._id);
      if (!fresh) throw new ConvexError("ReservationNotFound");

      if (args.phase === "checkin") {
        // On ne lance QUE si on est encore au bon statut
        if (fresh.status === "pickup_pending") {
          await transitionReservationStatus({
            ctx,
            reservationId: reservation._id,
            renterUserId: reservation.renterUserId,
            ownerUserId: String(reservation.ownerUserId ?? ""),
            actorUserId: "system",
            nextStatus: "in_progress",
            eventType: "checkin_completed",
            idempotencyKey: `phase:${String(reservation._id)}:checkin_completed`,
          });

          // ✅ hold (caution) au démarrage réel — une seule fois
          await holdDepositDEV({
            ctx,
            reservationId: reservation._id,
            actorUserId: "system",
          });
        }
      }

      if (args.phase === "checkout") {
        if (fresh.status === "dropoff_pending") {
          await transitionReservationStatus({
            ctx,
            reservationId: reservation._id,
            renterUserId: reservation.renterUserId,
            ownerUserId: String(reservation.ownerUserId ?? ""),
            actorUserId: "system",
            nextStatus: "completed",
            eventType: "checkout_completed",
            idempotencyKey: `phase:${String(reservation._id)}:checkout_completed`,
          });

          // ✅ release (caution) à la fin — une seule fois
          await releaseDepositDEV({
            ctx,
            reservationId: reservation._id,
            actorUserId: "system",
          });
        }
      }
    }
    return { reportId };
  },
});



