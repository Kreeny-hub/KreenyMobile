import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { VehicleSchema, type Vehicle } from "../../domain/schemas/vehicle.schema";
import type { VehicleRepository } from "../../domain/repositories/VehicleRepository";

export function createVehicleRepository(convex: ConvexReactClient): VehicleRepository {
  return {
    async listVehicles(): Promise<Vehicle[]> {
      const rows = await convex.query(api.vehicles.listVehicles, {});
      return rows.map((r: any) =>
        VehicleSchema.parse({
          _id: String(r._id),
          title: r.title,
          pricePerDay: r.pricePerDay,
          city: r.city,
          imageUrls: r.imageUrls ?? [],
          createdAt: r.createdAt,

          depositMin: r.depositMin,
          depositMax: r.depositMax,
          depositSelected: r.depositSelected,
        })
      );
    },

    async seedVehicles(): Promise<void> {
      await convex.mutation(api.vehicles.seedVehicles, {});
    },

    async getVehicleById(id: string): Promise<Vehicle | null> {
      const row = await convex.query(api.vehicles.getVehicleById, { id: id as any });
      if (!row) return null;

      const r: any = row;
      return VehicleSchema.parse({
        _id: String(r._id),
        title: r.title,
        pricePerDay: r.pricePerDay,
        city: r.city,
        imageUrls: r.imageUrls ?? [],
        createdAt: r.createdAt,

        depositMin: r.depositMin,
        depositMax: r.depositMax,
        depositSelected: r.depositSelected,
      });
    },

    async searchVehicles(params: { city?: string; maxPricePerDay?: number; limit?: number }): Promise<Vehicle[]> {
      const rows = await convex.query(api.vehicles.searchVehicles, {
        city: params.city,
        maxPricePerDay: params.maxPricePerDay,
        limit: params.limit ?? 20,
      });

      return rows.map((r: any) =>
        VehicleSchema.parse({
          _id: String(r._id),
          title: r.title,
          pricePerDay: r.pricePerDay,
          city: r.city,
          imageUrls: r.imageUrls ?? [],
          createdAt: r.createdAt,

          depositMin: r.depositMin,
          depositMax: r.depositMax,
          depositSelected: r.depositSelected,
        })
      );
    },
  };
}