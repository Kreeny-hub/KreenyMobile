import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════
// Photo URLs — Unsplash direct CDN (stable, high quality)
// ═══════════════════════════════════════════════════════
const PHOTOS: Record<string, string[]> = {
  "Dacia Sandero 2024": [
    "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80",
    "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80",
  ],
  "Renault Clio 5 2023": [
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&q=80",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
  ],
  "Hyundai i20 2024": [
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80",
    "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80",
  ],
  "Peugeot 208 2023": [
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80",
  ],
  "Fiat 500 2022": [
    "https://images.unsplash.com/photo-1595787142240-a1952d308e5b?w=800&q=80",
    "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80",
  ],
  "Volkswagen Passat 2023": [
    "https://images.unsplash.com/photo-1471479917193-f00955256257?w=800&q=80",
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&q=80",
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=800&q=80",
  ],
  "Toyota Camry 2024": [
    "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
  ],
  "Peugeot 508 2023": [
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
    "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80",
  ],
  "Dacia Duster 2024": [
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80",
  ],
  "Hyundai Tucson 2024": [
    "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800&q=80",
    "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
  ],
  "Toyota RAV4 2023": [
    "https://images.unsplash.com/photo-1551830820-330a71b99659?w=800&q=80",
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
  ],
  "Kia Sportage 2024": [
    "https://images.unsplash.com/photo-1504215680853-026ed2a45def?w=800&q=80",
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80",
  ],
  "Mercedes Classe C 2024": [
    "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&q=80",
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
    "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80",
  ],
  "BMW Série 3 2023": [
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=800&q=80",
    "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800&q=80",
  ],
  "Audi A4 2023": [
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
    "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800&q=80",
  ],
  "BMW M3 2025": [
    "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&q=80",
    "https://images.unsplash.com/photo-1580274455191-1c62238ce452?w=800&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
  ],
  "Ford Mustang GT 2024": [
    "https://images.unsplash.com/photo-1584345604476-8ec5f82d661f?w=800&q=80",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80",
    "https://images.unsplash.com/photo-1547744152-14d985cb937f?w=800&q=80",
  ],
  "Tesla Model 3 2024": [
    "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80",
    "https://images.unsplash.com/photo-1571987502227-9231b837d92a?w=800&q=80",
  ],
  "Renault Kangoo 2023": [
    "https://images.unsplash.com/photo-1543796076-c4a1d1032c1e?w=800&q=80",
    "https://images.unsplash.com/photo-1449965408869-ebd3fee6dead?w=800&q=80",
  ],
  "Citroën Berlingo 2024": [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80",
  ],
};

// ═══════════════════════════════════════════════════════
// Vehicle data
// ═══════════════════════════════════════════════════════
function computeDepositRange(ppd: number) {
  const min = Math.round(ppd * 5);
  const max = Math.round(ppd * 15);
  return { min, max };
}

