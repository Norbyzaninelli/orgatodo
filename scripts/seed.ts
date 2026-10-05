/**
 * Carga datos de prueba para desarrollo:
 * - Profesional: http://localhost:3000/demo (panel: demo@orgatodo.test / demo1234), administra el centro.
 * - Centro: http://localhost:3000/espacio-demo con dos profesionales más (demo2@ y demo3@orgatodo.test, misma clave).
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
  } else {
    await seedProfessional();
  }
  await seedCentro();
}

async function seedProfessional() {

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
      category: "kinesiologia",
      city: "Almagro",
      province: "Ciudad de Buenos Aires",
      minNoticeMinutes: 60,
      bufferMinutes: 10,
      slotStepMinutes: 30,
      published: true,
      isAdmin: true,
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

const TEAM = [
  {
    slug: "demo-martina",
    name: "Martina Ruiz",
    email: "demo2@orgatodo.test",
    bio: "Masoterapeuta. Masajes descontracturantes y drenaje linfático.",
    category: "masajes",
    services: [
      { name: "Masaje descontracturante", durationMinutes: 60, priceCents: 2800000 },
      { name: "Drenaje linfático", durationMinutes: 50, priceCents: 2600000 },
    ],
  },
  {
    slug: "demo-pablo",
    name: "Pablo Herrera",
    email: "demo3@orgatodo.test",
    bio: "Nutricionista. Planes de alimentación personalizados.",
    category: "nutricion",
    services: [
      { name: "Primera consulta de nutrición", durationMinutes: 60, priceCents: 3200000 },
      { name: "Control", durationMinutes: 30, priceCents: 2000000 },
    ],
  },
];

/** Convierte a la profesional demo en administradora de un centro con dos profesionales más. */
async function seedCentro() {
  if (await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, "espacio-demo") })) {
    console.log("Ya existe el centro demo.");
    return;
  }
  const laura = await db.query.professionals.findFirst({ where: eq(schema.professionals.slug, "demo") });
  if (!laura) throw new Error("Falta la profesional demo");
  await db
    .update(schema.organizations)
    .set({
      kind: "centro",
      slug: "espacio-demo",
      name: "Espacio Salud Demo",
      description: "Kinesiología, masajes y nutrición en un mismo lugar.",
      address: "Av. Corrientes 1234, CABA",
      phone: "+54 9 11 5555-5555",
      category: "kinesiologia",
      city: "Almagro",
      province: "Ciudad de Buenos Aires",
      published: true,
    })
    .where(eq(schema.organizations.id, laura.organizationId));

  const tz = "America/Argentina/Buenos_Aires";
  const today = toLocalDate(new Date(), tz);
  const pros = [laura];
  for (const member of TEAM) {
    const { user } = await getAuth().api.signUpEmail({
      body: { name: member.name, email: member.email, password: "demo1234" },
    });
    const [pro] = await db
      .insert(schema.professionals)
      .values({
        organizationId: laura.organizationId,
        userId: user.id,
        slug: member.slug,
        displayName: member.name,
        email: member.email,
        bio: member.bio,
        category: member.category,
        city: "Almagro",
        province: "Ciudad de Buenos Aires",
        address: "Av. Corrientes 1234, CABA",
        minNoticeMinutes: 60,
        published: true,
      })
      .returning();
    await db
      .insert(schema.services)
      .values(member.services.map((service, position) => ({ ...service, professionalId: pro.id, position })));
    await db.insert(schema.availabilityRules).values(
      [1, 2, 3, 4, 5].map((weekday) => ({ professionalId: pro.id, weekday, startMinute: 10 * 60, endMinute: 18 * 60 })),
    );
    pros.push(pro);
  }

  // Turnos de hoy y mañana para ver la agenda del equipo.
  const bookings: (typeof schema.bookings.$inferInsert)[] = [];
  for (const [i, pro] of pros.entries()) {
    const services = await db.select().from(schema.services).where(eq(schema.services.professionalId, pro.id));
    const clients = await db
      .insert(schema.clients)
      .values(
        ["Lucía Fernández", "Diego Castro", "Valentina López"].map((name, n) => ({
          professionalId: pro.id,
          name,
          email: `equipo${i}-${n}@orgatodo.test`,
        })),
      )
      .onConflictDoNothing()
      .returning();
    for (const [d, day] of [today, addDays(today, 1)].entries()) {
      for (const [n, client] of clients.entries()) {
        const service = services[(n + d) % services.length];
        const startsAt = localToInstant(day, (11 + n * 2 + i) * 60, tz);
        bookings.push({
          professionalId: pro.id,
          serviceId: service.id,
          clientId: client.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
          status: "confirmado",
          serviceName: service.name,
          priceCents: service.priceCents,
        });
      }
    }
  }
  await db.insert(schema.bookings).values(bookings);
  console.log("Centro demo creado: /espacio-demo (equipo: demo2@ y demo3@orgatodo.test / demo1234)");
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
