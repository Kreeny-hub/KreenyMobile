import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { releaseDepositDEV, retainDepositDEV } from "./_lib/paymentEngine";
import { getRoleOrThrow } from "./_lib/reservationGuards";

// ── Admin guard (same as reports.ts) ──
import { ADMIN_USER_ID, assertAdmin } from "./_lib/admin";

// ═══════════════════════════════════════════════════════
// Open a dispute (owner or renter)
// ═══════════════════════════════════════════════════════
export const openDispute = mutation({
  args: {
    reservationId: v.id("reservations"),
    reason: v.union(
      v.literal("damage"),
      v.literal("dirty"),
      v.literal("missing_part"),
      v.literal("km_exceeded"),
      v.literal("mechanical"),
      v.literal("other")
    ),
    description: v.string(),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) throw new ConvexError("ReservationNotFound");

    // Only participants
    const role = getRoleOrThrow(r as any, me);

    // Can only dispute from dropoff_pending or completed (within 48h)
    const allowedStatuses = ["dropoff_pending", "completed"];
    if (!allowedStatuses.includes(r.status)) {
      throw new ConvexError("InvalidStatus");
    }

    // Must have at least one checkout condition report
    const checkoutReport = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", "checkout")
      )
      .first();
    if (!checkoutReport) {
      throw new ConvexError("NoCheckoutReport");
    }

    // If completed, check 48h window
    if (r.status === "completed") {
      const completedEvents = await ctx.db
        .query("reservationEvents")
        .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
        .filter((q) => q.eq(q.field("type"), "checkout_completed"))
        .first();
      const completedAt = completedEvents?._creationTime ?? 0;
      const hoursSince = (Date.now() - completedAt) / 3_600_000;
      if (hoursSince > 48) {
        throw new ConvexError("DisputeWindowExpired");
      }
    }

    // Prevent duplicate
    const existing = await ctx.db
      .query("disputes")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();
    if (existing) throw new ConvexError("DisputeAlreadyOpen");

    const description = args.description.trim();
    if (!description || description.length < 10) {
      throw new ConvexError("DescriptionTooShort");
    }

    // Create dispute
    const disputeId = await ctx.db.insert("disputes", {
      reservationId: args.reservationId,
      vehicleId: r.vehicleId,
      openedByUserId: me,
      openedByRole: role,
      reason: args.reason,
      description,
      photoStorageIds: args.photoStorageIds,
      status: "open",
      createdAt: Date.now(),
    });

    // Transition to disputed
    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: me,
      nextStatus: "disputed",
      eventType: "dispute_opened",
      idempotencyKey: `dispute:${String(disputeId)}`,
    });

    // 📲 Notify the other party
    const otherUserId = role === "renter" ? String(r.ownerUserId ?? "") : r.renterUserId;
    if (otherUserId) {
      const vehicle = await ctx.db.get(r.vehicleId) as any;
      await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
        targetUserId: otherUserId,
        senderUserId: me,
        vehicleTitle: vehicle?.title ?? "un véhicule",
        type: "dispute_opened",
        reservationId: String(r._id),
      });
    }

    // 📲 Notify admin
    if (ADMIN_USER_ID) {
      await ctx.scheduler.runAfter(0, internal.push.sendPush, {
        targetUserId: ADMIN_USER_ID,
        title: "⚠️ Nouveau litige",
        body: `${role === "renter" ? "Locataire" : "Propriétaire"} : ${args.reason}`,
        data: { type: "admin_dispute", reservationId: String(r._id) },
      });
    }

    return { disputeId };
  },
});

// ═══════════════════════════════════════════════════════
// Check if dispute can be opened on a reservation
// ═══════════════════════════════════════════════════════
export const canDispute = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return { canOpen: false, reason: "" };
    const me = userKey(user);

    const r = await ctx.db.get(args.reservationId);
    if (!r) return { canOpen: false, reason: "" };

    // Must be participant
    if (r.renterUserId !== me && r.ownerUserId !== me) {
      return { canOpen: false, reason: "" };
    }

    if (!["dropoff_pending", "completed"].includes(r.status)) {
      return { canOpen: false, reason: "status" };
    }

    // Must have at least one checkout condition report
    const checkoutReport = await ctx.db
      .query("conditionReports")
      .withIndex("by_reservation_phase", (q) =>
        q.eq("reservationId", args.reservationId).eq("phase", "checkout")
      )
      .first();
    if (!checkoutReport) {
      return { canOpen: false, reason: "no_checkout" };
    }

    // Check 48h window for completed
    if (r.status === "completed") {
      const completedEvents = await ctx.db
        .query("reservationEvents")
        .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
        .filter((q) => q.eq(q.field("type"), "checkout_completed"))
        .first();
      const completedAt = completedEvents?._creationTime ?? 0;
      if ((Date.now() - completedAt) / 3_600_000 > 48) {
        return { canOpen: false, reason: "expired" };
      }
    }

    // Check no open dispute
    const existing = await ctx.db
      .query("disputes")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();
    if (existing) return { canOpen: false, reason: "already_open" };

    return { canOpen: true, reason: "" };
  },
});

