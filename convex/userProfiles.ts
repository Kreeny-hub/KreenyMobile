import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

function getMe(user: any) {
  // ✅ Toujours présent côté Convex Better Auth
  return String(user._id);
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const me = getMe(user);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    return profile ?? null;
  },
});

export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const me = getMe(user);
    const now = Date.now();

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
      return { ok: true as const, profileId: existing._id };
    }

    const profileId = await ctx.db.insert("userProfiles", {
      userId: me,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true as const, profileId };
  },
});

export const setMyAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const me = getMe(user);
    const now = Date.now();

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    // si pas de profile, on le crée
    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId: me,
        createdAt: now,
        updatedAt: now,
        avatarStorageId: args.storageId,
      });
      return { ok: true as const, profileId };
    }

    await ctx.db.patch(profile._id, {
      avatarStorageId: args.storageId,
      updatedAt: now,
    });

    return { ok: true as const };
  },
});

export const getMyAvatarUrl = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const me = getMe(user);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();

    if (!profile?.avatarStorageId) return null;

    const url = await ctx.storage.getUrl(profile.avatarStorageId);
    return url;
  },
});

export const getProfileByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const migrateMyProfileToAuthId = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const authId = String(user._id);
    const email = user.email ? String(user.email) : null;

    // 1) si déjà un profile avec authId -> rien à faire
    const already = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", authId))
      .first();
    if (already) return { ok: true as const, migrated: false as const, reason: "already_ok" as const };

    // 2) sinon, tente de retrouver l’ancien profile par email (si tu en avais)
    let old =
      email
        ? await ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", email))
            .first()
        : null;

    // 3) ou par "k577..." (ton ancien id app) -> on le récupère depuis userProfiles existant le plus récent
    // (si tu n’as qu’un profil, ça suffit)
    if (!old) {
      old = await ctx.db.query("userProfiles").order("desc").first();
    }

    if (!old) {
      // pas de profile du tout -> on en crée un clean
      const now = Date.now();
      const profileId = await ctx.db.insert("userProfiles", {
        userId: authId,
        createdAt: now,
        updatedAt: now,
      });
      return { ok: true as const, migrated: true as const, created: true as const, profileId };
    }

    await ctx.db.patch(old._id, { userId: authId, updatedAt: Date.now() });
    return { ok: true as const, migrated: true as const, created: false as const, profileId: old._id };
  },
});