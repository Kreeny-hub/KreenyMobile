import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

/**
 * Toggle favorite on/off. Returns the new state.
 */
export const toggle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Unauthenticated");
    const me = userKey(user);

    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_vehicle", (q) => q.eq("userId", me).eq("vehicleId", vehicleId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorited: false };
    }

    await ctx.db.insert("favorites", {
      userId: me,
      vehicleId,
      createdAt: Date.now(),
    });
    return { favorited: true };
  },
});

/**
 * List current user's favorites with vehicle cover + info.
 */
export const listMy = query({
  handler: async (ctx) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return []; }
    if (!user) return [];
    const me = userKey(user);

    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .order("desc")
      .take(50);

    const results = [];
    for (const f of favs) {
      const v = await ctx.db.get(f.vehicleId);
      if (!v) continue;

      let coverUrl: string | null = null;
      if (v.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(v.imageUrls[0] as any);
      }

      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
        .collect();
      const reviewCount = reviews.length;
      const reviewAverage = reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10) / 10
        : 0;

      results.push({
        _id: f._id,
        vehicleId: v._id,
        title: v.title,
        city: v.city,
        pricePerDay: v.pricePerDay,
        coverUrl,
        reviewCount,
        reviewAverage,
        favoritedAt: f.createdAt,
      });
    }
    return results;
  },
});

/**
 * Check which vehicle IDs are favorited by current user.
 * Returns a Set-like object { [vehicleId]: true }
 */
export const myFavoritedIds = query({
  handler: async (ctx) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return {}; }
    if (!user) return {};
    const me = userKey(user);

    const favs = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .take(200);

    const map: Record<string, boolean> = {};
    for (const f of favs) map[f.vehicleId] = true;
    return map;
  },
});
