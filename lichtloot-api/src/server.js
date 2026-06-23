import "dotenv/config";
import cors from "cors";
import express from "express";
import { pool, query, requireGuild } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const defaultGuildSlug = process.env.DEFAULT_GUILD_SLUG || "lichtloot";
const masterCode = process.env.MASTER_CODE || "Lichtbringer-Master";
const lichtbotQueueToken = process.env.LICHTBOT_QUEUE_TOKEN || "";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/downloads", express.static("public/downloads"));

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

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const guild = await requireGuild(resolveGuildSlug(req.query.guild));
    const today = new Date().toISOString().slice(0, 10);
    const result = await query(
      `select r.*,
              (
                select count(*)
                from p0plus_points pp
                where pp.guild_id = r.guild_id
                  and pp.source = 'Raidlead Transfer'
                  and pp.note in (
                    concat('RaidID: ', coalesce(r.external_raid_id, r.id::text)),
                    concat('RaidID: ', r.id::text),
                    concat('RaidID: ', r.raid_pin)
                  )
              ) as p0plus_transfer_count
       from raids r
       where r.guild_id = $1
         and raid_date >= $2
         and coalesce(status, '') not in ('archiviert', 'archive')
       order by raid_date asc, coalesce(raid_time, '') asc, created_at asc`,
      [guild.id, today]
    );
    const raids = result.rows.map(row => {
      const raid = normalizeRaidRow(row);
      return { ...raid, leadPin: "", LeadPin: "" };
    });
    res.json({ success: true, guild: guild.slug, raids, allRaids: raids, activeRaids: raids });
  } catch (error) {
    next(error);
  }
});

function clean(value) {
  return String(value || "").trim();
}

