# Forever storage and leadership

Production uses the Railway service **Postgres-Forever**. The API reads its private connection via `FOREVER_DATABASE_URL`; it never falls back to `DATABASE_URL` (Era). `P0_DATABASE_URL` and `RANDOM_DATABASE_URL` are independent and unchanged.

`/api/forever`, `/api/forever/register` and `listGuilds&game=forever` use the dedicated pool, including guild lookup, player authentication and master-code validation. The Era `requireGuild` rejects Forever guilds. Leadership is available at `/forever-leitung.html?guild=lichtbringer-forever`.

Core tables store guilds, settings, access credentials and characters. `forever_*` stores groups, characters, raids, signups and the audit trail. `forever_point_entries` and `forever_priority_entries` are storage foundations only: there are no active point or priority-write endpoints yet. Their foreign keys scope references to the same guild.

## One-time migration

Provision an empty, independent PostgreSQL database. Run `node scripts/migrate-forever-database.mjs` with `SOURCE_DATABASE_URL` and `FOREVER_DATABASE_URL` supplied securely. The script creates the target schema, locks the source briefly, selects only guilds explicitly marked `game=forever`, copies their rows, compares all copied records, and resets the audit sequence. It refuses a populated destination or unexpected legacy raid/point/priority data. Credentials are never printed.

The old Forever rows remain a **read-only rollback copy** in Era. Scoped triggers reject writes to migrated guilds; Era guilds remain writable. After the migration succeeds, configure the API's `FOREVER_DATABASE_URL` and deploy. Do not remove the source triggers or blindly switch back: new Forever writes exist only in the new database. Rollback after cutover requires reconciling those writes first. Do not rerun the one-time migration against the populated target.

The API database variable is a Railway reference to `${{Postgres-Forever.DATABASE_URL}}`. No database credentials are committed.

## Checks

Run `tests/forever-raids.test.mjs`, `tests/forever-registration.test.mjs` and `tests/forever-admin.test.mjs` with `FOREVER_PGLITE` pointing to the PGlite module if it is not installed locally. These cover guild isolation, auth, approvals, blocking, admin-only operations, transaction rollback, revisions and foreign-key isolation.
