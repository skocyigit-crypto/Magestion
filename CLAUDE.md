# Magestion

Application de gestion BTP française (multi-tenant via `licences`), monorepo pnpm.

## Run & Operate

- **Dev** : `pnpm dev` (API + web) — `pnpm dev:api` / `pnpm dev:web` séparément.
- **Build** : `pnpm build` (typecheck + build).
- **Typecheck** : `pnpm typecheck`.
- **Migrations DB** : `pnpm db:migrate` — applique les fichiers `lib/db/migrations/NNNN_*.sql` (triés numériquement, une seule fois, table `schema_migrations`). Cible `DATABASE_URL` si défini, sinon PGlite local embarqué (`lib/db/.pglite-data`). Additif/idempotent uniquement — jamais de DELETE/DROP de données.
- **Environment Variables** :
  - `DATABASE_URL` : optionnel en dev (PGlite local si absent), requis en prod.
  - `PDP_API_URL`, `PDP_API_KEY`, `PDP_PLATFORM_ID` : connecteur PDP générique (facturation électronique 2026) — voir `artifacts/api-server/src/lib/pdp.ts`. Si absent → mode **SIMULATION** (aucun réseau, cycle de vie simulé localement).
  - `PDP_PROVIDER=storecove` (+ `PDP_API_KEY`) : bascule sur le connecteur Storecove dédié (même fichier `pdp.ts`), Plateforme Agréée DGFiP choisie pour son modèle multi-tenant — une "Legal Entity" Storecove provisionnée automatiquement par licence (`lib/pdp-legal-entity.ts`, id stocké dans `licences.pdpLegalEntityId`) sous un seul contrat/compte Storecove. ⚠️ Schéma de dépôt (`POST /document_submissions`) et de suivi (`GET /document_submissions/{guid}`) basé sur la spec OpenAPI publique de Storecove, **non vérifié contre un compte sandbox réel** — à valider avant mise en production ; les échecs HTTP ne sont jamais masqués.

## Stack

- pnpm workspaces, Node.js, TypeScript
- Frontend : React + Vite (`artifacts/web`)
- API : Express (`artifacts/api-server`)
- DB : PostgreSQL (ou PGlite embarqué en dev local) + Drizzle ORM (`lib/db`)

## Where things live

- Schéma DB : `lib/db/src/schema/*.ts` (une licence = un tenant, table `licences`)
- Routes API : `artifacts/api-server/src/routes/*`
- Connecteur PDP / facturation électronique : `artifacts/api-server/src/lib/pdp.ts` + `lib/pdp-legal-entity.ts`
- Génération XML Factur-X : `artifacts/api-server/src/lib/facturx-xml.ts`

## Architecture decisions

- **Pas de suppression dure** : données jamais supprimées (archivage/désactivation).
- **Facture verrouillée une fois émise** : `montantHt`/`tauxTva`/`objet` non modifiables server-side au-delà du statut `BROUILLON`.
- **Cycle de vie PDP** : `deposee → recue_destinataire → acceptee | refusee | en_litige → encaissee`, stocké directement sur `factures` (`eStatut`, `ePlatformRef`, `eSimulation`, `eTransmisAt`, `eErreur`) — pas de table séparée.
