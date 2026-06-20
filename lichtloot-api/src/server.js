import "dotenv/config";
import cors from "cors";
import express from "express";
import { pool, query, requireGuild } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const defaultGuildSlug = process.env.DEFAULT_GUILD_SLUG || "lichtloot";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ success: true, service: "lichtloot-api" });
});

app.get("/db-health", async (req, res, next) => {
  try {
    const result = await query("select now() as now");
    res.json({ success: true, now: result.rows[0].now });
  } catch (error) {
    next(error);
  }
});

function clean(value) {
  return String(value || "").trim();
}

function normalizePin(value) {
  return clean(value).toUpperCase();
}

function normalizeCharacter(row) {
  return {
    id: row.id,
    char: row.name,
    name: row.name,
    player: row.name,
    server: row.server,
    className: row.class_name,
    Klasse: row.class_name,
    mainChar: row.main_char || "",
    created_at: row.created_at
  };
}

async function findPlayerByPin(guildId, pin) {
  const result = await query(
    "select id, player_pin from players where guild_id = $1 and player_pin = $2",
    [guildId, normalizePin(pin)]
  );
  return result.rows[0] || null;
}

async function findCharacter(guildId, charName, server) {
  const result = await query(
    `select c.id, c.name, c.server, c.class_name, c.created_at, p.player_pin
     from characters c
     join players p on p.id = c.player_id
     where p.guild_id = $1 and lower(c.name) = lower($2) and lower(c.server) = lower($3)
     limit 1`,
    [guildId, clean(charName), clean(server)]
  );
  return result.rows[0] || null;
}

async function getCharactersByPin(guildId, pin) {
  const result = await query(
    `select c.id, c.name, c.server, c.class_name, c.created_at
     from players p
     join characters c on c.player_id = p.id
     where p.guild_id = $1 and p.player_pin = $2
     order by c.name asc`,
    [guildId, normalizePin(pin)]
  );
  return result.rows.map(normalizeCharacter);
}

