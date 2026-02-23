import type { SystemRepository, PingResult } from "../../domain/repositories/SystemRepository";

export async function ping(systemRepo: SystemRepository): Promise<PingResult> {
  return systemRepo.ping();
}