const VEHICLES = [
  { title: "Dacia Sandero 2024", brand: "Dacia", model: "Sandero", year: 2024, price: 250, city: "Casablanca", transmission: "manual", fuel: "essence", seats: 5, desc: "Idéale pour la ville, économique et fiable." },
  { title: "Renault Clio 5 2023", brand: "Renault", model: "Clio", year: 2023, price: 280, city: "Rabat", transmission: "auto", fuel: "essence", seats: 5, desc: "Compacte et moderne, parfaite pour explorer la capitale." },
  { title: "Hyundai i20 2024", brand: "Hyundai", model: "i20", year: 2024, price: 260, city: "Tanger", transmission: "manual", fuel: "essence", seats: 5, desc: "Design frais, conso réduite, climatisation auto." },
  { title: "Peugeot 208 2023", brand: "Peugeot", model: "208", year: 2023, price: 300, city: "Marrakech", transmission: "auto", fuel: "essence", seats: 5, desc: "Petit SUV look, i-Cockpit digital, très agréable." },
  { title: "Fiat 500 2022", brand: "Fiat", model: "500", year: 2022, price: 270, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 4, desc: "Le charme italien. Parfaite pour les balades en ville." },
  { title: "Volkswagen Passat 2023", brand: "Volkswagen", model: "Passat", year: 2023, price: 500, city: "Casablanca", transmission: "auto", fuel: "diesel", seats: 5, desc: "Confort premium, parfaite pour les longs trajets." },
  { title: "Toyota Camry 2024", brand: "Toyota", model: "Camry", year: 2024, price: 550, city: "Rabat", transmission: "auto", fuel: "hybrid", seats: 5, desc: "Hybride silencieuse, finition haut de gamme." },
  { title: "Peugeot 508 2023", brand: "Peugeot", model: "508", year: 2023, price: 480, city: "Marrakech", transmission: "auto", fuel: "diesel", seats: 5, desc: "Ligne élégante, intérieur cuir, Night Vision." },
  { title: "Dacia Duster 2024", brand: "Dacia", model: "Duster", year: 2024, price: 350, city: "Agadir", transmission: "manual", fuel: "diesel", seats: 5, desc: "Le SUV le plus populaire du Maroc. Robuste et spacieux." },
  { title: "Hyundai Tucson 2024", brand: "Hyundai", model: "Tucson", year: 2024, price: 600, city: "Casablanca", transmission: "auto", fuel: "hybrid", seats: 5, desc: "Design futuriste, hybride, écran panoramique." },
  { title: "Toyota RAV4 2023", brand: "Toyota", model: "RAV4", year: 2023, price: 650, city: "Tanger", transmission: "auto", fuel: "hybrid", seats: 5, desc: "SUV familial hybride, coffre immense, fiabilité Toyota." },
  { title: "Kia Sportage 2024", brand: "Kia", model: "Sportage", year: 2024, price: 550, city: "Fès", transmission: "auto", fuel: "diesel", seats: 5, desc: "Nouveau design, tech embarquée, garantie 7 ans." },
  { title: "Mercedes Classe C 2024", brand: "Mercedes", model: "Classe C", year: 2024, price: 900, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 5, desc: "Élégance et technologie. Idéale pour impressionner." },
  { title: "BMW Série 3 2023", brand: "BMW", model: "Série 3", year: 2023, price: 850, city: "Marrakech", transmission: "auto", fuel: "diesel", seats: 5, desc: "Le plaisir de conduire à l'état pur." },
  { title: "Audi A4 2023", brand: "Audi", model: "A4", year: 2023, price: 800, city: "Rabat", transmission: "auto", fuel: "essence", seats: 5, desc: "Virtual cockpit, quattro disponible, finition S-Line." },
  { title: "BMW M3 2025", brand: "BMW", model: "M3", year: 2025, price: 1500, city: "Casablanca", transmission: "auto", fuel: "essence", seats: 5, desc: "510ch, propulsion, mode Drift. Sensations garanties." },
  { title: "Ford Mustang GT 2024", brand: "Ford", model: "Mustang", year: 2024, price: 1200, city: "Marrakech", transmission: "auto", fuel: "essence", seats: 4, desc: "V8 5.0L, le son mythique. Décapotable disponible." },
  { title: "Tesla Model 3 2024", brand: "Tesla", model: "Model 3", year: 2024, price: 700, city: "Casablanca", transmission: "auto", fuel: "electric", seats: 5, desc: "Autonomie 500km, Autopilot, superchargeurs gratuits." },
  { title: "Renault Kangoo 2023", brand: "Renault", model: "Kangoo", year: 2023, price: 350, city: "Casablanca", transmission: "manual", fuel: "diesel", seats: 5, desc: "Spacieux, portes coulissantes, parfait pour déménager." },
  { title: "Citroën Berlingo 2024", brand: "Citroën", model: "Berlingo", year: 2024, price: 380, city: "Tanger", transmission: "auto", fuel: "diesel", seats: 7, desc: "7 places, modulable, idéal familles nombreuses." },
];

