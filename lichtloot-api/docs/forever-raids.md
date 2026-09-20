# Forever guild planning — first usable version

Entry: `/forever-raids.html`, linked from `forever.html`. Frontend assets live at the repository root and are mirrored under `lichtloot-api/public`. The API endpoint is `POST /api/forever`.

## Available

- Separate Forever guilds (`guild_settings.layout_json.game = forever`) and their own approved player logins; guild-specific master access. Era accounts are not imported.
- Guild leaders / officers / raid officers can manage events and groups using their player login. A master-code session has management access but cannot impersonate a player to sign up.
- Dedicated Forever characters with class, preferred role and Normal/PvP/RP ruleset; no automatic Era character import.
- Named groups; create and edit raids, dungeon nights and other events; open, close, cancel or complete events.
- One signup per player account per event, with a selected character, role, note and signed/bench/late/tentative/absent status.
- Full events place new signups on the bench. Capacity checks and writes hold a row lock on the event. Leaders can explicitly move an existing signup after a place opens; no automatic promotion or notification.
- Role targets indicate missing roles; they are planning targets, not class restrictions or separate admission caps.
- Archive, leadership change history, shareable login-protected event links and ICS export. Event input and display use Europe/Berlin; calendar exports use UTC.
- Links to existing Forever item, talent, profession and material tools.

## Deliberately not activated

Discord posts / DMs, automatic recurring events, fixed group membership, addon integration, point balances and loot assignments. Existing item data does not assert verified raid drop tables. Character management currently supports creating and editing (not deletion).

## Data and authorization

`forever-raids.js` owns five tables: `forever_groups`, `forever_characters`, `forever_raids`, `forever_signups`, `forever_audit`. They are created lazily after successful authentication, on the existing PostgreSQL pool. All operations carry an explicit guild ID. These tables do not feed legacy Era raid queries, Discord queues or point calculations.

The server adapter resolves an explicit guild slug, verifies its master code or an approved, unblocked player account in that guild, and derives leadership from the existing player role. No credential is returned in API responses or included in shared links or audit rows. Frontend credentials are kept only for the browser-tab session; logout removes them. All API calls use JSON POST and no-store responses. Overview returns up to 100 events per upcoming/archive view. Audit returns the latest 50 changes for one event.

Raid edits use an expected revision to reject stale edits. Character uniqueness is case-insensitive per guild and ruleset. Existing production tables and data are not migrated or rewritten.

## Checks

```
node --check src/server.js
node --check src/forever-raids.js
# Install @electric-sql/pglite in a separate test runtime, then:
FOREVER_PGLITE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node tests/forever-raids.test.mjs
```

The integration test executes real PostgreSQL queries through PGlite and checks guild boundaries, account ownership, capacity, leadership permissions, revisions, event states and audit isolation. Browser checks and screenshots are stored in `outputs/forever-guild-planning-20260920` at the workspace root. The preview runs against an in-memory test database only.

## Release

Publish the frontend assets and updated Forever hub to the website and deploy the API module plus server registration together. An old API returns a visible error; the frontend never substitutes sample events or reports an unsaved action as successful. The current workspace includes unrelated pre-existing changes in server.js and other site files; review and isolate this feature before a production release.

## Separate game areas and registration

`forever-start.html` is the entry for Forever; `forever-register.html` creates a pending account through `POST /api/forever/register`. First and last names are validated separately and stored as the full display name. Account, initial character and Forever character are created in one transaction. Recovery answers use the existing hash function. Guild leadership approves pending accounts in the existing management page. The default `listGuilds` response contains Era guilds; `game=forever` selects only Forever guilds. The Forever API rejects Era guilds. `layout.sourceGuild` maps only the game switcher destination, never credentials or players.

Lichtbringer's test guild uses `lichtbringer-forever`, linked to Era `lichtloot` for navigation only. Initially one player, Ariee Mondlichtung, and a distinct guild master credential were created. Secrets are stored outside the repository.

Official logo sources: https://worldofwarcraft.blizzard.com/en-gb/classic and https://worldofwarcraft.blizzard.com/en-us/forever .
