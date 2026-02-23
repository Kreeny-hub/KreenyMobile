import { convex } from "./convex";
import { createSystemRepository } from "../../infrastructure/convex/systemRepository";
import { createVehicleRepository } from "../../infrastructure/convex/vehicleRepository";
import { createReservationRepository } from "../../infrastructure/convex/reservationRepository";

export const container = {
  systemRepository: createSystemRepository(convex),
  vehicleRepository: createVehicleRepository(convex),
  reservationRepository: createReservationRepository(convex),
};
