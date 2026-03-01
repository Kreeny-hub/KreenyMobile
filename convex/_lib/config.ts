/**
 * convex/_lib/config.ts
 * ────────────────────────────────────────────────────
 * Configuration plateforme Kreeny.
 * Centralise les paramètres business modifiables.
 *
 * ── Modèle de commission (phase lancement) ──
 * Le locataire paie : prix location + frais de service (8%)
 * Le propriétaire reçoit : prix location - commission propriétaire (2%)
 * Kreeny garde : frais de service + commission = 10% total
 *
 * ── Exemples ──
 * Location 5 jours × 300 MAD = 1 500 MAD
 * Locataire paie  : 1 500 + 120 (8%) = 1 620 MAD
 * Propriétaire reçoit : 1 500 - 30 (2%) = 1 470 MAD
 * Kreeny garde   : 120 + 30 = 150 MAD (10%)
 */

// ── Taux de commission ──

/** Frais de service facturés AU LOCATAIRE (% du sous-total location) */
export const RENTER_SERVICE_FEE_RATE = 0.08; // 8%

/** Commission prélevée AU PROPRIÉTAIRE sur le payout (% du sous-total location) */
export const OWNER_COMMISSION_RATE = 0.02; // 2%

// Total revenu plateforme = 8% + 2% = 10%

// ── Devise ──
export const DEFAULT_CURRENCY = "MAD";

/** Calcule les montants pour une réservation */
export function computePricing(opts: { days: number; pricePerDay: number }) {
  const subtotal = opts.days * opts.pricePerDay;
  const serviceFee = Math.round(subtotal * RENTER_SERVICE_FEE_RATE);
  const ownerCommission = Math.round(subtotal * OWNER_COMMISSION_RATE);
  const totalRenterPays = subtotal + serviceFee;
  const ownerPayout = subtotal - ownerCommission;

  return {
    subtotal,          // prix location brut (jours × prix/jour)
    serviceFee,        // frais de service (facturés au locataire)
    ownerCommission,   // commission (prélevée au propriétaire)
    totalRenterPays,   // total que le locataire paie
    ownerPayout,       // ce que le propriétaire reçoit
    platformRevenue: serviceFee + ownerCommission, // revenu Kreeny
  };
}
