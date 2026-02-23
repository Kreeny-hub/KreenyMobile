import { useEffect, useState } from "react";
import type { Vehicle } from "../../domain/schemas/vehicle.schema";
import { container } from "../../shared/config/container";

export function useVehicleSearch(city?: string, maxPricePerDay?: number) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (c?: string, p?: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await container.vehicleRepository.searchVehicles({
        city: c,
        maxPricePerDay: p,
        limit: 30,
      });
      setVehicles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run(city, maxPricePerDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, maxPricePerDay]);

  return { vehicles, loading, error, run };
}
