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

## Discord raid signup

`/api/forever/bot` requires the existing bot queue secret in `X-Forever-Bot-Token`; this endpoint never uses Era guild/player tables. The PO bot's `forever_signup.py` adds `/forever_verbinden` (Discord “Manage Server” permission plus the Forever leadership code). Linking stores a dedicated guild/channel mapping. Raid leaders explicitly publish each raid from its website card. Later participant/raid changes update that same Discord message.

`forever_discord_links` pairs a Discord user with an approved Forever player per guild. The login code is only used for verification and is not duplicated in this table. All interaction writes validate the exact guild, raid, Discord server, channel and message. Ownership, capacity, closed raids and blocked-player checks use the existing Forever signup service. Posts use publication leases, stored message IDs and footer recovery after an uncertain send result. A deleted post is only recreated after a raid leader explicitly republishes it. No role mentions or mass pings are sent.

Discord UI uses private character/role/status selection and an optional note. Website changes are polled every 30 seconds. Point and priority features remain inactive. Run `tests/forever-discord.test.mjs` for auth/binding/ownership/capacity coverage and the bot repository's `tests/test_forever_signup.py` for embed limits, persistent views and duplicate-send recovery.
