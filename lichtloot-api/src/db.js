import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 15000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 12000),
  application_name: "lichtloot-api"
});

// Reine P0-Anmelder werden absichtlich in einer eigenen Railway-Postgres-
// Instanz gespeichert. Es gibt keinen Fallback auf DATABASE_URL: Fehlt die
// Verbindung, darf ein P0-only-Anmelder nicht versehentlich im Raidbestand
// landen.
export const p0Pool = process.env.P0_DATABASE_URL
  ? new Pool({
      connectionString: process.env.P0_DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.P0_PG_POOL_MAX || 5),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 15000),
      statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 12000),
      application_name: "lichtloot-api-p0-only"
    })
  : null;

// Random-Raids sind vollständig von Lootgilden und reinen P0-Anmeldern
// getrennt. Es gibt absichtlich keinen Fallback auf DATABASE_URL.
export const randomPool = process.env.RANDOM_DATABASE_URL
  ? new Pool({
      connectionString: process.env.RANDOM_DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      max: Number(process.env.RANDOM_PG_POOL_MAX || 5),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
      query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 15000),
      statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 12000),
      application_name: "lichtloot-api-random-raids"
    })
  : null;

pool.on("error", error => {
  console.error("Unerwarteter PostgreSQL-Poolfehler:", error.message || error);
});

p0Pool?.on("error", error => {
  console.error("Unerwarteter P0-PostgreSQL-Poolfehler:", error.message || error);
});

randomPool?.on("error", error => {
  console.error("Unerwarteter Random-Raid-PostgreSQL-Poolfehler:", error.message || error);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function p0Query(text, params = []) {
  if (!p0Pool) {
    const error = new Error("P0_DATABASE_URL ist nicht konfiguriert. Reine P0-Anmelder bleiben zum Schutz der Raid-Daten deaktiviert.");
    error.statusCode = 503;
    throw error;
  }
  return p0Pool.query(text, params);
}

export async function randomQuery(text, params = []) {
  if (!randomPool) {
    const error = new Error("RANDOM_DATABASE_URL ist nicht konfiguriert. Random-Raids bleiben zum Schutz der Lootgilden-Daten deaktiviert.");
    error.statusCode = 503;
    throw error;
  }
  return randomPool.query(text, params);
}

export async function getGuildBySlug(slug) {
  const result = await query(
    "select id, name, slug, created_at from guilds where slug = $1",
    [slug]
  );
  return result.rows[0] || null;
}

export async function requireGuild(slug) {
  const guild = await getGuildBySlug(slug);
  if (!guild) {
    const error = new Error("Guild not found");
    error.statusCode = 404;
    throw error;
  }
  return guild;
}
