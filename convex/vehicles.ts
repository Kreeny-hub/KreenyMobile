import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { assertDevOnly, BLOCKING_STATUSES } from "./_lib/enums";
import { userKey } from "./_lib/userKey";

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
    const vehicles = await ctx.db.query("vehicles").order("desc").take(30);
    return vehicles.filter(isVehicleActive);
  },
});

/** Listing avec la première image résolue (pour les cards) */
export const listVehiclesWithCover = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").order("desc").take(30);
    const active = vehicles.filter(isVehicleActive);

    const results = [];
    for (const v of active) {
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

// ✅ Helper : véhicule actif (isActive undefined = true pour rétrocompat)
function isVehicleActive(v: { isActive?: boolean }): boolean {
  return v.isActive !== false;
}

export const searchVehicles = query({
  args: {
    city: v.optional(v.string()),
    maxPricePerDay: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const citySearch = args.city?.trim().toLowerCase();

    const all = await ctx.db.query("vehicles").order("desc").take(limit * 2);

    let results = all;
    if (citySearch && citySearch.length > 0) {
      results = results.filter((v) => v.city.toLowerCase() === citySearch);
    }
    if (typeof args.maxPricePerDay === "number") {
      results = results.filter((v) => v.pricePerDay <= args.maxPricePerDay!);
    }

    return results.slice(0, limit);
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
    const citySearch = args.city?.trim().toLowerCase();

    const all = await ctx.db.query("vehicles").order("desc").take(limit * 2);

    let results = all;
    if (citySearch && citySearch.length > 0) {
      results = results.filter((v) => v.city.toLowerCase() === citySearch);
    }
    if (typeof args.maxPricePerDay === "number") {
      filtered = filtered.filter((v) => v.pricePerDay <= args.maxPricePerDay!);
    }
    filtered = filtered.slice(0, limit);

    results = results.slice(0, limit);

    const withCovers = [];
    for (const v of filtered) {
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

    // ✅ FIX: Validation des inputs
    const title = args.title.trim();
    const city = args.city.trim();

    if (title.length < 3 || title.length > 120) {
      throw new ConvexError("InvalidTitle");
    }
    if (city.length < 2 || city.length > 60) {
      throw new ConvexError("InvalidCity");
    }
    if (!Number.isFinite(args.pricePerDay) || args.pricePerDay < 50 || args.pricePerDay > 50000) {
      throw new ConvexError("InvalidPrice");
    }

    const ownerUserId = userKey(user);

    // 🔒 Limite compte standard = 2 annonces
    // ✅ Optimisé : utilise l'index by_ownerUserId
    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .take(10);

    if (existing.length >= 2) {
      throw new ConvexError("ListingLimitReached");
    }

    const now = Date.now();

    const { min, max } = computeDepositRange(args.pricePerDay);

    // choix par défaut (plateforme) : le min (simple et lisible)
    const depositSelected = min;

    const id = await ctx.db.insert("vehicles", {
      title,
      city,
      pricePerDay: args.pricePerDay,
      imageUrls: [],
      isActive: true,
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

    const ownerUserId = userKey(user);

    // ✅ Optimisé : utilise l'index by_ownerUserId au lieu de .filter()
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .order("desc")
      .take(50);

    const results = [];

    for (const vhl of vehicles) {
      // ✅ Optimisé : utilise l'index by_owner_status_createdAt
      const requests = await ctx.db
        .query("reservations")
        .withIndex("by_owner_status_createdAt", (q) =>
          q.eq("ownerUserId", ownerUserId).eq("status", "requested")
        )
        .take(100);

      // Filtrer seulement ceux de ce véhicule
      const vehicleRequests = requests.filter((r) => r.vehicleId === vhl._id);

      results.push({
        vehicle: vhl,
        requestCount: vehicleRequests.length,
      });
    }

    return results;
  },
});

/* ======================================================
   SOFT-DELETE (DEACTIVATE / REACTIVATE)
====================================================== */

/** Désactive une annonce (soft-delete). Vérifie qu'il n'y a pas de résa active. */
export const deactivateVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    // ✅ Vérifier qu'aucune réservation active n'existe
    const activeReservations = await ctx.db
      .query("reservations")
      .withIndex("by_vehicle", (q) => q.eq("vehicleId", args.vehicleId))
      .take(50);

    const hasActive = activeReservations.some((r) =>
      BLOCKING_STATUSES.has(r.status as any)
    );

    if (hasActive) {
      throw new ConvexError("HasActiveReservations");
    }

    await ctx.db.patch(args.vehicleId, { isActive: false });
    return { ok: true };
  },
});

/** Réactive une annonce désactivée */
export const reactivateVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    await ctx.db.patch(args.vehicleId, { isActive: true });
    return { ok: true };
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
    const me = userKey(user);

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
    const me = userKey(user);

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
    const me = userKey(user);

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
    assertDevOnly(); // 🔒 DEV ONLY
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
    assertDevOnly(); // 🔒 DEV ONLY
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