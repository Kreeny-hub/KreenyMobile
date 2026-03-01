import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
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
    return await ctx.db.query("vehicles").order("desc").take(20);
  },
});

/** Listing avec la première image résolue (pour les cards) */
export const listVehiclesWithCover = query({
  args: {},
  handler: async (ctx) => {
    const vehicles = await ctx.db.query("vehicles").order("desc").take(50);

    const results = [];
    for (const v of vehicles) {
      // Resolve all image URLs (for carousel)
      const allImageUrls: string[] = [];
      for (const storageId of v.imageUrls) {
        const url = await ctx.storage.getUrl(storageId as any);
        if (url) allImageUrls.push(url);
      }
      const coverUrl = allImageUrls[0] ?? null;

      // Review stats
      const reviews = await ctx.db.query("reviews").withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id)).collect();
      const reviewCount = reviews.length;
      const reviewAverage = reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10) / 10
        : 0;
      results.push({ ...v, coverUrl, allImageUrls, reviewCount, reviewAverage });
    }
    return results;
  },
});

export const getVehicleById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) return null;
    // Resolve cover image URL
    let coverUrl: string | null = null;
    if (vehicle.imageUrls && vehicle.imageUrls.length > 0) {
      coverUrl = await ctx.storage.getUrl(vehicle.imageUrls[0] as any) ?? null;
    }
    return { ...vehicle, coverUrl };
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
    minPricePerDay: v.optional(v.number()),
    maxPricePerDay: v.optional(v.number()),
    transmission: v.optional(v.string()),   // "auto" | "manual"
    fuel: v.optional(v.string()),           // "essence" | "diesel" | "hybrid" | "electric"
    minSeats: v.optional(v.number()),
    startDate: v.optional(v.string()),      // YYYY-MM-DD — availability filter
    endDate: v.optional(v.string()),        // YYYY-MM-DD — availability filter
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 40;
    const citySearch = args.city?.trim().toLowerCase();

    const all = await ctx.db.query("vehicles").order("desc").take(limit * 3);

    let results = all;
    if (citySearch && citySearch.length > 0) {
      results = results.filter((v) => v.city.toLowerCase() === citySearch);
    }
    if (typeof args.minPricePerDay === "number") {
      results = results.filter((v) => v.pricePerDay >= args.minPricePerDay!);
    }
    if (typeof args.maxPricePerDay === "number") {
      results = results.filter((v) => v.pricePerDay <= args.maxPricePerDay!);
    }
    if (args.transmission) {
      results = results.filter((v) => v.transmission === args.transmission);
    }
    if (args.fuel) {
      results = results.filter((v) => v.fuel === args.fuel);
    }
    if (typeof args.minSeats === "number") {
      results = results.filter((v) => (v.seats ?? 5) >= args.minSeats!);
    }

    // ── Availability filter: exclude vehicles with overlapping reservations ──
    const BLOCKING_STATUSES = new Set(["requested", "accepted_pending_payment", "confirmed", "pickup_pending", "in_progress", "dropoff_pending"]);
    if (args.startDate && args.endDate) {
      const wantStart = args.startDate;
      const wantEnd = args.endDate;
      const available: typeof results = [];
      for (const v of results) {
        // Check owner blocked dates
        const blocked = new Set((v as any).ownerBlockedDates ?? []);
        let ownerBlocked = false;
        if (blocked.size > 0) {
          const d = new Date(wantStart + "T00:00:00");
          const end = new Date(wantEnd + "T00:00:00");
          while (d < end) {
            const iso = d.toISOString().split("T")[0];
            if (blocked.has(iso)) { ownerBlocked = true; break; }
            d.setDate(d.getDate() + 1);
          }
        }
        if (ownerBlocked) continue;

        // Check reservation overlaps
        const reservations = await ctx.db
          .query("reservations")
          .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
          .collect();
        const hasOverlap = reservations.some((r) =>
          BLOCKING_STATUSES.has(r.status) && r.startDate < wantEnd && r.endDate > wantStart
        );
        if (!hasOverlap) available.push(v);
      }
      results = available;
    }

    results = results.slice(0, limit);

    const withCovers = [];
    for (const v of results) {
      // Resolve all image URLs (for carousel)
      const allImageUrls: string[] = [];
      for (const storageId of v.imageUrls) {
        const url = await ctx.storage.getUrl(storageId as any);
        if (url) allImageUrls.push(url);
      }
      const coverUrl = allImageUrls[0] ?? null;

      // Review stats
      const reviews = await ctx.db.query("reviews").withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id)).collect();
      const reviewCount = reviews.length;
      const reviewAverage = reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10) / 10
        : 0;
      withCovers.push({ ...v, coverUrl, allImageUrls, reviewCount, reviewAverage });
    }
    return withCovers;
  },
});

