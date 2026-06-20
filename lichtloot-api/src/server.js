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
