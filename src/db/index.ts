import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* prepare:false — задължително за Supabase transaction pooler (:6543).
   В dev клиентът се кешира на globalThis: иначе всяко hot-reload на модула
   създава нов postgres() клиент (до 10 връзки), старите висят и pooler-ът
   удря MaxClients → произволни „Failed query" в редактора/preview-то. */
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ?? postgres(process.env.DATABASE_URL!, { prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export * from "./schema";
