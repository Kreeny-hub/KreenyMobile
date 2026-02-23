import { useEffect, useState } from "react";
import type { Vehicle } from "../../domain/schemas/vehicle.schema";
import { container } from "../../shared/config/container";

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await container.vehicleRepository.listVehicles();
      setVehicles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const seed = async () => {
    await container.vehicleRepository.seedVehicles();
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, []);

  return { vehicles, loading, error, refresh, seed };
}
