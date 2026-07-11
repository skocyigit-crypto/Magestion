import "../env.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, licencesTable } from "@magestion/db";

// Script ponctuel (pas monte dans l'app) : cree une licence + un utilisateur
// SUPER_ADMIN de test si absent. Idempotent (safe a relancer).
async function main() {
  const email = "admin@magestion.local";

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    console.log(`[seed] utilisateur ${email} existe deja (licence=${existing.licenceId})`);
    return;
  }

  const [licence] = await db
    .insert(licencesTable)
    .values({ nom: "Entreprise Demo", plan: "PME" })
    .returning();

  const passwordHash = await bcrypt.hash("Admin1234!", 10);

  const [user] = await db
    .insert(usersTable)
    .values({
      licenceId: licence.id,
      email,
      passwordHash,
      nom: "Admin Demo",
      role: "SUPER_ADMIN",
    })
    .returning();

  console.log(`[seed] licence creee: ${licence.id} (${licence.nom})`);
  console.log(`[seed] utilisateur cree: ${user.email} / mot de passe: Admin1234!`);
}

main().then(() => process.exit(0));
