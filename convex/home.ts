import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Home feed: returns categorized sections for the home screen.
 * All data processing is done server-side to minimize client-side logic.
 */
export const getFeed = query({
  args: {},
  handler: async (ctx) => {
    // Fetch all active vehicles
    const allVehicles = await ctx.db.query("vehicles").order("desc").take(100);
    const vehicles = allVehicles.filter((v) => v.isActive !== false);

    // Resolve covers + reviews for all vehicles
    type Enriched = typeof vehicles[number] & {
      coverUrl: string | null;
      reviewCount: number;
      reviewAverage: number;
    };
    const enriched: Enriched[] = [];

    for (const v of vehicles) {
      const coverStorageId = v.imageUrls?.[0];
      const coverUrl = coverStorageId
        ? (await ctx.storage.getUrl(coverStorageId as any)) ?? null
        : null;

      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
        .collect();
      const reviewCount = reviews.length;
      const reviewAverage =
        reviewCount > 0
          ? Math.round(
              (reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10
            ) / 10
          : 0;

      enriched.push({ ...v, coverUrl, reviewCount, reviewAverage });
    }

    // ── Featured: best rated with cover photos ──
    const featured = [...enriched]
      .filter((v) => v.coverUrl && v.reviewCount > 0)
      .sort((a, b) => b.reviewAverage - a.reviewAverage || b.reviewCount - a.reviewCount)
      .slice(0, 6);

    // If not enough rated vehicles, fill with newest with covers
    if (featured.length < 3) {
      const featuredIds = new Set(featured.map((v) => v._id));
      const filler = enriched
        .filter((v) => v.coverUrl && !featuredIds.has(v._id))
        .slice(0, 6 - featured.length);
      featured.push(...filler);
    }

    const featuredIds = new Set(featured.map((v) => v._id));

    // ── Popular cities: group by city, count vehicles, pick cover ──
    const cityMap = new Map<string, { count: number; coverUrl: string | null }>();
    for (const v of enriched) {
      const city = v.city?.trim();
      if (!city) continue;
      const existing = cityMap.get(city);
      if (!existing) {
        cityMap.set(city, { count: 1, coverUrl: v.coverUrl });
      } else {
        existing.count++;
        if (!existing.coverUrl && v.coverUrl) existing.coverUrl = v.coverUrl;
      }
    }
    const popularCities = [...cityMap.entries()]
      .filter(([, info]) => info.count >= 1)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([city, info]) => ({ city, count: info.count, coverUrl: info.coverUrl }));

    // ── Best deals: cheapest ──
    const bestDeals = [...enriched]
      .filter((v) => !featuredIds.has(v._id) && v.coverUrl)
      .sort((a, b) => a.pricePerDay - b.pricePerDay)
      .slice(0, 10);
    const bestDealsIds = new Set(bestDeals.map((v) => v._id));

    // ── Top rated: highest average rating (min 1 review) ──
    const topRated = [...enriched]
      .filter(
        (v) => !featuredIds.has(v._id) && !bestDealsIds.has(v._id) && v.reviewCount > 0
      )
      .sort((a, b) => b.reviewAverage - a.reviewAverage || b.reviewCount - a.reviewCount)
      .slice(0, 10);
    const topRatedIds = new Set(topRated.map((v) => v._id));

    // ── Newest: most recently created ──
    const newest = [...enriched]
      .filter(
        (v) =>
          !featuredIds.has(v._id) &&
          !bestDealsIds.has(v._id) &&
          !topRatedIds.has(v._id)
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);

    // Strip heavy fields for smaller payload
    const slim = (v: Enriched) => ({
      _id: v._id,
      title: v.title,
      city: v.city,
      pricePerDay: v.pricePerDay,
      coverUrl: v.coverUrl,
      reviewCount: v.reviewCount,
      reviewAverage: v.reviewAverage,
      imageUrls: v.imageUrls,
      createdAt: v.createdAt,
    });

    return {
      featured: featured.map(slim),
      popularCities,
      bestDeals: bestDeals.map(slim),
      topRated: topRated.map(slim),
      newest: newest.map(slim),
      totalVehicles: enriched.length,
    };
  },
});

/**
 * Fetch vehicles by IDs (for recently viewed section).
 * Returns them in the same order as input IDs.
 */
export const getVehiclesByIds = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    if (ids.length === 0) return [];

    const results = [];
    for (const id of ids) {
      try {
        const vehicleId = id as Id<"vehicles">;
        const v = await ctx.db.get(vehicleId);
        if (!v || v.isActive === false) continue;

        const coverUrl = v.imageUrls?.[0]
          ? (await ctx.storage.getUrl(v.imageUrls[0] as any)) ?? null
          : null;

        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
          .collect();
        const reviewCount = reviews.length;
        const reviewAverage =
          reviewCount > 0
            ? Math.round(
                (reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10
              ) / 10
            : 0;

        results.push({
          _id: v._id,
          title: v.title,
          city: v.city,
          pricePerDay: v.pricePerDay,
          coverUrl,
          reviewCount,
          reviewAverage,
          imageUrls: v.imageUrls,
          createdAt: v.createdAt,
        });
      } catch {
        // Skip invalid IDs
      }
    }
    return results;
  },
});
