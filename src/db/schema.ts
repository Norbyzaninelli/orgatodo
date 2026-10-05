import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

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

export const paymentMethod = pgEnum("payment_method", [
  "efectivo",
  "transferencia",
  "mercado_pago",
  "tarjeta",
  "otro",
]);
export const expenseCategory = pgEnum("expense_category", ["alquiler", "insumos", "monotributo", "otros"]);

export const arcaEnvironment = pgEnum("arca_environment", ["simulado", "homologacion", "produccion"]);
export const invoiceType = pgEnum("invoice_type", ["factura_c", "nota_credito_c"]);
export const invoiceStatus = pgEnum("invoice_status", ["emitiendo", "emitida", "rechazada", "anulada"]);

export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp"]);
export const notificationRecipient = pgEnum("notification_recipient", ["cliente", "profesional"]);
export const notificationKind = pgEnum("notification_kind", [
  "reserva_recibida",
  "turno_confirmado",
  "nuevo_turno",
  "recordatorio",
  "cancelado_por_cliente",
  "cancelado_por_profesional",
]);
export const notificationStatus = pgEnum("notification_status", ["pendiente", "enviado", "fallido", "omitido"]);

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
  /** Datos de la página pública del centro; un independiente usa los de su perfil. */
  description: text("description"),
  address: text("address"),
  phone: text("phone"),
  published: boolean("published").notNull().default(false),
  ...timestamps,
});

/** Invitación para sumarse a un centro. Se acepta con el link que lleva el token. */
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    token: text("token")
      .notNull()
      .unique()
      .$defaultFn(() => randomBytes(24).toString("hex")),
    invitedBy: uuid("invited_by").references(() => professionals.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Una sola invitación pendiente por email en cada centro.
    uniqueIndex("organization_invites_pending_idx")
      .on(t.organizationId, t.email)
      .where(sql`${t.acceptedAt} is null`),
  ],
);

export const professionals = pgTable(
  "professionals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Usuario que administra este perfil. */
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    /** Administra el centro: datos, equipo e invitaciones. Un independiente administra el suyo. */
    isAdmin: boolean("is_admin").notNull().default(false),
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
    /** Avisos al profesional cuando entra o se cancela un turno. */
    notifyByWhatsapp: boolean("notify_by_whatsapp").notNull().default(true),
    notifyByEmail: boolean("notify_by_email").notNull().default(true),
    /** Horas antes del turno en que se manda el recordatorio al cliente; 0 = sin recordatorio. */
    reminderHoursBefore: integer("reminder_hours_before").notNull().default(24),
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
    /** Cobro registrado a mano por el profesional; la plataforma no cobra por él. */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: paymentMethod("payment_method"),
    ...timestamps,
  },
  (t) => [index("bookings_professional_starts_idx").on(t.professionalId, t.startsAt)],
);

/** Gastos que el profesional carga a mano para ver su resultado del mes. */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    category: expenseCategory("category").notNull(),
    description: text("description"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [index("expenses_professional_date_idx").on(t.professionalId, t.date)],
);

/**
 * Cola de avisos. Cada aviso se guarda antes de mandarse, así un error del proveedor no pierde
 * el mensaje y los recordatorios se mandan a la hora programada.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    kind: notificationKind("kind").notNull(),
    channel: notificationChannel("channel").notNull(),
    recipient: notificationRecipient("recipient").notNull(),
    /** Email o teléfono en formato internacional. */
    address: text("address").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    status: notificationStatus("status").notNull().default("pendiente"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("notifications_once_idx").on(t.bookingId, t.kind, t.channel, t.recipient),
    index("notifications_due_idx").on(t.status, t.scheduledAt),
  ],
);

/**
 * Conexión de un profesional con ARCA usando su propio certificado digital.
 * La clave privada se genera acá y se guarda cifrada; nunca sale de la plataforma.
 */
