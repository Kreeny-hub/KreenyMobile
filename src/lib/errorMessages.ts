/**
 * Centralized error-to-user-message translation.
 * Maps ConvexError codes and common errors to clear French messages.
 */

const ERROR_MAP: Record<string, { title: string; message: string }> = {
  // ── Auth ──
  Unauthenticated: {
    title: "Connexion requise",
    message: "Connecte-toi pour continuer.",
  },
  Forbidden: {
    title: "Accès refusé",
    message: "Tu n'as pas la permission d'effectuer cette action.",
  },

  // ── Reservation creation ──
  AlreadyRequested: {
    title: "Demande déjà envoyée",
    message: "Tu as déjà une demande en cours pour ce véhicule. Attends la réponse du propriétaire.",
  },
  CooldownActive: {
    title: "Trop tôt pour redemander",
    message: "Patiente quelques minutes avant de refaire une demande pour ce véhicule.",
  },
  VehicleNotFound: {
    title: "Annonce introuvable",
    message: "Ce véhicule a peut-être été retiré. Essaie un autre véhicule.",
  },
  VehicleMissingOwner: {
    title: "Propriétaire introuvable",
    message: "Cette annonce a un problème. Contacte le support.",
  },
  CannotRentOwnVehicle: {
    title: "C'est ton véhicule !",
    message: "Tu ne peux pas louer ton propre véhicule.",
  },
  KycRequired: {
    title: "Vérification requise",
    message: "Tu dois vérifier ton identité avant de pouvoir réserver un véhicule. Va dans Paramètres → Vérification d'identité.",
  },
  OwnerBlockedDates: {
    title: "Dates indisponibles",
    message: "Le propriétaire a bloqué certaines de ces dates. Choisis d'autres dates.",
  },
  VehicleUnavailable: {
    title: "Véhicule déjà réservé",
    message: "Ce véhicule est déjà réservé sur ces dates. Essaie d'autres dates.",
  },
  InvalidDateFormat: {
    title: "Format de date invalide",
    message: "Vérifie les dates sélectionnées et réessaie.",
  },
  InvalidDateRange: {
    title: "Dates incorrectes",
    message: "La date de fin doit être après la date de début.",
  },

  // ── Payment ──
  PaymentNotInitialized: {
    title: "Paiement non prêt",
    message: "Le paiement n'a pas été initialisé correctement. Réessaie.",
  },

  // ── Reservation actions ──
  InvalidStatus: {
    title: "Action impossible",
    message: "Cette réservation n'est pas dans le bon état pour cette action.",
  },
  ReservationNotFound: {
    title: "Réservation introuvable",
    message: "Cette réservation n'existe plus ou a été supprimée.",
  },

  // ── Vehicle management ──
  HasActiveReservations: {
    title: "Réservations en cours",
    message: "Impossible tant qu'il y a des réservations actives sur ce véhicule.",
  },
  CancellationNotAllowed: {
    title: "Annulation impossible",
    message: "Cette réservation ne peut plus être annulée à ce stade.",
  },
  InvalidTransition: {
    title: "Action impossible",
    message: "Cette action n'est pas disponible pour l'état actuel de la réservation.",
  },
  AlreadyReported: {
    title: "Déjà signalé",
    message: "Tu as déjà envoyé un signalement pour cet élément.",
  },
  CannotReportSelf: {
    title: "Action impossible",
    message: "Tu ne peux pas te signaler toi-même.",
  },
  NotFound: {
    title: "Introuvable",
    message: "Cet élément n'existe plus ou a été supprimé.",
  },

  // ── Messages ──
  EmptyMessage: {
    title: "Message vide",
    message: "Écris quelque chose avant d'envoyer.",
  },
  MessageTooLong: {
    title: "Message trop long",
    message: "Limite ton message à 1000 caractères.",
  },
  RateLimited: {
    title: "Doucement !",
    message: "Attends une seconde avant d'envoyer un autre message.",
  },
  ThreadNotFound: {
    title: "Conversation introuvable",
    message: "Cette conversation n'existe plus.",
  },

  // ── Network ──
  NetworkError: {
    title: "Pas de connexion",
    message: "Vérifie ta connexion internet et réessaie.",
  },
};

// Fallback
const FALLBACK = {
  title: "Quelque chose a raté",
  message: "Une erreur inattendue s'est produite. Réessaie dans un instant.",
};

/**
 * Extract error code from a ConvexError or generic Error.
 */
function extractCode(error: unknown): string {
  if (error && typeof error === "object") {
    // ConvexError: { data: "ErrorCode" }
    if ("data" in error && typeof (error as any).data === "string") {
      return (error as any).data;
    }
    // Error with message that is a code
    if (error instanceof Error) {
      // ConvexError wraps: "Uncaught ConvexError: ErrorCode"
      const match = error.message.match(/ConvexError:\s*(\w+)/);
      if (match) return match[1];
      // Check if message itself is a known code
      if (ERROR_MAP[error.message]) return error.message;
      // Network errors
      if (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("Network")) {
        return "NetworkError";
      }
    }
  }
  return "";
}

/**
 * Get a user-friendly error object { title, message } from any error.
 */
export function translateError(error: unknown): { title: string; message: string } {
  const code = extractCode(error);
  return ERROR_MAP[code] ?? FALLBACK;
}

/**
 * Get just the user-facing message string.
 */
export function getErrorMessage(error: unknown): string {
  const { title, message } = translateError(error);
  return message;
}

/**
 * Get title + message for Alert.alert usage.
 */
export function alertError(error: unknown): [string, string] {
  const { title, message } = translateError(error);
  return [title, message];
}
