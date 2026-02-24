import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

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

/** Listing avec la première image résolue (pour les cards) */
export const listVehiclesWithCover = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").order("desc").take(20);

    const results = [];
    for (const v of vehicles) {
      let coverUrl: string | null = null;
      if (v.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(v.imageUrls[0] as any);
      }
      results.push({ ...v, coverUrl });
    }
    return results;
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

/** Recherche avec image de couverture résolue */
export const searchVehiclesWithCover = query({
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

    let results = await q.take(limit);

    if (typeof args.maxPricePerDay === "number") {
      results = results.filter((v) => v.pricePerDay <= args.maxPricePerDay!);
    }

    const withCovers = [];
    for (const v of results) {
      let coverUrl: string | null = null;
      if (v.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(v.imageUrls[0] as any);
      }
      withCovers.push({ ...v, coverUrl });
    }
    return withCovers;
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
      .filter((q) => q.eq(q.field("ownerUserId"), ownerUserId))
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
      .filter((q) => q.eq(q.field("ownerUserId"), ownerUserId))
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
   VEHICLE IMAGES (Convex Storage)
====================================================== */

const MAX_VEHICLE_IMAGES = 6;
const VEHICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const VEHICLE_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Génère une URL d'upload pour une image de véhicule (owner only) */
export const generateVehicleImageUploadUrl = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    mimeType: v.string(),
    byteSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);

    // ✅ Ownership check
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    // ✅ Limite nombre de photos
    if (vehicle.imageUrls.length >= MAX_VEHICLE_IMAGES) {
      throw new ConvexError("TooManyImages");
    }

    // ✅ Validation taille + type
    if (args.byteSize > VEHICLE_IMAGE_MAX_BYTES) {
      throw new ConvexError("FILE_TOO_LARGE");
    }
    if (!VEHICLE_IMAGE_MIMES.has(args.mimeType)) {
      throw new ConvexError("BAD_MIME");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { ok: true as const, uploadUrl };
  },
});

/** Ajoute un storageId à la liste des images du véhicule (owner only) */
export const addVehicleImage = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    storageId: v.string(), // storageId retourné par Convex après upload
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    if (vehicle.imageUrls.length >= MAX_VEHICLE_IMAGES) {
      throw new ConvexError("TooManyImages");
    }

    await ctx.db.patch(args.vehicleId, {
      imageUrls: [...vehicle.imageUrls, args.storageId],
    });

    return { ok: true };
  },
});

/** Supprime une image du véhicule par son storageId (owner only) */
export const removeVehicleImage = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    await ctx.db.patch(args.vehicleId, {
      imageUrls: vehicle.imageUrls.filter((id) => id !== args.storageId),
    });

    // ✅ Nettoyage : supprimer le fichier du storage
    try {
      await ctx.storage.delete(args.storageId as any);
    } catch {
      // pas grave si déjà supprimé
    }

    return { ok: true };
  },
});

/** Retourne un véhicule avec ses URLs d'images résolues */
export const getVehicleWithImages = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) return null;

    // Résoudre chaque storageId en URL CDN
    const resolvedUrls: (string | null)[] = await Promise.all(
      vehicle.imageUrls.map((sid) => ctx.storage.getUrl(sid as any))
    );

    return {
      ...vehicle,
      resolvedImageUrls: resolvedUrls.filter(Boolean) as string[],
    };
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