function resolveGuildSlug(value) {
  const slug = slugify(value || defaultGuildSlug);
  if (!slug) return defaultGuildSlug;
  if (
    [
      "lichtloot",
      "lichtbringer",
      "lichtzbringer",
      "lichbringer",
      "lichtbringer-loot",
      "lichtloot-gilde"
    ].includes(slug)
  ) {
    return "lichtloot";
  }
  return slug;
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLootSlug(guildName, lootName) {
  const explicit = slugify(lootName);
  if (explicit) return explicit;
  const base = slugify(guildName);
  return base ? `${base}-loot` : "";
}

async function listGuilds() {
  const result = await query(
    `select g.slug, g.name, g.server, g.logo_url, g.background_url, g.created_at,
            coalesce(gs.points_label, 'P0/P0+') as points_label,
            coalesce(gs.primary_color, '#facc15') as primary_color,
            coalesce(gs.accent_color, '#1d4ed8') as accent_color
     from guilds g
     left join guild_settings gs on gs.guild_id = g.id
     order by g.created_at asc, g.name asc`
  );
  return {
    success: true,
    guilds: result.rows.map(row => ({
      slug: row.slug,
      name: row.name,
      server: row.server || "",
      logoUrl: row.logo_url || "",
      backgroundUrl: row.background_url || "",
      pointsLabel: row.points_label || "P0/P0+",
      primaryColor: row.primary_color || "#facc15",
      accentColor: row.accent_color || "#1d4ed8",
      createdAt: row.created_at
    }))
  };
}

async function createGuild({ query: params }) {
  const guildName = clean(params.guildName || params.name);
  const lootName = clean(params.lootName || params.slugName);
  const server = clean(params.server);
  const slug = buildLootSlug(guildName, lootName);

  if (!guildName || !slug) {
    const error = new Error("Bitte Gildenname und Lootsystem-Name angeben.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const guildResult = await client.query(
      `insert into guilds (name, slug, server)
       values ($1, $2, $3)
       on conflict (slug) do update
         set name = excluded.name,
             server = coalesce(nullif(excluded.server, ''), guilds.server),
             updated_at = now()
       returning id, name, slug, server, created_at`,
      [guildName, slug, server || null]
    );

    await client.query(
      `insert into guild_settings (guild_id)
       values ($1)
       on conflict (guild_id) do nothing`,
      [guildResult.rows[0].id]
    );

    await client.query("commit");
    const guild = guildResult.rows[0];
    return {
      success: true,
      guild: {
        slug: guild.slug,
        name: guild.name,
        server: guild.server || "",
        createdAt: guild.created_at
      },
      startUrl: `start.html?guild=${encodeURIComponent(guild.slug)}`,
      leadershipUrl: `gildenleitung.html?guild=${encodeURIComponent(guild.slug)}`
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function updateGuildConfig({ query: params, body = {} }) {
  const values = { ...params, ...body };
  const slug = clean(values.guild || values.slug);
  if (!slug) {
    const error = new Error("Gilde fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const guild = await requireGuild(resolveGuildSlug(slug));
  const name = clean(values.guildName || values.name);
  const server = clean(values.server);
  const logoUrl = clean(values.logoUrl || values.logo_url);
  const backgroundUrl = clean(values.backgroundUrl || values.background_url);
  const pointsLabel = clean(values.pointsLabel || values.points_label);
  const primaryColor = clean(values.primaryColor || values.primary_color);
  const accentColor = clean(values.accentColor || values.accent_color);

  const client = await pool.connect();
  try {
    await client.query("begin");
    const guildResult = await client.query(
      `update guilds
       set name = coalesce(nullif($2, ''), name),
           server = coalesce(nullif($3, ''), server),
           logo_url = coalesce(nullif($4, ''), logo_url),
           background_url = coalesce(nullif($5, ''), background_url),
           updated_at = now()
       where id = $1
       returning slug, name, server, logo_url, background_url, created_at`,
      [guild.id, name, server, logoUrl, backgroundUrl]
    );

    await client.query(
      `insert into guild_settings (guild_id, points_label, primary_color, accent_color)
       values ($1, coalesce(nullif($2, ''), 'P0/P0+'), coalesce(nullif($3, ''), '#facc15'), coalesce(nullif($4, ''), '#1d4ed8'))
       on conflict (guild_id) do update
         set points_label = coalesce(nullif(excluded.points_label, ''), guild_settings.points_label),
             primary_color = coalesce(nullif(excluded.primary_color, ''), guild_settings.primary_color),
             accent_color = coalesce(nullif(excluded.accent_color, ''), guild_settings.accent_color),
             updated_at = now()`,
      [guild.id, pointsLabel, primaryColor, accentColor]
    );

    const settingsResult = await client.query(
      `select points_label, primary_color, accent_color from guild_settings where guild_id = $1`,
      [guild.id]
    );

    await client.query("commit");
    const row = guildResult.rows[0];
    return {
      success: true,
      guild: {
        slug: row.slug,
        name: row.name,
        server: row.server || "",
        logoUrl: row.logo_url || "",
        backgroundUrl: row.background_url || "",
        pointsLabel: settingsResult.rows[0]?.points_label || "P0/P0+",
        primaryColor: settingsResult.rows[0]?.primary_color || "#facc15",
        accentColor: settingsResult.rows[0]?.accent_color || "#1d4ed8",
        createdAt: row.created_at
      }
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

async function getPlayerDisplayNameByPin(guildId, pin) {
  const result = await query(
    `select coalesce((
       select c.name
       from characters c
       where c.player_id = p.id
       order by c.is_main desc, c.created_at asc
       limit 1
     ), p.player_pin) as display_name
     from players p
     where p.guild_id = $1 and p.player_pin = $2`,
    [guildId, normalizePin(pin)]
  );
  return clean(result.rows[0]?.display_name);
}

async function getVerifiedSenderCharacterName(guildId, pin, charName, server) {
  const name = clean(charName);
  if (!name) return "";

  const params = [guildId, normalizePin(pin), name];
  let serverClause = "";
  if (clean(server)) {
    params.push(clean(server));
    serverClause = `and lower(c.server) = lower($${params.length})`;
  }

  const result = await query(
    `select c.name
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
  return clean(result.rows[0]?.name);
}

async function findPlayerByRecipient(guildId, recipient, server) {
  const raw = clean(recipient);
  if (!raw) return null;

  const byPin = await findPlayerByPin(guildId, raw);
  if (byPin) return byPin;

  const params = [guildId, raw];
  let serverClause = "";
  if (clean(server)) {
    params.push(clean(server));
    serverClause = `and lower(c.server) = lower($${params.length})`;
  }

  const result = await query(
    `select p.id, p.player_pin, c.name as character_name, c.server
     from characters c
     join players p on p.id = c.player_id
     where p.guild_id = $1
       and lower(c.name) = lower($2)
       ${serverClause}
     order by c.created_at asc
     limit 1`,
    params
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

function formatGermanDate(value) {
  if (!value) return "";
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : parseDateValue(value);
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : clean(value);
}

function weekdayShort(value) {
  const iso = parseDateValue(value);
  const date = new Date(`${iso}T12:00:00Z`);
  const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return names[date.getUTCDay()] || "";
}

function normalizeRaidType(value) {
  const raw = clean(value) || "raid";
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "raid";
  const aliases = {
    "molten-core": "mc",
    "blackwing-lair": "bwl",
    "ahn-qiraj-40": "aq40",
    "aq-40": "aq40",
    "ahn-qiraj": "aq40",
    "zul-gurub": "zg",
    "zg-20": "zg",
    "zul-gurub-20": "zg",
    "aq-20": "aq20",
    "ahn-qiraj-20": "aq20",
    "ruins-of-ahn-qiraj": "aq20",
    "onyxia": "ony",
    "onyxia-s-lair": "ony"
  };
  return aliases[key] || key;
}

function raidTypeSearchValues(value) {
  const normalized = normalizeRaidType(value);
  const variants = {
    mc: ["mc", "molten-core"],
    bwl: ["bwl", "blackwing-lair"],
    aq40: ["aq40", "aq-40", "ahn-qiraj-40", "ahn-qiraj"],
    naxx: ["naxx", "naxxramas"],
    zg: ["zg", "zg20", "zg 20", "zg-20", "zul-gurub", "zul gurub", "zul'gurub", "zul-gurub-20", "zul gurub 20"],
    aq20: ["aq20", "aq 20", "aq-20", "ahn-qiraj-20", "ahn qiraj 20", "ahn'qiraj 20", "ruins-of-ahn-qiraj", "ruins of ahn qiraj"],
    ony: ["ony", "onyxia", "onyxia-s-lair"]
  };
  return Array.from(new Set([normalized, ...(variants[normalized] || [])].map(value => value.toLowerCase())));
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

function readSlotFromNote(note) {
  const text = clean(note);
  const match = text.match(/Slot:\s*(.*)$/i);
  return match ? clean(match[1]) : "";
}

function requireMasterCode(value) {
  if (clean(value) !== masterCode) {
    const error = new Error("Falscher Master-Code.");
    error.statusCode = 403;
    throw error;
  }
}

function requireMasterOrQueueToken(params = {}) {
  if (clean(params.masterCode) === masterCode) return;
  if (lichtbotQueueToken && clean(params.queueToken) === lichtbotQueueToken) return;
  const error = new Error("Nicht erlaubt.");
  error.statusCode = 403;
  throw error;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(value));
}

function normalizeStatus(value) {
  const raw = clean(value).toLowerCase();
  if (raw === "offen") return "geöffnet";
  if (raw === "open") return "geöffnet";
  if (raw === "closed") return "geschlossen";
  return clean(value) || "geschlossen";
}

function raidPublicId(row) {
  return row.external_raid_id || row.id;
}

function normalizeRaidRow(row) {
  const raidDate = row.raid_date ? row.raid_date.toISOString().slice(0, 10) : "";
  const p0PlusTransferCount = Number(row.p0plus_transfer_count || 0);
  return {
    id: row.id,
    raidId: raidPublicId(row),
    RaidID: raidPublicId(row),
    raid: row.raid_type,
    raidName: row.name || displayRaidName(row.raid_type),
    raidDate,
    date: raidDate,
    datum: raidDate,
    raidTime: row.raid_time || "",
    time: row.raid_time || "",
    uhrzeit: row.raid_time || "",
    guild: row.guild_name || "",
    gilde: row.guild_name || "",
    playerPin: row.raid_pin || "",
    prioPin: row.raid_pin || "",
    leadPin: row.lead_pin || "",
    status: row.status || "geschlossen",
    p0PlusFreigabe: row.p0plus_freigabe || "geschlossen",
    p0PlusTransferred: p0PlusTransferCount > 0,
    p0PlusTransferCount,
    playerLink: row.player_link || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeHordenbuffStatus(value) {
  const raw = clean(value).toLowerCase();
  if (!raw) return "offen";
  if (raw.includes("erledigt") || raw === "done" || raw === "fertig") return "erledigt";
  if (raw.includes("zugeteilt")) return "zugeteilt";
  if (raw.includes("offen")) return "offen";
  return clean(value);
}

function normalizeHordenbuffRow(row) {
  return {
    rowNumber: row.entry_id || "",
    eventId: row.event_id,
    buff: row.buff || "Rend",
    tag: row.tag || weekdayShort(row.event_date),
    datum: formatGermanDate(row.event_date),
    date: row.event_date ? row.event_date.toISOString().slice(0, 10) : "",
    uhrzeit: row.event_time || "",
    gilde: row.faction || "Horde",
    charakter: row.ally_char || "",
    uebernehmer: row.horde_char || "",
    status: row.entry_status || row.event_status || "offen",
    note: row.entry_note || row.event_note || "",
    notiz: row.entry_note || row.event_note || "",
    source: row.source || "railway",
    key: `${formatGermanDate(row.event_date)}|${row.event_time || ""}|Rend|${row.faction || "Horde"}`
  };
}

async function upsertHordenbuffEvent(client, guildId, params) {
  const eventDate = parseDateValue(params.datum || params.date || params.eventDate);
  const eventTime = clean(params.uhrzeit || params.time || params.eventTime || "19:35");
  const buff = clean(params.buff || "Rend") || "Rend";
  const faction = clean(params.gilde || params.faction || "Horde") || "Horde";
  const status = normalizeHordenbuffStatus(params.eventStatus || params.status || "offen");
  const note = clean(params.eventNote || "");

  const result = await client.query(
    `insert into hordenbuff_events (guild_id, buff, event_date, event_time, faction, status, note)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (guild_id, buff, event_date, event_time) do update
       set faction = coalesce(nullif(excluded.faction, ''), hordenbuff_events.faction),
           status = coalesce(nullif(excluded.status, ''), hordenbuff_events.status),
           note = coalesce(nullif(excluded.note, ''), hordenbuff_events.note),
           updated_at = now()
     returning *`,
    [guildId, buff, eventDate, eventTime, faction, status, note]
  );
  return result.rows[0];
}

async function getHordenbuffs({ guildId, query: params }) {
  const days = clean(params.days || "all");
  const values = [guildId];
  let windowClause = "";
  if (days !== "all") {
    const dayCount = Math.max(Number(days) || 30, 1);
    values.push(dayCount);
    windowClause = `and e.event_date <= current_date + ($2::int * interval '1 day')`;
  }

  const result = await query(
    `select e.id as event_id, e.buff, e.event_date, e.event_time, e.faction,
            e.status as event_status, e.note as event_note,
            he.id as entry_id, he.ally_char, he.horde_char,
            he.status as entry_status, he.note as entry_note, he.source
     from hordenbuff_events e
     left join hordenbuff_entries he on he.event_id = e.id
     where e.guild_id = $1
       and e.event_date >= current_date
       ${windowClause}
     order by e.event_date asc, e.event_time asc, he.created_at asc`,
    values
  );

  return { success: true, buffs: result.rows.map(normalizeHordenbuffRow) };
}

async function setHordenbuffEntry({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const client = await pool.connect();
  try {
    await client.query("begin");

    let event;
    const rowNumber = clean(params.rowNumber);
    let existingEntry = null;
    if (rowNumber && isUuid(rowNumber)) {
      const existing = await client.query(
        `select he.*, e.*
         from hordenbuff_entries he
         join hordenbuff_events e on e.id = he.event_id
         where he.id = $1 and e.guild_id = $2`,
        [rowNumber, guildId]
      );
      existingEntry = existing.rows[0] || null;
    }

    if (existingEntry) {
      event = { id: existingEntry.event_id };
    } else {
      event = await upsertHordenbuffEvent(client, guildId, params);
    }

    const allyChar = clean(params.charakter || params.allyChar || params.ally_char);
    const hordeChar = clean(params.uebernehmer || params.hordeChar || params.horde_char);
    const status = normalizeHordenbuffStatus(params.status);
    const note = clean(params.note || params.notiz);
    const shouldAutoAssign = hordeChar && !allyChar && status !== "erledigt";

    if (shouldAutoAssign) {
      const target = await client.query(
        `select he.id, he.note
         from hordenbuff_entries he
         where he.event_id = $1
           and nullif(he.ally_char, '') is not null
           and nullif(he.horde_char, '') is null
           and lower(coalesce(he.status, '')) not in ('erledigt', 'done', 'fertig')
           and ($2::uuid is null or he.id <> $2::uuid)
         order by he.created_at asc
         limit 1`,
        [event.id, rowNumber && isUuid(rowNumber) ? rowNumber : null]
      );

      if (target.rows[0]) {
        const assignedNote = note || target.rows[0].note || "Benötigt Buff für aktiven Termin; Helfer zugeteilt";
        const assigned = await client.query(
          `update hordenbuff_entries
           set horde_char = $2,
               status = 'zugeteilt',
               note = $3,
               updated_at = now()
           where id = $1
           returning *`,
          [target.rows[0].id, hordeChar, assignedNote]
        );

        if (existingEntry) {
          await client.query("delete from hordenbuff_entries where id = $1", [rowNumber]);
        }

        await client.query("commit");
        return { success: true, rowNumber: assigned.rows[0].id, autoAssigned: true };
      }
    }

    let saved;
    if (existingEntry) {
      saved = await client.query(
        `update hordenbuff_entries
         set ally_char = $2,
             horde_char = $3,
             status = $4,
             note = $5,
             updated_at = now()
         where id = $1
         returning *`,
        [rowNumber, allyChar, hordeChar, status, note]
      );
    } else {
      saved = await client.query(
        `insert into hordenbuff_entries (event_id, ally_char, horde_char, status, note, source)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [event.id, allyChar, hordeChar, status, note, clean(params.source || "railway")]
      );
    }

    await client.query("commit");
    return { success: true, rowNumber: saved.rows[0].id };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createHordenbuffTerm({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const event = await upsertHordenbuffEvent(client, guildId, params);
    const allyChar = clean(params.charakter || params.allyChar || params.ally_char);
    const hordeChar = clean(params.uebernehmer || params.hordeChar || params.horde_char);
    if (allyChar || hordeChar) {
      await client.query(
        `insert into hordenbuff_entries (event_id, ally_char, horde_char, status, note, source)
         values ($1, $2, $3, $4, $5, 'railway')`,
        [
          event.id,
          allyChar,
          hordeChar,
          normalizeHordenbuffStatus(params.status),
          clean(params.note || params.notiz)
        ]
      );
    }
    await client.query("commit");
    return { success: true, eventId: event.id };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function deleteHordenbuffEntry({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const rowNumber = clean(params.rowNumber);
  const name = clean(params.name || params.charakter || params.allyChar || params.hordeChar);
  if (rowNumber && isUuid(rowNumber)) {
    await query(
      `delete from hordenbuff_entries he
       using hordenbuff_events e
       where he.event_id = e.id and e.guild_id = $1 and he.id = $2`,
      [guildId, rowNumber]
    );
    return { success: true };
  }

  const eventId = clean(params.eventId || params.event_id);
  if (eventId && isUuid(eventId)) {
    await query(
      `delete from hordenbuff_events
       where guild_id = $1 and id = $2`,
      [guildId, eventId]
    );
    return { success: true };
  }

  const eventDate = parseDateValue(params.datum || params.date);
  const eventTime = clean(params.uhrzeit || params.time);
  await query(
    `delete from hordenbuff_entries he
     using hordenbuff_events e
     where he.event_id = e.id
       and e.guild_id = $1
       and e.event_date = $2
       and e.event_time = $3
       and (lower(he.ally_char) = lower($4) or lower(he.horde_char) = lower($4))`,
    [guildId, eventDate, eventTime, name]
  );
  return { success: true };
}

async function queueBotUpdate({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const type = clean(params.type || "hordenbuff_update") || "hordenbuff_update";
  const result = await query(
    `insert into bot_update_queue (guild_id, type)
     values ($1, $2)
     returning id, type`,
    [guildId, type]
  );
  return { success: true, rowNumber: result.rows[0].id, type: result.rows[0].type };
}

async function getBotQueue({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const result = await query(
    `select id, type, created_at
     from bot_update_queue
     where guild_id = $1 and status = 'open'
     order by created_at asc
     limit 10`,
    [guildId]
  );
  return {
    success: true,
    items: result.rows.map(row => ({
      rowNumber: row.id,
      type: row.type,
      createdAt: row.created_at
    }))
  };
}

async function resolveBotQueue({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  const rowNumber = clean(params.rowNumber);
  if (!isUuid(rowNumber)) return { success: true };
  await query(
    `update bot_update_queue
     set status = 'done', resolved_at = now()
     where guild_id = $1 and id = $2`,
    [guildId, rowNumber]
  );
  return { success: true };
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
  const externalRaidId = clean(params.raidId || params.RaidID || params.raidID);
  const prioPin = clean(params.raidPin || params.prioPin || params.PrioPIN || params.playerLinkPin);
  const p0Plus = clean(params.p0Plus).toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("begin");

    let raidResult;
    if (externalRaidId) {
      raidResult = await client.query(
        `update raids
         set name = coalesce(nullif($3, ''), name),
             raid_pin = coalesce(nullif($4, ''), raid_pin),
             raid_time = coalesce(nullif($5, ''), raid_time),
             guild_name = coalesce(nullif($6, ''), guild_name),
             p0plus_freigabe = coalesce(nullif($7, ''), p0plus_freigabe),
             updated_at = now()
         where guild_id = $1
           and (external_raid_id = $2 or id::text = $2)
         returning id, external_raid_id, name, raid_type, raid_date, status`,
        [
          guildId,
          externalRaidId,
          raidName,
          prioPin || "",
          clean(params.raidTime || params.uhrzeit),
          clean(params.guild || params.gilde),
          clean(params.p0PlusFreigabe || params.p0PlusOverride)
        ]
      );
    }

    if ((!raidResult || !raidResult.rows.length) && prioPin) {
      raidResult = await client.query(
        `update raids
         set name = coalesce(nullif($3, ''), name),
             raid_pin = coalesce(nullif($4, ''), raid_pin),
             raid_time = coalesce(nullif($5, ''), raid_time),
             guild_name = coalesce(nullif($6, ''), guild_name),
             p0plus_freigabe = coalesce(nullif($7, ''), p0plus_freigabe),
             updated_at = now()
         where guild_id = $1
           and raid_pin = $2
           and lower(raid_type) = any($8)
         returning id, external_raid_id, name, raid_type, raid_date, status`,
        [
          guildId,
          prioPin,
          raidName,
          prioPin || "",
          clean(params.raidTime || params.uhrzeit),
          clean(params.guild || params.gilde),
          clean(params.p0PlusFreigabe || params.p0PlusOverride),
          raidTypeSearchValues(raidType)
        ]
      );
    }

    if ((!raidResult || !raidResult.rows.length) && prioPin) {
      raidResult = await client.query(
        `update raids
         set name = coalesce(nullif($3, ''), name),
             raid_pin = coalesce(nullif($4, ''), raid_pin),
             raid_time = coalesce(nullif($5, ''), raid_time),
             guild_name = coalesce(nullif($6, ''), guild_name),
             p0plus_freigabe = coalesce(nullif($7, ''), p0plus_freigabe),
             updated_at = now()
         where guild_id = $1
           and raid_pin = $2
         returning id, external_raid_id, name, raid_type, raid_date, status`,
        [
          guildId,
          prioPin,
          raidName,
          prioPin || "",
          clean(params.raidTime || params.uhrzeit),
          clean(params.guild || params.gilde),
          clean(params.p0PlusFreigabe || params.p0PlusOverride)
        ]
      );
    }

    if (!raidResult || !raidResult.rows.length) {
      raidResult = await client.query(
        `insert into raids (
           guild_id, name, raid_type, raid_date, external_raid_id, raid_pin,
           raid_time, guild_name, p0plus_freigabe
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce(nullif($9, ''), 'geschlossen'))
         on conflict (guild_id, raid_type, raid_date) do update
           set name = excluded.name,
               external_raid_id = coalesce(excluded.external_raid_id, raids.external_raid_id),
               raid_pin = coalesce(excluded.raid_pin, raids.raid_pin),
               raid_time = coalesce(excluded.raid_time, raids.raid_time),
               guild_name = coalesce(excluded.guild_name, raids.guild_name),
               updated_at = now()
         returning id, external_raid_id, name, raid_type, raid_date, status`,
        [
          guildId,
          raidName,
          raidType,
          raidDate,
          externalRaidId || null,
          prioPin || null,
          clean(params.raidTime || params.uhrzeit) || null,
          clean(params.guild || params.gilde) || null,
          clean(params.p0PlusFreigabe || params.p0PlusOverride)
        ]
      );
    }

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
      raidId: raidResult.rows[0].external_raid_id || raidResult.rows[0].id
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

async function getGuildLeadershipOverview(guildId, params) {
  requireMasterCode(params.masterCode);

  const raidsResult = await query(
    `select r.*,
            (
              select count(*)
              from p0plus_points pp
              where pp.guild_id = r.guild_id
                and pp.source = 'Raidlead Transfer'
                and pp.note in (
                  concat('RaidID: ', coalesce(r.external_raid_id, r.id::text)),
                  concat('RaidID: ', r.id::text),
                  concat('RaidID: ', r.raid_pin)
                )
            ) as p0plus_transfer_count
     from raids r
     where r.guild_id = $1
     order by raid_date desc, coalesce(raid_time, '') desc, created_at desc`,
    [guildId]
  );

  const playersResult = await query(
    `select
       c.id,
       c.name,
       c.server,
       c.class_name,
       c.is_main,
       c.created_at,
       p.id as player_id,
       count(*) over (partition by p.id) as linked_characters,
       first_value(c.name) over (
         partition by p.id
         order by c.is_main desc, c.created_at asc
       ) as main_char
     from players p
     join characters c on c.player_id = p.id
     where p.guild_id = $1
     order by c.name asc`,
    [guildId]
  );

  return {
    success: true,
    raids: raidsResult.rows.map(normalizeRaidRow),
    players: playersResult.rows.map((row, index) => ({
      id: row.id,
      rowNumber: index + 1,
      char: row.name,
      name: row.name,
      server: row.server,
      className: row.class_name,
      Klasse: row.class_name,
      mainChar: row.main_char || row.name,
      linkedCharacters: Number(row.linked_characters || 1),
      createdAt: row.created_at
    }))
  };
}

function normalizeIssueReportRow(row, index = 0) {
  return {
    id: row.id,
    rowNumber: row.id,
    number: index + 1,
    time: row.created_at ? row.created_at.toISOString() : "",
    type: row.type || "",
    source: row.source || "",
    category: row.category || "",
    raid: row.raid || "",
    item: row.item || "",
    slot: row.slot || "",
    points: row.points || "",
    player: row.player || "",
    server: row.server || "",
    note: row.note || "",
    page: row.page || "",
    originalDate: row.original_date || ""
  };
}

async function reportIssue({ guildId, query: params }) {
  let reportPlayer = clean(params.player || params.char || params.spieler);
  let reportServer = clean(params.server);
  if (!reportPlayer) {
    const pin = params.playerPin || params.characterPin || params.pin;
    if (pin) {
      const characters = await getCharactersByPin(guildId, pin);
      const character = characters[0] || null;
      if (character) {
        reportPlayer = clean(character.name);
        reportServer = clean(character.server);
      }
    }
  }

  const result = await query(
    `insert into issue_reports (
       guild_id, type, source, category, raid, item, slot, points,
       player, server, note, page, original_date
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     returning *`,
    [
      guildId,
      clean(params.type),
      clean(params.source),
      clean(params.category),
      clean(params.raid),
      clean(params.item),
      clean(params.slot),
      clean(params.points),
      reportPlayer,
      reportServer,
      clean(params.note),
      clean(params.page),
      clean(params.createdAt || params.originalDate)
    ]
  );
  return { success: true, report: normalizeIssueReportRow(result.rows[0]) };
}

async function getIssueReports({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const result = await query(
    `select *
     from issue_reports
     where guild_id = $1 and resolved_at is null
     order by created_at desc`,
    [guildId]
  );
  return { success: true, reports: result.rows.map(normalizeIssueReportRow) };
}

async function resolveIssueReport({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const id = clean(params.id || params.rowNumber);
  const result = await query(
    `update issue_reports
     set resolved_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [guildId, id]
  );

  let notified = false;
  let notificationError = "";
  const report = result.rows[0] || null;

  if (report && report.player) {
    try {
      const player = await findPlayerByRecipient(guildId, report.player, report.server);
      if (player) {
        const playerName = clean(player.main_name || player.character_name || report.player) || "Spieler";
        const bodyParts = [
          `Lieber ${playerName},`,
          "",
          "vielen Dank für deine Mithilfe, das Item wurde geändert.",
          "",
          "LG"
        ];

        await query(
          `insert into player_messages (
             guild_id, player_pin, title, body, raid_name, sender
           )
           values ($1,$2,$3,$4,$5,$6)`,
          [
            guildId,
            player.player_pin,
            "Item wurde geändert",
            bodyParts.join("\n"),
            report.raid || "",
            "Gildenleitung"
          ]
        );
        notified = true;
      } else {
        notificationError = "Spieler/Charakter wurde nicht gefunden.";
      }
    } catch (error) {
      notificationError = error.message || "Spieler konnte nicht benachrichtigt werden.";
    }
  } else if (report) {
    notificationError = "Kein Spieler in der Meldung.";
  }

  return { success: true, resolved: result.rowCount, notified, notificationError };
}

function normalizePlayerMessageRow(row) {
  const raidDate = row.raid_date ? row.raid_date.toISOString().slice(0, 10) : "";
  return {
    id: row.id,
    playerPin: row.player_pin || "",
    recipientNames: row.recipient_names || "",
    title: row.title || "",
    body: row.body || "",
    raidId: row.raid_id || "",
    raidName: row.raid_name || "",
    raidDate,
    raidTime: row.raid_time || "",
    leadPin: row.lead_pin || "",
    sender: row.sender_display || row.sender || "",
    createdAt: row.created_at,
    readAt: row.read_at,
    read: Boolean(row.read_at)
  };
}

async function sendPlayerMessage({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const recipient = clean(params.recipient || params.character || params.char || params.player || params.playerPin || params.pin);
  if (!recipient) {
    const error = new Error("Bitte Empfänger angeben.");
    error.statusCode = 400;
    throw error;
  }

  const player = await findPlayerByRecipient(guildId, recipient, params.server);
  if (!player) {
    const error = new Error("Dieser Spieler/Charakter wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const result = await query(
    `insert into player_messages (
       guild_id, player_pin, title, body, raid_id, raid_name,
       raid_date, raid_time, lead_pin, sender
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      guildId,
      player.player_pin,
      clean(params.title) || "Raidlead-PIN",
      clean(params.body) || "Du wurdest als Raidlead eingetragen.",
      clean(params.raidId),
      clean(params.raidName),
      parseDateValue(params.raidDate || params.date || null),
      clean(params.raidTime || params.time),
      clean(params.leadPin),
      clean(params.sender) || "Gildenleitung"
    ]
  );
  return { success: true, message: normalizePlayerMessageRow(result.rows[0]) };
}

async function sendPlayerMessageFromPlayer({ guildId, query: params }) {
  const senderPin = normalizePin(params.fromPlayerPin || params.senderPin || params.fromPin);
  const recipient = clean(params.recipient || params.character || params.char || params.player || params.toPlayerPin || params.playerPin || params.pin);
  const body = clean(params.body || params.message);
  if (!senderPin || !recipient || !body) {
    const error = new Error("Bitte Absender, Empfänger und Nachricht angeben.");
    error.statusCode = 400;
    throw error;
  }

  const sender = await findPlayerByPin(guildId, senderPin);
  if (!sender) {
    const error = new Error("Dein SpielerLogin wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  const senderName =
    await getVerifiedSenderCharacterName(guildId, senderPin, params.senderCharacter || params.senderChar, params.senderServer) ||
    await getPlayerDisplayNameByPin(guildId, senderPin) ||
    "Spieler";

  const recipientPlayer = await findPlayerByRecipient(guildId, recipient, params.server);
  if (!recipientPlayer) {
    const error = new Error("Empfänger wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const result = await query(
    `insert into player_messages (
       guild_id, player_pin, title, body, raid_id, raid_name,
       raid_date, raid_time, lead_pin, sender
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      guildId,
      recipientPlayer.player_pin,
      clean(params.title) || "Nachricht",
      body,
      clean(params.raidId),
      clean(params.raidName),
      parseDateValue(params.raidDate || params.date || null),
      clean(params.raidTime || params.time),
      clean(params.leadPin),
      senderName
    ]
  );
  return { success: true, message: normalizePlayerMessageRow(result.rows[0]) };
}

async function getPlayerMessages({ guildId, query: params }) {
  const playerPin = normalizePin(params.playerPin || params.pin);
  if (!playerPin) {
    const error = new Error("Bitte SpielerLogin eingeben.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `select pm.*,
            coalesce((
              select string_agg(c.name, ', ' order by c.name)
              from players p
              join characters c on c.player_id = p.id
              where p.guild_id = pm.guild_id and p.player_pin = pm.player_pin
            ), '') as recipient_names,
            coalesce((
              select coalesce((
                select c.name
                from characters c
                where c.player_id = p.id
                order by c.is_main desc, c.created_at asc
                limit 1
              ), p.player_pin)
              from players p
              where p.guild_id = pm.guild_id
                and p.player_pin = substring(pm.sender from '^Spieler (.+)$')
              limit 1
            ), pm.sender) as sender_display
     from player_messages pm
     where pm.guild_id = $1 and pm.player_pin = $2
     order by created_at desc
     limit 50`,
    [guildId, playerPin]
  );
  return { success: true, messages: result.rows.map(normalizePlayerMessageRow) };
}

async function getPlayerSentMessages({ guildId, query: params }) {
  const playerPin = normalizePin(params.playerPin || params.pin);
  if (!playerPin) {
    const error = new Error("Bitte SpielerLogin eingeben.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `select pm.*,
            coalesce((
              select string_agg(c.name, ', ' order by c.name)
              from players p
              join characters c on c.player_id = p.id
              where p.guild_id = pm.guild_id and p.player_pin = pm.player_pin
            ), '') as recipient_names
     from player_messages pm
     where pm.guild_id = $1
       and (
         pm.sender = $2
         or pm.sender = any(
           select c.name
           from players p
           join characters c on c.player_id = p.id
           where p.guild_id = pm.guild_id and p.player_pin = $3
         )
       )
     order by pm.created_at desc
     limit 50`,
    [guildId, `Spieler ${playerPin}`, playerPin]
  );
  return { success: true, messages: result.rows.map(normalizePlayerMessageRow) };
}

async function getGuildSentMessages({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const result = await query(
    `select pm.*,
            coalesce((
              select string_agg(c.name, ', ' order by c.name)
              from players p
              join characters c on c.player_id = p.id
              where p.guild_id = pm.guild_id and p.player_pin = pm.player_pin
            ), '') as recipient_names
     from player_messages pm
     where pm.guild_id = $1
       and pm.sender = 'Gildenleitung'
       and coalesce(pm.lead_pin, '') <> ''
     order by pm.created_at desc
     limit 100`,
    [guildId]
  );
  return { success: true, messages: result.rows.map(normalizePlayerMessageRow) };
}

async function markPlayerMessageRead({ guildId, query: params }) {
  const playerPin = normalizePin(params.playerPin || params.pin);
  const id = clean(params.id || params.messageId);
  const result = await query(
    `update player_messages
     set read_at = coalesce(read_at, now())
     where guild_id = $1 and player_pin = $2 and id = $3
     returning *`,
    [guildId, playerPin, id]
  );
  return { success: true, message: result.rows[0] ? normalizePlayerMessageRow(result.rows[0]) : null };
}

async function deletePlayerMessage({ guildId, query: params }) {
  const playerPin = normalizePin(params.playerPin || params.pin);
  const id = clean(params.id || params.messageId);
  const folder = clean(params.folder || params.box);
  if (!playerPin || !id) {
    const error = new Error("Bitte SpielerLogin und Nachricht angeben.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `delete from player_messages
     where guild_id = $1
       and id = $2
       and (
         player_pin = $3
         or (
           $4 = 'sent'
           and (
             sender = $5
             or sender = any(
               select c.name
               from players p
               join characters c on c.player_id = p.id
               where p.guild_id = player_messages.guild_id and p.player_pin = $3
             )
           )
         )
       )
     returning id`,
    [guildId, id, playerPin, folder, `Spieler ${playerPin}`]
  );
  return { success: true, deleted: result.rowCount };
}

async function deleteGuildPlayerMessage({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const id = clean(params.id || params.messageId);
  if (!id) {
    const error = new Error("Bitte Nachricht angeben.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `delete from player_messages
     where guild_id = $1
       and id = $2
       and sender = 'Gildenleitung'
     returning id`,
    [guildId, id]
  );
  return { success: true, deleted: result.rowCount };
}

async function deleteRaid({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const raidId = clean(params.raidId || params.RaidID || params.raidID);
  const id = clean(params.id || params.dbId || params.databaseId);
  const prioPin = clean(params.playerPin || params.prioPin || params.raidPin);
  const leadPin = clean(params.leadPin || params.raidleadPin);
  const values = [guildId];
  const clauses = [];

  if (id) {
    values.push(id);
    clauses.push(`id::text = $${values.length}`);
  }

  if (raidId) {
    values.push(raidId);
    clauses.push(`external_raid_id = $${values.length}`);
    if (isUuid(raidId)) {
      clauses.push(`id::text = $${values.length}`);
    }
  }

  if (prioPin) {
    values.push(prioPin);
    clauses.push(`raid_pin = $${values.length}`);
  }

  if (leadPin) {
    values.push(leadPin);
    clauses.push(`lead_pin = $${values.length}`);
  }

  if (!clauses.length) {
    const error = new Error("Bitte Raid angeben.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `delete from raids
     where guild_id = $1
       and (${clauses.join(" or ")})
     returning id, external_raid_id, name`,
    values
  );
  return { success: true, deleted: result.rowCount, raid: result.rows[0] || null };
}

async function createRaid({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  return createRaidRecord({ guildId, query: params });
}

async function createRandomRaid({ guildId, query: params }) {
  const raidType = normalizeRaidType(params.raid || params.raidName);
  const allowedRaids = new Set(["mc", "bwl", "aq40", "naxx", "zg", "aq20", "ony"]);
  if (!allowedRaids.has(raidType)) {
    const error = new Error("Dieser Raidtyp kann nicht erstellt werden.");
    error.statusCode = 400;
    throw error;
  }

  const prioPin = clean(params.playerPin || params.prioPin || params.raidPin);
  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!prioPin || !leadPin) {
    const error = new Error("PrioPIN oder LeadPIN fehlt.");
    error.statusCode = 400;
    throw error;
  }

  return createRaidRecord({
    guildId,
    query: {
      ...params,
      raid: raidType,
      status: "geöffnet",
      p0PlusFreigabe: "geöffnet"
    }
  });
}

async function createRaidRecord({ guildId, query: params }) {
  const raidType = normalizeRaidType(params.raid || params.raidName);
  const raidDate = parseDateValue(params.raidDate || params.datum || params.date);
  const raidName = clean(params.raidName) || displayRaidName(raidType);
  const externalRaidId = clean(params.raidId || params.RaidID || params.raidID) || `${raidType}-${Date.now()}`;
  const prioPin = clean(params.playerPin || params.prioPin || params.raidPin);
  const leadPin = clean(params.leadPin || params.raidleadPin);
  const status = normalizeStatus(params.status || "geöffnet");
  const p0plusFreigabe = normalizeStatus(params.p0PlusFreigabe || params.p0PlusOverride || "geöffnet");

  const result = await query(
    `insert into raids (
       guild_id, name, raid_type, raid_date, external_raid_id, raid_pin,
       lead_pin, raid_time, guild_name, player_link, status, p0plus_freigabe
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (guild_id, raid_type, raid_date) do update
       set name = excluded.name,
           external_raid_id = coalesce(excluded.external_raid_id, raids.external_raid_id),
           raid_pin = coalesce(excluded.raid_pin, raids.raid_pin),
           lead_pin = coalesce(excluded.lead_pin, raids.lead_pin),
           raid_time = coalesce(excluded.raid_time, raids.raid_time),
           guild_name = coalesce(excluded.guild_name, raids.guild_name),
           player_link = coalesce(excluded.player_link, raids.player_link),
           status = excluded.status,
           p0plus_freigabe = excluded.p0plus_freigabe,
           updated_at = now()
     returning *`,
    [
      guildId,
      raidName,
      raidType,
      raidDate,
      externalRaidId,
      prioPin || null,
      leadPin || null,
      clean(params.raidTime || params.uhrzeit) || null,
      clean(params.guild || params.gilde) || null,
      clean(params.playerLink) || null,
      status,
      p0plusFreigabe
    ]
  );

  return { success: true, ...normalizeRaidRow(result.rows[0]) };
}

async function findRaid(guildId, params) {
  const raidId = clean(params.raidId || params.RaidID || params.raidID);
  const leadPin = clean(params.leadPin || params.raidleadPin);
  const prioPin = clean(params.playerPin || params.prioPin || params.raidPin);
  const raidType = normalizeRaidType(params.raid || params.raidName);
  const values = [guildId];
  const identityClauses = [];

  if (raidId) {
    values.push(raidId);
    if (isUuid(raidId)) {
      identityClauses.push(`id = $${values.length}`);
    } else {
      identityClauses.push(`external_raid_id = $${values.length}`);
    }
  }

  if (leadPin) {
    values.push(leadPin);
    identityClauses.push(`lead_pin = $${values.length}`);
  }

  if (prioPin) {
    values.push(prioPin);
    identityClauses.push(`raid_pin = $${values.length}`);
  }

  if (!identityClauses.length && raidType) {
    values.push(raidTypeSearchValues(raidType));
    identityClauses.push(`lower(raid_type) = any($${values.length})`);
  }

  const clauses = ["guild_id = $1"];
  if (identityClauses.length) clauses.push(`(${identityClauses.join(" or ")})`);
  if (raidType && (leadPin || prioPin) && !raidId) {
    values.push(raidTypeSearchValues(raidType));
    clauses.push(`lower(raid_type) = any($${values.length})`);
  }

  let result = await query(
    `select *
     from raids
     where ${clauses.join(" and ")}
     order by raid_date desc, created_at desc
     limit 1`,
    values
  );

  if (!result.rows.length && prioPin) {
    result = await query(
      `select *
       from raids
       where guild_id = $1
         and raid_pin = $2
       order by raid_date desc, created_at desc
       limit 1`,
      [guildId, prioPin]
    );
  }

  return result.rows[0] || null;
}

async function getPublishedPrios({ guildId, query: params }) {
  const raid = await findRaid(guildId, params);
  if (!raid) {
    return { success: true, prios: [], published: false, status: "geschlossen" };
  }

  const result = await query(
    `select
       pr.id,
       pr.comment,
       pr.bench,
       c.name as player,
       c.server,
       c.class_name,
       i1.name as p1,
       i2.name as p2,
       i3.name as p3
     from prios pr
     join characters c on c.id = pr.character_id
     left join items i1 on i1.id = pr.p1_item_id
     left join items i2 on i2.id = pr.p2_item_id
     left join items i3 on i3.id = pr.p3_item_id
     where pr.raid_id = $1
     order by c.class_name asc, c.name asc`,
    [raid.id]
  );

  const normalizedRaid = normalizeRaidRow(raid);
  const transferResult = await query(
    `select count(*)::int as count
     from p0plus_points
     where guild_id = $1
       and source = 'Raidlead Transfer'
       and note in ($2, $3, $4)`,
    [guildId, `RaidID: ${raidPublicId(raid)}`, `RaidID: ${raid.id}`, `RaidID: ${raid.raid_pin}`]
  );
  const p0PlusTransferCount = Number(transferResult.rows[0]?.count || 0);
  const raidStatus = normalizeStatus(raid.status);
  const published = ["geöffnet", "veröffentlicht", "published"].includes(raidStatus.toLowerCase());
  return {
    success: true,
    ...normalizedRaid,
    p0PlusTransferred: p0PlusTransferCount > 0,
    p0PlusTransferCount,
    published,
    open: raidStatus !== "geöffnet" && !published,
    prios: result.rows.map((row, index) => {
      const meta = commentMeta(row.comment);
      return {
        id: row.id,
        rowNumber: index + 1,
        Spieler: row.player,
        player: row.player,
        Server: row.server || "",
        server: row.server || "",
        Klasse: row.class_name || "",
        className: row.class_name || "",
        P1: row.p1 || "",
        p1: row.p1 || "",
        P2: row.p2 || "",
        p2: row.p2 || "",
        P3: row.p3 || "",
        p3: row.p3 || "",
        P0Plus: meta.p0Plus || "nein",
        p0Plus: meta.p0Plus || "nein",
        Bench: row.bench || "",
        bench: row.bench || ""
      };
    })
  };
}

async function validateLeadPin({ guildId, query: params }) {
  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!leadPin) {
    return { success: false, error: "Falsche Raidlead-PIN." };
  }

  const result = await query(
    `select *
     from raids
     where guild_id = $1
       and lower(lead_pin) = lower($2)
     order by raid_date desc, created_at desc
     limit 1`,
    [guildId, leadPin]
  );
  const raid = result.rows[0] || null;

  if (!raid || !clean(raid.lead_pin)) {
    return { success: false, error: "Falsche Raidlead-PIN." };
  }

  return { success: true, ...normalizeRaidRow(raid) };
}

async function findRaidByPrioPin({ guildId, query: params }) {
  const prioPin = clean(params.playerPin || params.prioPin || params.raidPin || params.pin);
  if (!prioPin) {
    return { success: false, error: "Bitte Random PrioPIN eingeben." };
  }

  const raid = await findRaid(guildId, { playerPin: prioPin });
  if (!raid || !clean(raid.raid_pin)) {
    return { success: false, error: "Kein Raid zu dieser Random PrioPIN gefunden." };
  }

  return { success: true, ...normalizeRaidRow(raid) };
}

async function setRaidStatus({ guildId, query: params }) {
  const master = clean(params.masterCode);
  if (master) requireMasterCode(master);

  const raid = await findRaid(guildId, params);
  if (!raid) {
    const error = new Error("Raid wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!master && raid.lead_pin && leadPin !== raid.lead_pin) {
    const error = new Error("LeadPIN passt nicht zu diesem Raid.");
    error.statusCode = 403;
    throw error;
  }

  const status = normalizeStatus(params.status || raid.status);
  const p0plus = clean(params.p0PlusFreigabe || params.p0PlusOverride || params.value)
    ? normalizeStatus(params.p0PlusFreigabe || params.p0PlusOverride || params.value)
    : raid.p0plus_freigabe;

  const result = await query(
    `update raids
     set status = $1,
         p0plus_freigabe = $2,
         updated_at = now()
     where id = $3
     returning *`,
    [status, p0plus, raid.id]
  );

  return { success: true, ...normalizeRaidRow(result.rows[0]) };
}

async function setP0PlusOverride({ guildId, query: params }) {
  const enabled = ["true", "ja", "1", "geöffnet", "offen"].includes(clean(params.enabled || params.value).toLowerCase());
  return setRaidStatus({
    guildId,
    query: {
      ...params,
      status: params.status || undefined,
      p0PlusFreigabe: enabled ? "geöffnet" : "geschlossen"
    }
  });
}

async function findPrioForRaidAndPlayer(raidId, player, server) {
  const values = [raidId, clean(player)];
  let serverClause = "";
  if (clean(server)) {
    values.push(clean(server));
    serverClause = `and lower(c.server) = lower($${values.length})`;
  }

  const result = await query(
    `select
       pr.id,
       pr.character_id,
       pr.p1_item_id,
       c.name as player,
       c.server
     from prios pr
     join characters c on c.id = pr.character_id
     where pr.raid_id = $1
       and lower(c.name) = lower($2)
       ${serverClause}
     limit 1`,
    values
  );
  return result.rows[0] || null;
}

async function setPrioBench({ guildId, query: params }) {
  const master = clean(params.masterCode);
  if (master) requireMasterCode(master);

  const raid = await findRaid(guildId, params);
  if (!raid) {
    const error = new Error("Raid wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!master && raid.lead_pin && leadPin !== raid.lead_pin) {
    const error = new Error("LeadPIN passt nicht zu diesem Raid.");
    error.statusCode = 403;
    throw error;
  }

  const prio = await findPrioForRaidAndPlayer(raid.id, params.player || params.char || params.spieler, params.server);
  if (!prio) {
    const error = new Error("Prio wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const bench = ["ja", "true", "1", "bench"].includes(clean(params.bench).toLowerCase()) ? "ja" : "";
  const note = `Bench RaidID: ${raidPublicId(raid)}`;
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("update prios set bench = $1, updated_at = now() where id = $2", [bench, prio.id]);

    if (prio.p1_item_id) {
      await client.query(
        `delete from p0plus_points
         where guild_id = $1 and character_id = $2 and item_id = $3 and source = 'Bench' and note = $4`,
        [guildId, prio.character_id, prio.p1_item_id, note]
      );

      if (bench) {
        await client.query(
          `insert into p0plus_points (guild_id, character_id, item_id, points, source, note)
           values ($1, $2, $3, 0.5, 'Bench', $4)`,
          [guildId, prio.character_id, prio.p1_item_id, note]
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { success: true, bench, player: prio.player, server: prio.server };
}

async function deleteGuildPrio({ guildId, query: params }) {
  const master = clean(params.masterCode);
  if (master) requireMasterCode(master);

  const raid = await findRaid(guildId, params);
  if (!raid) {
    const error = new Error("Raid wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!master && raid.lead_pin && leadPin !== raid.lead_pin) {
    const error = new Error("LeadPIN passt nicht zu diesem Raid.");
    error.statusCode = 403;
    throw error;
  }

  const prio = await findPrioForRaidAndPlayer(raid.id, params.player || params.char || params.spieler, params.server);
  if (!prio) return { success: true, deleted: 0 };

  const result = await query("delete from prios where id = $1 returning id", [prio.id]);
  return { success: true, deleted: result.rowCount };
}

async function getP0Plus(guildId) {
  const result = await query(
    `select
       coalesce(i.raid_type, 'Raid') as raid,
       coalesce(i.name, pp.note, 'P0/P0+') as item,
       coalesce(i.quality, '') as quality,
       c.name as player,
       c.server,
       pp.points,
       pp.source,
       pp.note,
       pp.created_at
     from p0plus_points pp
     join characters c on c.id = pp.character_id
     left join items i on i.id = pp.item_id
     where pp.guild_id = $1
     order by raid asc, item asc, player asc`,
    [guildId]
  );

  const grouped = new Map();
  result.rows.forEach(row => {
    const key = [
      clean(row.raid).toLowerCase(),
      clean(row.item).toLowerCase(),
      clean(row.player).toLowerCase(),
      clean(row.server).toLowerCase()
    ].join("|");
    const current = grouped.get(key) || {
      raid: row.raid,
      item: row.item,
      quality: row.quality || "",
      player: row.player,
      server: row.server || "",
      slot: readSlotFromNote(row.note),
      count: 0,
      points: 0,
      source: row.source || "",
      createdAt: row.created_at
    };
    const points = Number(row.points) || 0;
    current.count += points;
    current.points += points;
    grouped.set(key, current);
  });

  return { success: true, entries: Array.from(grouped.values()).filter(entry => Number(entry.count) > 0) };
}

async function getRaidP0PlusAudit({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const raidType = normalizeRaidType(params.raid || "aq40");
  const date = clean(params.date);
  const values = [guildId, raidTypeSearchValues(raidType)];
  let dateClause = "";

  if (date) {
    values.push(date);
    dateClause = `and (r.raid_date = $${values.length}::date or pr.created_at::date = $${values.length}::date)`;
  }

  const priosResult = await query(
    `select
       r.external_raid_id,
       r.raid_type,
       r.name as raid_name,
       r.raid_date,
       r.raid_time,
       r.raid_pin,
       r.status,
       r.created_at as raid_created_at,
       pr.comment,
       pr.created_at as prio_created_at,
       c.name as player,
       c.server,
       c.class_name,
       i1.name as p1,
       i2.name as p2,
       i3.name as p3
     from prios pr
     join raids r on r.id = pr.raid_id
     join characters c on c.id = pr.character_id
     left join items i1 on i1.id = pr.p1_item_id
     left join items i2 on i2.id = pr.p2_item_id
     left join items i3 on i3.id = pr.p3_item_id
     where r.guild_id = $1
       and lower(r.raid_type) = any($2)
       ${dateClause}
     order by r.raid_date desc nulls last, r.created_at desc, c.name asc`,
    values
  );

  const transferValues = [guildId, raidTypeSearchValues(raidType)];
  let transferDateClause = "";
  if (date) {
    transferValues.push(date);
    transferDateClause = `and pp.created_at::date = $${transferValues.length}::date`;
  }
  const transferResult = await query(
    `select
       pp.points,
       pp.source,
       pp.note,
       pp.created_at,
       c.name as player,
       c.server,
       i.name as item,
       i.raid_type
     from p0plus_points pp
     join characters c on c.id = pp.character_id
     left join items i on i.id = pp.item_id
     where pp.guild_id = $1
       and pp.source = 'Raidlead Transfer'
       and lower(coalesce(i.raid_type, '')) = any($2)
       ${transferDateClause}
     order by pp.created_at desc, c.name asc`,
    transferValues
  );

  const prios = priosResult.rows.map(row => {
    const meta = commentMeta(row.comment);
    return {
      raidId: row.external_raid_id || "",
      raid: row.raid_type || "",
      raidName: row.raid_name || "",
      raidDate: row.raid_date || "",
      raidTime: row.raid_time || "",
      raidPin: row.raid_pin || "",
      status: row.status || "",
      player: row.player || "",
      server: row.server || "",
      className: row.class_name || "",
      p1: row.p1 || "",
      p2: row.p2 || "",
      p3: row.p3 || "",
      p0Plus: meta.p0Plus || "nein",
      p0Item: meta.p0Item || "",
      prioCreatedAt: row.prio_created_at,
      raidCreatedAt: row.raid_created_at
    };
  });

  const transfers = transferResult.rows.map(row => ({
    player: row.player || "",
    server: row.server || "",
    item: row.item || "",
    points: Number(row.points || 0),
    note: row.note || "",
    createdAt: row.created_at
  }));

  return {
    success: true,
    raid: raidType,
    date,
    prios,
    p0PlusPrios: prios.filter(row => normalizeStatus(row.p0Plus) === "ja"),
    transfers
  };
}

async function findCharacterByName(guildId, charName, server) {
  const params = [guildId, clean(charName)];
  let serverClause = "";
  if (clean(server)) {
    params.push(clean(server));
    serverClause = `and lower(c.server) = lower($${params.length})`;
  }

  const result = await query(
    `select c.id, c.name, c.server, c.class_name
     from characters c
     join players p on p.id = c.player_id
     where p.guild_id = $1 and lower(c.name) = lower($2)
       ${serverClause}
     order by c.created_at asc
     limit 1`,
    params
  );
  return result.rows[0] || null;
}

async function setP0PlusPoints({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const raidType = normalizeRaidType(params.raid);
  const player = clean(params.player || params.char || params.spieler);
  const server = clean(params.server);
  const itemName = clean(params.item);
  const slot = clean(params.slot);
  const points = Number(String(params.points || "0").replace(",", "."));

  if (!raidType || !player || !itemName || !Number.isFinite(points) || points < 0) {
    const error = new Error("Raid, Spieler, Item und Punkte werden benötigt.");
    error.statusCode = 400;
    throw error;
  }

  const character = await findCharacterByName(guildId, player, server);
  if (!character) {
    const error = new Error("Dieser Charakter wurde in Railway nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const item = await upsertItem(client, raidType, itemName);

    await client.query(
      `delete from p0plus_points
       where guild_id = $1 and character_id = $2 and item_id = $3`,
      [guildId, character.id, item.id]
    );

    if (points > 0) {
      await client.query(
        `insert into p0plus_points (guild_id, character_id, item_id, points, source, note)
         values ($1, $2, $3, $4, $5, $6)`,
        [guildId, character.id, item.id, points, "Gildenleitung", slot ? `Slot: ${slot}` : ""]
      );
    }

    await client.query("commit");
    return { success: true, deleted: points === 0, raid: raidType, player, item: itemName, slot, count: points, points };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function clearP0PlusForPlayer({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const raidType = normalizeRaidType(params.raid);
  const player = clean(params.player || params.char || params.spieler);
  const server = clean(params.server);
  const itemName = clean(params.item);
  const character = await findCharacterByName(guildId, player, server);

  if (!character) {
    const error = new Error("Dieser Charakter wurde in Railway nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const result = await query(
    `delete from p0plus_points pp
     using items i
     where pp.item_id = i.id
       and pp.guild_id = $1
       and pp.character_id = $2
       and i.raid_type = $3
       and lower(i.name) = lower($4)
     returning pp.id`,
    [guildId, character.id, raidType, itemName]
  );

  return { success: true, deleted: result.rowCount };
}

async function exportGuildBackup({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const [
    guildResult,
    settingsResult,
    playersResult,
    raidsResult,
    priosResult,
    p0plusResult,
    issueReportsResult,
    playerMessagesResult,
    hordenbuffEventsResult,
    hordenbuffEntriesResult
  ] = await Promise.all([
    query("select id, name, slug, created_at from guilds where id = $1", [guildId]),
    query("select * from guild_settings where guild_id = $1", [guildId]),
    query(
      `select
         p.id as player_id,
         p.player_pin,
         p.security_question,
         p.security_answer_hash,
         p.created_at as player_created_at,
         p.updated_at as player_updated_at,
         c.id as character_id,
         c.name as character_name,
         c.server,
         c.class_name,
         c.created_at as character_created_at,
         c.updated_at as character_updated_at
       from players p
       left join characters c on c.player_id = p.id
       where p.guild_id = $1
       order by p.created_at asc, c.created_at asc`,
      [guildId]
    ),
    query(
      `select *
       from raids
       where guild_id = $1
       order by raid_date asc, raid_time asc, created_at asc`,
      [guildId]
    ),
    query(
      `select
         pr.*,
         r.external_raid_id,
         r.raid_type,
         r.name as raid_name,
         r.raid_date,
         r.raid_time,
         r.raid_pin,
         r.lead_pin,
         c.name as player,
         c.server,
         c.class_name,
         i1.name as p1,
         i2.name as p2,
         i3.name as p3
       from prios pr
       join raids r on r.id = pr.raid_id
       join characters c on c.id = pr.character_id
       left join items i1 on i1.id = pr.p1_item_id
       left join items i2 on i2.id = pr.p2_item_id
       left join items i3 on i3.id = pr.p3_item_id
       where r.guild_id = $1
       order by r.raid_date asc, r.raid_time asc, c.name asc`,
      [guildId]
    ),
    query(
      `select
         pp.*,
         c.name as player,
         c.server,
         c.class_name,
         i.raid_type,
         i.name as item_name,
         i.quality
       from p0plus_points pp
       join characters c on c.id = pp.character_id
       left join items i on i.id = pp.item_id
       where pp.guild_id = $1
       order by pp.created_at asc`,
      [guildId]
    ),
    query("select * from issue_reports where guild_id = $1 order by created_at asc", [guildId]),
    query("select * from player_messages where guild_id = $1 order by created_at asc", [guildId]),
    query("select * from hordenbuff_events where guild_id = $1 order by event_date asc, event_time asc", [guildId]),
    query(
      `select he.*
       from hordenbuff_entries he
       join hordenbuff_events e on e.id = he.event_id
       where e.guild_id = $1
       order by e.event_date asc, e.event_time asc, he.created_at asc`,
      [guildId]
    )
  ]);

  return {
    success: true,
    exportedAt: new Date().toISOString(),
    version: 1,
    guild: guildResult.rows[0] || null,
    settings: settingsResult.rows[0] || null,
    playersAndCharacters: playersResult.rows,
    raids: raidsResult.rows,
    prios: priosResult.rows,
    p0plusPoints: p0plusResult.rows,
    issueReports: issueReportsResult.rows,
    playerMessages: playerMessagesResult.rows,
    hordenbuffEvents: hordenbuffEventsResult.rows,
    hordenbuffEntries: hordenbuffEntriesResult.rows
  };
}

async function transferP0PlusPoints({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const raidType = normalizeRaidType(params.raid);
  const raidId = clean(params.raidId);
  const values = [guildId, raidType];
  let raidClause = "r.guild_id = $1 and r.raid_type = $2";

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raidId)) {
    values.push(raidId);
    raidClause += ` and r.id = $${values.length}`;
  } else if (raidId) {
    values.push(raidId);
    raidClause += ` and (r.external_raid_id = $${values.length} or r.raid_pin = $${values.length})`;
  }

  const raidResult = await query(
    `select r.*
     from raids r
     where ${raidClause}
     order by r.raid_date desc, coalesce(r.raid_time, '') desc, r.created_at desc
     limit 1`,
    values
  );

  const raid = raidResult.rows[0];
  if (!raid) {
    const error = new Error("Raid wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const transferNote = `RaidID: ${raidPublicId(raid)}`;

  const priosResult = await query(
    `select
       pr.character_id,
       c.name as player,
       i.id as item_id,
       i.name as item_name,
       pr.comment
     from prios pr
     join raids r on r.id = pr.raid_id
     join characters c on c.id = pr.character_id
     join items i on i.id = pr.p1_item_id
     where ${raidClause}`,
    values
  );

  const candidates = priosResult.rows.filter(row => commentMeta(row.comment).p0Plus === "ja");
  const client = await pool.connect();

  try {
    await client.query("begin");
    for (const row of candidates) {
      await client.query(
        `delete from p0plus_points
         where guild_id = $1
           and character_id = $2
           and item_id = $3
           and source = 'Raidlead Transfer'
           and note = $4`,
        [guildId, row.character_id, row.item_id, transferNote]
      );
      await client.query(
        `insert into p0plus_points (guild_id, character_id, item_id, points, source, note)
         values ($1, $2, $3, 1, $4, $5)`,
        [guildId, row.character_id, row.item_id, "Raidlead Transfer", transferNote]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const transferResult = await query(
    `select count(*)::int as count
     from p0plus_points
     where guild_id = $1
       and source = 'Raidlead Transfer'
       and note = $2`,
    [guildId, transferNote]
  );
  const p0PlusTransferCount = Number(transferResult.rows[0]?.count || 0);

  return {
    success: true,
    awarded: candidates.length,
    candidates: candidates.length,
    p0PlusTransferred: p0PlusTransferCount > 0,
    p0PlusTransferCount
  };
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
    const action = clean(req.query.action);

    if (action === "listGuilds") {
      const guilds = await listGuilds();
      return res.json(guilds);
    }

    if (action === "createGuild") {
      const created = await createGuild({ query: req.query });
      return res.json(created);
    }

    if (action === "updateGuildConfig") {
      const saved = await updateGuildConfig({ query: req.query });
      return res.json(saved);
    }

    const guild = await requireGuild(resolveGuildSlug(req.query.guild));

    if (action === "getCharactersByPin") {
      const characters = await getCharactersByPin(guild.id, req.query.pin);
      return res.json({ success: true, guild: guild.slug, characters, entries: characters, chars: characters });
    }

    if (action === "getPlayerPrioHistory") {
      const history = await getPlayerPrioHistory(guild.id, req.query);
      return res.json({ ...history, guild: guild.slug });
    }

    if (action === "getGuildLeadershipOverview") {
      const overview = await getGuildLeadershipOverview(guild.id, req.query);
      return res.json({ ...overview, guild: guild.slug });
    }

    if (action === "getActiveRaids") {
      const today = new Date().toISOString().slice(0, 10);
      const result = await query(
        `select r.*,
                (
                  select count(*)
                  from p0plus_points pp
                  where pp.guild_id = r.guild_id
                    and pp.source = 'Raidlead Transfer'
                    and pp.note in (
                      concat('RaidID: ', coalesce(r.external_raid_id, r.id::text)),
                      concat('RaidID: ', r.id::text),
                      concat('RaidID: ', r.raid_pin)
                    )
                ) as p0plus_transfer_count
         from raids r
         where r.guild_id = $1
           and raid_date >= $2
           and coalesce(status, '') not in ('archiviert', 'archive')
         order by raid_date asc, coalesce(raid_time, '') asc, created_at asc`,
        [guild.id, today]
      );
      const raids = result.rows.map(row => {
        const raid = normalizeRaidRow(row);
        return { ...raid, leadPin: "", LeadPin: "" };
      });
      return res.json({ success: true, guild: guild.slug, raids, allRaids: raids, activeRaids: raids });
    }

    if (action === "guildExportBackup" || action === "exportGuildBackup") {
      const backup = await exportGuildBackup({ guildId: guild.id, query: req.query });
      return res.json({ ...backup, guild: guild.slug });
    }

    if (action === "reportIssue") {
      const report = await reportIssue({ guildId: guild.id, query: req.query });
      return res.json({ ...report, guild: guild.slug });
    }

    if (action === "guildGetIssueReports") {
      const reports = await getIssueReports({ guildId: guild.id, query: req.query });
      return res.json({ ...reports, guild: guild.slug });
    }

    if (action === "guildResolveIssueReport") {
      const resolved = await resolveIssueReport({ guildId: guild.id, query: req.query });
      return res.json({ ...resolved, guild: guild.slug });
    }

    if (action === "sendPlayerMessage") {
      const message = await sendPlayerMessage({ guildId: guild.id, query: req.query });
      return res.json({ ...message, guild: guild.slug });
    }

    if (action === "sendPlayerMessageFromPlayer" || action === "sendPlayerMessageAsPlayer") {
      const message = await sendPlayerMessageFromPlayer({ guildId: guild.id, query: req.query });
      return res.json({ ...message, guild: guild.slug });
    }

    if (action === "getPlayerMessages") {
      const messages = await getPlayerMessages({ guildId: guild.id, query: req.query });
      return res.json({ ...messages, guild: guild.slug });
    }

    if (action === "getPlayerSentMessages") {
      const messages = await getPlayerSentMessages({ guildId: guild.id, query: req.query });
      return res.json({ ...messages, guild: guild.slug });
    }

    if (action === "guildGetSentPlayerMessages") {
      const messages = await getGuildSentMessages({ guildId: guild.id, query: req.query });
      return res.json({ ...messages, guild: guild.slug });
    }

    if (action === "guildGetHordenbuffs" || action === "getPublicHordenbuffs") {
      const buffs = await getHordenbuffs({ guildId: guild.id, query: req.query });
      return res.json({ ...buffs, guild: guild.slug });
    }

    if (action === "lichtbotGetQueue") {
      const queue = await getBotQueue({ guildId: guild.id, query: req.query });
      return res.json({ ...queue, guild: guild.slug });
    }

    if (action === "markPlayerMessageRead") {
      const message = await markPlayerMessageRead({ guildId: guild.id, query: req.query });
      return res.json({ ...message, guild: guild.slug });
    }

    if (action === "deletePlayerMessage") {
      const deleted = await deletePlayerMessage({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildDeletePlayerMessage") {
      const deleted = await deleteGuildPlayerMessage({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "createRaid") {
      const created = await createRaid({ guildId: guild.id, query: req.query });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "createRandomRaid") {
      const created = await createRandomRaid({ guildId: guild.id, query: req.query });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "guildDeleteRaid" || action === "deleteRaid") {
      const deleted = await deleteRaid({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "getPublishedPrios") {
      const prios = await getPublishedPrios({ guildId: guild.id, query: req.query });
      return res.json({ ...prios, guild: guild.slug });
    }

    if (action === "findRaidByPrioPin") {
      const raid = await findRaidByPrioPin({ guildId: guild.id, query: req.query });
      return res.json({ ...raid, guild: guild.slug });
    }

    if (action === "validateLeadPin") {
      const raid = await validateLeadPin({ guildId: guild.id, query: req.query });
      return res.json({ ...raid, guild: guild.slug });
    }

    if (action === "savePrio") {
      const saved = await savePrio({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "deletePrio" || action === "deletePlayerPrio") {
      const deleted = await deletePrio({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildDeletePrio" || action === "deleteGuildPrio") {
      const deleted = await deleteGuildPrio({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildSetRaidStatus" || action === "setRaidStatus") {
      const saved = await setRaidStatus({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "setP0PlusOverride") {
      const saved = await setP0PlusOverride({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildSetPrioBench") {
      const saved = await setPrioBench({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "getP0Plus") {
      const points = await getP0Plus(guild.id);
      return res.json({ ...points, guild: guild.slug });
    }

    if (action === "getRaidP0PlusAudit") {
      const audit = await getRaidP0PlusAudit({ guildId: guild.id, query: req.query });
      return res.json({ ...audit, guild: guild.slug });
    }

    if (action === "guildSetP0PlusPoints") {
      const saved = await setP0PlusPoints({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "clearP0PlusForPlayer") {
      const cleared = await clearP0PlusForPlayer({ guildId: guild.id, query: req.query });
      return res.json({ ...cleared, guild: guild.slug });
    }

    if (action === "transferP0PlusPoints") {
      const transferred = await transferP0PlusPoints({ guildId: guild.id, query: req.query });
      return res.json({ ...transferred, guild: guild.slug });
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

app.post("/api/apps-script", async (req, res, next) => {
  try {
    const action = clean(req.body?.action || req.query?.action);

    if (action === "updateGuildConfig") {
      const saved = await updateGuildConfig({ query: req.query, body: req.body });
      return res.json(saved);
    }

    const postParams = { ...(req.query || {}), ...(req.body || {}) };
    const guild = await requireGuild(resolveGuildSlug(postParams.guild));

    if (action === "guildSetHordenbuffEntry" || action === "lichtbotSetHordenbuffEntry") {
      const saved = await setHordenbuffEntry({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildCreateBuffTerm") {
      const created = await createHordenbuffTerm({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "createRaid") {
      const created = await createRaid({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "createRandomRaid") {
      const created = await createRandomRaid({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "guildDeleteHordenbuffEntry" || action === "lichtbotDeleteHordenbuffEntry") {
      const deleted = await deleteHordenbuffEntry({ guildId: guild.id, query: postParams });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildQueueWorldbuffBotUpdate") {
      const queued = await queueBotUpdate({ guildId: guild.id, query: postParams });
      return res.json({ ...queued, guild: guild.slug });
    }

    if (action === "lichtbotResolveQueue") {
      const resolved = await resolveBotQueue({ guildId: guild.id, query: postParams });
      return res.json({ ...resolved, guild: guild.slug });
    }

    const error = new Error("Unbekannte POST-Aktion.");
    error.statusCode = 404;
    throw error;
  } catch (error) {
    next(error);
  }
});

app.get("/api/guilds/:guildSlug", async (req, res, next) => {
  try {
    const guild = await requireGuild(resolveGuildSlug(req.params.guildSlug));
    res.json({ success: true, guild });
  } catch (error) {
    next(error);
  }
});

app.get("/api/guilds/:guildSlug/characters", async (req, res, next) => {
  try {
    const guild = await requireGuild(resolveGuildSlug(req.params.guildSlug));
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
    const guild = await requireGuild(resolveGuildSlug(req.params.guildSlug));
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
    const guild = await requireGuild(resolveGuildSlug(req.params.guildSlug));
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
