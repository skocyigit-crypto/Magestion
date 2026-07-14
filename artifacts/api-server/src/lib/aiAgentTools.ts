import { and, desc, eq, ilike, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  db,
  clientsTable,
  projectsTable,
  devisTable,
  facturesTable,
  fournisseursTable,
  employeesTable,
  stockItemsTable,
  articlesTable,
  agendaEventsTable,
  prospectsTable,
} from "@magestion/db";

// Outils LECTURE SEULE pour l'assistant IA (voir routes/agent.ts) : aucun
// outil de creation/modification n'existe ici par conception — un modele de
// langage ne doit jamais ecrire directement en base sans passage par les
// routes metier (validation Zod, calculs serveur, regles produit). Chaque
// table est scopee licenceId + une whitelist explicite de colonnes exposees
// (jamais licenceId lui-meme, jamais de champ auth/token/hash — voir
// schema/users.ts qui n'apparait d'ailleurs pas dans TABLES ci-dessous).
type TableConfig = {
  table: PgTable;
  label: string;
  // Colonnes exposees au modele : cle = nom renvoye, valeur = colonne source.
  columns: Record<string, AnyColumn>;
  licenceIdCol: AnyColumn;
  activeCol?: AnyColumn;
  searchCol?: AnyColumn;
  orderCol: AnyColumn;
};