function parseDateValue(value) {
  const raw = clean(value);
  if (!raw) return new Date().toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const german = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (german) {
    return `${german[3]}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return new Date().toISOString().slice(0, 10);
}

function normalizeRaidType(value) {
  const raw = clean(value) || "raid";
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "raid";
}

function displayRaidName(value) {
  const key = normalizeRaidType(value);
  const names = {
    mc: "Molten Core",
    bwl: "Blackwing Lair",
    aq40: "Ahn'Qiraj 40",
    naxx: "Naxxramas",
    zg: "Zul'Gurub",
    aq20: "AQ 20",
    ony: "Onyxia"
  };
  return names[key] || clean(value) || "Raid";
}

async function findCharacterForPin(guildId, pin, charName, server) {
  const params = [guildId, normalizePin(pin), clean(charName)];
  let serverClause = "";

  if (clean(server)) {
    params.push(clean(server));
    serverClause = `and lower(c.server) = lower($${params.length})`;
  }

  const result = await query(
    `select c.id, c.name, c.server, c.class_name, c.created_at, p.player_pin
     from players p
     join characters c on c.player_id = p.id
     where p.guild_id = $1
       and p.player_pin = $2
       and lower(c.name) = lower($3)
       ${serverClause}
     order by c.created_at asc
     limit 1`,
    params
  );
  return result.rows[0] || null;
}

async function upsertItem(client, raidType, itemName) {
  const name = clean(itemName);
  if (!name || name === "-") return null;

  const result = await client.query(
    `insert into items (raid_type, name)
     values ($1, $2)
     on conflict (raid_type, name) do update
       set name = excluded.name
     returning id, name`,
    [raidType, name]
  );
  return result.rows[0];
}

async function savePrio({ guildId, query: params }) {
  const pin = params.playerPin || params.characterPin || params.masterCharacterPin || params.pin;
  const player = params.player || params.char || params.spieler;
  const server = params.server;
  const character = await findCharacterForPin(guildId, pin, player, server);

  if (!character) {
    const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerPin.");
    error.statusCode = 403;
    throw error;
  }

  const raidType = normalizeRaidType(params.raid || params.raidName);
  const raidName = displayRaidName(params.raidName || params.raid);
  const raidDate = parseDateValue(params.raidDate || params.datum || params.date);
  const p0Plus = clean(params.p0Plus).toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const raidResult = await client.query(
      `insert into raids (guild_id, name, raid_type, raid_date, raid_pin)
       values ($1, $2, $3, $4, $5)
       on conflict (guild_id, raid_type, raid_date) do update
         set name = excluded.name,
             raid_pin = coalesce(excluded.raid_pin, raids.raid_pin),
             updated_at = now()
       returning id, name, raid_type, raid_date`,
      [guildId, raidName, raidType, raidDate, clean(params.raidId || params.RaidID || params.raidPin) || null]
    );

    const p1 = await upsertItem(client, raidType, params.p1);
    const p2 = await upsertItem(client, raidType, params.p2);
    const p3 = await upsertItem(client, raidType, params.p3);
    const comment = JSON.stringify({
      p0Plus: p0Plus === "ja" || p0Plus === "true" ? "ja" : "nein",
      raidTime: clean(params.raidTime || params.uhrzeit),
      source: "railway"
    });

    const prioResult = await client.query(
      `insert into prios (raid_id, character_id, p1_item_id, p2_item_id, p3_item_id, comment)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (raid_id, character_id) do update
         set p1_item_id = excluded.p1_item_id,
             p2_item_id = excluded.p2_item_id,
             p3_item_id = excluded.p3_item_id,
             comment = excluded.comment,
             updated_at = now()
       returning id, created_at, updated_at`,
      [raidResult.rows[0].id, character.id, p1?.id || null, p2?.id || null, p3?.id || null, comment]
    );

    await client.query("commit");
    return {
      success: true,
      characterPin: normalizePin(pin),
      playerPin: normalizePin(pin),
      tempPin: normalizePin(pin),
      prioId: prioResult.rows[0].id,
      raidId: raidResult.rows[0].id
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function commentMeta(comment) {
  try {
    return JSON.parse(comment || "{}") || {};
  } catch {
    return {};
  }
}

async function getPlayerPrioHistory(guildId, params) {
  const pin = params.pin || params.playerPin || params.characterPin || params.masterCharacterPin;
  const charName = params.char || params.player || params.spieler;
  const character = await findCharacterForPin(guildId, pin, charName, params.server);

  if (!character) {
    const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerPin.");
    error.statusCode = 403;
    throw error;
  }

  const result = await query(
    `select
       pr.id,
       pr.comment,
       pr.created_at,
       pr.updated_at,
       r.id as raid_id,
       r.name as raid_name,
       r.raid_type,
       r.raid_date,
       i1.name as p1,
       i2.name as p2,
       i3.name as p3
     from prios pr
     join raids r on r.id = pr.raid_id
     left join items i1 on i1.id = pr.p1_item_id
     left join items i2 on i2.id = pr.p2_item_id
     left join items i3 on i3.id = pr.p3_item_id
     where pr.character_id = $1
     order by r.raid_date desc, pr.updated_at desc
     limit 25`,
    [character.id]
  );

  const pointsResult = await query(
    `select
       coalesce(i.raid_type, 'Raid') as raid,
       coalesce(i.name, pp.note, 'P0/P0+') as item,
       coalesce(i.quality, '') as quality,
       pp.points,
       pp.source,
       pp.note,
       pp.created_at
     from p0plus_points pp
     left join items i on i.id = pp.item_id
     where pp.guild_id = $1 and pp.character_id = $2
     order by raid asc, item asc`,
    [guildId, character.id]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries = result.rows.map(row => {
    const meta = commentMeta(row.comment);
    const raidDate = row.raid_date ? row.raid_date.toISOString().slice(0, 10) : "";
    const raidDay = raidDate ? new Date(`${raidDate}T00:00:00`) : null;

    return {
      id: row.id,
      raidId: row.raid_id,
      raid: row.raid_type,
      raidName: row.raid_name || displayRaidName(row.raid_type),
      raidDate,
      raidTime: meta.raidTime || "",
      createdAt: row.updated_at || row.created_at,
      player: character.name,
      server: character.server,
      className: character.class_name,
      p1: row.p1 || "",
      p2: row.p2 || "",
      p3: row.p3 || "",
      p0Plus: meta.p0Plus || "nein",
      current: raidDay ? raidDay >= today : true,
      pinType: "Railway"
    };
  });

  return {
    success: true,
    guild: defaultGuildSlug,
    player: character.name,
    server: character.server,
    className: character.class_name,
    entries,
    ownP0PlusPoints: pointsResult.rows.map(row => ({
      raid: row.raid,
      item: row.item,
      quality: row.quality || "",
      slot: "",
      count: row.points,
      source: row.source || "",
      note: row.note || "",
      createdAt: row.created_at
    }))
  };
}

async function deletePrio({ guildId, query: params }) {
  const pin = params.pin || params.playerPin || params.characterPin || params.masterCharacterPin;
  const player = params.player || params.char || params.spieler;
  const character = await findCharacterForPin(guildId, pin, player, params.server);

  if (!character) {
    const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerPin.");
    error.statusCode = 403;
    throw error;
  }

  const values = [character.id];
  let raidClause = "";
  const raidId = clean(params.raidId);

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raidId)) {
    values.push(raidId);
    raidClause = `and pr.raid_id = $${values.length}`;
  } else if (clean(params.raid)) {
    values.push(normalizeRaidType(params.raid));
    raidClause = `and r.raid_type = $${values.length}`;
  }

  const result = await query(
    `delete from prios pr
     using raids r
     where pr.raid_id = r.id
       and pr.character_id = $1
       ${raidClause}
     returning pr.id`,
    values
  );

  return { success: true, deleted: result.rowCount };
}

async function createPlayerWithCharacter({
  guildId,
  playerPin,
  securityQuestion,
  securityAnswer,
  charName,
  server,
  className
}) {
  const pin = normalizePin(playerPin);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existingPlayer = await client.query(
      "select id from players where guild_id = $1 and player_pin = $2",
      [guildId, pin]
    );
    if (existingPlayer.rows.length) {
      const error = new Error("Dieser SpielerLogin ist bereits vergeben.");
      error.statusCode = 409;
      throw error;
    }

    const existingCharacter = await client.query(
      `select c.id
       from characters c
       join players p on p.id = c.player_id
       where p.guild_id = $1 and lower(c.name) = lower($2) and lower(c.server) = lower($3)
       limit 1`,
      [guildId, clean(charName), clean(server)]
    );
    if (existingCharacter.rows.length) {
      const error = new Error("Für diesen Charakter existiert bereits ein SpielerLogin.");
      error.statusCode = 409;
      throw error;
    }

    const playerResult = await client.query(
      `insert into players (guild_id, player_pin, security_question, security_answer)
       values ($1, $2, $3, $4)
       returning id, player_pin, created_at`,
      [guildId, pin, clean(securityQuestion) || null, clean(securityAnswer) || null]
    );

    const characterResult = await client.query(
      `insert into characters (player_id, name, server, class_name, is_main)
       values ($1, $2, $3, $4, true)
       returning id, name, server, class_name, created_at`,
      [playerResult.rows[0].id, clean(charName), clean(server), clean(className)]
    );

    await client.query("commit");
    return { player: playerResult.rows[0], character: normalizeCharacter(characterResult.rows[0]) };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function addCharacterToPlayer({ guildId, pin, charName, server, className }) {
  const player = await findPlayerByPin(guildId, pin);
  if (!player) {
    const error = new Error("Dieser SpielerLogin wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const existingCharacter = await findCharacter(guildId, charName, server);
  if (existingCharacter) {
    const error = new Error("Dieser Charakter ist bereits gespeichert.");
    error.statusCode = 409;
    throw error;
  }

  const result = await query(
    `insert into characters (player_id, name, server, class_name)
     values ($1, $2, $3, $4)
     returning id, name, server, class_name, created_at`,
    [player.id, clean(charName), clean(server), clean(className)]
  );

  return normalizeCharacter(result.rows[0]);
}

async function resetPlayerPin({ guildId, charName, server, oldPin, newPin, className }) {
  const character = await findCharacter(guildId, charName, server);
  if (!character) {
    const error = new Error("Dieser Charakter wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  if (normalizePin(character.player_pin) !== normalizePin(oldPin)) {
    const error = new Error("Der alte SpielerLogin passt nicht zu diesem Charakter.");
    error.statusCode = 403;
    throw error;
  }

  const pin = normalizePin(newPin);
  await query(
    `update players p
     set player_pin = $1, updated_at = now()
     from characters c
     where c.player_id = p.id
       and p.guild_id = $2
       and lower(c.name) = lower($3)
       and lower(c.server) = lower($4)`,
    [pin, guildId, clean(charName), clean(server)]
  );

  if (clean(className)) {
    await query(
      `update characters c
       set class_name = $1, updated_at = now()
       from players p
       where c.player_id = p.id
         and p.guild_id = $2
         and lower(c.name) = lower($3)
         and lower(c.server) = lower($4)`,
      [clean(className), guildId, clean(charName), clean(server)]
    );
  }

  return pin;
}

async function resetPlayerPinBySecurity({
  guildId,
  charName,
  server,
  securityQuestion,
  securityAnswer,
  newPin
}) {
  const result = await query(
    `select p.id, p.security_question, p.security_answer
     from players p
     join characters c on c.player_id = p.id
     where p.guild_id = $1 and lower(c.name) = lower($2) and lower(c.server) = lower($3)
     limit 1`,
    [guildId, clean(charName), clean(server)]
  );

  const player = result.rows[0];
  if (!player) {
    const error = new Error("Dieser Charakter wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const questionMatches = clean(player.security_question) === clean(securityQuestion);
  const answerMatches = clean(player.security_answer).toLowerCase() === clean(securityAnswer).toLowerCase();
  if (!questionMatches || !answerMatches) {
    const error = new Error("Sicherheitsfrage oder Antwort ist nicht korrekt.");
    error.statusCode = 403;
    throw error;
  }

  const pin = normalizePin(newPin);
  await query("update players set player_pin = $1, updated_at = now() where id = $2", [pin, player.id]);
  return pin;
}

app.get("/api/apps-script", async (req, res, next) => {
  try {
    const guild = await requireGuild(clean(req.query.guild) || defaultGuildSlug);
    const action = clean(req.query.action);

    if (action === "getCharactersByPin") {
      const characters = await getCharactersByPin(guild.id, req.query.pin);
      return res.json({ success: true, guild: guild.slug, characters, entries: characters, chars: characters });
    }

    if (action === "getPlayerPrioHistory") {
      const history = await getPlayerPrioHistory(guild.id, req.query);
      return res.json({ ...history, guild: guild.slug });
    }

    if (action === "savePrio") {
      const saved = await savePrio({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "deletePrio" || action === "deletePlayerPrio") {
      const deleted = await deletePrio({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "getPlayerPin") {
      const character = await findCharacter(guild.id, req.query.char, req.query.server);
      return res.json({
        success: true,
        exists: Boolean(character),
        className: character?.class_name || "",
        char: character?.name || "",
        server: character?.server || ""
      });
    }

    if (action === "createPlayerPin") {
      const result = await createPlayerWithCharacter({
        guildId: guild.id,
        playerPin: req.query.customPin,
        securityQuestion: req.query.securityQuestion,
        securityAnswer: req.query.securityAnswer,
        charName: req.query.char,
        server: req.query.server,
        className: req.query.className
      });
      return res.json({ success: true, guild: guild.slug, pin: result.player.player_pin, character: result.character });
    }

    if (action === "addTwink") {
      const character = await addCharacterToPlayer({
        guildId: guild.id,
        pin: req.query.pin,
        charName: req.query.char,
        server: req.query.server,
        className: req.query.className
      });
      return res.json({ success: true, guild: guild.slug, character });
    }

    if (action === "resetPlayerPin") {
      const pin = await resetPlayerPin({
        guildId: guild.id,
        charName: req.query.char,
        server: req.query.server,
        oldPin: req.query.oldPin,
        newPin: req.query.customPin,
        className: req.query.className
      });
      return res.json({ success: true, guild: guild.slug, pin });
    }

    if (action === "resetPlayerPinBySecurity") {
      const pin = await resetPlayerPinBySecurity({
        guildId: guild.id,
        charName: req.query.char,
        server: req.query.server,
        securityQuestion: req.query.securityQuestion,
        securityAnswer: req.query.securityAnswer,
        newPin: req.query.customPin
      });
      return res.json({ success: true, guild: guild.slug, pin });
    }

    return res.status(404).json({ success: false, error: `Unsupported action: ${action}` });
  } catch (error) {
    next(error);
  }
});

app.get("/api/guilds/:guildSlug", async (req, res, next) => {
  try {
    const guild = await requireGuild(req.params.guildSlug || defaultGuildSlug);
    res.json({ success: true, guild });
  } catch (error) {
    next(error);
  }
});

app.get("/api/guilds/:guildSlug/characters", async (req, res, next) => {
  try {
    const guild = await requireGuild(req.params.guildSlug || defaultGuildSlug);
    const result = await query(
      `select c.id, c.name, c.server, c.class_name, c.created_at
       from characters c
       join players p on p.id = c.player_id
       where p.guild_id = $1
       order by c.name asc`,
      [guild.id]
    );
    res.json({ success: true, guild: guild.slug, characters: result.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/guilds/:guildSlug/players/by-pin/:pin/characters", async (req, res, next) => {
  try {
    const guild = await requireGuild(req.params.guildSlug || defaultGuildSlug);
    const result = await query(
      `select c.id, c.name, c.server, c.class_name, c.created_at
       from players p
       join characters c on c.player_id = p.id
       where p.guild_id = $1 and p.player_pin = $2
       order by c.name asc`,
      [guild.id, req.params.pin]
    );
    res.json({ success: true, guild: guild.slug, characters: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/guilds/:guildSlug/players", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const guild = await requireGuild(req.params.guildSlug || defaultGuildSlug);
    const { playerPin, securityQuestion, securityAnswer, character } = req.body || {};

    if (!playerPin || !character?.name || !character?.server || !character?.className) {
      return res.status(400).json({
        success: false,
        error: "playerPin, character.name, character.server and character.className are required"
      });
    }

    await client.query("begin");
    const playerResult = await client.query(
      `insert into players (guild_id, player_pin, security_question, security_answer)
       values ($1, $2, $3, $4)
       returning id, player_pin, created_at`,
      [guild.id, playerPin, securityQuestion || null, securityAnswer || null]
    );
    const player = playerResult.rows[0];
    const characterResult = await client.query(
      `insert into characters (player_id, name, server, class_name)
       values ($1, $2, $3, $4)
       returning id, name, server, class_name, created_at`,
      [player.id, character.name, character.server, character.className]
    );
    await client.query("commit");

    res.status(201).json({
      success: true,
      guild: guild.slug,
      player,
      character: characterResult.rows[0]
    });
  } catch (error) {
    await client.query("rollback").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`LichtLoot API listening on port ${port}`);
});
