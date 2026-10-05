import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { orgatodoDb?: Database };

function connect(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  return drizzle(postgres(url, { max: 10 }), { schema });
}

function getDb(): Database {
  // Se conecta recién en la primera consulta, así el build no necesita base de datos.
  // En desarrollo Next recarga módulos; guardar la conexión en globalThis evita abrir una nueva en cada cambio.
  globalForDb.orgatodoDb ??= connect();
  return globalForDb.orgatodoDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getDb();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
