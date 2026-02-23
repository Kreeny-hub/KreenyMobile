import { useEffect, useState } from "react";
import type { Vehicle } from "../../domain/schemas/vehicle.schema";
import { container } from "../../shared/config/container";

export function useVehicle(id: string) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await container.vehicleRepository.getVehicleById(id);
        if (mounted) setVehicle(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  return { vehicle, loading, error };
}