const TABLES: Record<string, TableConfig> = {
  chantiers: {
    table: projectsTable,
    label: "Chantiers",
    columns: {
      id: projectsTable.id, nom: projectsTable.nom, client: projectsTable.client,
      adresse: projectsTable.adresse, budgetEstimeHt: projectsTable.budgetEstimeHt,
      categorie: projectsTable.categorie, statut: projectsTable.statut, createdAt: projectsTable.createdAt,
    },
    licenceIdCol: projectsTable.licenceId, activeCol: projectsTable.active,
    searchCol: projectsTable.nom, orderCol: projectsTable.createdAt,
  },
  clients: {
    table: clientsTable,
    label: "Clients",
    columns: {
      id: clientsTable.id, type: clientsTable.type, nom: clientsTable.nom, email: clientsTable.email,
      telephone: clientsTable.telephone, ville: clientsTable.ville, createdAt: clientsTable.createdAt,
    },
    licenceIdCol: clientsTable.licenceId, activeCol: clientsTable.active,
    searchCol: clientsTable.nom, orderCol: clientsTable.createdAt,
  },
  prospects: {
    table: prospectsTable,
    label: "Prospects",
    columns: {
      id: prospectsTable.id, nom: prospectsTable.nom, contact: prospectsTable.contact,
      budgetEstime: prospectsTable.budgetEstime, urgence: prospectsTable.urgence,
      statut: prospectsTable.statut, score: prospectsTable.score, createdAt: prospectsTable.createdAt,
    },
    licenceIdCol: prospectsTable.licenceId,
    searchCol: prospectsTable.nom, orderCol: prospectsTable.createdAt,
  },
  devis: {
    table: devisTable,
    label: "Devis",
    columns: {
      id: devisTable.id, numero: devisTable.numero, client: devisTable.client, objet: devisTable.objet,
      statut: devisTable.statut, montantHt: devisTable.montantHt, tauxTva: devisTable.tauxTva,
      createdAt: devisTable.createdAt,
    },
    licenceIdCol: devisTable.licenceId, activeCol: devisTable.active,
    searchCol: devisTable.client, orderCol: devisTable.createdAt,
  },
  factures: {
    table: facturesTable,
    label: "Factures",
    columns: {
      id: facturesTable.id, numero: facturesTable.numero, client: facturesTable.client, objet: facturesTable.objet,
      statut: facturesTable.statut, montantHt: facturesTable.montantHt, tauxTva: facturesTable.tauxTva,
      dateEcheance: facturesTable.dateEcheance, datePaiement: facturesTable.datePaiement,
      createdAt: facturesTable.createdAt,
    },
    licenceIdCol: facturesTable.licenceId, activeCol: facturesTable.active,
    searchCol: facturesTable.client, orderCol: facturesTable.createdAt,
  },
  fournisseurs: {
    table: fournisseursTable,
    label: "Fournisseurs",
    columns: {
      id: fournisseursTable.id, nom: fournisseursTable.nom, email: fournisseursTable.email,
      telephone: fournisseursTable.telephone, ville: fournisseursTable.ville,
    },
    licenceIdCol: fournisseursTable.licenceId, activeCol: fournisseursTable.active,
    searchCol: fournisseursTable.nom, orderCol: fournisseursTable.nom,
  },
  employes: {
    table: employeesTable,
    label: "Employes",
    columns: {
      id: employeesTable.id, nom: employeesTable.nom, prenom: employeesTable.prenom,
      role: employeesTable.role, statut: employeesTable.statut,
    },
    licenceIdCol: employeesTable.licenceId, activeCol: employeesTable.active,
    searchCol: employeesTable.nom, orderCol: employeesTable.nom,
  },
  stock: {
    table: stockItemsTable,
    label: "Stock",
    columns: {
      id: stockItemsTable.id, nom: stockItemsTable.nom, categorie: stockItemsTable.categorie,
      unite: stockItemsTable.unite, quantiteActuelle: stockItemsTable.quantiteActuelle,
      seuilAlerte: stockItemsTable.seuilAlerte, prixUnitaireHt: stockItemsTable.prixUnitaireHt,
    },
    licenceIdCol: stockItemsTable.licenceId, activeCol: stockItemsTable.active,
    searchCol: stockItemsTable.nom, orderCol: stockItemsTable.nom,
  },
  articles: {
    table: articlesTable,
    label: "Articles/ouvrages",
    columns: {
      id: articlesTable.id, code: articlesTable.code, libelle: articlesTable.libelle,
      unite: articlesTable.unite, categorie: articlesTable.categorie, prixUnitaireHt: articlesTable.prixUnitaireHt,
    },
    licenceIdCol: articlesTable.licenceId, activeCol: articlesTable.active,
    searchCol: articlesTable.libelle, orderCol: articlesTable.libelle,
  },
  agenda: {
    table: agendaEventsTable,
    label: "Agenda",
    columns: {
      id: agendaEventsTable.id, titre: agendaEventsTable.titre, type: agendaEventsTable.type,
      statut: agendaEventsTable.statut, priorite: agendaEventsTable.priorite,
      dateHeure: agendaEventsTable.dateHeure, dureeMinutes: agendaEventsTable.dureeMinutes,
    },
    licenceIdCol: agendaEventsTable.licenceId, activeCol: agendaEventsTable.active,
    searchCol: agendaEventsTable.titre, orderCol: agendaEventsTable.dateHeure,
  },
};

export const TABLE_KEYS = Object.keys(TABLES);
export function tableLabel(key: string): string {
  return TABLES[key]?.label ?? key;
}

function scopedConditions(cfg: TableConfig, licenceId: string, extra?: SQL): SQL {
  const conditions = [eq(cfg.licenceIdCol, licenceId)];
  if (cfg.activeCol) conditions.push(eq(cfg.activeCol, true));
  if (extra) conditions.push(extra);
  return and(...conditions)!;
}

const MAX_ROWS = 25;

// Dispatch dynamique sur une table choisie a l'execution (par le modele IA) :
// Drizzle type ses requetes statiquement par table/colonnes, incompatible
// avec un select() generique sur une TableConfig resolue au runtime. Le cast
// `any` est borne a ce seul helper — la securite (scoping licenceId, whitelist
// de colonnes via TableConfig.columns) est appliquee AVANT, pas contournee.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectFrom(cfg: TableConfig): any {
  return db.select(cfg.columns as never).from(cfg.table as never);
}

