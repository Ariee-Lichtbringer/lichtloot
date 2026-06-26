# LichtLoot API

Railway backend for the multi-guild version of LichtLoot.

## What this service owns

- Guilds and guild settings
- Players and SpielerLogin pins
- Characters
- Raids
- Raid signups
- Prios
- P0/P0+ points

The current HTML pages can stay as they are while we move one feature at a time from Google Apps Script to this API.

## Railway Setup

1. Create a new Railway project.
2. Add a PostgreSQL database.
3. Add this folder as a Railway service.
4. Set the service root to `lichtloot-api` if the whole repository is connected.
5. Railway should provide `DATABASE_URL` automatically through the PostgreSQL plugin.
6. Set these variables:

```sh
NODE_ENV=production
CORS_ORIGIN=*
DEFAULT_GUILD_SLUG=lichtloot
```

7. Run the initial migration:

```sh
psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
```

8. Start command:

```sh
npm start
```

## Local Development

```sh
cp .env.example .env
npm install
npm start
```

Health checks:

```sh
curl http://localhost:3000/health
curl http://localhost:3000/db-health
```

## First API Routes

- `GET /health`
- `GET /db-health`
- `GET /api/guilds/lichtloot`
- `GET /api/guilds/lichtloot/characters`
- `GET /api/guilds/lichtloot/players/by-pin/:pin/characters`
- `POST /api/guilds/lichtloot/players`

Example player payload:

```json
{
  "playerPin": "1234",
  "securityQuestion": "Lieblingsboss?",
  "securityAnswer": "Ragnaros",
  "character": {
    "name": "Charname",
    "server": "Everlook",
    "className": "Mage"
  }
}
```

## Migration Order

1. Move SpielerLogin and character loading first.
2. Move raid creation and active raid list.
3. Move prio saving and prio history.
4. Move P0/P0+ points.
5. Add guild admin screens and invite links.

This order keeps the public pages usable while the database becomes the new source of truth.

Deploy marker: item admin endpoint refresh 2026-06-27.
