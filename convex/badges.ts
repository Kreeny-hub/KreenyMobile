import { query } from "./_generated/server";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

export const getProfileBadge = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    // ✅ invité / déconnecté => pas de badge, pas d'erreur
    if (!user) return { show: false, requestedCount: 0 };

    const me = userKey(user);

    // ✅ Optimisé + borné
    const count = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", me).eq("status", "requested")
      )
      .take(100);

    return { show: count.length > 0, requestedCount: count.length };
  },
});