/* ======================================================
   CREATE VEHICLE (PUBLISH)
====================================================== */

/** Public vehicles for a given owner (for public profile) */
export const listVehiclesByOwner = query({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
    const vehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .order("desc")
      .take(20);

    const results = [];
    for (const v of vehicles) {
      let coverUrl: string | null = null;
      if (v.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(v.imageUrls[0] as any);
      }
      const reviews = await ctx.db.query("reviews").withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id)).collect();
      const reviewCount = reviews.length;
      const reviewAverage = reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.averageRating, 0) / reviewCount) * 10) / 10
        : 0;
      results.push({
        _id: v._id,
        title: v.title,
        city: v.city,
        pricePerDay: v.pricePerDay,
        coverUrl,
        reviewCount,
        reviewAverage,
      });
    }
    return results;
  },
});

export const createVehicle = mutation({
  args: {
    title: v.string(),
    city: v.string(),
    pricePerDay: v.number(),
    // ── Identité ──
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    // ── Caractéristiques ──
    transmission: v.optional(v.string()),
    fuel: v.optional(v.string()),
    seats: v.optional(v.number()),
    description: v.optional(v.string()),
    // ── Features ──
    featuresSafety: v.optional(v.array(v.string())),
    featuresConnect: v.optional(v.array(v.string())),
    featuresAmenities: v.optional(v.array(v.string())),
    // ── Livraison ──
    delivery: v.optional(v.boolean()),
    deliveryRadiusKm: v.optional(v.number()),
    deliveryPrice: v.optional(v.number()),
    // ── Disponibilité ──
    availableFrom: v.optional(v.string()),
    availableUntil: v.optional(v.string()),
    // ── Annulation ──
    cancellationPolicy: v.optional(v.string()), // "flexible" | "moderate" | "strict"
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = userKey(user);

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
    const depositSelected = min;

    const id = await ctx.db.insert("vehicles", {
      title: args.title.trim(),
      city: args.city.trim(),
      pricePerDay: args.pricePerDay,
      imageUrls: [],
      isActive: true,
      createdAt: now,
      isSeed: false,
      ownerUserId,

      depositMin: min,
      depositMax: max,
      depositSelected,

      // Nouveaux champs (optionnels)
      brand: args.brand?.trim(),
      model: args.model?.trim(),
      year: args.year,
      transmission: args.transmission,
      fuel: args.fuel,
      seats: args.seats,
      description: args.description?.trim(),
      featuresSafety: args.featuresSafety,
      featuresConnect: args.featuresConnect,
      featuresAmenities: args.featuresAmenities,
      delivery: args.delivery,
      deliveryRadiusKm: args.deliveryRadiusKm,
      deliveryPrice: args.deliveryPrice,
      availableFrom: args.availableFrom,
      availableUntil: args.availableUntil,
      cancellationPolicy: args.cancellationPolicy ?? "moderate",
    });

    return { vehicleId: id };
  },
});

