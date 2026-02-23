export type PingResult = { ok: boolean; message: string };

export interface SystemRepository {
  ping(): Promise<PingResult>;
}
