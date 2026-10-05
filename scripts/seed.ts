/**
 * Carga una profesional de prueba para desarrollo: http://localhost:3000/demo
 * Uso: pnpm db:seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";

async function main() {
  const existing = await db.query.professionals.findFirst({ where: eq(schema.professionals.slug, "demo") });
  if (existing) {
    console.log("Ya existe la profesional demo.");
    return;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({ slug: "demo", name: "Laura Gómez", kind: "independiente" })
    .returning();

  const [pro] = await db
    .insert(schema.professionals)
    .values({
      organizationId: org.id,
      slug: "demo",
      displayName: "Laura Gómez",
      email: "demo@orgatodo.test",
      phone: "+54 9 11 5555-5555",
      bio: "Kinesióloga. Atención particular en consultorio y sesiones virtuales.",
      address: "Av. Corrientes 1234, CABA",
      minNoticeMinutes: 60,
      bufferMinutes: 10,
      slotStepMinutes: 30,
      published: true,
    })
    .returning();

  await db.insert(schema.services).values([
    { professionalId: pro.id, name: "Sesión de kinesiología", durationMinutes: 45, priceCents: 2500000, position: 1 },
    { professionalId: pro.id, name: "Evaluación inicial", durationMinutes: 60, priceCents: 3000000, position: 0 },
    {
      professionalId: pro.id,
      name: "Consulta virtual",
      durationMinutes: 30,
      priceCents: 1800000,
      modality: "virtual",
      position: 2,
    },
  ]);

  // Lunes a viernes de 9 a 13 y de 15 a 19; sábados de 9 a 12.
  const rules = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { professionalId: pro.id, weekday, startMinute: 9 * 60, endMinute: 13 * 60 },
    { professionalId: pro.id, weekday, startMinute: 15 * 60, endMinute: 19 * 60 },
  ]);
  rules.push({ professionalId: pro.id, weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 });
  await db.insert(schema.availabilityRules).values(rules);

  console.log("Profesional demo creada: /demo");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