// ═══════════════════════════════════════════════════════
// UPDATE (propriétaire modifie son annonce)
// ═══════════════════════════════════════════════════════
export const updateVehicle = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    title: v.optional(v.string()),
    pricePerDay: v.optional(v.number()),
    city: v.optional(v.string()),
    // ── Identité ──
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    // ── Caractéristiques ──
    transmission: v.optional(v.string()),
    fuel: v.optional(v.string()),
    seats: v.optional(v.number()),
    description: v.optional(v.string()),
    // ── Features ──
    featuresSafety: v.optional(v.array(v.string())),
    featuresConnect: v.optional(v.array(v.string())),
    featuresAmenities: v.optional(v.array(v.string())),
    // ── Livraison ──
    delivery: v.optional(v.boolean()),
    deliveryRadiusKm: v.optional(v.number()),
    deliveryPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const ownerUserId = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (vehicle.ownerUserId !== ownerUserId) throw new ConvexError("Forbidden");

    // Build patch — only include defined fields
    const patch: Record<string, any> = {};
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.pricePerDay !== undefined) {
      patch.pricePerDay = args.pricePerDay;
      // Recalculate deposit range when price changes
      const { min, max } = computeDepositRange(args.pricePerDay);
      patch.depositMin = min;
      patch.depositMax = max;
      patch.depositSelected = min;
    }
    if (args.city !== undefined) patch.city = args.city.trim();
    if (args.brand !== undefined) patch.brand = args.brand.trim();
    if (args.model !== undefined) patch.model = args.model.trim();
    if (args.year !== undefined) patch.year = args.year;
    if (args.transmission !== undefined) patch.transmission = args.transmission;
    if (args.fuel !== undefined) patch.fuel = args.fuel;
    if (args.seats !== undefined) patch.seats = args.seats;
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.featuresSafety !== undefined) patch.featuresSafety = args.featuresSafety;
    if (args.featuresConnect !== undefined) patch.featuresConnect = args.featuresConnect;
    if (args.featuresAmenities !== undefined) patch.featuresAmenities = args.featuresAmenities;
    if (args.delivery !== undefined) patch.delivery = args.delivery;
    if (args.deliveryRadiusKm !== undefined) patch.deliveryRadiusKm = args.deliveryRadiusKm;
    if (args.deliveryPrice !== undefined) patch.deliveryPrice = args.deliveryPrice;

    if (Object.keys(patch).length === 0) return { ok: true };

    // Auto-update title if brand/model/year changed
    const newBrand = patch.brand ?? vehicle.brand ?? "";
    const newModel = patch.model ?? vehicle.model ?? "";
    const newYear = patch.year ?? vehicle.year;
    if (args.brand !== undefined || args.model !== undefined || args.year !== undefined) {
      patch.title = `${newBrand} ${newModel}${newYear ? ` ${newYear}` : ""}`.trim();
    }

    await ctx.db.patch(args.vehicleId, patch);
    return { ok: true };
  },
});

/* ======================================================
   OWNER - ACTIVATE / DEACTIVATE / DELETE
====================================================== */

export const deactivateVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle || vehicle.ownerUserId !== userKey(user)) throw new ConvexError("NotFound");

    // Check no active reservations
    const active = await ctx.db.query("reservations")
      .filter((q) => q.and(
        q.eq(q.field("vehicleId"), vehicleId),
        q.or(
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "pickup_pending"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "dropoff_pending"),
        )
      )).first();
    if (active) throw new ConvexError("HasActiveReservations");

    await ctx.db.patch(vehicleId, { isActive: false });
  },
});

export const reactivateVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle || vehicle.ownerUserId !== userKey(user)) throw new ConvexError("NotFound");
    await ctx.db.patch(vehicleId, { isActive: true });
  },
});

