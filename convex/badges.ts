import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getProfileBadge = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);

    // ✅ invité / déconnecté => pas de badge, pas d'erreur
    if (!user) return { show: false, requestedCount: 0 };

    const me = String(user.userId ?? user.email ?? user._id);

    const count = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(q.eq(q.field("ownerUserId"), me), q.eq(q.field("status"), "requested"))
      )
      .collect();

    return { show: count.length > 0, requestedCount: count.length };
  },
});