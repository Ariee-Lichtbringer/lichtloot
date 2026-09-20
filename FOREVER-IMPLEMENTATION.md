# Forever implementation status — 2026-09-20

## Implemented and covered by isolated database tests
- Explicit running/completed/archived raid phases; no time-only archival.
- Per-raid actual attendance separate from signup; completed roster identity snapshots.
- Raid officer read access to leadership planning, admin-only member/settings/financial mutations.
- Idempotent creation and atomic weekly series up to 12 dates; copy existing raid in UI.
- Melee/ranged roles, optional enforced role capacity, explicit bench management.
- Five-player party assignment and neutral CSV roster export (formula cells escaped).
- Paged raid API and player overview.
- Manual points journal, idempotent adjustments, unique reversal records; JSON export.
- Guild-curated loot catalog, P1–P3/P0 persistence, owner/signup checks, unique items/slots, start-time lock, pre-start visibility restrictions, manual P0 approvals.
- Loot awards require recorded presence; idempotent awards and recorded void reasons.
- Bank stock journal, nonnegative stock, member requests and single-decision atomic withdrawals.
- Private member/leadership mailbox.
- Security-answer recovery, admin reset and reopening rejected registrations.

## Still pending / requires subsequent work
- Automated attendance point rules (awaiting user choice; manual journal is active).
- Raid-specific leadership and lootmaster permissions (currently guild-level permissions).
- Dedicated saved template library; copies and weekly series are available.
- Automatic bench promotion and notifications/reminders; existing posts continue syncing.
- Per-group Discord channels and configurable recipients/images.
- Full log/Addon integration (source/format not supplied); current CSV is neutral, not a claimed Addon contract.
- Bank Addon import, reconciliation and item identity beyond name.
- Restore/import preview for point backups, full audit pagination.
- Full guild onboarding and shared Forever multi-guild player identity design.
- Player performance/log analyses and traffic reports need event/data sources.

No Era database records are imported or modified by these services. Worldbuffs and Hordenbuffs remain excluded.
