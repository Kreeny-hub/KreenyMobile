/**
 * Migration: aligne tous les IDs utilisateur sur le format userKey (= user._id).
 *
 * Pas besoin d'auth : scanne les tables et compare avec les données
 * du composant Better Auth pour trouver le bon _id.
 *
 * Usage: npx convex run migrations/fixOwnerUserIds:migrateAll
 */
import { internalMutation, mutation } from "../_generated/server";
import { authComponent } from "../auth";

/**
 * Version appelable depuis l'app (nécessite auth).
 * Corrige les données du user connecté.
 */
export const migrateMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return { ok: false, reason: "not_authenticated" };

    const correctId = String(user._id);

    // Tous les IDs possibles que ce user a pu utiliser
    const oldIds = new Set<string>();
    if ((user as any).userId) oldIds.add(String((user as any).userId));
    if ((user as any).email) oldIds.add(String((user as any).email));
    oldIds.add(correctId);

    let patched = 0;

    // Fix vehicles
    for (const oldId of oldIds) {
      const vehicles = await ctx.db
        .query("vehicles")
        .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", oldId))
        .collect();
      for (const v of vehicles) {
        if (v.ownerUserId !== correctId) {
          await ctx.db.patch(v._id, { ownerUserId: correctId });
          patched++;
        }
      }
    }

    // Fix reservations (as owner)
    for (const oldId of oldIds) {
      const asOwner = await ctx.db
        .query("reservations")
        .withIndex("by_owner", (q) => q.eq("ownerUserId", oldId))
        .collect();
      for (const r of asOwner) {
        if (r.ownerUserId !== correctId) {
          await ctx.db.patch(r._id, { ownerUserId: correctId });
          patched++;
        }
      }
    }

    // Fix reservations (as renter)
    for (const oldId of oldIds) {
      const asRenter = await ctx.db
        .query("reservations")
        .withIndex("by_renter", (q) => q.eq("renterUserId", oldId))
        .collect();
      for (const r of asRenter) {
        if (r.renterUserId !== correctId) {
          await ctx.db.patch(r._id, { renterUserId: correctId });
          patched++;
        }
      }
    }

    // Fix threads
    for (const oldId of oldIds) {
      const threads = await ctx.db
        .query("threads")
        .filter((q) =>
          q.or(
            q.eq(q.field("ownerUserId"), oldId),
            q.eq(q.field("renterUserId"), oldId)
          )
        )
        .collect();
      for (const t of threads) {
        const patch: any = {};
        if (t.ownerUserId === oldId && t.ownerUserId !== correctId) patch.ownerUserId = correctId;
        if (t.renterUserId === oldId && t.renterUserId !== correctId) patch.renterUserId = correctId;
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(t._id, patch);
          patched++;
        }
      }
    }

    // Fix messages
    for (const oldId of oldIds) {
      const messages = await ctx.db
        .query("messages")
        .filter((q) => q.eq(q.field("senderUserId"), oldId))
        .collect();
      for (const m of messages) {
        if (m.senderUserId !== correctId) {
          await ctx.db.patch(m._id, { senderUserId: correctId });
          patched++;
        }
      }
    }

    // Fix condition reports
    for (const oldId of oldIds) {
      const reports = await ctx.db
        .query("conditionReports")
        .filter((q) => q.eq(q.field("submittedByUserId"), oldId))
        .collect();
      for (const r of reports) {
        if ((r as any).submittedByUserId !== correctId) {
          await ctx.db.patch(r._id, { submittedByUserId: correctId } as any);
          patched++;
        }
      }
    }

    // Fix user profiles
    for (const oldId of oldIds) {
      const profiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", oldId))
        .collect();
      for (const p of profiles) {
        if (p.userId !== correctId) {
          await ctx.db.patch(p._id, { userId: correctId });
          patched++;
        }
      }
    }

    return { ok: true, correctId, oldIds: [...oldIds], patched };
  },
});