export const arcaConnections = pgTable("arca_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  professionalId: uuid("professional_id")
    .notNull()
    .unique()
    .references(() => professionals.id, { onDelete: "cascade" }),
  environment: arcaEnvironment("environment").notNull(),
  cuit: text("cuit").notNull(),
  /** Punto de venta para web services, distinto del de Comprobantes en línea. */
  pointOfSale: integer("point_of_sale").notNull(),
  privateKeyEncrypted: text("private_key_encrypted").notNull(),
  csrPem: text("csr_pem").notNull(),
  certificatePem: text("certificate_pem"),
  certificateExpiresAt: timestamp("certificate_expires_at", { withTimezone: true }),
  /** Última vez que la conexión respondió bien. */
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastError: text("last_error"),
  /** Datos de la constancia de inscripción. */
  legalName: text("legal_name"),
  fiscalAddress: text("fiscal_address"),
  /** Letra de la categoría de monotributo (A a K). */
  monotributoCategory: text("monotributo_category"),
  monotributoCategoryDescription: text("monotributo_category_description"),
  categoryCheckedAt: timestamp("category_checked_at", { withTimezone: true }),
  /** Leyendas del comprobante que no informa ARCA. */
  grossIncomeNumber: text("gross_income_number"),
  activityStartDate: date("activity_start_date"),
  ...timestamps,
});

/** Permisos de acceso de WSAA, válidos unas horas. ARCA rechaza pedir otro mientras uno sigue vigente. */
export const arcaTickets = pgTable(
  "arca_tickets",
  {
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => arcaConnections.id, { onDelete: "cascade" }),
    service: text("service").notNull(),
    token: text("token").notNull(),
    sign: text("sign").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.connectionId, t.service] })],
);

/** Comprobantes emitidos. Se conservan aunque se borre el profesional: hay que guardarlos 10 años. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    /** Factura a la que anula una nota de crédito. */
    creditsInvoiceId: uuid("credits_invoice_id"),
    environment: arcaEnvironment("environment").notNull(),
    type: invoiceType("type").notNull(),
    status: invoiceStatus("status").notNull().default("emitiendo"),
    cuit: text("cuit").notNull(),
    pointOfSale: integer("point_of_sale").notNull(),
    /** Se asigna al pedir el CAE, con el último autorizado + 1. */
    number: integer("number"),
    issueDate: date("issue_date").notNull(),
    serviceFrom: date("service_from").notNull(),
    serviceTo: date("service_to").notNull(),
    paymentDueDate: date("payment_due_date").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    /** Receptor: 80 CUIT, 96 DNI, 99 consumidor final sin identificar. */
    recipientDocType: smallint("recipient_doc_type").notNull(),
    recipientDocNumber: text("recipient_doc_number").notNull(),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email"),
    /** Condición frente al IVA del receptor según la tabla de ARCA (5 = consumidor final). */
    recipientVatCondition: smallint("recipient_vat_condition").notNull(),
    cae: text("cae"),
    caeExpiresAt: date("cae_expires_at"),
    /** Observaciones o errores de ARCA, en texto. */
    arcaMessages: text("arca_messages"),
    /** Último pedido y respuesta, para auditoría. */
    arcaLog: jsonb("arca_log"),
    publicToken: text("public_token")
      .notNull()
      .unique()
      .$defaultFn(() => randomBytes(24).toString("hex")),
    ...timestamps,
  },
  (t) => [
    index("invoices_professional_date_idx").on(t.professionalId, t.issueDate),
    uniqueIndex("invoices_number_idx")
      .on(t.environment, t.cuit, t.pointOfSale, t.type, t.number)
      .where(sql`${t.number} is not null and ${t.status} <> 'rechazada'`),
    // Un turno tiene a lo sumo una factura viva; con una nota de crédito queda anulada y se puede volver a facturar.
    uniqueIndex("invoices_booking_live_idx")
      .on(t.bookingId)
      .where(sql`${t.type} = 'factura_c' and ${t.status} in ('emitiendo', 'emitida')`),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type Professional = typeof professionals.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ArcaConnection = typeof arcaConnections.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