// Seed owner profiles
const SEED_OWNERS = [
  { id: "seed-owner-1", name: "Youssef El Amrani", city: "Casablanca" },
  { id: "seed-owner-2", name: "Nadia Benkirane", city: "Marrakech" },
  { id: "seed-owner-3", name: "Rachid Fassi-Fihri", city: "Rabat" },
  { id: "seed-owner-4", name: "Salma Idrissi", city: "Tanger" },
  { id: "seed-owner-5", name: "Karim Ziani", city: "Agadir" },
];

// Map cities to owner IDs
function ownerForCity(city: string): string {
  const map: Record<string, string> = {
    "Casablanca": "seed-owner-1",
    "Marrakech": "seed-owner-2",
    "Rabat": "seed-owner-3",
    "Tanger": "seed-owner-4",
    "Agadir": "seed-owner-5",
    "Fès": "seed-owner-3",
  };
  return map[city] ?? "seed-owner-1";
}

// Review comments
const REVIEW_COMMENTS = [
  "Très bon véhicule, conforme à la description. Je recommande !",
  "Propriétaire réactif et sympathique. Voiture en excellent état.",
  "Location parfaite, je referai appel sans hésiter.",
  "Véhicule propre et bien entretenu. Expérience top !",
  "Super rapport qualité-prix. Merci beaucoup !",
  "Excellent contact, véhicule impeccable. 5 étoiles !",
  "Tout s'est très bien passé, remise et retour sans souci.",
  "Voiture agréable à conduire, je suis très satisfait.",
];

// ═══════════════════════════════════════════════════════
// Internal mutations
// ═══════════════════════════════════════════════════════
export const cleanSeeds = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete seed vehicles
    const vehicles = await ctx.db.query("vehicles")
      .filter((q) => q.eq(q.field("isSeed"), true))
      .collect();
    for (const v of vehicles) {
      // Delete storage files
      for (const sid of v.imageUrls) {
        try { await ctx.storage.delete(sid as any); } catch {}
      }
      // Delete reviews for this vehicle
      const reviews = await ctx.db.query("reviews")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
        .collect();
      for (const r of reviews) await ctx.db.delete(r._id);
      // Delete reservations
      const reservations = await ctx.db.query("reservations")
        .withIndex("by_vehicle", (q) => q.eq("vehicleId", v._id))
        .collect();
      for (const r of reservations) await ctx.db.delete(r._id);
      // Delete favorites
      const favs = await ctx.db.query("favorites").collect();
      for (const f of favs) {
        if (f.vehicleId === v._id) await ctx.db.delete(f._id);
      }
      await ctx.db.delete(v._id);
    }
    // Delete seed profiles
    const profiles = await ctx.db.query("userProfiles").collect();
    for (const p of profiles) {
      if ((p.userId as string).startsWith("seed-")) {
        await ctx.db.delete(p._id);
      }
    }
    return { cleaned: vehicles.length };
  },
});

export const insertVehicle = internalMutation({
  args: {
    vehicle: v.any(),
    imageStorageIds: v.array(v.string()),
  },
  handler: async (ctx, { vehicle, imageStorageIds }) => {
    return await ctx.db.insert("vehicles", {
      ...vehicle,
      imageUrls: imageStorageIds,
    });
  },
});

export const insertProfile = internalMutation({
  args: { userId: v.string(), displayName: v.string() },
  handler: async (ctx, { userId, displayName }) => {
    const existing = await ctx.db.query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("userProfiles", {
      userId,
      displayName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      kycStatus: "verified",
    });
  },
});

export const insertReservation = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    return await ctx.db.insert("reservations", data);
  },
});

export const insertReview = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    return await ctx.db.insert("reviews", data);
  },
});

