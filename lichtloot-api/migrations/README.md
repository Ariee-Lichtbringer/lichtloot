# LichtLoot API Migrations

Run migrations against the Railway PostgreSQL database before starting the API.

Railway usually provides `DATABASE_URL` automatically when a PostgreSQL service is attached.

```sh
psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
```

For the LichtLoot RaidHelper MVP, run the latest signup migration as well:

```sh
psql "$DATABASE_URL" -f migrations/012_raidhelper_signups.sql
```
