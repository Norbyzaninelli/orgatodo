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

## Estructura

```
src/app/            páginas y acciones del servidor
src/components/     componentes de interfaz
src/db/             esquema y conexión a la base
src/app/panel/      panel del profesional y sus acciones
src/app/(cuenta)/   registro, ingreso y salida
src/lib/agenda/     horarios disponibles, reservas y consultas
src/lib/auth.ts     configuración de Better Auth y sesión del profesional
src/lib/notifications/  cola, mensajes y envío de avisos
drizzle/            migraciones SQL
scripts/seed.ts     datos de prueba
```
