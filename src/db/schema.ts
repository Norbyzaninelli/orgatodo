import { randomBytes } from "node:crypto";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const organizationKind = pgEnum("organization_kind", ["independiente", "centro"]);
export const taxCondition = pgEnum("tax_condition", ["monotributo"]);
export const serviceModality = pgEnum("service_modality", ["presencial", "virtual"]);
export const bookingStatus = pgEnum("booking_status", [
  "reservado",
  "confirmado",
  "realizado",
  "cancelado",
  "ausente",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Agrupa profesionales. Un independiente es una organización de una sola persona.
 * La organización nunca factura: cada profesional factura con su propio CUIT.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: organizationKind("kind").notNull().default("independiente"),
  ...timestamps,
});

export const professionals = pgTable(
  "professionals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Dirección pública: orgatodo.com/<slug> */
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    bio: text("bio"),
    address: text("address"),
    /** Datos fiscales; se completan al conectar la facturación. */
    cuit: text("cuit"),
    taxCondition: taxCondition("tax_condition").default("monotributo"),
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    /** Anticipación mínima para reservar. */
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(120),
    /** Margen libre después de cada turno. */
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    /** Hasta cuántos días hacia adelante se puede reservar. */
    maxDaysAhead: integer("max_days_ahead").notNull().default(60),
    /** Cada cuántos minutos se ofrecen horarios de inicio. */
    slotStepMinutes: integer("slot_step_minutes").notNull().default(30),
    autoConfirm: boolean("auto_confirm").notNull().default(true),
    worksOnHolidays: boolean("works_on_holidays").notNull().default(false),
    published: boolean("published").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("professionals_organization_idx").on(t.organizationId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    /** Precio en centavos de peso. */
    priceCents: integer("price_cents").notNull(),
    modality: serviceModality("modality").notNull().default("presencial"),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("services_professional_idx").on(t.professionalId)],
);

/** Horario semanal: un bloque por fila, minutos desde la medianoche en hora local. */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    /** 0 = domingo ... 6 = sábado */
    weekday: smallint("weekday").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
  },
  (t) => [index("availability_rules_professional_idx").on(t.professionalId)],
);

/** Bloqueos puntuales. Sin horario = el día entero. */
export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    startMinute: smallint("start_minute"),
    endMinute: smallint("end_minute"),
    reason: text("reason"),
  },
  (t) => [index("availability_exceptions_professional_date_idx").on(t.professionalId, t.date)],
);

/** Feriados nacionales, compartidos por toda la plataforma. */
export const holidays = pgTable("holidays", {
  date: date("date").primaryKey(),
  name: text("name").notNull(),
});

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** Para facturar: DNI o CUIT, opcional. */
    documentNumber: text("document_number"),
    ...timestamps,
  },
  (t) => [uniqueIndex("clients_professional_email_idx").on(t.professionalId, t.email)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("reservado"),
    /** Copia del servicio al momento de reservar, para que la factura no cambie si se edita el servicio. */
    serviceName: text("service_name").notNull(),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes"),
    /** Token secreto del link que recibe el cliente para ver o cancelar el turno. */
    manageToken: text("manage_token")
      .notNull()
      .unique()
      .$defaultFn(() => randomBytes(24).toString("hex")),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("bookings_professional_starts_idx").on(t.professionalId, t.startsAt)],
);

export type Professional = typeof professionals.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
