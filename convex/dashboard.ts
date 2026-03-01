import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

export const getOwnerDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = userKey(user);

    // Active reservations by status
    const requested = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "requested")
      )
      .order("desc").take(5);

    const acceptedPending = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "accepted_pending_payment")
      )
      .order("desc").take(5);

    const pickupPending = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "pickup_pending")
      )
      .order("desc").take(5);

    const dropoffPending = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "dropoff_pending")
      )
      .order("desc").take(5);

    const inProgress = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "in_progress")
      )
      .order("desc").take(5);

    const completed = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "completed")
      )
      .order("desc").take(50);

    // Enrich reservations with vehicle info
    const allActive = [...requested, ...acceptedPending, ...pickupPending, ...inProgress, ...dropoffPending];
    const enriched = [];
    for (const r of allActive) {
      const v = await ctx.db.get(r.vehicleId);
      if (!v) continue; // Vehicle deleted — skip
      let coverUrl: string | null = null;
      if (v.imageUrls.length > 0) {
        coverUrl = await ctx.storage.getUrl(v.imageUrls[0] as any) ?? null;
      }

      // Check if owner already submitted their constat for this reservation
      let needsMyConstat = false;
      if (r.status === "pickup_pending" || r.status === "dropoff_pending") {
        const phase = r.status === "pickup_pending" ? "checkin" : "checkout";
        const already = await ctx.db
          .query("conditionReports")
          .withIndex("by_reservation_phase_role", (q) =>
            q.eq("reservationId", r._id).eq("phase", phase as any).eq("role", "owner")
          ).unique();
        needsMyConstat = !already;
      }

      enriched.push({
        ...r,
        vehicleTitle: v.title ?? "Sans titre",
        vehicleCity: v.city ?? "",
        vehiclePricePerDay: v.pricePerDay ?? 0,
        coverUrl,
        needsMyConstat,
      });
    }

    // Earnings from completed — total + monthly breakdown
    let totalEarnings = 0;
    const monthlyMap: Record<string, number> = {};
    for (const r of completed) {
      const v = await ctx.db.get(r.vehicleId);
      if (!v) continue;
      const [y1, m1, d1] = r.startDate.split("-").map(Number);
      const [y2, m2, d2] = r.endDate.split("-").map(Number);
      const days = Math.max(1, Math.round(
        (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000
      ));
      const amount = days * v.pricePerDay;
      totalEarnings += amount;

      // Group by month of endDate (= when revenue is realized)
      const monthKey = r.endDate.slice(0, 7); // "2026-02"
      monthlyMap[monthKey] = (monthlyMap[monthKey] ?? 0) + amount;
    }

    // Build last 6 months array (including current)
    const now = new Date();
    const monthlyEarnings: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyEarnings.push({ month: key, amount: monthlyMap[key] ?? 0 });
    }

    // My vehicles count
    const myVehicles = await ctx.db
      .query("vehicles")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .take(50);

    return {
      counts: {
        requested: enriched.filter((r) => r.status === "requested").length,
        acceptedPending: enriched.filter((r) => r.status === "accepted_pending_payment").length,
        pickupPending: enriched.filter((r: any) => r.status === "pickup_pending" && r.needsMyConstat).length,
        dropoffPending: enriched.filter((r: any) => r.status === "dropoff_pending" && r.needsMyConstat).length,
        inProgress: enriched.filter((r) => r.status === "in_progress").length,
        completed: completed.length,
        totalVehicles: myVehicles.filter((v) => v.isActive !== false).length,
      },
      totalEarnings,
      monthlyEarnings,
      reservations: enriched.sort((a, b) => b.createdAt - a.createdAt),
      myVehicles: myVehicles
        .filter((v) => v.isActive !== false)
        .map((v) => ({ _id: v._id, title: v.title })),
    };
  },
});
