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

## Stack

Next.js 16 (App Router) con TypeScript, Tailwind CSS, PostgreSQL con Drizzle ORM, Vitest.

## Correr en local

Requisitos: Node 22, pnpm y PostgreSQL 16.

```bash
pnpm install
cp .env.example .env        # ajustá DATABASE_URL
pnpm db:migrate             # crea las tablas
pnpm db:seed                # carga una profesional de prueba
pnpm dev                    # http://localhost:3000/demo
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm test` | Tests unitarios |
| `pnpm lint` / `pnpm typecheck` | Chequeos de código |
| `pnpm db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes |

## Estructura

```
src/app/            páginas y acciones del servidor
src/components/     componentes de interfaz
src/db/             esquema y conexión a la base
src/lib/agenda/     horarios disponibles, reservas y consultas
drizzle/            migraciones SQL
scripts/seed.ts     datos de prueba
```
