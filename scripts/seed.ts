/**
 * Carga una profesional de prueba para desarrollo: http://localhost:3000/demo
 * Ingreso al panel: demo@orgatodo.test / demo1234
 * Uso: pnpm db:seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { addDays, localToInstant, toLocalDate } from "../src/lib/agenda/slots";
import { getAuth } from "../src/lib/auth";

async function main() {
  const existing = await db.query.professionals.findFirst({ where: eq(schema.professionals.slug, "demo") });
  if (existing) {
    console.log("Ya existe la profesional demo.");
    return;
  }

  const { user } = await getAuth().api.signUpEmail({
    body: { name: "Laura Gómez", email: "demo@orgatodo.test", password: "demo1234" },
  });

  const [org] = await db
    .insert(schema.organizations)
    .values({ slug: "demo", name: "Laura Gómez", kind: "independiente" })
    .returning();

  const [pro] = await db
    .insert(schema.professionals)
    .values({
      organizationId: org.id,
      userId: user.id,
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

  const services = await db.insert(schema.services).values([
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
  ]).returning();

  // Lunes a viernes de 9 a 13 y de 15 a 19; sábados de 9 a 12.
  const rules = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { professionalId: pro.id, weekday, startMinute: 9 * 60, endMinute: 13 * 60 },
    { professionalId: pro.id, weekday, startMinute: 15 * 60, endMinute: 19 * 60 },
  ]);
  rules.push({ professionalId: pro.id, weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 });
  await db.insert(schema.availabilityRules).values(rules);

  await seedHistory(pro.id, services);

  console.log("Profesional demo creada: /demo (panel: demo@orgatodo.test / demo1234)");
}

/** Turnos realizados y gastos de los últimos meses, para que el resumen tenga datos. */
async function seedHistory(professionalId: string, services: (typeof schema.services.$inferSelect)[]) {
  const clients = await db
    .insert(schema.clients)
    .values(
      ["Ana Pérez", "Martín Díaz", "Sofía Romero", "Julián Sosa", "Carla Medina"].map((name, i) => ({
        professionalId,
        name,
        email: `cliente${i + 1}@orgatodo.test`,
        phone: `+54 9 11 4000-000${i + 1}`,
      })),
    )
    .returning();

  const tz = "America/Argentina/Buenos_Aires";
  const today = toLocalDate(new Date(), tz);
  const methods = ["efectivo", "transferencia", "mercado_pago"] as const;
  const bookings: (typeof schema.bookings.$inferInsert)[] = [];
  // Un turno a las 10 cada día hábil de los últimos 120 días, salteando algunos.
  for (let back = 120, n = 0; back >= 1; back--) {
    const day = addDays(today, -back);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6 || back % 3 === 0) continue;
    const service = services[n % services.length];
    const startsAt = localToInstant(day, 10 * 60, tz);
    // Los turnos de los últimos días quedan sin cobrar.
    const paid = back > 6;
    bookings.push({
      professionalId,
      serviceId: service.id,
      clientId: clients[n % clients.length].id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
      status: n % 11 === 5 ? "ausente" : "realizado",
      serviceName: service.name,
      priceCents: service.priceCents,
      paidAt: paid && n % 11 !== 5 ? startsAt : null,
      paymentMethod: paid && n % 11 !== 5 ? methods[n % methods.length] : null,
    });
    n++;
  }
  await db.insert(schema.bookings).values(bookings);

  const expenses: (typeof schema.expenses.$inferInsert)[] = [];
  for (let m = 0; m < 4; m++) {
    const first = addDays(today, -30 * m);
    const month = first.slice(0, 7);
    expenses.push(
      { professionalId, date: `${month}-01`, category: "alquiler", description: "Consultorio", amountCents: 18000000 },
      { professionalId, date: `${month}-05`, category: "insumos", description: "Cremas y descartables", amountCents: 4200000 + m * 350000 },
      { professionalId, date: `${month}-20`, category: "monotributo", description: "Cuota mensual", amountCents: 3800000 },
    );
  }
  await db.insert(schema.expenses).values(expenses.filter((e) => e.date <= today));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
