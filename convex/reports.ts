import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

// ── Admin user ID — CONFIGURE THIS before launch ──
// Go to Convex dashboard → userProfiles table → find your row → copy userId
// Paste it here to receive push notifications for every report
const ADMIN_USER_ID = "k577z6y2e2m0zw6706pv12by9n81kf2d";
// Example: const ADMIN_USER_ID = "jh7abc123def456ghi789";

function assertAdmin(userId: string) {
  if (!ADMIN_USER_ID || userId !== ADMIN_USER_ID) {
    throw new ConvexError("Forbidden");
  }
}

// ═══════════════════════════════════════════════════════
// Submit a report
// ═══════════════════════════════════════════════════════
export const submitReport = mutation({
  args: {
    targetType: v.union(v.literal("vehicle"), v.literal("user"), v.literal("reservation"), v.literal("message")),
    targetId: v.string(),
    reason: v.union(
      v.literal("inappropriate"),
      v.literal("fraud"),
      v.literal("dangerous"),
      v.literal("fake"),
      v.literal("other")
    ),
    comment: v.optional(v.string()),
    messageText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const reporterUserId = userKey(user);

    // Prevent duplicate reports
    const existing = await ctx.db
      .query("reports")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .filter((q) => q.eq(q.field("reporterUserId"), reporterUserId))
      .first();

    if (existing) throw new ConvexError("AlreadyReported");

    // Can't report yourself
    if (args.targetType === "user" && args.targetId === reporterUserId) {
      throw new ConvexError("CannotReportSelf");
    }

    await ctx.db.insert("reports", {
      reporterUserId,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason,
      comment: args.comment?.trim() || undefined,
      messageText: args.messageText?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });

    // 📲 Notify admin
    const REASON_LABELS: Record<string, string> = {
      inappropriate: "Contenu inapproprié",
      fraud: "Fraude",
      dangerous: "Dangereux",
      fake: "Faux",
      other: "Autre",
    };
    if (ADMIN_USER_ID) {
      await ctx.scheduler.runAfter(0, internal.push.sendPush, {
        targetUserId: ADMIN_USER_ID,
        title: `🚨 Signalement : ${args.targetType}`,
        body: `Raison : ${REASON_LABELS[args.reason] ?? args.reason}${args.comment ? ` — "${args.comment.slice(0, 60)}"` : ""}`,
        data: { type: "admin_report", targetType: args.targetType, targetId: args.targetId },
      });
    }

    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// Check if current user already reported this target
// ═══════════════════════════════════════════════════════
export const hasReported = query({
  args: {
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return false;
    const me = userKey(user);

    const existing = await ctx.db
      .query("reports")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .filter((q) => q.eq(q.field("reporterUserId"), me))
      .first();

    return !!existing;
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: check if current user is admin
// ═══════════════════════════════════════════════════════
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    if (!ADMIN_USER_ID) return false;
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return false;
    return userKey(user) === ADMIN_USER_ID;
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: list all reports (newest first)
// ═══════════════════════════════════════════════════════
export const adminListReports = query({
  args: {
    statusFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    let reports;
    if (args.statusFilter) {
      reports = await ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
        .order("desc")
        .take(100);
    } else {
      reports = await ctx.db
        .query("reports")
        .order("desc")
        .take(100);
    }

    // Enrich with reporter info + target info
    const enriched = await Promise.all(
      reports.map(async (report) => {
        // Reporter name
        const reporterProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", report.reporterUserId))
          .unique();

        // Target info
        let targetLabel = report.targetId;
        if (report.targetType === "vehicle") {
          const vehicle = await ctx.db.get(report.targetId as any) as any;
          targetLabel = vehicle ? `${vehicle.title ?? "Véhicule"} (${vehicle.city ?? ""})` : report.targetId;
        } else if (report.targetType === "user") {
          const targetProfile = await ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", report.targetId))
            .unique();
          targetLabel = targetProfile?.displayName ?? report.targetId;
        } else if (report.targetType === "message") {
          // Fetch message + sender name
          const msg = await ctx.db.get(report.targetId as any) as any;
          if (msg?.senderUserId) {
            const senderProfile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user", (q) => q.eq("userId", msg.senderUserId))
              .unique();
            targetLabel = `Message de ${senderProfile?.displayName ?? "Inconnu"}`;
          } else {
            targetLabel = "Message";
          }
        }

        return {
          ...report,
          reporterName: reporterProfile?.displayName ?? "Inconnu",
          targetLabel,
        };
      })
    );

    return enriched;
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: update report status
// ═══════════════════════════════════════════════════════
export const adminUpdateReportStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    await ctx.db.patch(args.reportId, { status: args.status });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: deactivate a vehicle (from report)
// ═══════════════════════════════════════════════════════
export const adminDeactivateVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("NotFound");

    await ctx.db.patch(args.vehicleId, { isActive: false });
    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// ADMIN: get stats
// ═══════════════════════════════════════════════════════
export const adminGetStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    const allReports = await ctx.db.query("reports").collect();
    const pending = allReports.filter((r) => r.status === "pending").length;
    const reviewed = allReports.filter((r) => r.status === "reviewed").length;
    const dismissed = allReports.filter((r) => r.status === "dismissed").length;

    const allUsers = await ctx.db.query("userProfiles").collect();
    const allVehicles = await ctx.db.query("vehicles").collect();
    const activeVehicles = allVehicles.filter((v) => v.isActive !== false).length;
    const allReservations = await ctx.db.query("reservations").collect();

    return {
      reports: { pending, reviewed, dismissed, total: allReports.length },
      users: allUsers.length,
      vehicles: { total: allVehicles.length, active: activeVehicles },
      reservations: allReservations.length,
    };
  },
});
