import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

export async function query(text, params = []) {
  return pool.query(text, params);
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