async function listRecords(licenceId: string, args: { table: string; limit?: number }) {
  const cfg = TABLES[args.table];
  if (!cfg) return { error: `Table inconnue: ${args.table}` };
  const limit = Math.min(args.limit ?? 10, MAX_ROWS);
  const rows = await selectFrom(cfg).where(scopedConditions(cfg, licenceId)).orderBy(desc(cfg.orderCol)).limit(limit);
  return { table: args.table, count: rows.length, rows };
}

async function searchRecords(licenceId: string, args: { table: string; query: string; limit?: number }) {
  const cfg = TABLES[args.table];
  if (!cfg) return { error: `Table inconnue: ${args.table}` };
  if (!cfg.searchCol) return { error: `Recherche non disponible sur ${args.table}` };
  const limit = Math.min(args.limit ?? 10, MAX_ROWS);
  const rows = await selectFrom(cfg)
    .where(scopedConditions(cfg, licenceId, ilike(cfg.searchCol, `%${args.query}%`)))
    .orderBy(desc(cfg.orderCol)).limit(limit);
  return { table: args.table, count: rows.length, rows };
}

async function countRecords(licenceId: string, args: { table: string }) {
  const cfg = TABLES[args.table];
  if (!cfg) return { error: `Table inconnue: ${args.table}` };
  const [row] = await db.select({ count: sql<string>`count(*)` }).from(cfg.table as never).where(scopedConditions(cfg, licenceId)) as { count: string }[];
  return { table: args.table, count: Number(row?.count ?? 0) };
}

async function getRecordById(licenceId: string, args: { table: string; id: string }) {
  const cfg = TABLES[args.table];
  if (!cfg) return { error: `Table inconnue: ${args.table}` };
  const [row] = await selectFrom(cfg)
    .where(scopedConditions(cfg, licenceId, eq(cfg.columns.id, args.id))).limit(1);
  return row ?? { error: "Introuvable" };
}

// Declarations au format Gemini function-calling (schema JSON simplifie,
// pas de $ref/oneOf — l'API generateContent n'accepte qu'un sous-ensemble
// d'OpenAPI). Voir lib/geminiAgent.ts pour la boucle d'appel.
export const AGENT_TOOL_DECLARATIONS = [
  {
    name: "list_records",
    description: `Liste les enregistrements les plus recents d'une table. Tables disponibles: ${TABLE_KEYS.join(", ")}.`,
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", enum: TABLE_KEYS },
        limit: { type: "NUMBER", description: `Nombre max de lignes (defaut 10, max ${MAX_ROWS})` },
      },
      required: ["table"],
    },
  },
  {
    name: "search_records",
    description: "Recherche textuelle (nom/titre/client) dans une table.",
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", enum: TABLE_KEYS },
        query: { type: "STRING", description: "Texte a rechercher" },
        limit: { type: "NUMBER", description: `Nombre max de lignes (defaut 10, max ${MAX_ROWS})` },
      },
      required: ["table", "query"],
    },
  },
  {
    name: "count_records",
    description: "Compte le nombre total d'enregistrements actifs d'une table.",
    parameters: {
      type: "OBJECT",
      properties: { table: { type: "STRING", enum: TABLE_KEYS } },
      required: ["table"],
    },
  },
  {
    name: "get_record_by_id",
    description: "Recupere un enregistrement precis par son identifiant (UUID).",
    parameters: {
      type: "OBJECT",
      properties: { table: { type: "STRING", enum: TABLE_KEYS }, id: { type: "STRING" } },
      required: ["table", "id"],
    },
  },
] as const;

export async function callAgentTool(name: string, args: Record<string, unknown>, licenceId: string): Promise<unknown> {
  try {
    switch (name) {
      case "list_records":
        return await listRecords(licenceId, args as { table: string; limit?: number });
      case "search_records":
        return await searchRecords(licenceId, args as { table: string; query: string; limit?: number });
      case "count_records":
        return await countRecords(licenceId, args as { table: string });
      case "get_record_by_id":
        return await getRecordById(licenceId, args as { table: string; id: string });
      default:
        return { error: `Outil inconnu: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur outil" };
  }
}
