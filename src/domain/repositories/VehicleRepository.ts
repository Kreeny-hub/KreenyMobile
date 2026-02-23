import type { Vehicle } from "../schemas/vehicle.schema";

export interface VehicleRepository {
  listVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | null>;
  seedVehicles(): Promise<void>;
  
  searchVehicles(params: {
  city?: string;
  maxPricePerDay?: number;
  limit?: number;
}): Promise<Vehicle[]>;

}
