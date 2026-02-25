import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { userKey } from "./_lib/userKey";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// ✅ Avatar affichable (inline) pour l’utilisateur connecté
http.route({
  path: "/me/avatar",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const user = await authComponent.getAuthUser(ctx).catch(() => null);
    if (!user) return new Response("Unauthenticated", { status: 401 });

    const me = userKey(user);

    const profile = await ctx.runQuery(api.userProfiles.getProfileByUserId, {
      userId: me,
    });

    if (!profile?.avatarStorageId) return new Response("No avatar", { status: 404 });

    const blob = await ctx.storage.get(profile.avatarStorageId);
    if (!blob) return new Response("Not found", { status: 404 });

    return new Response(blob, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store",
      },
    });
  }),
});

export default http;