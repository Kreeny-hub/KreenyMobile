import { z } from "zod";

export const VehicleSchema = z.object({
  _id: z.string(),
  title: z.string(),
  pricePerDay: z.number(),
  city: z.string(),
  imageUrls: z.array(z.string()),
  createdAt: z.number(),

  // ✅ RISK layer (optionnel le temps que tous les vieux docs soient backfill)
  depositMin: z.number().optional(),
  depositMax: z.number().optional(),
  depositSelected: z.number().optional(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;