import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { authComponent } from "./auth";
import { assertDevMutationEnabled } from "./_lib/devGuards";

function computeDepositRange(pricePerDay: number) {
  // MVP simple, à ajuster selon ton marché
  if (pricePerDay < 300) return { min: 2000, max: 4000 };
  if (pricePerDay < 600) return { min: 4000, max: 7000 };
  return { min: 7000, max: 15000 };
}

/* ======================================================
   LISTING PUBLIC
====================================================== */

export const listVehicles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vehicles").order("desc").take(20);
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const searchVehicles = query({
  args: {
    city: v.optional(v.string()),
    maxPricePerDay: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let q = ctx.db.query("vehicles").order("desc");

    if (args.city && args.city.trim().length > 0) {
      q = q.filter((f) => f.eq(f.field("city"), args.city!.trim()));
    }

    const results = await q.take(limit);

    if (typeof args.maxPricePerDay === "number") {
      return results.filter((v) => v.pricePerDay <= args.maxPricePerDay!);
    }

    return results;
  },
});

/* ======================================================
   CREATE VEHICLE (PUBLISH)
====================================================== */

export const createVehicle = mutation({
  args: {
    title: v.string(),
    city: v.string(),
    pricePerDay: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = String(user.userId ?? user.email ?? user._id);

    // 🔒 Limite compte standard = 2 annonces
    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();

    if (existing.length >= 2) {
      throw new ConvexError("ListingLimitReached");
    }

    const now = Date.now();

    const { min, max } = computeDepositRange(args.pricePerDay);

    // choix par défaut (plateforme) : le min (simple et lisible)
    const depositSelected = min;

    const id = await ctx.db.insert("vehicles", {
      title: args.title.trim(),
      city: args.city.trim(),
      pricePerDay: args.pricePerDay,
      imageUrls: [],
      createdAt: now,
      isSeed: false,
      ownerUserId,

      depositMin: min,
      depositMax: max,
      depositSelected,
    });



    return { vehicleId: id };
  },
});

/* ======================================================
   OWNER - MES ANNONCES + BADGE REQUEST COUNT
====================================================== */

export const listMyListingsWithRequestCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = String(user.userId ?? user.email ?? user._id);

    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .order("desc")
      .take(50);

    const results = [];

    for (const vhl of vehicles) {
      const requests = await ctx.db
        .query("reservations")
        .filter((q) =>
          q.and(
            q.eq(q.field("vehicleId"), vhl._id),
            q.eq(q.field("status"), "requested")
          )
        )
        .collect();

      results.push({
        vehicle: vhl,
        requestCount: requests.length,
      });
    }

    return results;
  },
});

/* ======================================================
   DEV ONLY - SEED
====================================================== */

export const backfillVehicleDeposits = mutation({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").collect();

    for (const vhl of vehicles) {
      // si déjà rempli, skip
      if ((vhl as any).depositMin && (vhl as any).depositMax && (vhl as any).depositSelected) continue;

      const { min, max } = computeDepositRange((vhl as any).pricePerDay);
      await ctx.db.patch(vhl._id, {
        depositMin: min,
        depositMax: max,
        depositSelected: min,
      });
    }

    return { ok: true };
  },
});

export const seedVehicles = mutation({
  args: {},
  handler: async (ctx) => {
    assertDevMutationEnabled();

    const seeds = await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("isSeed"), true))
      .collect();

    // ✅ ne pas appeler la variable "v" (conflit avec import { v })
    for (const doc of seeds) {
      await ctx.db.delete(doc._id);
    }

    const now = Date.now();

    const seedData = [
      { title: "Dacia Sandero", pricePerDay: 250, city: "Casablanca", createdAt: now },
      { title: "Hyundai i10", pricePerDay: 220, city: "Rabat", createdAt: now + 1 },
      { title: "Kia Picanto", pricePerDay: 200, city: "Marrakech", createdAt: now + 2 },
    ];

    for (const s of seedData) {
      const { min, max } = computeDepositRange(s.pricePerDay);

      await ctx.db.insert("vehicles", {
        title: s.title,
        pricePerDay: s.pricePerDay,
        city: s.city,
        imageUrls: [],
        createdAt: s.createdAt,
        isSeed: true,
        ownerUserId: "seed-owner",

        depositMin: min,
        depositMax: max,
        depositSelected: min,
      });
    }

    return { ok: true };
  },
});
