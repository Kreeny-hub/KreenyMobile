import { useEffect, useState } from "react";
import type { PingResult } from "../../domain/repositories/SystemRepository";
import { ping as pingUseCase } from "../../application/system/ping";
import { container } from "../../shared/config/container";

export function usePing() {
  const [data, setData] = useState<PingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = await pingUseCase(container.systemRepository);
        if (mounted) setData(result);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}
