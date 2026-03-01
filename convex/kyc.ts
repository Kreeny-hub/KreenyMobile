import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

const ADMIN_USER_ID = "k577z6y2e2m0zw6706pv12by9n81kf2d";
function assertAdmin(userId: string) {
  if (!ADMIN_USER_ID || userId !== ADMIN_USER_ID) throw new ConvexError("Forbidden");
}

// ══════════════════════════════════════════════════════════
// Submit KYC documents (4 photos: CIN recto/verso + Permis recto/verso)
// ══════════════════════════════════════════════════════════
export const submitKyc = mutation({
  args: {
    cinRecto: v.id("_storage"),
    cinVerso: v.id("_storage"),
    permisRecto: v.id("_storage"),
    permisVerso: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    if (!profile) throw new ConvexError("ProfileNotFound");

    // Already verified
    if (profile.kycStatus === "verified") {
      throw new ConvexError("AlreadyVerified");
    }

    // Already pending
    if (profile.kycStatus === "pending") {
      throw new ConvexError("AlreadyPending");
    }

    const now = Date.now();

    // Delete old documents if re-submitting after rejection
    const oldDocs = await ctx.db
      .query("kycDocuments")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    for (const doc of oldDocs) {
      await ctx.db.delete(doc._id);
    }

    // Insert 4 documents
    const docs = [
      { docType: "cin" as const, side: "recto" as const, storageId: args.cinRecto },
      { docType: "cin" as const, side: "verso" as const, storageId: args.cinVerso },
      { docType: "permis" as const, side: "recto" as const, storageId: args.permisRecto },
      { docType: "permis" as const, side: "verso" as const, storageId: args.permisVerso },
    ];

    for (const doc of docs) {
      await ctx.db.insert("kycDocuments", {
        userId: me,
        docType: doc.docType,
        side: doc.side,
        storageId: doc.storageId,
        createdAt: now,
      });
    }

    // Update profile status
    await ctx.db.patch(profile._id, {
      kycStatus: "pending",
      kycRejectionReason: undefined,
      updatedAt: now,
    });

    // Notify admin
    if (ADMIN_USER_ID) {
      const name = profile.displayName ?? "Utilisateur";
      await ctx.scheduler.runAfter(0, internal.push.sendPush, {
        targetUserId: ADMIN_USER_ID,
        title: "📋 Nouvelle demande KYC",
        body: `${name} a soumis ses documents de vérification.`,
        data: { type: "admin_kyc" },
      });
    }

    return { ok: true };
  },
});

// ══════════════════════════════════════════════════════════
// Get my KYC status + documents
// ══════════════════════════════════════════════════════════
export const getMyKycStatus = query({
  args: {},
  handler: async (ctx) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return null; }
    if (!user) return null;
    const me = userKey(user);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    if (!profile) return { status: "none", rejectionReason: null, documents: [] };

    const docs = await ctx.db
      .query("kycDocuments")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();

    // Resolve URLs
    const documents = await Promise.all(
      docs.map(async (d) => ({
        docType: d.docType,
        side: d.side,
        url: await ctx.storage.getUrl(d.storageId),
      }))
    );

    return {
      status: profile.kycStatus ?? "none",
      rejectionReason: (profile as any).kycRejectionReason ?? null,
      documents,
    };
  },
});

// ══════════════════════════════════════════════════════════
// ADMIN: List pending KYC submissions
// ══════════════════════════════════════════════════════════
export const adminListKyc = query({
  args: {
    statusFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    // Get all profiles with kycStatus
    const allProfiles = await ctx.db
      .query("userProfiles")
      .collect();

    let profiles = allProfiles.filter((p) => {
      const status = p.kycStatus ?? "none";
      if (args.statusFilter) return status === args.statusFilter;
      return status === "pending" || status === "verified" || status === "rejected";
    });

    // Sort: pending first, then by updatedAt desc
    profiles.sort((a, b) => {
      if (a.kycStatus === "pending" && b.kycStatus !== "pending") return -1;
      if (b.kycStatus === "pending" && a.kycStatus !== "pending") return 1;
      return b.updatedAt - a.updatedAt;
    });

    // Take 50 max
    profiles = profiles.slice(0, 50);

    // Enrich with documents + avatar
    const enriched = await Promise.all(
      profiles.map(async (p) => {
        const docs = await ctx.db
          .query("kycDocuments")
          .withIndex("by_user", (q) => q.eq("userId", p.userId))
          .collect();

        const documents = await Promise.all(
          docs.map(async (d) => ({
            docType: d.docType,
            side: d.side,
            url: await ctx.storage.getUrl(d.storageId),
          }))
        );

        const avatarUrl = p.avatarStorageId
          ? await ctx.storage.getUrl(p.avatarStorageId)
          : null;

        return {
          _id: p._id,
          userId: p.userId,
          displayName: p.displayName ?? "Utilisateur",
          avatarUrl,
          kycStatus: p.kycStatus ?? "none",
          updatedAt: p.updatedAt,
          documents,
        };
      })
    );

    return enriched;
  },
});

// ══════════════════════════════════════════════════════════
// ADMIN: Approve or reject KYC
// ══════════════════════════════════════════════════════════
export const adminReviewKyc = mutation({
  args: {
    profileId: v.id("userProfiles"),
    decision: v.union(v.literal("verified"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    assertAdmin(userKey(user));

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new ConvexError("ProfileNotFound");

    const now = Date.now();
    const patch: any = {
      kycStatus: args.decision,
      updatedAt: now,
    };
    if (args.decision === "rejected") {
      patch.kycRejectionReason = args.rejectionReason?.trim() || "Documents non conformes";
    } else {
      patch.kycRejectionReason = undefined;
    }

    await ctx.db.patch(args.profileId, patch);

    // Notify user
    const title = args.decision === "verified"
      ? "✅ Identité vérifiée"
      : "❌ Vérification refusée";
    const body = args.decision === "verified"
      ? "Ton identité a été vérifiée. Tu peux maintenant réserver des véhicules !"
      : `Ta vérification a été refusée : ${patch.kycRejectionReason}. Tu peux resoumettre tes documents.`;

    await ctx.scheduler.runAfter(0, internal.push.sendPush, {
      targetUserId: profile.userId,
      title,
      body,
      data: { type: "kyc_result" },
    });

    return { ok: true };
  },
});