export const deleteVehicle = mutation({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const vehicle = await ctx.db.get(vehicleId);
    if (!vehicle || vehicle.ownerUserId !== userKey(user)) throw new ConvexError("NotFound");

    // Block if active reservations
    const active = await ctx.db.query("reservations")
      .filter((q) => q.and(
        q.eq(q.field("vehicleId"), vehicleId),
        q.or(
          q.eq(q.field("status"), "requested"),
          q.eq(q.field("status"), "accepted_pending_payment"),
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "pickup_pending"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "dropoff_pending"),
        )
      )).first();
    if (active) throw new ConvexError("HasActiveReservations");

    // Delete all images from storage
    for (const storageId of vehicle.imageUrls) {
      try { await ctx.storage.delete(storageId as any); } catch { /* ignore */ }
    }

    // Delete vehicle
    await ctx.db.delete(vehicleId);
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

      // Resolve cover image
      let coverUrl: string | null = null;
      if (vhl.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(vhl.imageUrls[0] as any) ?? null;
      }

      results.push({
        vehicle: { ...vhl, coverUrl },
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

    // Check if current user is the owner
    let isOwner = false;
    try {
      const user = await authComponent.getAuthUser(ctx);
      if (user && vehicle.ownerUserId === userKey(user)) {
        isOwner = true;
      }
    } catch { /* not authenticated — isOwner stays false */ }

    return {
      ...vehicle,
      resolvedImageUrls: resolvedUrls.filter(Boolean) as string[],
      isOwner,
    };
  },
});

// ═══════════════════════════════════════════════════════
// Owner: toggle blocked dates (availability calendar)
// ═══════════════════════════════════════════════════════
export const setBlockedDates = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    blockedDates: v.array(v.string()), // full replacement
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) throw new ConvexError("VehicleNotFound");
    if (String(vehicle.ownerUserId) !== me) throw new ConvexError("Forbidden");

    // Validate date format
    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of args.blockedDates) {
      if (!ISO.test(d)) throw new ConvexError(`InvalidDate: ${d}`);
    }

    // Deduplicate and sort
    const unique = [...new Set(args.blockedDates)].sort();

    await ctx.db.patch(args.vehicleId, { ownerBlockedDates: unique });
    return { ok: true, count: unique.length };
  },
});

