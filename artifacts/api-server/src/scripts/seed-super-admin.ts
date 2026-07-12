import "../env.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@magestion/db";

// Script ponctuel (pas monte dans l'app) : cree le compte "platform owner"
// (SUPER_ADMIN sans licence, licenceId=null — voir schema/users.ts et
// lib/tenantScope.ts::isPlatformOwner). Ce compte n'est JAMAIS creable via
// /auth/register (qui cree toujours une licence) — bootstrap manuel
// uniquement, idempotent (safe a relancer).
async function main() {
  const email = process.env.PLATFORM_OWNER_EMAIL ?? "owner@magestion.local";
  const password = process.env.PLATFORM_OWNER_PASSWORD ?? "Owner1234!";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    console.log(`[seed-super-admin] utilisateur ${email} existe deja`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ licenceId: null, email, passwordHash, nom: "Proprietaire Plateforme", role: "SUPER_ADMIN" })
    .returning();

  console.log(`[seed-super-admin] platform owner cree: ${user.email} / mot de passe: ${password}`);
}

main().then(() => process.exit(0));
