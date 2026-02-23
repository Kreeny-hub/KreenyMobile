import type { SystemRepository, PingResult } from "../../domain/repositories/SystemRepository";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function createSystemRepository(convex: ConvexReactClient): SystemRepository {
  return {
    async ping(): Promise<PingResult> {
      return await convex.query(api.ping.ping);
    },
  };
}
