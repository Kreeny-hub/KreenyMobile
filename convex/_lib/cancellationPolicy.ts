/**
 * ══════════════════════════════════════════════════════
 * Cancellation Policy Engine
 * ══════════════════════════════════════════════════════
 *
 * 3 politiques standard marketplace :
 *
 * FLEXIBLE  → gratuit jusqu'à 24h avant. Après: 50%.
 * MODERATE  → gratuit jusqu'à J-3. J-3→J-1: 50%. <24h: 0%.  ← DEFAULT au lancement
 * STRICT    → gratuit jusqu'à J-7. J-7→J-3: 50%. <J-3: 0%.
 *
 * STRATÉGIE V1 :
 * - Tous les véhicules = "moderate" imposé
 * - Le choix sera débloqué progressivement :
 *     Niveau 2 (5 réservations + KYC) → flexible/moderate
 *     Niveau 3 (15 réservations + note >4.2) → strict débloqué
 *
 * Avant paiement → toujours gratuit (pas d'argent engagé).
 */

export const CANCELLATION_POLICIES = ["flexible", "moderate", "strict"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export function isCancellationPolicy(v: string): v is CancellationPolicy {
  return (CANCELLATION_POLICIES as readonly string[]).includes(v);
}

// ─── Display info per policy ────────────────────────────
export const POLICY_INFO: Record<CancellationPolicy, {
  label: string;
  shortDesc: string;
  rules: string[];
  icon: string;
  color: string;
}> = {
  flexible: {
    label: "Flexible",
    shortDesc: "Annulation gratuite jusqu'à 24h avant",
    rules: [
      "Annulation gratuite jusqu'à 24h avant le départ",
      "Moins de 24h avant : remboursement de 50%",
    ],
    icon: "shield-checkmark-outline",
    color: "#10B981",
  },
  moderate: {
    label: "Modérée",
    shortDesc: "Annulation gratuite jusqu'à 3 jours avant",
    rules: [
      "Annulation gratuite jusqu'à 3 jours avant le départ",
      "Entre 3 jours et 24h avant : remboursement de 50%",
      "Moins de 24h avant : aucun remboursement",
    ],
    icon: "shield-half-outline",
    color: "#F59E0B",
  },
  strict: {
    label: "Stricte",
    shortDesc: "Annulation gratuite jusqu'à 7 jours avant",
    rules: [
      "Annulation gratuite jusqu'à 7 jours avant le départ",
      "Entre 7 jours et 3 jours avant : remboursement de 50%",
      "Moins de 3 jours avant : aucun remboursement",
    ],
    icon: "lock-closed-outline",
    color: "#EF4444",
  },
};

// ─── Refund calculation ─────────────────────────────────

export interface CancellationResult {
  /** 0..1 — fraction of totalAmount refunded */
  refundPercent: number;
  /** Absolute refund amount (MAD) */
  refundAmount: number;
  /** Penalty amount (MAD) — what the renter loses */
  penaltyAmount: number;
  /** Human-readable reason */
  reason: string;
  /** Whether this is a free cancellation */
  isFree: boolean;
}

/**
 * Compute cancellation refund.
 *
 * @param policy       — vehicle's cancellation policy
 * @param startDateIso — reservation start date "YYYY-MM-DD"
 * @param totalAmount  — total paid amount
 * @param isPaid       — whether payment has been captured
 * @param nowMs        — current time in ms (default: Date.now())
 */
export function computeCancellationRefund(
  policy: CancellationPolicy,
  startDateIso: string,
  totalAmount: number,
  isPaid: boolean,
  nowMs: number = Date.now(),
): CancellationResult {
  // ── Before payment → always free ──
  if (!isPaid) {
    return {
      refundPercent: 1,
      refundAmount: totalAmount,
      penaltyAmount: 0,
      reason: "Annulation avant paiement — aucun frais",
      isFree: true,
    };
  }

  // ── Hours until start ──
  const startMs = new Date(`${startDateIso}T09:00:00`).getTime(); // 9h AM = heure standard de retrait
  const hoursUntilStart = (startMs - nowMs) / (1000 * 60 * 60);

  let refundPercent: number;
  let reason: string;

  switch (policy) {
    case "flexible":
      if (hoursUntilStart >= 24) {
        refundPercent = 1;
        reason = "Annulation gratuite (plus de 24h avant le départ)";
      } else {
        refundPercent = 0.5;
        reason = "Annulation tardive — remboursement de 50%";
      }
      break;

    case "moderate":
      if (hoursUntilStart >= 72) { // 3 jours
        refundPercent = 1;
        reason = "Annulation gratuite (plus de 3 jours avant le départ)";
      } else if (hoursUntilStart >= 24) {
        refundPercent = 0.5;
        reason = "Annulation entre 3 jours et 24h — remboursement de 50%";
      } else {
        refundPercent = 0;
        reason = "Annulation tardive (moins de 24h) — aucun remboursement";
      }
      break;

    case "strict":
      if (hoursUntilStart >= 168) { // 7 jours
        refundPercent = 1;
        reason = "Annulation gratuite (plus de 7 jours avant le départ)";
      } else if (hoursUntilStart >= 72) { // 3 jours
        refundPercent = 0.5;
        reason = "Annulation entre 7 jours et 3 jours — remboursement de 50%";
      } else {
        refundPercent = 0;
        reason = "Annulation tardive (moins de 3 jours) — aucun remboursement";
      }
      break;
  }

  const refundAmount = Math.round(totalAmount * refundPercent);
  const penaltyAmount = totalAmount - refundAmount;

  return {
    refundPercent,
    refundAmount,
    penaltyAmount,
    reason,
    isFree: refundPercent === 1,
  };
}

/**
 * For owner-initiated cancellation: always full refund to renter.
 * The owner may face platform penalties (future implementation).
 */
export function computeOwnerCancellationRefund(totalAmount: number, isPaid: boolean): CancellationResult {
  return {
    refundPercent: 1,
    refundAmount: isPaid ? totalAmount : 0,
    penaltyAmount: 0,
    reason: "Annulation par le propriétaire — remboursement intégral",
    isFree: true,
  };
}
