import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

// userKey importé depuis _lib/userKey

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const me = userKey(user);

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

    const me = userKey(user);
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

    const me = userKey(user);
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

    const me = userKey(user);

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

    const authId = userKey(user);
    const email = user.email ? String(user.email) : null;

    // 1) si déjà un profile avec authId -> rien à faire
    const already = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", authId))
      .first();
    if (already) return { ok: true as const, migrated: false as const, reason: "already_ok" as const };

    // 2) sinon, tente de retrouver l'ancien profile par email (si tu en avais)
    const old =
      email
        ? await ctx.db
            .query("userProfiles")
            .withIndex("by_user", (q) => q.eq("userId", email))
            .first()
        : null;

    // ✅ FIX: supprimé le fallback dangereux qui prenait le profil le plus récent
    // de N'IMPORTE QUEL utilisateur. Maintenant on ne migre que par email exact.

    if (!old) {
      // pas de profile trouvé -> on en crée un clean
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