export const getBlockedDates = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) return [];
    return (vehicle as any).ownerBlockedDates ?? [];
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
    // Delete previous seeds
    const seeds = await ctx.db
      .query("vehicles")
      .filter((q) => q.eq(q.field("isSeed"), true))
      .collect();
    for (const doc of seeds) {
      await ctx.db.delete(doc._id);
    }

    const now = Date.now();

    const VEHICLES = [
      // ── Économiques ──
      { title: "Dacia Sandero 2024", brand: "Dacia", model: "Sandero", year: 2024, price: 250, city: "Casablanca", transmission: "manual", fuel: "essence", seats: 5, desc: "Idéale pour la ville, économique et fiable." },
      { title: "Renault Clio 5 2023", brand: "Renault", model: "Clio", year: 2023, price: 280, city: "Rabat", transmission: "auto", fuel: "essence", seats: 5, desc: "Compacte et moderne, parfaite pour explorer la capitale." },
      { title: "Hyundai i20 2024", brand: "Hyundai", model: "i20", year: 2024, price: 260, city: "Tanger", transmission: "manual", fuel: "essence", seats: 5, desc: "Design frais, conso réduite, climatisation auto." },
      { title: "Peugeot 208 2023", brand: "Peugeot", model: "208", year: 2023, price: 300, city: "Marrakech", transmission: "auto", fuel: "essence", seats: 5, desc: "Petit SUV look, i-Cockpit digital, très agréable." },
      { title: "Fiat 500 2022", brand: "Fiat", model: "500", year: 2022, price: 270, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 4, desc: "Le charme italien. Parfaite pour les balades en ville." },

      // ── Berlines ──
      { title: "Volkswagen Passat 2023", brand: "Volkswagen", model: "Passat", year: 2023, price: 500, city: "Casablanca", transmission: "auto", fuel: "diesel", seats: 5, desc: "Confort premium, parfaite pour les longs trajets." },
      { title: "Toyota Camry 2024", brand: "Toyota", model: "Camry", year: 2024, price: 550, city: "Rabat", transmission: "auto", fuel: "hybrid", seats: 5, desc: "Hybride silencieuse, finition haut de gamme." },
      { title: "Peugeot 508 2023", brand: "Peugeot", model: "508", year: 2023, price: 480, city: "Marrakech", transmission: "auto", fuel: "diesel", seats: 5, desc: "Ligne élégante, intérieur cuir, Night Vision." },

      // ── SUV ──
      { title: "Dacia Duster 2024", brand: "Dacia", model: "Duster", year: 2024, price: 350, city: "Agadir", transmission: "manual", fuel: "diesel", seats: 5, desc: "Le SUV le plus populaire du Maroc. Robuste et spacieux." },
      { title: "Hyundai Tucson 2024", brand: "Hyundai", model: "Tucson", year: 2024, price: 600, city: "Casablanca", transmission: "auto", fuel: "hybrid", seats: 5, desc: "Design futuriste, hybride, écran panoramique." },
      { title: "Toyota RAV4 2023", brand: "Toyota", model: "RAV4", year: 2023, price: 650, city: "Tanger", transmission: "auto", fuel: "hybrid", seats: 5, desc: "SUV familial hybride, coffre immense, fiabilité Toyota." },
      { title: "Kia Sportage 2024", brand: "Kia", model: "Sportage", year: 2024, price: 550, city: "Fès", transmission: "auto", fuel: "diesel", seats: 5, desc: "Nouveau design, tech embarquée, garantie 7 ans." },

      // ── Premium ──
      { title: "Mercedes Classe C 2024", brand: "Mercedes", model: "Classe C", year: 2024, price: 900, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 5, desc: "Élégance et technologie. Idéale pour impressionner." },
      { title: "BMW Série 3 2023", brand: "BMW", model: "Série 3", year: 2023, price: 850, city: "Marrakech", transmission: "auto", fuel: "diesel", seats: 5, desc: "Le plaisir de conduire à l'état pur." },
      { title: "Audi A4 2023", brand: "Audi", model: "A4", year: 2023, price: 800, city: "Rabat", transmission: "auto", fuel: "essence", seats: 5, desc: "Virtual cockpit, quattro disponible, finition S-Line." },

      // ── Sport ──
      { title: "BMW M3 2025", brand: "BMW", model: "M3", year: 2025, price: 1500, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 5, desc: "510ch, propulsion, mode Drift. Sensations garanties." },
      { title: "Ford Mustang GT 2024", brand: "Ford", model: "Mustang", year: 2024, price: 1200, city: "Marrakech", transmission: "auto", fuel: "essence", seats: 4, desc: "V8 5.0L, le son mythique. Décapotable disponible." },

      // ── Électrique ──
      { title: "Tesla Model 3 2024", brand: "Tesla", model: "Model 3", year: 2024, price: 700, city: "Casablanca", transmission: "auto", fuel: "electric", seats: 5, desc: "Autonomie 500km, Autopilot, superchargeurs gratuits." },

      // ── Utilitaire ──
      { title: "Renault Kangoo 2023", brand: "Renault", model: "Kangoo", year: 2023, price: 350, city: "Casablanca", transmission: "manual", fuel: "diesel", seats: 5, desc: "Spacieux, portes coulissantes, parfait pour déménager." },
      { title: "Citroën Berlingo 2024", brand: "Citroën", model: "Berlingo", year: 2024, price: 380, city: "Tanger", transmission: "auto", fuel: "diesel", seats: 7, desc: "7 places, modulable, idéal familles nombreuses." },
    ];

    // Insert vehicles
    for (let i = 0; i < VEHICLES.length; i++) {
      const v = VEHICLES[i];
      const { min, max } = computeDepositRange(v.price);
      await ctx.db.insert("vehicles", {
        title: v.title,
        brand: v.brand,
        model: v.model,
        year: v.year,
        pricePerDay: v.price,
        city: v.city,
        transmission: v.transmission,
        fuel: v.fuel,
        seats: v.seats,
        description: v.desc,
        imageUrls: [],
        createdAt: now + i,
        isSeed: true,
        isActive: true,
        ownerUserId: "seed-owner",
        depositMin: min,
        depositMax: max,
        depositSelected: min,
      });
    }

    return { ok: true, count: VEHICLES.length };
  },
});