// ═══════════════════════════════════════════════════════
// Get dispute for a reservation (for UI)
// ═══════════════════════════════════════════════════════
export const getForReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("disputes")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .order("desc")
      .first();
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: list all disputes
// ═══════════════════════════════════════════════════════
export const adminListDisputes = query({
  args: { statusFilter: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    let disputes;
    if (args.statusFilter) {
      disputes = await ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
        .order("desc")
        .take(100);
    } else {
      disputes = await ctx.db.query("disputes").order("desc").take(100);
    }

    // Enrich
    return await Promise.all(
      disputes.map(async (d) => {
        const reservation = await ctx.db.get(d.reservationId);
        const vehicle = await ctx.db.get(d.vehicleId) as any;
        const openerProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", d.openedByUserId))
          .unique();

        // Get both party profiles
        const renterProfile = reservation
          ? await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", reservation.renterUserId)).unique()
          : null;
        const ownerProfile = reservation?.ownerUserId
          ? await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", reservation.ownerUserId!)).unique()
          : null;

        // Photo URLs (attached to dispute)
        const photoUrls = d.photoStorageIds
          ? await Promise.all(d.photoStorageIds.map((id) => ctx.storage.getUrl(id)))
          : [];

        // Condition report photos (checkin + checkout)
        const conditionReports = await ctx.db
          .query("conditionReports")
          .withIndex("by_reservation_phase", (q) => q.eq("reservationId", d.reservationId))
          .collect();

        const checkinPhotos: string[] = [];
        const checkoutPhotos: string[] = [];
        for (const cr of conditionReports) {
          const urls: string[] = [];
          for (const storageId of Object.values(cr.requiredPhotos)) {
            const url = await ctx.storage.getUrl(storageId);
            if (url) urls.push(url);
          }
          if (cr.phase === "checkin") checkinPhotos.push(...urls);
          else checkoutPhotos.push(...urls);
        }

        return {
          ...d,
          vehicleTitle: vehicle?.title ?? "Véhicule supprimé",
          openerName: openerProfile?.displayName ?? "Inconnu",
          renterName: renterProfile?.displayName ?? "Inconnu",
          renterPhone: renterProfile?.phone ?? null,
          ownerName: ownerProfile?.displayName ?? "Inconnu",
          ownerPhone: ownerProfile?.phone ?? null,
          depositAmount: (reservation as any)?.depositAmount ?? 0,
          photoUrls: photoUrls.filter(Boolean),
          checkinPhotos,
          checkoutPhotos,
          dates: reservation ? `${reservation.startDate} → ${reservation.endDate}` : "",
        };
      })
    );
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: resolve dispute
// ═══════════════════════════════════════════════════════
export const adminResolveDispute = mutation({
  args: {
    disputeId: v.id("disputes"),
    resolution: v.union(
      v.literal("no_penalty"),
      v.literal("partial"),
      v.literal("full")
    ),
    retainedAmount: v.optional(v.number()),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    const dispute = await ctx.db.get(args.disputeId);
    if (!dispute) throw new ConvexError("NotFound");
    if (dispute.status !== "open") throw new ConvexError("AlreadyResolved");

    const r = await ctx.db.get(dispute.reservationId);
    if (!r) throw new ConvexError("ReservationNotFound");

    const statusMap = {
      no_penalty: "resolved_no_penalty",
      partial: "resolved_partial",
      full: "resolved_full",
    };

    // Update dispute
    await ctx.db.patch(args.disputeId, {
      status: statusMap[args.resolution],
      retainedAmount: args.resolution === "no_penalty" ? 0 : (args.retainedAmount ?? 0),
      adminNote: args.adminNote?.trim() || undefined,
      resolvedAt: Date.now(),
    });

    // Handle deposit
    if (args.resolution === "no_penalty") {
      await releaseDepositDEV({ ctx, reservationId: r._id, actorUserId: "admin" });
    } else {
      await retainDepositDEV({
        ctx,
        reservationId: r._id,
        actorUserId: "admin",
        retainedAmount: args.retainedAmount ?? 0,
        partial: args.resolution === "partial",
      });
    }

    // Transition reservation to completed
    await transitionReservationStatus({
      ctx,
      reservationId: r._id,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: "admin",
      nextStatus: "completed",
      eventType: "dispute_resolved",
      idempotencyKey: `dispute:${String(args.disputeId)}:resolved`,
    });

    // 📲 Notify both parties
    const vehicle = await ctx.db.get(r.vehicleId) as any;
    const title = vehicle?.title ?? "un véhicule";
    const RESOLUTION_LABELS = {
      no_penalty: "Le litige a été résolu sans retenue de caution.",
      partial: `Le litige a été résolu. ${args.retainedAmount ?? 0} MAD retenus sur la caution.`,
      full: "Le litige a été résolu. La caution a été intégralement retenue.",
    };

    for (const userId of [r.renterUserId, String(r.ownerUserId ?? "")]) {
      if (userId) {
        await ctx.scheduler.runAfter(0, internal.push.sendPush, {
          targetUserId: userId,
          title: `Litige résolu — ${title}`,
          body: RESOLUTION_LABELS[args.resolution],
          data: { type: "dispute_resolved", reservationId: String(r._id) },
        });
      }
    }

    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: get dispute stats
// ═══════════════════════════════════════════════════════
export const adminGetDisputeStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return { open: 0, resolved: 0, total: 0 };
    const me = userKey(user);
    if (!ADMIN_USER_ID || me !== ADMIN_USER_ID) return { open: 0, resolved: 0, total: 0 };

    const all = await ctx.db.query("disputes").collect();
    return {
      open: all.filter((d) => d.status === "open").length,
      resolved: all.filter((d) => d.status !== "open").length,
      total: all.length,
    };
  },
});
