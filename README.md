# Kreeny Mobile

Application mobile marketplace de location de voitures (Expo + Convex).

## Stack

- Expo Router + React Native
- Convex (backend, temps réel, jobs cron)
- better-auth (auth)
- Zod (validation côté client/domain)

## Démarrage local

1. Installer les dépendances:

```bash
npm install
```

2. Lancer l'app:

```bash
npm run start
```

3. Lancer Convex en dev (dans un autre terminal):

```bash
npx convex dev
```

## Variables d'environnement

- `CONVEX_DEPLOYMENT`: fourni par Convex.
- `ENABLE_DEV_ACTIONS=true`: autorise les mutations de debug (ex: `DEV_MARK_PAID`, seed véhicules).
  - Par défaut, les actions DEV sont bloquées hors déploiement `dev:`.

## Architecture backend (résumé)

- `convex/schema.ts`: schéma + indexes.
- `convex/reservations.ts`: cycle de vie des réservations.
- `convex/chat*.ts`: messagerie transactionnelle liée aux réservations.
- `convex/_lib/reservationStateMachine.ts`: transitions autorisées.
- `convex/_lib/reservationTransitions.ts`: transition atomique + event.
- `convex/crons.ts`: maintenance automatique (expiration des réservations non payées).

## Sécurité et robustesse

- Contrôle d'authentification et ownership sur les mutations critiques.
- Status de réservation/paiement/caution typés strictement au schéma.
- Upload URL Convex Storage protégée par auth.
- Mutations DEV protégées par garde d'environnement.