// ═══════════════════════════════════════════════════════
// MAIN SEED ACTION — run with: npx convex run seed:run
// ═══════════════════════════════════════════════════════
export const run = action({
  args: {},
  handler: async (ctx) => {
    console.log("🌱 Cleaning previous seeds...");
    await ctx.runMutation(internal.seed.cleanSeeds);

    console.log("👤 Creating seed profiles...");
    for (const owner of SEED_OWNERS) {
      await ctx.runMutation(internal.seed.insertProfile, {
        userId: owner.id,
        displayName: owner.name,
      });
    }

    console.log("📸 Fetching images & creating vehicles...");
    const vehicleIds: { id: string; title: string; owner: string; price: number }[] = [];
    let photoCount = 0;
    const now = Date.now();

    for (let i = 0; i < VEHICLES.length; i++) {
      const v = VEHICLES[i];
      const urls = PHOTOS[v.title] || [];
      const storageIds: string[] = [];

      // Fetch each photo and store
      for (const url of urls) {
        try {
          const res = await fetch(url, { redirect: "follow" });
          if (!res.ok) continue;
          const blob = await res.blob();
          const sid = await ctx.storage.store(blob);
          storageIds.push(sid as string);
          photoCount++;
        } catch (e) {
          console.warn(`  ⚠ Failed: ${v.title} — ${url}`);
        }
      }

      const { min, max } = computeDepositRange(v.price);
      const ownerId = ownerForCity(v.city);

      const vehicleId = await ctx.runMutation(internal.seed.insertVehicle, {
        vehicle: {
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
          createdAt: now - (VEHICLES.length - i) * 86400000, // stagger creation dates
          isSeed: true,
          isActive: true,
          ownerUserId: ownerId,
          depositMin: min,
          depositMax: max,
          depositSelected: min,
        },
        imageStorageIds: storageIds,
      });

      vehicleIds.push({ id: vehicleId, title: v.title, owner: ownerId, price: v.price });
      console.log(`  ✅ ${v.title} — ${storageIds.length} photo(s)`);
    }

    // Create completed reservations with reviews (for 8 random vehicles)
    console.log("📋 Creating reservations & reviews...");
    const renterIds = ["seed-renter-1", "seed-renter-2", "seed-renter-3"];
    const renterNames = ["Amine Berrada", "Hiba Tazi", "Omar Kettani"];

    // Create renter profiles
    for (let i = 0; i < renterIds.length; i++) {
      await ctx.runMutation(internal.seed.insertProfile, {
        userId: renterIds[i],
        displayName: renterNames[i],
      });
    }

    // Completed reservations + reviews
    const reviewVehicles = vehicleIds.filter((_, i) => i % 2 === 0).slice(0, 8);
    for (let i = 0; i < reviewVehicles.length; i++) {
      const v = reviewVehicles[i];
      const renterId = renterIds[i % renterIds.length];
      const daysAgo = 30 + i * 7;
      const duration = 2 + (i % 4);
      const startDate = new Date(now - daysAgo * 86400000);
      const endDate = new Date(startDate.getTime() + duration * 86400000);
      const fmt = (d: Date) => d.toISOString().split("T")[0];

      const resId = await ctx.runMutation(internal.seed.insertReservation, {
        data: {
          vehicleId: v.id,
          renterUserId: renterId,
          ownerUserId: v.owner,
          status: "completed",
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          createdAt: startDate.getTime() - 86400000 * 3,
        },
      });

      // Review from renter
      const rating = 4 + Math.random();
      const comm = Math.round(3.5 + Math.random() * 1.5);
      const punct = Math.round(3.5 + Math.random() * 1.5);
      const clean = Math.round(4 + Math.random());
      const conf = Math.round(3.5 + Math.random() * 1.5);
      const avg = Math.round(((comm + punct + clean + conf) / 4) * 10) / 10;

      await ctx.runMutation(internal.seed.insertReview, {
        data: {
          reservationId: resId,
          vehicleId: v.id,
          authorUserId: renterId,
          targetUserId: v.owner,
          role: "renter",
          ratings: { communication: comm, punctuality: punct, cleanliness: clean, conformity: conf },
          averageRating: avg,
          comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
          createdAt: endDate.getTime() + 3600000,
        },
      });
    }

    console.log(`\n🌱 Seed complete!`);
    console.log(`   ${vehicleIds.length} vehicles`);
    console.log(`   ${photoCount} photos`);
    console.log(`   ${SEED_OWNERS.length + renterIds.length} profiles`);
    console.log(`   ${reviewVehicles.length} reviews`);

    return {
      ok: true,
      vehicles: vehicleIds.length,
      photos: photoCount,
      reviews: reviewVehicles.length,
    };
  },
});
