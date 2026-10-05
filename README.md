# ORGATODO

Plataforma para profesionales que trabajan en Argentina: publican sus servicios, sus clientes
reservan turnos online, reciben recordatorios y el profesional factura cada turno con ARCA.

El plan del producto y las decisiones fiscales están en el
[documento del plan](https://claude.ai/code/artifact/9a34d7c3-7dfa-42e5-b4eb-46fded621586).

## Qué hay hoy

- Página pública de cada profesional (`/<slug>`) con sus servicios.
- Reserva de turnos: el cliente elige día y horario libre y deja sus datos, sin crear cuenta.
- Link privado del turno (`/turno/<token>`) para verlo o cancelarlo.
- Cálculo de horarios con bloques semanales, bloqueos, feriados, margen entre turnos y
  anticipación mínima (`src/lib/agenda/slots.ts`, con tests).
- La base de datos impide que dos turnos activos del mismo profesional se superpongan.
- Registro e ingreso del profesional con email y contraseña (`/registro`, `/ingresar`).
- Panel del profesional (`/panel`): próximos turnos (confirmar, cancelar, marcar realizado o
  ausente), servicios, horario semanal, días u horas bloqueadas, perfil, reglas de reserva y
  publicación de la página.
- Avisos por email y WhatsApp: confirmación y recordatorio al cliente, aviso de turno nuevo y de
  cancelaciones al profesional. Ver "Avisos" más abajo.
- Resumen de ingresos y gastos (`/panel/resumen`): ingresos por turnos realizados, cobrado y por
  cobrar con medio de pago, gastos cargados a mano por categoría, resultado del mes, gráfico de
  los últimos 6 meses y lo facturado en los últimos 12 meses contra el límite de la categoría.
- Facturación con ARCA (`/panel/facturacion`): conexión con el certificado propio del profesional,
  categoría de monotributo leída de la constancia, factura C y nota de crédito C desde cada turno
  realizado, comprobante con QR en `/factura/[token]` y envío por email. Ver "Facturación" más abajo.

## Stack

Next.js 16 (App Router) con TypeScript, Tailwind CSS, PostgreSQL con Drizzle ORM, Better Auth, Vitest.

## Correr en local

Requisitos: Node 22, pnpm y PostgreSQL 16.

```bash
pnpm install
cp .env.example .env        # ajustá DATABASE_URL y generá BETTER_AUTH_SECRET con: openssl rand -hex 32
pnpm db:migrate             # crea las tablas
pnpm db:seed                # carga una profesional de prueba
pnpm dev                    # http://localhost:3000/demo
```

La profesional de prueba entra al panel con `demo@orgatodo.test` / `demo1234`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm test` | Tests unitarios |
| `pnpm lint` / `pnpm typecheck` | Chequeos de código |
| `pnpm db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes |

## Avisos

Cada aviso se guarda primero en la tabla `notifications` y después se manda, así un error del
proveedor no pierde el mensaje (se reintenta hasta 5 veces) y los recordatorios salen a la hora
programada.

- **Email**: con [Resend](https://resend.com). Configurar `RESEND_API_KEY` y `EMAIL_FROM` con un
  dominio verificado.
- **WhatsApp**: con la API de WhatsApp Cloud de Meta. Configurar `WHATSAPP_TOKEN` y
  `WHATSAPP_PHONE_NUMBER_ID`, y crear las plantillas de
  [`docs/plantillas-whatsapp.md`](docs/plantillas-whatsapp.md).
- **Recordatorios**: un cron tiene que llamar cada 5 minutos a `GET /api/cron/avisos` con el header
  `Authorization: Bearer <CRON_SECRET>`.

Sin esas claves, los avisos se escriben en el log del servidor con el prefijo `[avisos:prueba]`.

## Facturación

Cada profesional factura con su propio CUIT y certificado digital:

1. Carga CUIT y un punto de venta "RECE para aplicativo y web services". La plataforma genera la
   clave privada (queda cifrada con `ARCA_CLAVE_CIFRADO`) y el pedido de certificado (CSR).
2. En ARCA crea el certificado con ese pedido y lo asocia a los servicios `wsfe` y
   `ws_sr_constancia_inscripcion` en el Administrador de Relaciones.
3. Sube el certificado. Se prueba la conexión y se lee la categoría de monotributo.

Los comprobantes se numeran de a uno por punto de venta con un lock de Postgres. El número se
guarda antes de pedir el CAE; si la respuesta se pierde, "Reintentar" consulta a ARCA si ese número
quedó autorizado antes de pedir otro.

`ARCA_MODO=simulado` (por defecto) imita a ARCA sin salir a internet y ofrece un certificado de
prueba. `homologacion` usa el ambiente de prueba de ARCA, que necesita un certificado de
homologación (servicio "WSASS" con clave fiscal). Los límites por categoría están en
`src/lib/arca/categorias.ts` y se actualizan cuando ARCA publica la tabla nueva.

## Estructura

```
src/app/            páginas y acciones del servidor
src/components/     componentes de interfaz
src/db/             esquema y conexión a la base
src/app/panel/      panel del profesional y sus acciones
src/lib/arca/       WSAA, WSFEv1, constancia de inscripción, certificados y emisión
src/app/(cuenta)/   registro, ingreso y salida
src/lib/agenda/     horarios disponibles, reservas y consultas
src/lib/auth.ts     configuración de Better Auth y sesión del profesional
src/lib/notifications/  cola, mensajes y envío de avisos
drizzle/            migraciones SQL
scripts/seed.ts     datos de prueba
```
