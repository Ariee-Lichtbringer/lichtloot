# GuildLoot Forever

Discover new loot together in WoW Forever. GuildLoot Forever records items you see in loot windows, including items that are not yet in the GuildLoot catalog.

## Features
- Captures item IDs, links, available item metadata and loot sources.
- Retrieves item metadata when the client cache becomes available.
- No planned raid or raid ID required.
- SavedVariables logging and manual export with `/gfl export`.
- Optional Python 3 companion uploads saved discoveries to https://lichtloot.de.

## Installation
Copy the GuildLootForever folder into your Forever client's Interface/AddOns folder. Use `/gfl` for status, `/gfl stop` to pause and `/gfl start` to resume.

## Uploads
Download the separate companion and follow the guide at https://lichtloot.de/forever-addon.html. Uploading requires an approved Forever player login. Saved data becomes available after `/reload` or logout; the add-on itself has no network access.

## Beta status
Targets WoW Forever 1.60.x, Interface 16001. Locally tested; verification in the real Forever client is pending. Only loot windows you open are captured. Community reports are unverified and do not overwrite reviewed item catalogs or modify loot priorities, awards or points. Public discoveries do not include account, character or guild names.
