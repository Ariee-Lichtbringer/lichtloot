import "dotenv/config";
import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool, query, requireGuild } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const defaultGuildSlug = process.env.DEFAULT_GUILD_SLUG || "lichtloot";
const masterCode = process.env.MASTER_CODE || "Lichtbringer-Master";
const lichtbotQueueToken = process.env.LICHTBOT_QUEUE_TOKEN || "";
const logAnalysisCallbackToken = process.env.LOG_ANALYSIS_CALLBACK_TOKEN || "";
const masterCodeOverrides = new Map();
const worldbuffPublicCsvUrl =
  process.env.WORLDBUFF_PUBLIC_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1eItzaMGhpJ28vv4sDA8wwmu0YhUxcbiz-2VLiCVyjv4/export?format=csv&gid=1498762908";
const worldbuffTickerCsvUrl =
  process.env.WORLDBUFF_TICKER_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/1o7fzOAn9wC0iWcauC3bDo2RYR8kZ1xQMjkvSi1lJG8Q/gviz/tq?tqx=out:csv&gid=0";
const warcraftLogsTokenCache = new Map();
const staticLootCache = new Map();
const STATIC_LOOT_CACHE_TTL_MS = 5 * 60 * 1000;
let rpbConfigAllCache = null;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/downloads", express.static("public/downloads"));
app.use(express.static("public"));

await loadMasterCodeOverrides().catch(error => {
  console.warn("Master-Code Overrides konnten nicht geladen werden:", error.message || error);
});

await ensureRaidCreatedByColumn().catch(error => {
  console.warn("Raid-Ersteller-Spalte konnte nicht vorbereitet werden:", error.message || error);
});

await ensureBuffTables().catch(error => {
  console.warn("Buff-Tabellen konnten nicht vorbereitet werden:", error.message || error);
});

await seedDefaultLootItemsOnce().catch(error => {
  console.warn("Standard-Lootdaten konnten nicht importiert werden:", error.message || error);
});

await ensureLootItemMetadataColumns().catch(error => {
  console.warn("Item-Metadaten-Spalten konnten nicht vorbereitet werden:", error.message || error);
});

await applyLootItemCorrectionsOnce().catch(error => {
  console.warn("Lootdaten-Korrekturen konnten nicht angewendet werden:", error.message || error);
});

await importLootItemMetadata().catch(error => {
  console.warn("Item-Metadaten konnten nicht nach Railway übertragen werden:", error.message || error);
});

await restoreLootItemsFromStaticDataOnce().catch(error => {
  console.warn("Lootdaten-Wiederherstellung konnte nicht angewendet werden:", error.message || error);
});

await applyLootRaidAssignmentCorrectionsOnce().catch(error => {
  console.warn("Loot-Raid-Zuordnungen konnten nicht korrigiert werden:", error.message || error);
});

await applyEterniumLockboxRaidItemsOnce().catch(error => {
  console.warn("Eterniumschließkassette konnte nicht für alle Raids ergänzt werden:", error.message || error);
});

app.get("/health", (req, res) => {
  res.json({ success: true, service: "lichtloot-api", build: "item-create-v2" });
});

app.get("/db-health", async (req, res, next) => {
  try {
    const result = await query("select now() as now");
    res.json({ success: true, now: result.rows[0].now });
  } catch (error) {
    next(error);
  }
});

app.get(["/sicherung", "/sicherung.html"], async (req, res, next) => {
  try {
    let html = "";
    try {
      html = await readFile(new URL("./sicherung.html", import.meta.url), "utf8");
    } catch {
      html = await readFile(new URL("../public/sicherung.html", import.meta.url), "utf8");
    }
    res.type("html").send(html);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const guild = await requireGuild(resolveGuildSlug(req.query.guild));
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
         and raid_date >= current_date - interval '1 day'
         and coalesce(status, '') not in ('archiviert', 'archive')
       order by
         case when raid_date >= current_date then 0 else 1 end,
         case when raid_date >= current_date then raid_date end asc,
         case when raid_date < current_date then raid_date end desc,
         coalesce(raid_time, '') asc,
         created_at desc
       limit 50`,
      [guild.id]
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

function itemKey(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/['’`´]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIconName(icon) {
  return clean(icon)
    .replace(/\.jpg$/i, "")
    .replace(/\.blp$/i, "")
    .replace(/^https:\/\/wow\.zamimg\.com\/images\/wow\/icons\/large\//i, "")
    .replace(/^Interface\\Icons\\/i, "")
    .replace(/^interface\\icons\\/i, "")
    .toLowerCase();
}

function toWarcraftLogsSlug(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function warcraftLogsBaseUrl() {
  return clean(process.env.WCL_BASE_URL || "https://vanilla.warcraftlogs.com").replace(/\/+$/g, "");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWarcraftLogsAccessToken() {
  const clientId = clean(process.env.WCL_CLIENT_ID);
  const clientSecret = clean(process.env.WCL_CLIENT_SECRET);
  const baseUrl = warcraftLogsBaseUrl();

  if (!clientId || !clientSecret) {
    const error = new Error("Warcraft-Logs-Zugang fehlt. Bitte WCL_CLIENT_ID und WCL_CLIENT_SECRET in Railway eintragen.");
    error.needsSetup = true;
    throw error;
  }

  const cached = warcraftLogsTokenCache.get(baseUrl);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "client_credentials" })
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Token konnte nicht geholt werden (${response.status}): ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("Warcraft Logs lieferte keinen Access Token.");

  warcraftLogsTokenCache.set(baseUrl, {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 120) * 1000
  });
  return data.access_token;
}

async function warcraftLogsGraphql(token, gqlQuery, variables = {}) {
  const baseUrl = warcraftLogsBaseUrl();
  let status = 0;
  let text = "";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v2/client`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: gqlQuery, variables })
    });
    status = response.status;
    text = await response.text();

    if (response.ok) break;
    if (![500, 502, 503, 504].includes(status) || attempt === 3) break;
    await sleep(700 * attempt);
  }

  if (status < 200 || status >= 300) {
    if (status === 502) {
      throw new Error("Warcraft Logs Vanilla antwortet gerade mit 502. Bitte in 1-2 Minuten erneut versuchen.");
    }
    throw new Error(`GraphQL HTTP ${status}: ${text}`);
  }

  const data = JSON.parse(text);
  if (data.errors?.length) {
    throw new Error(data.errors.map(error => error.message).join("; "));
  }

  return data.data || {};
}

async function fetchWarcraftLogsCharacter(token, character, serverSlug, region) {
  const gqlQuery =
    "query($name:String!,$serverSlug:String!,$serverRegion:String!){"+
    "characterData{"+
    "character(name:$name,serverSlug:$serverSlug,serverRegion:$serverRegion){"+
    "id name recentReports(limit:8){data{code title startTime}}"+
    "}"+
    "}"+
    "}";

  const data = await warcraftLogsGraphql(token, gqlQuery, {
    name: character,
    serverSlug,
    serverRegion: region
  });
  const found = data.characterData?.character;
  if (!found) throw new Error("Charakter wurde bei Warcraft Logs nicht gefunden.");
  return found;
}

async function fetchWarcraftLogsReportGear(token, reportCode, character, server) {
  const actorQuery =
    "query($code:String!){"+
    "reportData{report(code:$code){fights{ id name startTime endTime } masterData{actors{ id name server type subType }}}}"+
    "}";
  const actorData = await warcraftLogsGraphql(token, actorQuery, { code: reportCode });
  const report = actorData.reportData?.report || {};
  const actors = report.masterData?.actors || [];
  const actor =
    actors.find(actorRow =>
      itemKey(actorRow.name) === itemKey(character) &&
      (!server || itemKey(actorRow.server) === itemKey(server) || !actorRow.server)
    ) ||
    actors.find(actorRow => itemKey(actorRow.name) === itemKey(character));

  if (!actor?.id) return null;

  const fights = (report.fights || [])
    .filter(fight => Number(fight.id) && Number(fight.endTime) > Number(fight.startTime))
    .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0));
  if (!fights.length) return null;

  const eventQuery =
    "query($code:String!,$sourceID:Int!,$fightIDs:[Int]){"+
    "reportData{report(code:$code){events(dataType:CombatantInfo,sourceID:$sourceID,fightIDs:$fightIDs,limit:1){data}}}"+
    "}";

  for (const fight of fights) {
    const eventData = await warcraftLogsGraphql(token, eventQuery, {
      code: reportCode,
      sourceID: Number(actor.id),
      fightIDs: [Number(fight.id)]
    });
    const eventsRaw = eventData.reportData?.report?.events?.data || [];
    const events = typeof eventsRaw === "string" ? JSON.parse(eventsRaw) : eventsRaw;
    const combatantInfo = Array.isArray(events) ? events[0] : events;
    const items = normalizeWarcraftLogsGear(combatantInfo?.gear || []);
    const talents = normalizeWarcraftLogsTalents(combatantInfo);

    if (items.length) {
      return {
        items,
        className: actor.subType || actor.type || "",
        talents,
        rawTalents: combatantInfo?.talents || combatantInfo?.talentTree || combatantInfo?.specs || combatantInfo?.spec || null,
        rawStats: combatantInfo?.stats || combatantInfo?.expansion || null,
        fight: {
          id: fight.id,
          name: fight.name || "",
          startTime: fight.startTime || "",
          endTime: fight.endTime || ""
        }
      };
    }
  }

  return null;
}

function inferRaidTypeFromLogText(value) {
  const text = clean(value).toLowerCase();
  if (!text) return "";

  const checks = [
    ["AQ40", ["aq40", "ahn'qiraj", "ahn qiraj", "temple of ahn", "tempel von ahn"]],
    ["AQ20", ["aq20", "ruins of ahn", "ruinen von ahn"]],
    ["BWL", ["bwl", "blackwing lair", "pechschwingenhort"]],
    ["MC", ["mc", "molten core", "geschmolzener kern"]],
    ["NAXX", ["naxx", "naxxramas"]],
    ["ZG", ["zg", "zul'gurub", "zulgurub"]],
    ["ONY", ["ony", "onyxia", "onixia"]]
  ];

  for (const [raid, terms] of checks) {
    if (terms.some(term => text.includes(term))) return raid;
  }
  return "";
}

function formatDateInBerlin(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function fetchWarcraftLogsReportMeta(reportCode) {
  const token = await getWarcraftLogsAccessToken();
  const gqlQuery =
    "query($code:String!){"+
    "reportData{report(code:$code){title startTime fights{ name startTime endTime }}}"+
    "}";
  const data = await warcraftLogsGraphql(token, gqlQuery, { code: reportCode });
  const report = data.reportData?.report || {};
  const fights = Array.isArray(report.fights) ? report.fights : [];
  const fightNames = fights.map(fight => fight.name || "").join(" ");
  const startTime = Number(report.startTime || fights.find(fight => Number(fight.startTime))?.startTime || 0);
  const raidDate = startTime ? formatDateInBerlin(new Date(startTime)) : "";
  const raid = inferRaidTypeFromLogText([report.title || "", fightNames].join(" "));

  return {
    title: clean(report.title),
    raid,
    raidDate
  };
}

async function fetchWarcraftLogsReportMetaSafe(reportCode) {
  try {
    return await fetchWarcraftLogsReportMeta(reportCode);
  } catch (error) {
    console.warn("Warcraft-Logs-Metadaten konnten nicht geladen werden:", error.message || error);
    return {};
  }
}

function normalizeWarcraftLogsGear(gear) {
  const slotNames = {
    0: "Kopf", 1: "Hals", 2: "Schultern", 3: "Hemd", 4: "Brust", 5: "Taille",
    6: "Beine", 7: "Füße", 8: "Handgelenke", 9: "Hände", 10: "Ring 1", 11: "Ring 2",
    12: "Schmuck 1", 13: "Schmuck 2", 14: "Rücken", 15: "Waffenhand", 16: "Schildhand", 17: "Distanz"
  };

  return (Array.isArray(gear) ? gear : []).map((item, index) => {
    const id = item.id || item.itemID || item.itemId || "";
    const slot = item.slot !== undefined && item.slot !== null && item.slot !== "" ? item.slot : index;
    return {
      slot,
      slotName: slotNames[slot] || String(slot || "Slot"),
      id,
      itemId: id,
      name: item.name || item.itemName || (id ? `Item ${id}` : "Unbekannt"),
      quality: item.quality || "",
      icon: normalizeIconName(item.icon || item.iconName || ""),
      itemLevel: item.itemLevel || item.ilvl || "",
      permanentEnchant: item.permanentEnchant || item.permanentEnchantName || item.enchant || "",
      permanentEnchantName: item.permanentEnchantName || item.enchantName || "",
      enchantments: normalizeWarcraftLogsEnchantments(item),
      gems: normalizeWarcraftLogsGems(item.gems || item.gem || item.socketedGems || [])
    };
  }).filter(item => item.id);
}

function normalizeWarcraftLogsEnchantments(item) {
  const enchants = [];
  if (item.permanentEnchant || item.permanentEnchantName || item.enchant || item.enchantName) {
    enchants.push({
      id: item.permanentEnchant || item.enchant || "",
      name: item.permanentEnchantName || item.enchantName || "",
      type: "PERMANENT"
    });
  }

  (Array.isArray(item.enchantments || item.enchants) ? (item.enchantments || item.enchants) : []).forEach(enchant => {
    if (!enchant) return;
    enchants.push({
      id: enchant.id || enchant.enchantment_id || enchant.enchantmentId || enchant.spellID || enchant.spellId || "",
      name: enchant.name || enchant.enchantmentName || enchant.spellName || "",
      type: enchant.type || enchant.enchantment_slot?.type || ""
    });
  });

  return enchants;
}

function normalizeWarcraftLogsGems(gems) {
  return (Array.isArray(gems) ? gems : [gems]).filter(Boolean).map(gem => {
    if (typeof gem === "string" || typeof gem === "number") return { id: gem, name: "" };
    return {
      id: gem.id || gem.itemID || gem.itemId || "",
      name: gem.name || gem.itemName || "",
      icon: normalizeIconName(gem.icon || gem.iconName || "")
    };
  });
}

function normalizeWarcraftLogsTalents(combatantInfo) {
  if (!combatantInfo) return [];
  const rawTalents = combatantInfo.talents || combatantInfo.talentTree || combatantInfo.specs || combatantInfo.spec || [];

  if (
    Array.isArray(rawTalents) &&
    rawTalents.length &&
    rawTalents.every(talent => typeof talent === "number" || /^\d+$/.test(String(talent || "")))
  ) {
    return [{ name: "Spec", rank: rawTalents.join("/") + (rawTalents.length === 2 ? "/0" : ""), type: "spec", trees: rawTalents }];
  }

  const talents = [];
  const addTalent = (talent, treeName = "") => {
    if (!talent) return;
    if (typeof talent === "string") {
      talents.push({ name: talent, rank: "", tree: treeName });
      return;
    }
    const name = talent.name || talent.talentName || talent.abilityName || talent.spellName || talent.id || talent.guid || "";
    const rank = talent.rank || talent.points || talent.amount || talent.value || "";
    if (name || rank) {
      talents.push({
        name: String(name || "Talent"),
        rank,
        tree: treeName || talent.tree || talent.treeName || talent.category || "",
        id: talent.id || talent.guid || talent.spellID || talent.spellId || ""
      });
    }
  };

  if (Array.isArray(rawTalents)) {
    rawTalents.forEach(talent => {
      if (talent && Array.isArray(talent.talents)) {
        talent.talents.forEach(child => addTalent(child, talent.name || talent.tree || talent.treeName || ""));
      } else {
        addTalent(talent);
      }
    });
  } else if (typeof rawTalents === "object") {
    Object.keys(rawTalents).forEach(key => {
      const value = rawTalents[key];
      if (Array.isArray(value)) value.forEach(talent => addTalent(talent, key));
      else if (typeof value === "object") addTalent(value, key);
      else if (value) addTalent({ name: key, rank: value });
    });
  }

  return talents;
}

async function getCharacterGearFromWCL({ query: params }) {
  const character = clean(params.character || params.player);
  const server = clean(params.server);
  const region = clean(params.region || process.env.WCL_REGION || "EU").toUpperCase();

  if (!character || !server) {
    return { success: false, error: "Bitte zuerst Charakter und Server auswählen." };
  }

  try {
    const token = await getWarcraftLogsAccessToken();
    const serverSlug = toWarcraftLogsSlug(server);
    const characterInfo = await fetchWarcraftLogsCharacter(token, character, serverSlug, region);
    const reports = (characterInfo.recentReports?.data || [])
      .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0));

    for (const report of reports.slice(0, 8)) {
      const gearResult = await fetchWarcraftLogsReportGear(token, report.code, character, server);
      if (gearResult?.items?.length) {
        return {
          success: true,
          source: "Warcraft Logs",
          character: characterInfo.name || character,
          server,
          region,
          report: {
            code: report.code,
            title: report.title || "",
            startTime: report.startTime || ""
          },
          fight: gearResult.fight || null,
          items: gearResult.items,
          className: gearResult.className || "",
          talents: gearResult.talents || [],
          rawTalents: gearResult.rawTalents || null,
          rawStats: gearResult.rawStats || null
        };
      }
    }

    return { success: false, character, server, error: "Keine Ausrüstung in den letzten Warcraft-Logs-Reports gefunden." };
  } catch (error) {
    return {
      success: false,
      needsSetup: Boolean(error.needsSetup),
      error: `Warcraft-Logs-Import fehlgeschlagen: ${error.message}`
    };
  }
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
    isMain: Boolean(row.is_main),
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
    `select c.id, c.name, c.server, c.class_name, c.created_at, p.id as player_id, p.player_pin
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
    `select
       c.id,
       c.name,
       c.server,
       c.class_name,
       c.is_main,
       c.created_at,
       first_value(c.name) over (
         partition by p.id
         order by c.is_main desc, c.created_at asc
       ) as main_char
     from players p
     join characters c on c.player_id = p.id
     where p.guild_id = $1 and p.player_pin = $2
     order by c.is_main desc, c.created_at asc, c.name asc`,
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

function normalizeLogRaidType(value) {
  const raw = clean(value);
  if (!raw) return "";
  const normalized = normalizeRaidType(raw);
  if (normalized === "raid") return "";
  return normalized.toUpperCase();
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

async function loadMasterCodeOverrides() {
  await query(
    `create table if not exists guild_master_codes (
       guild_id uuid primary key references guilds(id) on delete cascade,
       master_code text not null,
       updated_at timestamptz not null default now()
     )`
  );
  const result = await query("select guild_id, master_code from guild_master_codes");
  result.rows.forEach(row => masterCodeOverrides.set(String(row.guild_id), row.master_code));
}

function requireMasterCode(value) {
  const code = clean(value);
  if (code !== masterCode && !Array.from(masterCodeOverrides.values()).includes(code)) {
    const error = new Error("Falscher Master-Code.");
    error.statusCode = 403;
    throw error;
  }
}

function requireMasterOrQueueToken(params = {}) {
  const code = clean(params.masterCode);
  if (code === masterCode || Array.from(masterCodeOverrides.values()).includes(code)) return;
  if (lichtbotQueueToken && clean(params.queueToken) === lichtbotQueueToken) return;
  const error = new Error("Nicht erlaubt.");
  error.statusCode = 403;
  throw error;
}

async function ensureRaidCreatedByColumn() {
  await query(`alter table raids add column if not exists created_by text`);
}

async function ensureBuffTables() {
  await query(
    `create table if not exists hordenbuff_events (
       id uuid primary key default gen_random_uuid(),
       guild_id uuid not null references guilds(id) on delete cascade,
       buff text not null default 'Rend',
       event_date date not null,
       event_time text not null,
       faction text not null default 'Horde',
       status text not null default 'offen',
       note text,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now(),
       unique (guild_id, buff, event_date, event_time)
     )`
  );
  await query(
    `create table if not exists hordenbuff_entries (
       id uuid primary key default gen_random_uuid(),
       event_id uuid not null references hordenbuff_events(id) on delete cascade,
       ally_char text,
       horde_char text,
       status text not null default 'offen',
       note text,
       source text not null default 'railway',
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     )`
  );
  await query(
    `create table if not exists worldbuff_events (
       id uuid primary key default gen_random_uuid(),
       guild_id uuid not null references guilds(id) on delete cascade,
       buff text not null,
       event_date date not null,
       event_time text not null,
       guild_name text,
       status text not null default 'offen',
       note text,
       source text not null default 'railway',
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now(),
       unique (guild_id, buff, event_date, event_time, guild_name)
     )`
  );
  await query(
    `create table if not exists worldbuff_entries (
       id uuid primary key default gen_random_uuid(),
       event_id uuid not null references worldbuff_events(id) on delete cascade,
       caster text,
       discord_name text,
       status text not null default 'offen',
       note text,
       source text not null default 'railway',
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     )`
  );
  await query(`create index if not exists hordenbuff_events_guild_date_idx on hordenbuff_events (guild_id, event_date, event_time)`);
  await query(`create index if not exists worldbuff_events_guild_date_idx on worldbuff_events (guild_id, event_date, event_time)`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(value));
}

function extractWarcraftLogsReportCode(value) {
  const text = clean(value);
  if (!text) return "";

  const reportMatch = text.match(/\/reports\/([A-Za-z0-9]+)/i);
  if (reportMatch) return reportMatch[1];

  const queryMatch = text.match(/[?&]report=([A-Za-z0-9]+)/i);
  if (queryMatch) return queryMatch[1];

  if (/^[A-Za-z0-9]{8,32}$/.test(text)) return text;
  return "";
}

function normalizeWarcraftLogsReportUrl(url, reportCode) {
  const raw = clean(url);
  if (raw && /^https?:\/\//i.test(raw)) return raw;
  return reportCode ? `${warcraftLogsBaseUrl()}/reports/${reportCode}` : raw;
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
    createdBy: row.created_by || "",
    erstelltVon: row.created_by || "",
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

function normalizeWorldbuffStatus(value) {
  const raw = clean(value).replace(/[🟡🟢✅🔴🟠⚪]/g, "").trim().toLowerCase();
  if (!raw) return "offen";
  if (raw.includes("bestätigt") || raw.includes("bestaetigt") || raw.includes("reserviert")) return "bestätigt";
  if (raw.includes("erledigt") || raw === "done" || raw === "fertig") return "erledigt";
  if (raw.includes("offen") || raw.includes("frei")) return "offen";
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

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  const input = String(text || "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "\"") {
      if (quote && input[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quote = !quote;
      }
    } else if ((char === "," || char === ";") && !quote) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quote) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some(value => clean(value))) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => clean(value))) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value) {
  return slugify(value).replace(/-/g, " ");
}

function normalizeWorldbuffName(value) {
  const text = clean(value)
    .replace(/^[-–•]+\s*/, "")
    .replace(/[🟢🔴🟠⚪🟡]/g, "")
    .replace(/\*/g, "")
    .trim();
  const lower = text.toLowerCase();
  if (lower === "zg" || lower.includes("hakkar")) return "Hakkar";
  if (lower.includes("ony")) return "Ony";
  if (lower.includes("nef")) return "Nef";
  if (lower.includes("rend")) return "Rend";
  return text;
}

function normalizeWorldbuffRow(row) {
  const datum = clean(row.datum || row.Datum || row.date || row.Date);
  const uhrzeit = clean(row.uhrzeit || row.Uhrzeit || row.time || row.Time);
  const buff = normalizeWorldbuffName(row.buff || row.Buff || row.name || row.Name || row.type || row.Type);
  const gilde = clean(row.gilde || row.Gilde || row.guild || row.Guild || row.fraktion || row.Fraktion || row["Gilde / Fraktion"]);

  if (!datum || !uhrzeit || !buff) return null;
  return {
    buff,
    datum,
    date: parseDateValue(datum),
    uhrzeit,
    time: uhrzeit,
    gilde,
    charakter: clean(row.charakter || row.Charakter || row.caster || row.Caster || row.werfer || row.Werfer || row.character),
    uebernehmer: clean(row.uebernehmer || row.Übernehmer || row.Uebernehmer || row.helfer || row.Helfer),
    status: clean(row.status || row.Status || "offen") || "offen",
    notiz: clean(row.notiz || row.Notiz || row.note || row.Note || row.hinweis || row.Hinweis),
    tag: clean(row.tag || row.Tag) || weekdayShort(datum),
    source: clean(row.source || row.Source || "railway-worldbuff")
  };
}

function normalizeWorldbuffDbRow(row) {
  return {
    rowNumber: row.entry_id || row.event_id || "",
    eventId: row.event_id,
    buff: normalizeWorldbuffName(row.buff || "Worldbuff"),
    tag: row.tag || weekdayShort(row.event_date),
    datum: formatGermanDate(row.event_date),
    date: row.event_date ? row.event_date.toISOString().slice(0, 10) : "",
    uhrzeit: row.event_time || "",
    time: row.event_time || "",
    gilde: row.guild_name || "",
    charakter: row.caster || "",
    caster: row.caster || "",
    discord: row.discord_name || "",
    uebernehmer: "",
    status: row.entry_status || row.event_status || "offen",
    notiz: row.entry_note || row.event_note || "",
    note: row.entry_note || row.event_note || "",
    source: row.entry_source || row.event_source || "railway",
    key: `${formatGermanDate(row.event_date)}|${row.event_time || ""}|${normalizeWorldbuffName(row.buff || "")}|${row.guild_name || ""}`
  };
}

function worldbuffCsvRowsToBuffs(text) {
  const rows = parseCsvRows(text);
  const headerIndex = rows.findIndex(row => {
    const headers = row.map(normalizeCsvHeader);
    return headers.includes("tag") && headers.includes("datum") && headers.includes("uhrzeit") && headers.includes("buff");
  });
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(normalizeCsvHeader);
  const find = (...names) => headers.findIndex(header => names.map(normalizeCsvHeader).includes(header));
  const idx = {
    tag: find("tag"),
    datum: find("datum"),
    uhrzeit: find("uhrzeit", "zeit"),
    buff: find("buff"),
    gilde: find("gilde fraktion", "gilde", "fraktion"),
    charakter: find("charakter", "char", "spieler", "werfer"),
    uebernehmer: find("uebernehmer", "helfer", "helper"),
    status: find("status"),
    notiz: find("notiz", "note", "hinweis")
  };
  let lastTag = "";
  let lastDatum = "";

  return rows.slice(headerIndex + 1).map(row => {
    const value = name => (idx[name] >= 0 ? clean(row[idx[name]]) : "");
    const tag = value("tag") || lastTag;
    const datum = value("datum") || lastDatum;
    if (value("tag")) lastTag = value("tag");
    if (value("datum")) lastDatum = value("datum");
    return normalizeWorldbuffRow({
      Tag: tag,
      Datum: datum,
      Uhrzeit: value("uhrzeit"),
      Buff: value("buff"),
      "Gilde / Fraktion": value("gilde"),
      Charakter: value("charakter"),
      Übernehmer: value("uebernehmer"),
      Status: value("status"),
      Notiz: value("notiz"),
      source: "Worldbuff-Sheet"
    });
  }).filter(Boolean);
}

function worldbuffTickerRowsToBuffs(text) {
  return parseCsvRows(text).map(row => {
    const cells = row.map(clean).filter(Boolean);
    if (cells.length < 3) return null;
    const dateCell = cells.find(cell => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(cell) || /^\d{4}-\d{2}-\d{2}$/.test(cell));
    const timeCell = cells.find(cell => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(cell));
    const buffCell = cells.find(cell => ["Hakkar", "Ony", "Nef", "Rend"].includes(normalizeWorldbuffName(cell)));
    if (!dateCell || !timeCell || !buffCell) return null;
    return normalizeWorldbuffRow({
      Datum: dateCell,
      Uhrzeit: timeCell,
      Buff: normalizeWorldbuffName(buffCell),
      "Gilde / Fraktion": cells.filter(cell => cell !== dateCell && cell !== timeCell && cell !== buffCell).join(" · "),
      source: "Worldbuffticker"
    });
  }).filter(Boolean);
}

function worldbuffTimestamp(entry) {
  const iso = parseDateValue(entry.date || entry.datum);
  const match = clean(entry.uhrzeit || entry.time).match(/^(\d{1,2}):(\d{2})/);
  const hours = match ? Math.max(0, Math.min(23, Number(match[1]) || 0)) : 0;
  const minutes = match ? Math.max(0, Math.min(59, Number(match[2]) || 0)) : 0;
  return new Date(`${iso}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).getTime();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function getWorldbuffsFromSheets(params = {}) {
  const days = clean(params.days || "14");
  const dayCount = days === "all" ? 3650 : Math.max(Number(days) || 14, 1);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + dayCount * 24 * 60 * 60 * 1000;
  const entries = [];

  const sources = [
    { url: worldbuffPublicCsvUrl, parse: worldbuffCsvRowsToBuffs },
    { url: worldbuffTickerCsvUrl, parse: worldbuffTickerRowsToBuffs }
  ];

  for (const source of sources) {
    try {
      entries.push(...source.parse(await fetchText(source.url)));
    } catch (error) {
      console.warn("Worldbuff-Quelle nicht ladbar:", source.url, error.message || error);
    }
  }

  const filtered = entries
    .filter(entry => {
      const timestamp = worldbuffTimestamp(entry);
      return timestamp >= start.getTime() && timestamp < end;
    })
    .sort((a, b) => worldbuffTimestamp(a) - worldbuffTimestamp(b));

  return { success: true, buffs: filtered, entries: filtered };
}

async function getWorldbuffs({ guildId, query: params }) {
  await ensureBuffTables();
  const days = clean(params.days || "14");
  const source = clean(params.source).toLowerCase();
  const dayCount = days === "all" ? 3650 : Math.max(Number(days) || 14, 1);
  const values = [guildId];
  let windowClause = "";
  if (days !== "all") {
    values.push(dayCount);
    windowClause = `and e.event_date <= current_date + ($2::int * interval '1 day')`;
  }

  const result = await query(
    `select e.id as event_id, e.buff, e.event_date, e.event_time, e.guild_name,
            e.status as event_status, e.note as event_note, e.source as event_source,
            we.id as entry_id, we.caster, we.discord_name,
            we.status as entry_status, we.note as entry_note, we.source as entry_source
     from worldbuff_events e
     left join lateral (
       select *
       from worldbuff_entries entry
       where entry.event_id = e.id
       order by
         case when nullif(entry.caster, '') is not null then 0 else 1 end,
         entry.updated_at desc,
         entry.created_at desc
       limit 1
     ) we on true
     where e.guild_id = $1
       and e.event_date >= current_date
       ${windowClause}
     order by e.event_date asc, e.event_time asc, e.buff asc, e.guild_name asc`,
    values
  );

  const railwayRows = result.rows.map(normalizeWorldbuffDbRow);
  if (railwayRows.length || source === "railway") {
    return { success: true, source: "railway", buffs: railwayRows, entries: railwayRows };
  }

  const sheetRows = await getWorldbuffsFromSheets(params);
  return { ...sheetRows, source: "sheet-fallback" };
}

async function upsertWorldbuffEvent(client, guildId, params) {
  const eventDate = parseDateValue(params.datum || params.date || params.eventDate);
  const eventTime = clean(params.uhrzeit || params.time || params.eventTime || "19:35");
  const buff = normalizeWorldbuffName(params.buff || "Hakkar") || "Hakkar";
  const guildName = clean(params.gilde || params.guild || params.fraktion || params.faction);
  const status = normalizeWorldbuffStatus(params.eventStatus || params.status || "offen");
  const note = clean(params.eventNote || params.note || params.notiz);
  const source = clean(params.source || "railway");

  const result = await client.query(
    `insert into worldbuff_events (guild_id, buff, event_date, event_time, guild_name, status, note, source)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (guild_id, buff, event_date, event_time, guild_name) do update
       set status = coalesce(nullif(excluded.status, ''), worldbuff_events.status),
           note = coalesce(nullif(excluded.note, ''), worldbuff_events.note),
           source = coalesce(nullif(excluded.source, ''), worldbuff_events.source),
           updated_at = now()
     returning *`,
    [guildId, buff, eventDate, eventTime, guildName, status, note, source]
  );
  return result.rows[0];
}

async function findWorldbuffEventOrEntry(client, guildId, rowNumber) {
  if (!isUuid(rowNumber)) return { event: null, entry: null };
  const entryResult = await client.query(
    `select we.*, e.id as event_id, e.buff, e.event_date, e.event_time, e.guild_name
     from worldbuff_entries we
     join worldbuff_events e on e.id = we.event_id
     where we.id = $1 and e.guild_id = $2`,
    [rowNumber, guildId]
  );
  if (entryResult.rows[0]) {
    const row = entryResult.rows[0];
    return {
      event: {
        id: row.event_id,
        buff: row.buff,
        event_date: row.event_date,
        event_time: row.event_time,
        guild_name: row.guild_name
      },
      entry: row
    };
  }

  const eventResult = await client.query(
    `select *
     from worldbuff_events
     where id = $1 and guild_id = $2`,
    [rowNumber, guildId]
  );
  return { event: eventResult.rows[0] || null, entry: null };
}

async function setWorldbuffCaster({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await ensureBuffTables();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rowNumber = clean(params.rowNumber);
    const found = await findWorldbuffEventOrEntry(client, guildId, rowNumber);
    const caster = clean(params.charakter || params.caster || params.werfer);
    const discordName = clean(params.discord || params.discordName);
    const status = normalizeWorldbuffStatus(params.status || (caster ? "bestätigt" : "offen"));
    const note = clean(params.note || params.notiz);
    let event = found.event;
    if (!event && !clean(params.datum || params.date) && !clean(params.uhrzeit || params.time)) {
      const wantedBuff = normalizeWorldbuffName(params.buff);
      const nextOpen = await client.query(
        `select e.*
         from worldbuff_events e
         left join worldbuff_entries we on we.event_id = e.id and nullif(we.caster, '') is not null
         where e.guild_id = $1
           and e.event_date >= current_date
           and lower(coalesce(e.guild_name, '')) = 'lichtbringer'
           and ($2 = '' or e.buff = $2 or ($2 in ('Ony', 'Nef') and e.buff in ('Ony', 'Nef')))
           and we.id is null
           and lower(coalesce(e.status, 'offen')) not in ('erledigt', 'done', 'fertig')
         order by e.event_date asc, e.event_time asc
         limit 1`,
        [guildId, wantedBuff]
      );
      event = nextOpen.rows[0] || null;
    }
    event = event || await upsertWorldbuffEvent(client, guildId, params);
    const requestedBuff = normalizeWorldbuffName(params.buff);
    const requestedGuild = clean(params.gilde || params.guild || params.fraktion || params.faction);
    if (event && (requestedBuff || requestedGuild || note)) {
      const targetBuff = requestedBuff || event.buff;
      const targetGuild = requestedGuild || event.guild_name || "";
      const targetDate = parseDateValue(params.datum || params.date || event.event_date);
      const targetTime = clean(params.uhrzeit || params.time || event.event_time);
      const conflictingEvent = await client.query(
        `select *
         from worldbuff_events
         where guild_id = $1
           and id <> $2
           and buff = $3
           and event_date = $4
           and event_time = $5
           and coalesce(guild_name, '') = $6
         limit 1`,
        [guildId, event.id, targetBuff, targetDate, targetTime, targetGuild]
      );

      if (conflictingEvent.rows[0]) {
        const targetEvent = conflictingEvent.rows[0];
        await client.query(
          `update worldbuff_entries
           set event_id = $2,
               updated_at = now()
           where event_id = $1`,
          [event.id, targetEvent.id]
        );
        await client.query(
          `delete from worldbuff_events
           where id = $1 and guild_id = $2`,
          [event.id, guildId]
        );
        event = targetEvent;
      } else {
        const updatedEvent = await client.query(
          `update worldbuff_events
           set buff = $2,
               event_date = $3,
               event_time = $4,
               guild_name = $5,
               note = coalesce(nullif($6, ''), note),
               updated_at = now()
           where id = $1 and guild_id = $7
           returning *`,
          [event.id, targetBuff, targetDate, targetTime, targetGuild, note, guildId]
        );
        event = updatedEvent.rows[0] || event;
      }
    }
    let savedId = found.entry?.id || "";

    const clearsCaster = !caster && status === "offen";

    if (found.entry && clearsCaster) {
      await client.query(
        `delete from worldbuff_entries
         where id = $1`,
        [found.entry.id]
      );
      await client.query(
        `update worldbuff_events
         set status = 'offen',
             updated_at = now()
         where id = $1 and guild_id = $2`,
        [event.id, guildId]
      );
      savedId = event.id;
    } else if (found.entry) {
      const saved = await client.query(
        `update worldbuff_entries
         set caster = $2,
             discord_name = coalesce(nullif($3, ''), discord_name),
             status = $4,
             note = $5,
             updated_at = now()
         where id = $1
         returning *`,
        [found.entry.id, caster, discordName, status, note]
      );
      savedId = saved.rows[0].id;
    } else if (caster || note || status !== "offen") {
      const existingEntry = await client.query(
        `select *
         from worldbuff_entries
         where event_id = $1
         order by updated_at desc, created_at desc
         limit 1`,
        [event.id]
      );
      if (existingEntry.rows[0]) {
        const saved = await client.query(
          `update worldbuff_entries
           set caster = $2,
               discord_name = coalesce(nullif($3, ''), discord_name),
               status = $4,
               note = $5,
               updated_at = now()
           where id = $1
           returning *`,
          [existingEntry.rows[0].id, caster, discordName, status, note]
        );
        savedId = saved.rows[0].id;
      } else {
        const saved = await client.query(
          `insert into worldbuff_entries (event_id, caster, discord_name, status, note, source)
           values ($1, $2, $3, $4, $5, $6)
           returning *`,
          [event.id, caster, discordName, status, note, clean(params.source || "railway")]
        );
        savedId = saved.rows[0].id;
      }
    } else {
      await client.query(
        `update worldbuff_events
         set status = $2, updated_at = now()
         where id = $1`,
        [event.id, status]
      );
    }

    await client.query("commit");
    await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_saved" } }).catch(() => {});
    return {
      success: true,
      rowNumber: savedId || event.id,
      eventId: event.id,
      buff: normalizeWorldbuffName(params.buff || event.buff),
      datum: formatGermanDate(params.datum || event.event_date),
      uhrzeit: clean(params.uhrzeit || event.event_time),
      charakter: caster,
      status
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createWorldbuffTerm({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await ensureBuffTables();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const event = await upsertWorldbuffEvent(client, guildId, params);
    const caster = clean(params.charakter || params.caster || params.werfer);
    if (caster || clean(params.note || params.notiz)) {
      await client.query(
        `insert into worldbuff_entries (event_id, caster, discord_name, status, note, source)
         values ($1, $2, $3, $4, $5, 'railway')`,
        [
          event.id,
          caster,
          clean(params.discord || params.discordName),
          normalizeWorldbuffStatus(params.status || (caster ? "bestätigt" : "offen")),
          clean(params.note || params.notiz)
        ]
      );
    }
    await client.query("commit");
    await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_created" } }).catch(() => {});
    return { success: true, eventId: event.id };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function deleteWorldbuffTerm({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await ensureBuffTables();
  const rowNumber = clean(params.rowNumber);
  if (rowNumber && isUuid(rowNumber)) {
    const entryDeleted = await query(
      `delete from worldbuff_entries we
       using worldbuff_events e
       where we.event_id = e.id and e.guild_id = $1 and we.id = $2`,
      [guildId, rowNumber]
    );
    if (!entryDeleted.rowCount) {
      await query(`delete from worldbuff_events where guild_id = $1 and id = $2`, [guildId, rowNumber]);
    }
    await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_deleted" } }).catch(() => {});
    return { success: true };
  }

  const eventDate = parseDateValue(params.datum || params.date);
  const eventTime = clean(params.uhrzeit || params.time);
  const buff = normalizeWorldbuffName(params.buff);
  const guildName = clean(params.gilde || params.guild || params.fraktion || params.faction);
  await query(
    `delete from worldbuff_events
     where guild_id = $1
       and event_date = $2
       and event_time = $3
       and buff = $4
       and coalesce(guild_name, '') = $5`,
    [guildId, eventDate, eventTime, buff, guildName]
  );
  await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_deleted" } }).catch(() => {});
  return { success: true };
}

async function importWorldbuffsFromSheets({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await ensureBuffTables();
  let sourceRows = [];
  if (params.buffs) {
    try {
      const parsed = typeof params.buffs === "string" ? JSON.parse(params.buffs) : params.buffs;
      if (Array.isArray(parsed)) sourceRows = parsed.map(normalizeWorldbuffRow).filter(Boolean);
    } catch (error) {
      const parseError = new Error("Worldbuff-Liste konnte nicht gelesen werden.");
      parseError.statusCode = 400;
      throw parseError;
    }
  }
  if (!sourceRows.length) {
    sourceRows = (await getWorldbuffsFromSheets({ ...params, days: params.days || "all" })).buffs || [];
  }
  const client = await pool.connect();
  let synced = 0;
  try {
    await client.query("begin");
    for (const entry of sourceRows) {
      await upsertWorldbuffEvent(client, guildId, {
        datum: entry.datum,
        uhrzeit: entry.uhrzeit,
        buff: entry.buff,
        gilde: entry.gilde,
        status: entry.status || "offen",
        note: entry.notiz || entry.note || "",
        source: entry.source || "sheet-import"
      });
      synced += 1;
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_import" } }).catch(() => {});
  return { success: true, synced };
}

async function getPlayerWorldbuffs({ guildId, query: params }) {
  const pin = normalizePin(params.pin);
  if (!pin) return { success: false, error: "SpielerLogin fehlt." };
  const chars = await getPlayerCharacters(guildId, pin);
  const names = chars.map(char => clean(char.name).toLowerCase()).filter(Boolean);
  if (!names.length) return { success: true, buffs: [], openSlots: [] };
  const all = (await getWorldbuffs({ guildId, query: { days: params.days || 90, source: "railway" } })).buffs || [];
  const openSlots = all.filter(entry =>
    ["Hakkar", "Ony", "Nef"].includes(normalizeWorldbuffName(entry.buff)) &&
    !clean(entry.charakter) &&
    normalizeWorldbuffStatus(entry.status) === "offen" &&
    clean(entry.gilde).toLowerCase() === "lichtbringer"
  );
  const buffs = all
    .filter(entry => names.includes(clean(entry.charakter).toLowerCase()))
    .map(entry => ({
      ...entry,
      alternatives: openSlots
        .filter(slot => normalizeWorldbuffName(slot.buff) === normalizeWorldbuffName(entry.buff) && slot.rowNumber !== entry.rowNumber)
        .slice(0, 20)
    }));
  return { success: true, buffs, openSlots };
}

async function claimPlayerWorldbuff({ guildId, query: params }) {
  const pin = normalizePin(params.pin);
  const charakter = clean(params.charakter || params.caster);
  if (!pin || !charakter) return { success: false, error: "SpielerLogin oder Charakter fehlt." };
  const chars = await getPlayerCharacters(guildId, pin);
  if (!chars.some(char => clean(char.name).toLowerCase() === charakter.toLowerCase())) {
    return { success: false, error: "Dieser Charakter gehört nicht zu deinem SpielerLogin." };
  }
  return setWorldbuffCaster({
    guildId,
    query: {
      ...params,
      queueToken: lichtbotQueueToken,
      charakter,
      status: "bestätigt"
    }
  });
}

async function movePlayerWorldbuff({ guildId, query: params }) {
  const pin = normalizePin(params.pin);
  const fromRowNumber = clean(params.fromRowNumber);
  const toRowNumber = clean(params.toRowNumber);
  if (!pin || !fromRowNumber || !toRowNumber) return { success: false, error: "Termin-Auswahl ist unvollständig." };
  const chars = await getPlayerCharacters(guildId, pin);
  const names = chars.map(char => clean(char.name).toLowerCase()).filter(Boolean);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const from = await client.query(
      `select we.*
       from worldbuff_entries we
       join worldbuff_events e on e.id = we.event_id
       where we.id = $1 and e.guild_id = $2`,
      [fromRowNumber, guildId]
    );
    const entry = from.rows[0];
    if (!entry || !names.includes(clean(entry.caster).toLowerCase())) {
      await client.query("rollback");
      return { success: false, error: "Der alte Termin wurde nicht gefunden." };
    }
    const target = await findWorldbuffEventOrEntry(client, guildId, toRowNumber);
    if (!target.event) {
      await client.query("rollback");
      return { success: false, error: "Der neue Termin wurde nicht gefunden." };
    }
    await client.query("delete from worldbuff_entries where id = $1", [entry.id]);
    const saved = await client.query(
      `insert into worldbuff_entries (event_id, caster, discord_name, status, note, source)
       values ($1, $2, $3, $4, $5, 'railway')
       returning id`,
      [target.event.id, entry.caster, entry.discord_name, entry.status, entry.note]
    );
    await client.query("commit");
    await enqueueBotUpdate({ guildId, type: "worldbuff_update", payload: { source: "worldbuff_moved" } }).catch(() => {});
    return { success: true, rowNumber: saved.rows[0].id };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
  const payload = params.payload && typeof params.payload === "object"
    ? params.payload
    : {
        raidId: clean(params.raidId || params.id || ""),
        source: clean(params.source || "")
      };
  return enqueueBotUpdate({ guildId, type, payload });
}

async function enqueueBotUpdate({ guildId, type, payload }) {
  await query(`alter table bot_update_queue add column if not exists payload jsonb not null default '{}'::jsonb`);
  const result = await query(
    `insert into bot_update_queue (guild_id, type, payload)
     values ($1, $2, $3::jsonb)
     returning id, type, payload`,
    [guildId, type, JSON.stringify(payload || {})]
  );
  return { success: true, rowNumber: result.rows[0].id, type: result.rows[0].type, payload: result.rows[0].payload || {} };
}

function logAnalysisPostChannelId(raid) {
  switch (normalizeLogRaidType(raid)) {
    case "MC":
      return "1509236588410834965";
    case "BWL":
      return "1509236359141785600";
    case "NAXX":
      return "1509235847109804082";
    case "AQ40":
      return "1509236271816511651";
    default:
      return "";
  }
}

async function getBotQueue({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await query(`alter table bot_update_queue add column if not exists payload jsonb not null default '{}'::jsonb`);
  const result = await query(
    `select id, type, payload, created_at
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
      payload: row.payload || {},
      createdAt: row.created_at
    }))
  };
}

async function queueRaidAnnouncement({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const raidId = clean(params.raidId || params.id || "");
  if (!raidId) return { success: false, error: "Raid-ID fehlt." };
  return queueBotUpdate({
    guildId,
    query: {
      ...params,
      type: "raid_announcement",
      payload: {
        raidId,
        source: "gildenleitung"
      }
    }
  });
}

async function queueLogAnalysisDiscordPost({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  if (!isUuid(id) || !["cla", "rpb"].includes(type)) {
    const error = new Error("Loganalyse-ID oder Typ fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `select *
     from log_analyses
     where guild_id = $1 and id = $2
     limit 1`,
    [guildId, id]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const analysis = normalizeLogAnalysis(result.rows[0]);
  const raid = normalizeLogRaidType(analysis.raid || analysis.summary?.raid || analysis.title || "");
  const channelId = logAnalysisPostChannelId(raid);
  if (!channelId) {
    const error = new Error("Für diesen Raid ist kein Log-Post-Channel hinterlegt.");
    error.statusCode = 400;
    throw error;
  }

  const sheetUrl = type === "cla"
    ? clean(analysis.claDownloadUrl || analysis.summary?.claDownloadUrl)
    : clean(analysis.rpbDownloadUrl || analysis.summary?.rpbDownloadUrl);
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(sheetUrl)) {
    const error = new Error(`${type.toUpperCase()} ist noch nicht fertig.`);
    error.statusCode = 400;
    throw error;
  }

  const queued = await enqueueBotUpdate({
    guildId,
    type: "log_analysis_post",
    payload: {
      analysisId: analysis.id,
      analysisType: type,
      raid,
      raidDate: analysis.raidDate || analysis.summary?.raidDate || "",
      reportCode: analysis.reportCode || "",
      reportUrl: analysis.reportUrl || "",
      sheetUrl,
      channelId
    }
  });

  return {
    ...queued,
    success: true,
    channelId
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
         values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce(nullif($9, ''), 'geöffnet'))
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

async function findOrCreateRaidleadCharacter(client, guildId, params) {
  const player = clean(params.player || params.char || params.spieler);
  const server = clean(params.server);
  const className = clean(params.className || params.class || params.klasse);

  if (!player || !server || !className) {
    const error = new Error("Spieler, Server oder Klasse fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await client.query(
    `select c.id, c.name, c.server, c.class_name, c.created_at, p.player_pin
     from characters c
     join players p on p.id = c.player_id
     where p.guild_id = $1
       and lower(c.name) = lower($2)
       and lower(c.server) = lower($3)
     order by c.created_at asc
     limit 1`,
    [guildId, player, server]
  );

  if (existing.rows.length) {
    const character = existing.rows[0];
    if (className && clean(character.class_name).toLowerCase() !== className.toLowerCase()) {
      const updated = await client.query(
        `update characters
         set class_name = $1, updated_at = now()
         where id = $2
         returning id, name, server, class_name, created_at`,
        [className, character.id]
      );
      return updated.rows[0];
    }
    return character;
  }

  let createdPlayer = null;
  for (let attempt = 0; attempt < 5 && !createdPlayer; attempt++) {
    const generatedPin = normalizePin(
      "RL" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );

    const playerResult = await client.query(
      `insert into players (guild_id, player_pin, security_question, security_answer)
       values ($1, $2, $3, $4)
       on conflict (guild_id, player_pin) do nothing
       returning id, player_pin`,
      [guildId, generatedPin, "Raidlead-Eintrag", "Raidlead-Eintrag"]
    );
    createdPlayer = playerResult.rows[0] || null;
  }

  if (!createdPlayer) {
    const error = new Error("Interner SpielerLogin konnte nicht erzeugt werden.");
    error.statusCode = 500;
    throw error;
  }

  const characterResult = await client.query(
    `insert into characters (player_id, name, server, class_name, is_main)
     values ($1, $2, $3, $4, true)
     returning id, name, server, class_name, created_at`,
    [createdPlayer.id, player, server, className]
  );

  return characterResult.rows[0];
}

async function savePrioAsRaidlead({ guildId, query: params }) {
  const raid = await findRaid(guildId, params);
  if (!raid) {
    const error = new Error("Raid wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const leadPin = clean(params.leadPin || params.raidleadPin);
  if (!leadPin || !raid.lead_pin || leadPin !== raid.lead_pin) {
    const error = new Error("LeadPIN passt nicht zu diesem Raid.");
    error.statusCode = 403;
    throw error;
  }

  const raidType = normalizeRaidType(raid.raid_type || params.raid || params.raidName);
  if (!clean(params.p1)) {
    const error = new Error("P1 fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const character = await findOrCreateRaidleadCharacter(client, guildId, params);
    const p1 = await upsertItem(client, raidType, params.p1);
    const p2 = await upsertItem(client, raidType, params.p2);
    const p3 = await upsertItem(client, raidType, params.p3);
    const comment = JSON.stringify({
      p0Plus: clean(params.p0Plus).toLowerCase() === "ja" ? "ja" : "nein",
      raidTime: clean(params.raidTime || params.uhrzeit) || raid.raid_time || "",
      source: "raidlead"
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
      [raid.id, character.id, p1?.id || null, p2?.id || null, p3?.id || null, comment]
    );

    await client.query("commit");
    return {
      success: true,
      prioId: prioResult.rows[0].id,
      raidId: raidPublicId(raid),
      player: character.name,
      server: character.server,
      className: character.class_name
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
       r.external_raid_id,
       r.raid_pin,
       r.name as raid_name,
       r.raid_type,
       r.raid_date,
       r.raid_time,
       r.guild_name,
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
      externalRaidId: row.external_raid_id || "",
      raidPin: row.raid_pin || "",
      prioPin: row.raid_pin || "",
      raid: row.raid_type,
      raidName: row.raid_name || displayRaidName(row.raid_type),
      raidDate,
      raidTime: row.raid_time || meta.raidTime || "",
      guild: row.guild_name || "",
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
  const raidId = clean(params.raidId);
  const leadPin = clean(params.leadPin || params.raidleadPin);

  if (leadPin && raidId && player) {
    const raid = await findRaid(guildId, { raidId, leadPin });
    if (!raid) {
      const error = new Error("RaidID oder LeadPIN nicht gefunden.");
      error.statusCode = 403;
      throw error;
    }

    const values = [guildId, raid.id, clean(player)];
    let serverClause = "";
    if (clean(params.server)) {
      values.push(clean(params.server));
      serverClause = `and lower(c.server) = lower($${values.length})`;
    }

    const result = await query(
      `delete from prios pr
       using characters c
       where pr.character_id = c.id
         and pr.raid_id = $2
         and c.player_id in (select id from players where guild_id = $1)
         and lower(c.name) = lower($3)
         ${serverClause}
       returning pr.id`,
      values
    );

    return { success: true, deleted: result.rowCount };
  }

  const character = await findCharacterForPin(guildId, pin, player, params.server);

  if (!character) {
    const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerPin.");
    error.statusCode = 403;
    throw error;
  }

  const values = [character.id];
  let raidClause = "";

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

function normalizeLogAnalysis(row) {
  const summary = row.summary || {};
  return {
    id: row.id,
    reportCode: row.report_code || "",
    reportUrl: row.report_url || "",
    title: row.title || "",
    raid: row.raid || "",
    raidDate: row.raid_date ? new Date(row.raid_date).toISOString().slice(0, 10) : "",
    status: row.status || "pending",
    summary,
    claDownloadUrl: summary.claDownloadUrl || "",
    rpbDownloadUrl: summary.rpbDownloadUrl || "",
    discordChannelId: row.discord_channel_id || "",
    discordMessageId: row.discord_message_id || "",
    discordAuthor: row.discord_author || "",
    postedAt: row.posted_at,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const logAnalysisRaidRoleOptions = [
  { value: "", label: "Automatisch" },
  { value: "main_tank", label: "Main Tank" },
  { value: "off_tank", label: "Off Tank" },
  { value: "tank", label: "Tank" },
  { value: "healer", label: "Heiler" },
  { value: "cat", label: "Katze" },
  { value: "owl", label: "Eule" },
  { value: "melee", label: "Nahkampf" },
  { value: "caster", label: "Caster" },
  { value: "hunter", label: "Jäger" },
  { value: "shadow", label: "Shadow" },
  { value: "support", label: "Support" },
  { value: "ignore", label: "Ignorieren" }
];

function normalizeLogAnalysisRaidRole(value) {
  const role = clean(value).toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const aliases = {
    maintank: "main_tank",
    mt: "main_tank",
    offtank: "off_tank",
    ot: "off_tank",
    feral_tank: "tank",
    bear: "tank",
    baer: "tank",
    bär: "tank",
    resto: "healer",
    heal: "healer",
    heiler: "healer",
    katze: "cat",
    feral: "cat",
    dd: "melee",
    melee_dd: "melee",
    nahkampf: "melee",
    eule: "owl",
    boomkin: "owl",
    moonkin: "owl",
    jaeger: "hunter",
    jäger: "hunter",
    hunter_dd: "hunter",
    schatten: "shadow",
    shadow_priest: "shadow",
    shadowpriest: "shadow",
    caster_dd: "caster",
    bench: "ignore"
  };
  const normalized = aliases[role] || role;
  return logAnalysisRaidRoleOptions.some(option => option.value === normalized) ? normalized : "";
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCsv(rows) {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\n")}\n`;
}

function slugPart(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "log";
}

function buildLogAnalysisDownloadUrl({ id, type, token }) {
  const params = new URLSearchParams({
    action: "guildDownloadLogAnalysis",
    id,
    type,
    token
  });
  const apiBase = clean(process.env.LICHTLOOT_API_URL || process.env.PUBLIC_API_URL) || "https://lichtloot-production.up.railway.app";
  const apiUrl = buildLogAnalysisCallbackUrl(apiBase);
  return `${apiUrl}?${params.toString()}`;
}

function parseWarcraftLogsEventsData(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.data)) return parsed.data;
      return [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw?.data)) return raw.data;
  return Array.isArray(raw) ? raw : [];
}

function parseWarcraftLogsTableData(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

function normalizeRpbClassName(value) {
  const text = clean(value);
  if (!text || /^unknown$/i.test(text) || /^player$/i.test(text)) return "";
  const lower = text.toLowerCase();
  const aliases = {
    druide: "Druid",
    druid: "Druid",
    jäger: "Hunter",
    jaeger: "Hunter",
    hunter: "Hunter",
    magier: "Mage",
    mage: "Mage",
    paladin: "Paladin",
    priester: "Priest",
    priest: "Priest",
    schurke: "Rogue",
    schurken: "Rogue",
    rogue: "Rogue",
    schamane: "Shaman",
    schamanen: "Shaman",
    shaman: "Shaman",
    hexenmeister: "Warlock",
    warlock: "Warlock",
    krieger: "Warrior",
    warrior: "Warrior"
  };
  return aliases[lower] || (rpbClassOrder.includes(text) ? text : "");
}

function playerActorsFromReport(report) {
  const actors = Array.isArray(report?.masterData?.actors) ? report.masterData.actors : [];
  return actors
    .filter(actor => clean(actor.type).toLowerCase() === "player" || normalizeRpbClassName(actor.subType || actor.type))
    .map(actor => ({
      id: Number(actor.id),
      name: clean(actor.name),
      server: clean(actor.server),
      className: normalizeRpbClassName(actor.subType || actor.type)
    }))
    .filter(actor => actor.id && actor.name)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function actorNameById(players) {
  const map = new Map();
  players.forEach(player => map.set(Number(player.id), player.name));
  return map;
}

function actorById(players) {
  const map = new Map();
  players.forEach(player => map.set(Number(player.id), player));
  return map;
}

async function getGuildClassMap(guildId) {
  const result = await query(
    `select c.name, c.class_name
     from characters c
     join players p on p.id = c.player_id
     where p.guild_id = $1`,
    [guildId]
  );
  const map = new Map();
  result.rows.forEach(row => {
    const className = normalizeRpbClassName(row.class_name);
    if (row.name && className) map.set(clean(row.name).toLowerCase(), className);
  });
  return map;
}

async function fetchReportBaseForAnalysis(reportCode) {
  const token = await getWarcraftLogsAccessToken();
  const gqlQuery =
    "query($code:String!){"+
    "reportData{report(code:$code){"+
    "title startTime endTime zone{name}"+
    "fights{ id name startTime endTime }"+
    "masterData{actors{ id name server type subType }}"+
    "}}}";
  const data = await warcraftLogsGraphql(token, gqlQuery, { code: reportCode });
  const report = data.reportData?.report || {};
  const fights = (Array.isArray(report.fights) ? report.fights : [])
    .filter(fight => Number(fight.id) && Number(fight.endTime) > Number(fight.startTime));
  return {
    token,
    report,
    players: playerActorsFromReport(report),
    fights,
    fightIds: fights.map(fight => Number(fight.id))
  };
}

async function fetchReportEventsForAnalysis(token, reportCode, dataType, fightIds) {
  const hasFightScope = Array.isArray(fightIds);
  const hasTimeScope = fightIds && typeof fightIds === "object" && !Array.isArray(fightIds);
  if (hasFightScope && !fightIds.length) return [];
  const gqlQuery = hasFightScope
    ? "query($code:String!,$fightIDs:[Int],$startTime:Float){"+
      "reportData{report(code:$code){events(dataType:"+dataType+",fightIDs:$fightIDs,startTime:$startTime,limit:10000){data nextPageTimestamp}}}"+
      "}"
    : hasTimeScope
      ? "query($code:String!,$startTime:Float,$endTime:Float){"+
        "reportData{report(code:$code){events(dataType:"+dataType+",startTime:$startTime,endTime:$endTime,limit:10000){data nextPageTimestamp}}}"+
        "}"
    : "query($code:String!,$startTime:Float){"+
      "reportData{report(code:$code){events(dataType:"+dataType+",startTime:$startTime,limit:10000){data nextPageTimestamp}}}"+
      "}";
  const allEvents = [];
  let startTime = null;
  try {
    for (let page = 0; page < 50; page++) {
      const variables = hasFightScope
        ? { code: reportCode, fightIDs: fightIds, startTime }
        : hasTimeScope
          ? { code: reportCode, startTime: startTime ?? Number(fightIds.startTime || 0), endTime: Number(fightIds.endTime || 999999999999) }
          : { code: reportCode, startTime };
      const data = await warcraftLogsGraphql(token, gqlQuery, variables);
      const events = data.reportData?.report?.events || {};
      allEvents.push(...parseWarcraftLogsEventsData(events.data));
      if (!events.nextPageTimestamp || events.nextPageTimestamp === startTime) break;
      startTime = Number(events.nextPageTimestamp);
    }
    return allEvents;
  } catch (error) {
    console.warn(`Warcraft-Logs-${dataType}-Events konnten nicht geladen werden:`, error.message || error);
    return allEvents;
  }
}

async function fetchReportTableForAnalysis(token, reportCode, dataType, fightIds, sourceId = null) {
  const hasFightScope = Array.isArray(fightIds);
  const hasTimeScope = fightIds && typeof fightIds === "object" && !Array.isArray(fightIds);
  if (hasFightScope && !fightIds.length) return {};
  const hasSource = Number(sourceId) > 0;
  const sourceArg = hasSource ? ",sourceID:$sourceID" : "";
  const fightArg = hasFightScope ? ",fightIDs:$fightIDs" : "";
  const timeArg = hasTimeScope ? ",startTime:$startTime,endTime:$endTime" : "";
  const queryVars = `$code:String!${hasFightScope ? ",$fightIDs:[Int]" : ""}${hasTimeScope ? ",$startTime:Float,$endTime:Float" : ""}${hasSource ? ",$sourceID:Int" : ""}`;
  const gqlQuery =
    "query("+queryVars+"){"+
    "reportData{report(code:$code){table(dataType:"+dataType+fightArg+timeArg+sourceArg+")}}"+
    "}";
  try {
    const variables = { code: reportCode };
    if (hasFightScope) variables.fightIDs = fightIds;
    if (hasTimeScope) {
      variables.startTime = Number(fightIds.startTime || 0);
      variables.endTime = Number(fightIds.endTime || 999999999999);
    }
    if (hasSource) variables.sourceID = Number(sourceId);
    const data = await warcraftLogsGraphql(token, gqlQuery, variables);
    return parseWarcraftLogsTableData(data.reportData?.report?.table);
  } catch (error) {
    console.warn(`Warcraft-Logs-${dataType}-Tabelle konnte nicht geladen werden:`, error.message || error);
    return {};
  }
}

function abilityName(event) {
  return clean(event?.ability?.name || event?.ability || event?.sourceAbility?.name || "");
}

function abilityId(event) {
  return Number(
    event?.abilityGameID ||
    event?.abilityGameId ||
    event?.ability?.guid ||
    event?.ability?.id ||
    event?.sourceAbilityGameID ||
    event?.sourceAbility?.guid ||
    event?.sourceAbility?.id ||
    0
  );
}

function abilityIdFromTableEntry(entry) {
  return Number(
    entry?.guid ||
    entry?.abilityGameID ||
    entry?.abilityGameId ||
    entry?.ability?.guid ||
    entry?.ability?.id ||
    entry?.id ||
    0
  );
}

function extraAbilityName(event) {
  return clean(event?.extraAbility?.name || event?.extraAbility || "");
}

function extraAbilityId(event) {
  return Number(
    event?.extraAbilityGameID ||
    event?.extraAbilityGameId ||
    event?.extraAbility?.guid ||
    event?.extraAbility?.id ||
    0
  );
}

function eventSourceId(event) {
  return Number(event?.sourceID || event?.sourceId || event?.source?.id || 0);
}

function eventTargetId(event) {
  return Number(event?.targetID || event?.targetId || event?.target?.id || 0);
}

function addPlayerAmount(table, player, key, amount = 1) {
  if (!player || !key) return;
  if (!table[key]) table[key] = {};
  table[key][player] = (Number(table[key][player] || 0) || 0) + amount;
}

function formatCountValue(value) {
  const number = Number(value || 0);
  return number ? String(Math.round(number)) : "";
}

const claExcludedGear = [
  [15138, "Onyxia Scale Cloak"],
  [20538, "Runed Stygian Leggings"],
  [20699, "Cenarion Reservist's Legplates"],
  [20700, "Cenarion Reservist's Legplates"],
  [20701, "Cenarion Reservist's Legguards"],
  [20702, "Cenarion Reservist's Legguards"],
  [20703, "Cenarion Reservist's Leggings"],
  [20704, "Cenarion Reservist's Leggings"],
  [20705, "Cenarion Reservist's Pants"],
  [20706, "Cenarion Reservist's Pants"],
  [20707, "Cenarion Reservist's Pants"],
  [15072, "Chimeric Leggings"],
  [15075, "Chimeric Vest"],
  [13531, "Crypt Stalker Leggings"],
  [17746, "Noxxion's Shackles"],
  [21691, "Ooze-Ridden Gauntlets"],
  [20476, "Sandstalker Bracers"],
  [20478, "Sandstalker Breastplate"],
  [21626, "Slime-Coated Leggings"],
  [18344, "Stonebark Gauntlets"],
  [9449, "Manual Crowd Pummeler"]
];

const rpbConsumables = [
  ["Greater Stoneshield Potion", ["Greater Stoneshield Potion"], [17540]],
  ["Limited Invulnerability Potion", ["Limited Invulnerability Potion"], [3169]],
  ["Living/Free Action Potion", ["Living Action Potion", "Free Action Potion"], [24364, 6615]],
  ["Great Rage Potion", ["Great Rage Potion"], [6612]],
  ["Mighty Rage Potion", ["Mighty Rage Potion"], [17528]],
  ["Major Healing Potion", ["Major Healing Potion"], [17534]],
  ["Major Mana Potion", ["Major Mana Potion"], [17531]],
  ["all other Mana Potions", ["Superior Mana Potion", "Greater Mana Potion", "Mana Potion"], [17530, 2023, 2024]],
  ["Demonic Rune/Dark Rune", ["Demonic Rune", "Dark Rune"], [16666, 27869]],
  ["Major/Greater Healthstone", ["Major Healthstone", "Greater Healthstone", "Healthstone"], [23473, 5720, 6262, 6263]],
  ["Mana Ruby", ["Mana Ruby"], [10058]],
  ["all other Mana Gems", ["Mana Citrine", "Mana Jade", "Mana Agate"], [10057, 10054, 5514]],
  ["Thistle Tea", ["Thistle Tea"], [9512]],
  ["Elixir of Poison Resistance", ["Elixir of Poison Resistance"], [11349]],
  ["Heavy Runecloth Bandage", ["Heavy Runecloth Bandage"], [18610]]
];

const rpbAbsorbs = [
  ["Greater Nature Protection Potion", ["Greater Nature Protection Potion"], [17546]],
  ["Nature Protection Potion", ["Nature Protection Potion"], [7254]],
  ["Greater Arcane Protection Potion", ["Greater Arcane Protection Potion"], [17549]],
  ["Greater Fire Protection Potion", ["Greater Fire Protection Potion"], [17543]],
  ["Fire Protection Potion", ["Fire Protection Potion"], [7230]],
  ["Frozen Rune", ["Frozen Rune"], [28764]],
  ["Greater Frost Protection Potion", ["Greater Frost Protection Potion"], [17544]],
  ["Frost Protection Potion", ["Frost Protection Potion"], [7239]],
  ["Frost Ward", ["Frost Ward"], [28609, 8462, 8461, 6143]],
  ["Greater Shadow Protection Potion", ["Greater Shadow Protection Potion"], [17548]],
  ["Shadow Protection Potion", ["Shadow Protection Potion"], [7242]],
  ["Shadow Ward", ["Shadow Ward"], [28610, 11739, 6229]],
  ["Power Word: Shield (excluded from total absorbed!)", ["Power Word: Shield"], [10901, 10900, 10899, 10898, 6066, 6065, 3747]]
];

const rpbEngineering = [
  ["Dense Dynamite", ["Dense Dynamite"], [19784, 23063]],
  ["Goblin Sapper Charge", ["Goblin Sapper Charge"], [13241]],
  ["Stratholme Holy Water", ["Stratholme Holy Water"], [17291]],
  ["Ez-Thro Dynamite II", ["Ez-Thro Dynamite II"], [8331]]
];

const rpbClassOrder = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];

function parseRpbConfigCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        i++;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseRpbConfigCast(configString) {
  const text = clean(configString);
  if (!text || text.indexOf("[") === -1) return null;
  const name = text.split(" [")[0].split(" {")[0];
  const idsText = (text.split("[")[1] || "").split("]")[0];
  const ids = idsText
    .split(",")
    .map(id => Number(String(id).replace("*", "").trim()))
    .filter(id => Number.isFinite(id) && id > 0);
  const castTime = Number.parseFloat((text.split("{")[1] || "").split("}")[0]) || 0;
  return {
    raw: text,
    name,
    ids,
    castTime,
    hasOverheal: text.toLowerCase().includes("overheal"),
    hasUptime: text.toLowerCase().includes("uptime") || text.includes("[99999]") || text.includes("[99998]")
  };
}

function findRpbConfigMarker(rows, marker) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const colIndex = (rows[rowIndex] || []).findIndex(value => clean(value).startsWith(marker));
    if (colIndex > -1) return { rowIndex, colIndex };
  }
  return null;
}

function readRpbConfigList(rows, marker) {
  const found = findRpbConfigMarker(rows, marker);
  if (!found) return [];
  const values = [];
  for (let rowIndex = found.rowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const value = clean(rows[rowIndex]?.[found.colIndex]);
    if (!value) break;
    values.push(value);
  }
  return values;
}

async function loadRpbConfigAll() {
  if (rpbConfigAllCache) return rpbConfigAllCache;
  const csv = await readFile(new URL("./rpb-configAll.csv", import.meta.url), "utf8");
  const rows = parseRpbConfigCsvRows(csv);
  const byClass = {};
  rpbClassOrder.forEach(className => {
    byClass[className] = {
      singleTarget: readRpbConfigList(rows, `singleTargetCasts tracked ${className}`).map(parseRpbConfigCast).filter(Boolean),
      aoe: readRpbConfigList(rows, `aoeCasts tracked ${className}`).map(parseRpbConfigCast).filter(Boolean),
      cooldowns: readRpbConfigList(rows, `classCooldowns tracked ${className}`).map(parseRpbConfigCast).filter(Boolean)
    };
  });
  rpbConfigAllCache = {
    rows,
    byClass,
    trinketsAndRacials: readRpbConfigList(rows, "trinketsAndRacials tracked").map(parseRpbConfigCast).filter(Boolean)
  };
  return rpbConfigAllCache;
}

function findConfiguredCast(rpbConfig, className, spellId, kind) {
  const casts = rpbConfig?.byClass?.[className]?.[kind] || [];
  return casts.find(cast => cast.ids.includes(Number(spellId))) || null;
}

const rpbSpellNamesById = {
  17: "Power Word: Shield",
  72: "Shield Bash",
  99: "Demoralizing Roar",
  100: "Charge",
  116: "Frostbolt",
  118: "Polymorph",
  120: "Cone of Cold",
  122: "Frost Nova",
  133: "Fireball",
  136: "Mend Pet",
  139: "Renew",
  172: "Corruption",
  284: "Heroic Strike",
  325: "Lightning Shield",
  339: "Entangling Roots",
  348: "Immolate",
  355: "Taunt",
  408: "Kidney Shot",
  453: "Mind Soothe",
  498: "Divine Protection",
  527: "Dispel Magic",
  528: "Cure Disease",
  552: "Abolish Disease",
  585: "Smite",
  586: "Fade",
  589: "Shadow Word: Pain",
  596: "Prayer of Healing",
  603: "Curse of Doom",
  605: "Mind Control",
  633: "Lay on Hands",
  642: "Divine Shield",
  686: "Shadow Bolt",
  689: "Drain Life",
  703: "Garrote",
  740: "Tranquility",
  772: "Rend",
  774: "Rejuvenation",
  781: "Disengage",
  853: "Hammer of Justice",
  879: "Exorcism",
  976: "Shadow Protection",
  980: "Curse of Agony",
  996: "Prayer of Healing",
  1004: "Smite",
  1064: "Chain Heal",
  1079: "Rip",
  1094: "Immolate",
  1120: "Drain Soul",
  1160: "Demoralizing Shout",
  1464: "Slam",
  1680: "Whirlwind",
  1715: "Hamstring",
  1752: "Sinister Strike",
  1760: "Backstab",
  1766: "Kick",
  1767: "Kick",
  1768: "Kick",
  1769: "Kick",
  1943: "Rupture",
  1978: "Serpent Sting",
  2006: "Resurrection",
  2050: "Lesser Heal",
  2054: "Heal",
  2055: "Heal",
  2060: "Greater Heal",
  2061: "Flash Heal",
  2098: "Eviscerate",
  2136: "Fire Blast",
  2139: "Counterspell",
  2643: "Multi-Shot",
  2812: "Holy Wrath",
  2944: "Devouring Plague",
  3044: "Arcane Shot",
  3140: "Fireball",
  3408: "Crippling Poison",
  3747: "Power Word: Shield",
  5143: "Arcane Missiles",
  5176: "Wrath",
  5185: "Healing Touch",
  5308: "Execute",
  5394: "Healing Stream Totem",
  5487: "Bear Form",
  5570: "Insect Swarm",
  5676: "Searing Pain",
  5857: "Hellfire Effect",
  6065: "Power Word: Shield",
  6066: "Power Word: Shield",
  6074: "Renew",
  6143: "Frost Ward",
  6229: "Shadow Ward",
  6353: "Soul Fire",
  6358: "Seduction",
  6359: "Fire Resistance",
  6544: "Heroic Leap",
  6552: "Pummel",
  6554: "Pummel",
  1671: "Shield Bash",
  1672: "Shield Bash",
  6572: "Revenge",
  6770: "Sap",
  6789: "Death Coil",
  6807: "Maul",
  6940: "Blessing of Sacrifice",
  7328: "Redemption",
  7373: "Hamstring",
  7384: "Overpower",
  7386: "Sunder Armor",
  8050: "Flame Shock",
  8056: "Frost Shock",
  8042: "Earth Shock",
  8044: "Earth Shock",
  8045: "Earth Shock",
  8046: "Earth Shock",
  8184: "Fire Resistance Totem",
  8190: "Magma Totem",
  8331: "Ez-Thro Dynamite II",
  8457: "Fire Ward",
  8461: "Frost Ward",
  8462: "Frost Ward",
  8676: "Ambush",
  8921: "Moonfire",
  8936: "Regrowth",
  9472: "Flash Heal",
  9473: "Flash Heal",
  9474: "Flash Heal",
  9484: "Shackle Undead",
  9512: "Thistle Tea",
  9592: "Flash Heal",
  9749: "Faerie Fire",
  9888: "Healing Touch",
  9889: "Healing Touch",
  10054: "Mana Agate",
  10057: "Mana Citrine",
  10058: "Mana Ruby",
  10060: "Power Infusion",
  10278: "Blessing of Protection",
  10412: "Earth Shock",
  10413: "Earth Shock",
  10414: "Earth Shock",
  10605: "Chain Lightning",
  10898: "Power Word: Shield",
  10899: "Power Word: Shield",
  10900: "Power Word: Shield",
  10901: "Power Word: Shield",
  10915: "Flash Heal",
  10916: "Flash Heal",
  10917: "Flash Heal",
  10927: "Renew",
  10928: "Renew",
  10929: "Renew",
  10931: "Prayer of Healing",
  10933: "Smite",
  10934: "Smite",
  10937: "Power Word: Fortitude",
  10938: "Power Word: Fortitude",
  10945: "Mind Blast",
  10946: "Mind Blast",
  10947: "Mind Blast",
  10951: "Inner Fire",
  10952: "Inner Fire",
  10953: "Mind Control",
  10955: "Shackle Undead",
  10957: "Shadow Word: Pain",
  10958: "Shadow Word: Pain",
  10963: "Greater Heal",
  10964: "Greater Heal",
  10965: "Greater Heal",
  11349: "Elixir of Poison Resistance",
  11357: "Blade Flurry",
  11551: "Battle Shout",
  11597: "Sunder Armor",
  11659: "Shadow Bolt",
  11660: "Shadow Bolt",
  11661: "Shadow Bolt",
  11739: "Shadow Ward",
  11958: "Ice Block",
  12472: "Icy Veins",
  12654: "Ignite",
  13021: "Blast Wave",
  13033: "Ice Barrier",
  13241: "Goblin Sapper Charge",
  13877: "Blade Flurry",
  15237: "Holy Nova",
  15258: "Shadow Weaving",
  15473: "Shadowform",
  16666: "Demonic Rune",
  17291: "Stratholme Holy Water",
  17528: "Mighty Rage Potion",
  17530: "Greater Mana Potion",
  17531: "Major Mana Potion",
  17534: "Major Healing Potion",
  17540: "Greater Stoneshield Potion",
  17543: "Greater Fire Protection Potion",
  17544: "Greater Frost Protection Potion",
  17546: "Greater Nature Protection Potion",
  17548: "Greater Shadow Protection Potion",
  17549: "Greater Arcane Protection Potion",
  18610: "Heavy Runecloth Bandage",
  19784: "Dense Dynamite",
  20066: "Repentance",
  20271: "Judgement",
  25289: "Battle Shout",
  25314: "Greater Heal",
  25315: "Renew",
  25316: "Prayer of Healing",
  25363: "Smite",
  25364: "Smite",
  25372: "Mind Blast",
  25375: "Mind Blast",
  25384: "Holy Fire",
  25396: "Healing Wave",
  25398: "Prayer of Healing",
  27869: "Dark Rune",
  28609: "Frost Ward",
  28610: "Shadow Ward",
  28764: "Frozen Rune",
  29166: "Innervate"
};

function matchingLabel(name, groups, id = 0) {
  const numericId = Number(id || 0);
  if (numericId) {
    const byId = groups.find(([, , ids]) => Array.isArray(ids) && ids.includes(numericId));
    if (byId) return byId[0];
  }
  const lower = clean(name).toLowerCase();
  if (!lower) return "";
  const found = groups.find(([, terms]) => terms.some(term => lower.includes(term.toLowerCase())));
  return found ? found[0] : "";
}

function labelForAbility(event, groups) {
  return matchingLabel(abilityName(event), groups, abilityId(event));
}

function displayAbilityName(event, preferExtra = false) {
  const name = preferExtra ? extraAbilityName(event) || abilityName(event) : abilityName(event) || extraAbilityName(event);
  if (name) return name;
  const id = preferExtra ? extraAbilityId(event) || abilityId(event) : abilityId(event) || extraAbilityId(event);
  return rpbSpellNamesById[id] || (id ? `Unbekannter Spell (${id})` : "");
}

function inferClassFromSpellName(spellName) {
  const text = clean(spellName).toLowerCase();
  if (!text) return "";
  const rules = [
    ["Priest", ["mind blast", "shadow word", "flash heal", "greater heal", "prayer of healing", "power word", "inner fire", "shackle undead", "psychic scream", "mind control", "mind soothe", "holy fire", "smite", "renew", "fade"]],
    ["Paladin", ["blessing of", "holy shock", "judgement", "exorcism", "hammer of justice", "divine shield", "cleanse", "purify", "seal of", "lay on hands"]],
    ["Druid", ["faerie fire", "wrath", "starfire", "moonfire", "healing touch", "regrowth", "rejuvenation", "innervate", "bear form", "cat form", "dire bear", "hibernate", "abolish poison"]],
    ["Mage", ["fireball", "frostbolt", "arcane missiles", "arcane brilliance", "arcane intellect", "counterspell", "detect magic", "fire blast", "pyroblast", "scorch", "ice block", "mana shield", "polymorph", "remove lesser curse"]],
    ["Warlock", ["shadow bolt", "corruption", "curse of", "drain life", "drain mana", "drain soul", "immolate", "life tap", "searing pain", "soul fire", "banish", "fear"]],
    ["Hunter", ["aimed shot", "arcane shot", "concussive shot", "distracting shot", "serpent sting", "tranquilizing shot", "viper sting", "wing clip", "aspect of", "feign death", "hunter's mark", "mend pet", "raptor strike"]],
    ["Rogue", ["ambush", "backstab", "cheap shot", "distract", "eviscerate", "expose armor", "feint", "garrote", "gouge", "kick", "kidney shot", "rupture", "sinister strike", "slice and dice"]],
    ["Warrior", ["battle shout", "berserker stance", "bloodthirst", "charge", "concussion blow", "defensive stance", "demoralizing shout", "execute", "hamstring", "heroic strike", "intercept", "intimidating shout", "mocking blow", "overpower", "pummel", "revenge", "shield bash", "shield block", "slam", "sunder armor", "taunt", "thunder clap"]]
  ];
  const found = rules.find(([, terms]) => terms.some(term => text.includes(term)));
  return found ? found[0] : "";
}

function rpbCastMeta(spellName, className = "") {
  const text = clean(spellName).toLowerCase();
  if (!text || text.startsWith("unbekannter spell")) return { castTime: 0, kind: "none" };
  const rules = [
    ["aoe", 0, ["cleave", "whirlwind", "multi-shot", "volley", "rain of fire", "hellfire", "blizzard", "arcane explosion", "cone of cold", "holy nova", "prayer of healing", "chain heal", "tranquility", "thunder clap", "sapper", "dynamite"]],
    ["st", 3.5, ["greater heal"]],
    ["st", 3.0, ["healing touch", "starfire", "fireball", "shadow bolt", "aimed shot", "pyroblast", "soul fire"]],
    ["st", 2.5, ["frostbolt", "smite", "holy fire", "heal", "mind blast", "wrath", "lightning bolt", "chain lightning"]],
    ["st", 2.0, ["regrowth", "flash heal", "flash of light", "shadow bolt volley"]],
    ["st", 1.5, ["renew", "rejuvenation", "moonfire", "arcane missiles", "scorch", "fire blast", "holy shock", "immolate", "searing pain", "corruption", "drain life", "drain mana", "drain soul", "shoot", "arcane shot", "serpent sting", "exorcism", "judgement", "cleanse", "purify", "dispel magic", "abolish disease", "cure disease", "power word", "shadow word", "faerie fire", "insect swarm", "hibernate", "banish", "curse of", "shadowburn"]],
    ["st", 1.0, ["heroic strike", "bloodthirst", "execute", "revenge", "sunder armor", "shield bash", "pummel", "kick", "sinister strike", "backstab", "eviscerate", "ambush", "gouge", "kidney shot", "rupture", "garrote", "slice and dice", "hamstring", "taunt", "battle shout", "demoralizing shout", "mortal strike", "overpower", "slam"]]
  ];
  const found = rules.find(([, , terms]) => terms.some(term => text.includes(term)));
  if (!found) return { castTime: 0, kind: "none" };
  let [, castTime, terms] = found;
  const kind = found[0];
  if (className === "Mage" && text.includes("fireball")) castTime = 3.5;
  if (className === "Mage" && text.includes("frostbolt")) castTime = 2.5;
  if (text.includes("arcane missiles")) castTime = 5;
  if (text.includes("arcane explosion")) castTime = 1.5;
  if (text.includes("cleave") || text.includes("whirlwind") || text.includes("thunder clap")) castTime = 1;
  return { castTime, kind };
}

async function buildClaAnalysisRows(analysis) {
  const { token, report, players, fightIds } = await fetchReportBaseForAnalysis(analysis.report_code);
  const combatantEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "CombatantInfo", fightIds);
  const playersById = actorNameById(players);
  const gearByPlayer = new Map();

  combatantEvents.forEach(event => {
    const player = playersById.get(eventSourceId(event));
    if (!player || gearByPlayer.has(player)) return;
    const gear = normalizeWarcraftLogsGear(event.gear || []);
    if (gear.length) gearByPlayer.set(player, gear);
  });

  const headerPlayers = players.map(player => player.name);
  const title = report.title || analysis.title || "";
  const zone = report.zone?.name || analysis.raid || "";
  const raidDate = report.startTime ? formatDateInBerlin(new Date(Number(report.startTime))) : "";
  const rows = [
    ["", "yes", "", "", "", "title ", title, ...headerPlayers.map(() => "")],
    ["bosses to consider", "all bosses", "", "", "", "zone ", zone, ...headerPlayers.map(() => "")],
    ["", "equip to exclude", "", "", "", "date ", raidDate || "", ...headerPlayers.map(() => "")],
    ["", "id", "name", "", ...headerPlayers.map(() => "Item [Enchant]")]
  ];

  claExcludedGear.forEach(([itemId, itemName], index) => {
    const row = ["", itemId, itemName, ""];
    headerPlayers.forEach(player => {
      const gear = gearByPlayer.get(player) || [];
      const found = gear.find(item => String(item.itemId || item.id) === String(itemId));
      if (!found) {
        row.push(index < headerPlayers.length ? "---------------------------------------------------------------" : "");
        return;
      }
      const enchant = found.permanentEnchantName || found.permanentEnchant || "no enchant";
      row.push(`${found.name || itemName} [${enchant}]`);
    });
    rows.push(row);
  });

  headerPlayers.forEach((player, index) => {
    const gear = gearByPlayer.get(player) || [];
    const missing = gear
      .filter(item => !item.permanentEnchant && !item.permanentEnchantName && !["Hemd", "Schmuck 1", "Schmuck 2", "Ring 1", "Ring 2"].includes(item.slotName))
      .map(item => `${item.name} [no enchant]`);
    if (!missing.length) return;
    const row = ["", "", "", ""];
    headerPlayers.forEach((name, playerIndex) => row.push(playerIndex === index ? missing.join(", ") : ""));
    rows.push(row);
  });

  if (!combatantEvents.length) {
    rows.push([], ["Hinweis", "Keine CombatantInfo-Daten von Warcraft Logs erhalten."]);
  }

  return rows;
}

async function buildRpbAnalysisRows(analysis) {
  const { token, players, fightIds } = await fetchReportBaseForAnalysis(analysis.report_code);
  const playersById = actorNameById(players);
  const headerPlayers = players.map(player => player.name);
  const castEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "Casts", fightIds);
  const damageDoneEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "DamageDone", fightIds);
  const damageTakenEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "DamageTaken", fightIds);
  const interruptEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "Interrupts", fightIds);
  const consumes = {};
  const trinketsAndRacials = {};
  const absorbs = {};
  const engineeringCounts = {};
  const engineeringDamage = {};
  const interrupts = {};
  const interruptNames = {};

  castEvents.forEach(event => {
    const player = playersById.get(eventSourceId(event));
    const label = labelForAbility(event, rpbConsumables);
    if (player && label) addPlayerAmount(consumes, player, label, 1);
  });

  damageTakenEvents.forEach(event => {
    const player = playersById.get(eventTargetId(event));
    const label = matchingLabel(
      extraAbilityName(event) || abilityName(event),
      rpbAbsorbs,
      extraAbilityId(event) || abilityId(event)
    );
    const amount = Number(event.absorbed || event.absorb || event.amount || 0);
    if (player && label && amount) addPlayerAmount(absorbs, player, label, amount);
  });

  damageDoneEvents.forEach(event => {
    const player = playersById.get(eventSourceId(event));
    const label = labelForAbility(event, rpbEngineering);
    const amount = Number(event.amount || 0);
    if (player && label) {
      addPlayerAmount(engineeringCounts, player, label, 1);
      addPlayerAmount(engineeringDamage, player, "damage done with Engineering etc. total", amount);
    }
  });

  interruptEvents.forEach(event => {
    const player = playersById.get(eventSourceId(event));
    if (!player) return;
    addPlayerAmount(interrupts, player, "# of interrupted spells", 1);
    const interrupted = displayAbilityName(event, true) || "Interrupt";
    if (!interruptNames[player]) interruptNames[player] = new Set();
    interruptNames[player].add(interrupted);
  });

  const rows = [
    ["", ...headerPlayers],
    ["Consumables", ...headerPlayers.map(() => "")]
  ];
  rpbConsumables.forEach(([label]) => rows.push([label, ...headerPlayers.map(player => formatCountValue(consumes[label]?.[player]))]));
  rows.push(["temporary enchant uptime (1+ consecr./blessed?)", ...headerPlayers.map(() => "")]);
  rows.push([], ["Damage absorbed", ...headerPlayers.map(() => "")]);
  rpbAbsorbs.forEach(([label]) => rows.push([label, ...headerPlayers.map(player => formatCountValue(absorbs[label]?.[player]))]));
  rows.push(["total absorbed", ...headerPlayers.map(player => {
    const total = Object.keys(absorbs).reduce((sum, label) => label.startsWith("Power Word") ? sum : sum + Number(absorbs[label]?.[player] || 0), 0);
    return formatCountValue(total);
  })]);
  rows.push([], ["Engineering etc. (avg. hits per use)", ...headerPlayers.map(() => "")]);
  rpbEngineering.forEach(([label]) => rows.push([label, ...headerPlayers.map(player => formatCountValue(engineeringCounts[label]?.[player]))]));
  rows.push(["damage done with Engineering etc. total", ...headerPlayers.map(player => formatCountValue(engineeringDamage["damage done with Engineering etc. total"]?.[player]))]);
  rows.push([], ["Interrupted spells", ...headerPlayers.map(() => "")]);
  rows.push(["# of interrupted spells", ...headerPlayers.map(player => formatCountValue(interrupts["# of interrupted spells"]?.[player]))]);
  rows.push(["names and sources of interrupted spells", ...headerPlayers.map(player => interruptNames[player] ? Array.from(interruptNames[player]).join(", ") : "")]);

  if (!castEvents.length && !damageDoneEvents.length && !damageTakenEvents.length && !interruptEvents.length) {
    rows.push([], ["Hinweis", "Keine Detail-Events von Warcraft Logs erhalten."]);
  }

  return rows;
}

async function buildRpbWebAnalysis(analysis, options = {}) {
  const rpbConfig = await loadRpbConfigAll();
  const base = await fetchReportBaseForAnalysis(analysis.report_code);
  const { token, report, fights, fightIds } = base;
  const classByName = options.classByName instanceof Map ? options.classByName : new Map();
  const roleByName = options.roleByName instanceof Map ? options.roleByName : new Map();
  const players = (base.players || []).map(player => ({
    ...player,
    className: normalizeRpbClassName(classByName.get(clean(player.name).toLowerCase()) || player.className) || "",
    raidRole: normalizeLogAnalysisRaidRole(roleByName.get(clean(player.name).toLowerCase()))
  }));
  const playersById = actorById(players);
  const reportDurationMs = Math.max(0, Number(report.endTime || 0) - Number(report.startTime || 0));
  const fullReportScope = reportDurationMs > 0 ? { startTime: 0, endTime: reportDurationMs } : fightIds;
  const castEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "Casts", fullReportScope);
  const castsTable = await fetchReportTableForAnalysis(token, analysis.report_code, "Casts", fullReportScope);
  const damageDoneEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "DamageDone", fullReportScope);
  const damageTakenEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "DamageTaken", fullReportScope);
  const interruptEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "Interrupts", fullReportScope);
  const healingEvents = await fetchReportEventsForAnalysis(token, analysis.report_code, "Healing", fullReportScope);
  const consumes = {};
  const trinketsAndRacials = {};
  const absorbs = {};
  const engineeringCounts = {};
  const engineeringDamage = {};
  const interrupts = {};
  const interruptNames = {};
  const activeSeconds = {};
  const activeEventCounts = {};
  const wclActiveSeconds = {};
  const wclActivePercent = {};
  const healingTotals = {};
  const overhealTotals = {};
  const healingBySpell = {};
  const healingById = {};
  const classCasts = {};
  const damageHitsByPlayerAndAbility = {};
  const classCooldowns = {};
  const stSecondsByPlayer = {};
  const aoeSecondsByPlayer = {};
  const classCastSources = {};
  const healerClasses = new Set(["Druid", "Paladin", "Priest", "Shaman"]);
  const totalFightSeconds = Math.max(1, Math.round((fights || []).reduce((sum, fight) => {
    return sum + Math.max(0, Number(fight.endTime || 0) - Number(fight.startTime || 0));
  }, 0) / 1000));

  function playerNameFromEvent(event, source = true) {
    const player = playersById.get(source ? eventSourceId(event) : eventTargetId(event));
    return player ? player.name : "";
  }

  function markActive(event) {
    const player = playerNameFromEvent(event, true);
    if (!player) return;
    if (!activeSeconds[player]) activeSeconds[player] = new Set();
    const timestamp = Number(event.timestamp || event.time || 0);
    if (timestamp) activeSeconds[player].add(Math.floor(timestamp / 1000));
    activeEventCounts[player] = (activeEventCounts[player] || 0) + 1;
  }

  function addHealing(event) {
    const player = playerNameFromEvent(event, true);
    if (!player) return;
    const amount = Number(event.amount || 0);
    const overheal = Number(event.overheal || event.overhealing || event.overhealAmount || 0);
    const id = abilityId(event);
    const spell = displayAbilityName(event) || "Unbekannter Heal";
    healingTotals[player] = (healingTotals[player] || 0) + amount;
    overhealTotals[player] = (overhealTotals[player] || 0) + overheal;
    if (!healingBySpell[spell]) healingBySpell[spell] = {};
    if (!healingBySpell[spell][player]) healingBySpell[spell][player] = { amount: 0, overheal: 0, hits: 0 };
    healingBySpell[spell][player].amount += amount;
    healingBySpell[spell][player].overheal += overheal;
    healingBySpell[spell][player].hits += 1;
    if (id) {
      if (!healingById[id]) healingById[id] = {};
      if (!healingById[id][player]) healingById[id][player] = { amount: 0, overheal: 0, hits: 0 };
      healingById[id][player].amount += amount;
      healingById[id][player].overheal += overheal;
      healingById[id][player].hits += 1;
    }
  }

  function addClassCooldown(event) {
    const player = playersById.get(eventSourceId(event));
    if (!player || !player.className) return;
    const id = abilityId(event);
    const cooldown = findConfiguredCast(rpbConfig, player.className, id, "cooldowns");
    if (!cooldown) return;
    if (!classCooldowns[player.className]) classCooldowns[player.className] = {};
    if (!classCooldowns[player.className][cooldown.name]) classCooldowns[player.className][cooldown.name] = {};
    classCooldowns[player.className][cooldown.name][player.name] = (classCooldowns[player.className][cooldown.name][player.name] || 0) + 1;
  }

  function addDamageHit(event) {
    const player = playersById.get(eventSourceId(event));
    if (!player) return;
    const id = abilityId(event);
    if (!id) return;
    if (!damageHitsByPlayerAndAbility[player.name]) damageHitsByPlayerAndAbility[player.name] = {};
    damageHitsByPlayerAndAbility[player.name][id] = (damageHitsByPlayerAndAbility[player.name][id] || 0) + 1;
  }

  function addConfiguredCastCount(player, cast, kind, count, source = "events") {
    const amount = Number(count || 0);
    if (!player || !player.className || !cast || !cast.name || amount <= 0) return;
    let accepted = false;
    if (!classCasts[player.className]) classCasts[player.className] = {};
    if (!classCasts[player.className][cast.name]) classCasts[player.className][cast.name] = {};
    if (!classCastSources[player.className]) classCastSources[player.className] = {};
    if (!classCastSources[player.className][cast.name]) classCastSources[player.className][cast.name] = {};
    if (source === "table") {
      classCasts[player.className][cast.name][player.name] = amount;
      classCastSources[player.className][cast.name][player.name] = "table";
      accepted = true;
    } else if (classCastSources[player.className][cast.name]?.[player.name] !== "table") {
      classCasts[player.className][cast.name][player.name] = (classCasts[player.className][cast.name][player.name] || 0) + amount;
      classCastSources[player.className][cast.name][player.name] = "events";
      accepted = true;
    }
    if (!accepted) return;
    if (kind === "aoe") {
      aoeSecondsByPlayer[player.name] = (aoeSecondsByPlayer[player.name] || 0) + (cast.castTime * amount);
    } else {
      stSecondsByPlayer[player.name] = (stSecondsByPlayer[player.name] || 0) + (cast.castTime * amount);
    }
  }

  function addClassCast(event) {
    const player = playersById.get(eventSourceId(event));
    if (!player) return;
    if (labelForAbility(event, rpbConsumables) || labelForAbility(event, rpbEngineering)) return;
    const id = abilityId(event);
    const configuredStCast = findConfiguredCast(rpbConfig, player.className, id, "singleTarget");
    const configuredAoeCast = findConfiguredCast(rpbConfig, player.className, id, "aoe");
    const configuredCast = configuredStCast || configuredAoeCast;
    const spell = configuredCast?.name || displayAbilityName(event);
    if (!spell || /^\d+$/.test(spell)) return;
    if (!player.className) player.className = inferClassFromSpellName(spell);
    if (!player.className) return;
    if (configuredCast) {
      addConfiguredCastCount(player, configuredCast, configuredAoeCast ? "aoe" : "singleTarget", 1, "events");
    } else {
      if (!classCasts[player.className]) classCasts[player.className] = {};
      if (!classCasts[player.className][spell]) classCasts[player.className][spell] = {};
      classCasts[player.className][spell][player.name] = (classCasts[player.className][spell][player.name] || 0) + 1;
      const meta = rpbCastMeta(spell, player.className);
      if (meta.castTime > 0 && meta.kind === "aoe") {
        aoeSecondsByPlayer[player.name] = (aoeSecondsByPlayer[player.name] || 0) + meta.castTime;
      } else if (meta.castTime > 0 && meta.kind === "st") {
        stSecondsByPlayer[player.name] = (stSecondsByPlayer[player.name] || 0) + meta.castTime;
      }
    }
  }

  async function loadPlayerCastTables() {
    const limitedPlayers = players.filter(player => player.id && player.className);
    const concurrency = 4;
    let index = 0;
    async function worker() {
      while (index < limitedPlayers.length) {
        const player = limitedPlayers[index++];
        const table = await fetchReportTableForAnalysis(token, analysis.report_code, "Casts", fullReportScope, player.id);
        const entries = Array.isArray(table.entries) ? table.entries : [];
        entries.forEach(entry => {
          const count = Number(entry.total || entry.uses || entry.amount || entry.count || 0);
          if (!count) return;
          const id = abilityIdFromTableEntry(entry);
          const trinket = (rpbConfig.trinketsAndRacials || []).find(item => item.ids.includes(id));
          if (trinket) addPlayerAmount(trinketsAndRacials, player.name, trinket.name, count);
          const configuredStCast = findConfiguredCast(rpbConfig, player.className, id, "singleTarget");
          const configuredAoeCast = findConfiguredCast(rpbConfig, player.className, id, "aoe");
          const configuredCast = configuredStCast || configuredAoeCast;
          if (!configuredCast) return;
          addConfiguredCastCount(player, configuredCast, configuredAoeCast ? "aoe" : "singleTarget", count, "table");
        });
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, limitedPlayers.length) }, () => worker()));
  }

  if (castsTable && Array.isArray(castsTable.entries)) {
    const tableTotalTime = Number(castsTable.totalTime || 0);
    castsTable.entries.forEach(entry => {
      const name = clean(entry.name);
      if (!name) return;
      const activeMs = Number(entry.activeTime || 0);
      if (activeMs > 0) wclActiveSeconds[name] = Math.round(activeMs / 1000);
      if (tableTotalTime > 0 && activeMs > 0) wclActivePercent[name] = `${Math.round(activeMs * 100 / tableTotalTime)}%`;
      const player = players.find(item => item.name === name);
      if (player && !player.className) player.className = normalizeRpbClassName(entry.type || entry.icon || entry.className);
    });
  }

  await loadPlayerCastTables();

  castEvents.forEach(event => {
    markActive(event);
    addClassCast(event);
    addClassCooldown(event);
  });
  damageDoneEvents.forEach(event => {
    markActive(event);
    addDamageHit(event);
  });
  healingEvents.forEach(event => {
    markActive(event);
    addHealing(event);
  });

  players.forEach(player => {
    if (!player.className) player.className = normalizeRpbClassName(classByName.get(clean(player.name).toLowerCase()));
    if (!player.className) player.className = "Unknown";
    player.raidRole = normalizeLogAnalysisRaidRole(roleByName.get(clean(player.name).toLowerCase()) || player.raidRole);
  });
  players.sort((a, b) => {
    const aIndex = rpbClassOrder.includes(a.className) ? rpbClassOrder.indexOf(a.className) : 999;
    const bIndex = rpbClassOrder.includes(b.className) ? rpbClassOrder.indexOf(b.className) : 999;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name, "de");
  });

  castEvents.forEach(event => {
    const player = playerNameFromEvent(event, true);
    const label = labelForAbility(event, rpbConsumables);
    if (player && label) addPlayerAmount(consumes, player, label, 1);
  });

  damageTakenEvents.forEach(event => {
    const player = playerNameFromEvent(event, false);
    const label = matchingLabel(
      extraAbilityName(event) || abilityName(event),
      rpbAbsorbs,
      extraAbilityId(event) || abilityId(event)
    );
    const amount = Number(event.absorbed || event.absorb || event.amount || 0);
    if (player && label && amount) addPlayerAmount(absorbs, player, label, amount);
  });

  damageDoneEvents.forEach(event => {
    const player = playerNameFromEvent(event, true);
    const label = labelForAbility(event, rpbEngineering);
    const amount = Number(event.amount || 0);
    if (player && label) {
      addPlayerAmount(engineeringCounts, player, label, 1);
      addPlayerAmount(engineeringDamage, player, "Gesamtschaden durch Engineering etc.", amount);
    }
  });

  interruptEvents.forEach(event => {
    const player = playerNameFromEvent(event, true);
    if (!player) return;
    addPlayerAmount(interrupts, player, "# of interrupted spells", 1);
    const interrupted = displayAbilityName(event, true) || "Interrupt";
    if (!interruptNames[player]) interruptNames[player] = new Set();
    interruptNames[player].add(interrupted);
  });

  const playerNames = players.map(player => player.name);
  const countRow = (label, table, options = {}) => ({
    label,
    type: options.type || "count",
    tone: options.tone || "",
    values: Object.fromEntries(playerNames.map(player => [player, formatCountValue(table[label]?.[player])]))
  });
  const amountRow = (label, table, options = {}) => ({
    label,
    type: options.type || "amount",
    tone: options.tone || "",
    values: Object.fromEntries(playerNames.map(player => [player, formatCountValue(table[label]?.[player])]))
  });
  const customRow = (label, values, options = {}) => ({
    label,
    type: options.type || "count",
    tone: options.tone || "",
    values: Object.fromEntries(playerNames.map(player => [player, values[player] || ""]))
  });
  const generalConsumableTone = label => {
    if (/Demonic Rune|Dark Rune|Healthstone|Mana Ruby|Mana Gems|Thistle Tea/i.test(label)) return "consumableGreen";
    if (/Poison Resistance|Runecloth Bandage/i.test(label)) return "muted";
    return "consumableBlue";
  };
  const absorbTone = label => {
    if (/Nature/i.test(label)) return "absorbNature";
    if (/Arcane/i.test(label)) return "absorbArcane";
    if (/Fire|Frozen Rune/i.test(label)) return "absorbFire";
    if (/Frost/i.test(label)) return "absorbFrost";
    if (/Shadow|Power Word/i.test(label)) return "absorbShadow";
    return "absorb";
  };
  const engineeringTone = label => label.indexOf("damage done") > -1 ? "engineeringTotal" : "engineering";

  const buildActivityRows = scopeNames => {
    const scoped = Array.isArray(scopeNames) && scopeNames.length ? scopeNames : playerNames;
    const maxTotalActiveSeconds = Math.max(1, ...scoped.map(player => {
      return Math.round((stSecondsByPlayer[player] || 0) + (aoeSecondsByPlayer[player] || 0));
    }));
    return [
    customRow("Sekunden aktiv auf Einzelziel", Object.fromEntries(playerNames.map(player => [
      player,
      formatCountValue(stSecondsByPlayer[player])
    ])), { tone: "activity" }),
    customRow("Aktiv auf Einzelziel %", Object.fromEntries(playerNames.map(player => [
      player,
      stSecondsByPlayer[player] ? `${Math.round((stSecondsByPlayer[player] || 0) * 100 / maxTotalActiveSeconds)}%` : ""
    ])), { tone: "activity" }),
    customRow("Aktiv gesamt %", Object.fromEntries(playerNames.map(player => [
      player,
      (stSecondsByPlayer[player] || aoeSecondsByPlayer[player])
        ? `${Math.round(((stSecondsByPlayer[player] || 0) + (aoeSecondsByPlayer[player] || 0)) * 100 / maxTotalActiveSeconds)}%`
        : ""
    ])), { tone: "activityStrong" }),
    customRow("Aktiv auf AoE %", Object.fromEntries(playerNames.map(player => [
      player,
      aoeSecondsByPlayer[player] ? `${Math.round((aoeSecondsByPlayer[player] || 0) * 100 / maxTotalActiveSeconds)}%` : ""
    ])), { tone: "activity" }),
    customRow("Sekunden aktiv auf AoE", Object.fromEntries(playerNames.map(player => [
      player,
      formatCountValue(aoeSecondsByPlayer[player])
    ])), { tone: "activity" }),
    customRow("WCL-Aktivität gesamt", Object.fromEntries(playerNames.map(player => [
      player,
      wclActivePercent[player] || ""
    ])), { tone: "activity" })
    ];
  };
  const activityRows = buildActivityRows(playerNames);

  const healerNames = players
    .filter(player => healerClasses.has(player.className) || healingTotals[player.name])
    .map(player => player.name);
  const healingRows = [
    customRow("Heilung gesamt", Object.fromEntries(playerNames.map(player => [player, formatCountValue(healingTotals[player])])), { tone: "healing" }),
    customRow("Overheal gesamt", Object.fromEntries(playerNames.map(player => [player, formatCountValue(overhealTotals[player])])), { tone: "healing" }),
    customRow("Overheal %", Object.fromEntries(playerNames.map(player => {
      const healing = Number(healingTotals[player] || 0);
      const overheal = Number(overhealTotals[player] || 0);
      return [player, healing + overheal > 0 ? `${Math.round(overheal * 100 / (healing + overheal))}%` : ""];
    })), { tone: "healing" })
  ];
  Object.keys(healingBySpell)
    .sort((a, b) => a.localeCompare(b, "de"))
    .forEach(spell => {
      healingRows.push(customRow(`${spell} (Overheal %)`, Object.fromEntries(playerNames.map(player => {
        const data = healingBySpell[spell][player];
        if (!data || (!data.amount && !data.overheal)) return [player, ""];
        const pct = data.amount + data.overheal > 0 ? Math.round(data.overheal * 100 / (data.amount + data.overheal)) : 0;
        return [player, `${Math.round(data.amount)} (${pct}%)`];
      })), { type: "text", tone: "healing" }));
    });

  const headerRow = (label, options = {}) => ({
    label,
    type: "header",
    tone: options.tone || "sectionHeader",
    className: options.className || "",
    values: {}
  });

  function configuredCastRow(className, cast, kind) {
    const isHealingRow = cast.hasOverheal || healerClasses.has(className);
    return customRow(cast.name, Object.fromEntries(playerNames.map(player => {
      const classPlayers = players.filter(item => item.className === className).map(item => item.name);
      if (!classPlayers.includes(player)) return [player, ""];
      const castCount = Number(classCasts[className]?.[cast.name]?.[player] || 0);
      if (cast.hasOverheal) {
        const data = cast.ids.reduce((sum, id) => {
          const row = healingById[id]?.[player];
          if (!row) return sum;
          sum.amount += Number(row.amount || 0);
          sum.overheal += Number(row.overheal || 0);
          return sum;
        }, { amount: 0, overheal: 0 });
        if (!castCount) return [player, "0"];
        const pct = data.amount + data.overheal > 0 ? Math.round(data.overheal * 100 / (data.amount + data.overheal)) : 0;
        return [player, `${formatCountValue(castCount)} (${pct}%)`];
      }
      if (kind === "aoe" && castCount > 0) {
        const ids = new Set(cast.ids || []);
        if (/Blade Flurry/i.test(cast.name)) ids.add(22482);
        const hits = Array.from(ids).reduce((sum, id) => sum + Number(damageHitsByPlayerAndAbility[player]?.[id] || 0), 0);
        if (hits > 0) return [player, `${formatCountValue(castCount)} (${(hits / castCount).toFixed(2)})`];
      }
      return [player, formatCountValue(castCount)];
    })), { type: cast.hasOverheal ? "text" : "count", tone: isHealingRow ? "healing" : kind === "aoe" ? "aoeCast" : "classCast" });
  }

  function configuredCooldownRows(className) {
    const cooldowns = rpbConfig.byClass?.[className]?.cooldowns || [];
    const rows = [];
    cooldowns.forEach(cooldown => {
      rows.push(customRow(`${cooldown.name} auf Trash`, Object.fromEntries(playerNames.map(player => [player, "0"])), { tone: "cooldown" }));
      rows.push(customRow(`${cooldown.name} auf Bossen`, Object.fromEntries(playerNames.map(player => [player, "0"])), { tone: "cooldown" }));
      rows.push(customRow(`${cooldown.name} gesamt`, Object.fromEntries(playerNames.map(player => [
        player,
        formatCountValue(classCooldowns[className]?.[cooldown.name]?.[player])
      ])), { tone: "total" }));
    });
    return rows;
  }

  const classSections = rpbClassOrder
    .filter(className => players.some(player => player.className === className))
    .map(className => {
      const classPlayers = players.filter(player => player.className === className).map(player => player.name);
      const config = rpbConfig.byClass?.[className] || { singleTarget: [], aoe: [] };
      const castRows = [
        ...config.singleTarget.map(cast => configuredCastRow(className, cast, "singleTarget")),
        ...config.aoe.map(cast => configuredCastRow(className, cast, "aoe"))
      ];

      const cooldownRows = configuredCooldownRows(className);
      const rows = castRows;
      return {
        id: `class-${className.toLowerCase()}`,
        label: className,
        className,
        description: `${className}: klassenspezifische Casts.`,
        rows: rows.length ? rows : [customRow("Keine Klassencasts erkannt", {}, { tone: "classCast" })],
        cooldownRows,
        playerFilter: classPlayers
      };
    });
  const classSectionByName = new Map(classSections.map(section => [section.className, section]));
  const namesForClasses = classNames => players
    .filter(player => classNames.includes(player.className))
    .map(player => player.name);
  const namesForRolesOrClasses = (roleNames, classNames) => players
    .filter(player => {
      if (player.raidRole === "ignore") return false;
      if (player.raidRole) return roleNames.includes(player.raidRole);
      return classNames.includes(player.className);
    })
    .map(player => player.name);
  const namesForRolesOnly = roleNames => players
    .filter(player => player.raidRole !== "ignore" && player.raidRole && roleNames.includes(player.raidRole))
    .map(player => player.name);
  const roleAwareNames = (roleNames, fallbackClassNames) => {
    const explicit = namesForRolesOnly(roleNames);
    return explicit.length ? explicit : namesForRolesOrClasses(roleNames, fallbackClassNames);
  };
  const rowsForClasses = (classNames, scopeNamesOverride = null) => {
    const rows = [];
    const sections = classNames.map(className => classSectionByName.get(className)).filter(Boolean);
    classNames.forEach(className => {
      const section = classSectionByName.get(className);
      if (!section) return;
      rows.push(headerRow(className, { className }));
      rows.push(...section.rows);
    });
    const scopeNames = Array.isArray(scopeNamesOverride) ? scopeNamesOverride : namesForClasses(classNames);
    if (scopeNames.length) rows.push(...buildActivityRows(scopeNames));
    sections.forEach(section => {
      if (!section.cooldownRows || !section.cooldownRows.length) return;
      rows.push(headerRow("Klassenspezifische Cooldowns", { className: section.className }));
      rows.push(...section.cooldownRows);
    });
    return rows.length ? rows : [customRow("Keine Klassencasts erkannt", {}, { tone: "classCast" })];
  };

  const casterPlayerNames = namesForRolesOrClasses(["caster", "owl", "shadow", "support"], ["Druid", "Mage", "Warlock", "Priest", "Shaman"]);
  const healerPlayerNames = roleAwareNames(["healer"], ["Druid", "Paladin", "Priest", "Shaman"]);
  const physicalPlayerNames = namesForRolesOrClasses(["melee", "cat", "hunter"], ["Druid", "Hunter", "Rogue", "Warrior"]);
  const tankPlayerNames = namesForRolesOrClasses(["main_tank", "off_tank", "tank"], ["Druid", "Paladin", "Warrior"]);

  const totalAbsorbed = {
    label: "Gesamt absorbiert",
    type: "amount",
    tone: "total",
    values: Object.fromEntries(playerNames.map(player => {
      const total = Object.keys(absorbs).reduce((sum, label) => {
        return label.startsWith("Power Word") ? sum : sum + Number(absorbs[label]?.[player] || 0);
      }, 0);
      return [player, formatCountValue(total)];
    }))
  };

  const interruptDetails = {
    label: "Namen und Quellen der unterbrochenen Zauber",
    type: "text",
    values: Object.fromEntries(playerNames.map(player => [
      player,
      interruptNames[player] ? Array.from(interruptNames[player]).join(", ") : ""
    ]))
  };

  const generalRows = [
    headerRow("Stats and Miscellaneous"),
    ...activityRows,
    headerRow("Consumables"),
    ...rpbConsumables.map(([label]) => countRow(label, consumes, { tone: generalConsumableTone(label) })),
    headerRow("Trinkets und Racials"),
    ...(rpbConfig.trinketsAndRacials || []).map(item => countRow(item.name, trinketsAndRacials, { tone: "trinket" })),
    headerRow("Absorbierter Schaden"),
    ...rpbAbsorbs.map(([label]) => amountRow(label, absorbs, { tone: absorbTone(label) })),
    totalAbsorbed,
    headerRow("Engineering etc. (ø = Treffer pro Nutzung)"),
    ...rpbEngineering.map(([label]) => countRow(label, engineeringCounts, { tone: "engineering" })),
    amountRow("Gesamtschaden durch Engineering etc.", engineeringDamage, { tone: "engineeringTotal" }),
    headerRow("Unterbrochene Zauber"),
    countRow("# unterbrochene Zauber", interrupts, { tone: "interrupt" }),
    interruptDetails
  ];

  const sections = [
    {
      id: "general",
      label: "Allgemein",
      description: "Sheet-nahe Gesamtübersicht mit Aktivität, Consumables, Absorbs, Engineering und Interrupts.",
      rows: generalRows,
      hideEmptyRows: true,
      compact: true,
      ignoreClassFilter: true
    },
    {
      id: "caster",
      label: "Zauberer",
      description: "Caster-Übersicht: Aktivität und allgemeine Kennzahlen.",
      rows: buildActivityRows(casterPlayerNames),
      playerFilter: casterPlayerNames
    },
    {
      id: "caster-casts",
      label: "Zauberer - Zauber",
      description: "Klassenblöcke für Caster-Casts wie im Sheet.",
      rows: rowsForClasses(["Druid", "Mage", "Warlock", "Priest", "Shaman"], casterPlayerNames),
      playerFilter: casterPlayerNames,
      hideEmptyRows: true
    },
    {
      id: "healer",
      label: "Heiler",
      description: "Heiler-Übersicht mit Healing, Overheal und Aktivität.",
      rows: buildActivityRows(healerPlayerNames).concat(healingRows.slice(0, 3)),
      playerFilter: healerPlayerNames
    },
    {
      id: "healer-casts",
      label: "Heiler - Zauber",
      description: "Heiler-Casts und Overheal pro Spell.",
      rows: rowsForClasses(["Druid", "Paladin", "Priest", "Shaman"], healerPlayerNames),
      playerFilter: healerPlayerNames,
      hideEmptyRows: true
    },
    {
      id: "physical",
      label: "Nahkampf",
      description: "Physical-Übersicht mit Aktivität und allgemeinen Kennzahlen.",
      rows: buildActivityRows(physicalPlayerNames),
      playerFilter: physicalPlayerNames
    },
    {
      id: "physical-casts",
      label: "Nahkampf - Zauber",
      description: "Klassenblöcke für Physical-Casts wie im Sheet.",
      rows: rowsForClasses(["Druid", "Hunter", "Rogue", "Warrior"], physicalPlayerNames),
      playerFilter: physicalPlayerNames,
      hideEmptyRows: true
    },
    {
      id: "tank",
      label: "Tank",
      description: "Tank-nahe Übersicht mit Aktivität und vermeidbarem Schaden.",
      rows: buildActivityRows(tankPlayerNames).concat(rpbAbsorbs.map(([label]) => amountRow(label, absorbs, { tone: "absorb" })).concat(totalAbsorbed)),
      playerFilter: tankPlayerNames
    },
    {
      id: "tank-casts",
      label: "Tank - Zauber",
      description: "Tank-Casts nach Klassenblöcken.",
      rows: rowsForClasses(["Druid", "Paladin", "Warrior"], tankPlayerNames),
      playerFilter: tankPlayerNames,
      hideEmptyRows: true
    }
  ];

  return {
    type: "rpb",
    generatedAt: new Date().toISOString(),
    analysis: normalizeLogAnalysis(analysis),
    report: {
      title: report.title || analysis.title || "",
      raid: report.zone?.name || analysis.raid || "",
      raidDate: report.startTime ? formatDateInBerlin(new Date(Number(report.startTime))) : (analysis.raid_date ? new Date(analysis.raid_date).toISOString().slice(0, 10) : ""),
      reportCode: analysis.report_code || "",
      reportUrl: analysis.report_url || ""
    },
    players: players.map(player => ({
      id: player.id,
      name: player.name,
      server: player.server || "",
      className: player.className || "",
      raidRole: player.raidRole || ""
    })),
    roleOptions: logAnalysisRaidRoleOptions,
    sections,
    warnings: (!castEvents.length && !damageDoneEvents.length && !damageTakenEvents.length && !interruptEvents.length && !healingEvents.length)
      ? ["Keine Detail-Events von Warcraft Logs erhalten."]
      : []
  };
}

async function buildLogAnalysisRows(analysis, type) {
  try {
    return type === "cla" ? await buildClaAnalysisRows(analysis) : await buildRpbAnalysisRows(analysis);
  } catch (error) {
    console.warn("Loganalyse konnte nicht vollständig erzeugt werden:", error.message || error);
    return buildLogAnalysisFallbackRows(analysis, type, error);
  }
}

function buildLogAnalysisFallbackRows(analysis, type, error = null) {
  const summary = analysis.summary || {};
  const kind = type === "cla" ? "CLA" : "RPB";
  const generatedAt = new Date().toISOString();
  const raid = analysis.raid || summary.raid || "Nicht erkannt";
  const raidDate = analysis.raid_date ? new Date(analysis.raid_date).toISOString().slice(0, 10) : (summary.raidDate || "");
  const title = analysis.title || "";
  return [
    [`${kind} Loganalyse`],
    [],
    ["Feld", "Wert"],
    ["Typ", kind],
    ["Raid", raid],
    ["Datum", raidDate || "-"],
    ["Warcraft-Logs-Code", analysis.report_code || ""],
    ["Warcraft-Logs-Link", analysis.report_url || ""],
    ["Titel", title],
    ["Erstellt am", generatedAt],
    [],
    ["Auswertung", "Hinweis"],
    [
      type === "cla" ? "CLA" : "RPB",
      "Die Datei wurde aus dem gespeicherten Warcraft-Logs-Report in LichtLoot erzeugt. Detailwerte koennen hier erweitert werden, sobald die gewuenschten Bewertungsregeln feststehen."
    ],
    ...(error ? [["Hinweis", error.message || String(error)]] : [])
  ];
}

async function buildLogAnalysisCsv(analysis, type) {
  return buildCsv(await buildLogAnalysisRows(analysis, type));
}

async function getPublicLogAnalysisWeb({ guildId, query: params }) {
  await ensureLogAnalysesTable();
  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType || "rpb").toLowerCase();
  if (!isUuid(id)) {
    const error = new Error("Loganalyse-ID fehlt.");
    error.statusCode = 400;
    throw error;
  }
  if (type !== "rpb") {
    const error = new Error("Web-Auswertung ist aktuell zuerst für RPB verfügbar.");
    error.statusCode = 400;
    throw error;
  }
  const result = await query(
    `select *
     from log_analyses
     where guild_id = $1 and id = $2
     limit 1`,
    [guildId, id]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  const classByName = await getGuildClassMap(guildId);
  const roleByName = new Map(Object.entries(result.rows[0].summary?.raidRoles || {}).map(([name, role]) => [
    clean(name).toLowerCase(),
    normalizeLogAnalysisRaidRole(role)
  ]));
  return {
    success: true,
    webAnalysis: await buildRpbWebAnalysis(result.rows[0], { classByName, roleByName })
  };
}

async function setPublicLogAnalysisRaidRoles({ guildId, query: params }) {
  await ensureLogAnalysesTable();
  const id = clean(params.id || params.analysisId);
  if (!isUuid(id)) {
    const error = new Error("Loganalyse-ID fehlt.");
    error.statusCode = 400;
    throw error;
  }
  const rawRoles = typeof params.roles === "string" ? JSON.parse(params.roles || "{}") : (params.roles || {});
  const raidRoles = {};
  Object.entries(rawRoles || {}).forEach(([name, role]) => {
    const player = clean(name);
    const normalized = normalizeLogAnalysisRaidRole(role);
    if (player && normalized) raidRoles[player] = normalized;
  });
  const result = await query(
    `update log_analyses
     set summary = coalesce(summary, '{}'::jsonb) || jsonb_build_object('raidRoles', $3::jsonb),
         updated_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [guildId, id, JSON.stringify(raidRoles)]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  return {
    success: true,
    raidRoles,
    analysis: normalizeLogAnalysis(result.rows[0])
  };
}

async function downloadLogAnalysis({ guildId, query: params, res }) {
  await ensureLogAnalysesTable();

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  const token = clean(params.token);
  if (!isUuid(id) || !["cla", "rpb"].includes(type) || !token) {
    const error = new Error("Download-Link ist unvollständig.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `select *
     from log_analyses
     where guild_id = $1 and id = $2
     limit 1`,
    [guildId, id]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const analysis = result.rows[0];
  const summary = analysis.summary || {};
  const expectedToken = type === "cla" ? summary.claDownloadToken : summary.rpbDownloadToken;
  if (!expectedToken || token !== expectedToken) {
    const error = new Error("Download-Link ist nicht mehr gültig.");
    error.statusCode = 403;
    throw error;
  }

  const raid = analysis.raid || summary.raid || "log";
  const raidDate = analysis.raid_date ? new Date(analysis.raid_date).toISOString().slice(0, 10) : (summary.raidDate || "");
  const filename = `${type.toUpperCase()}-${slugPart(raid)}${raidDate ? `-${raidDate}` : ""}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(await buildLogAnalysisCsv(analysis, type));
}

async function ensureLogAnalysesTable() {
  await query(
    `create table if not exists log_analyses (
       id uuid primary key default gen_random_uuid(),
       guild_id uuid not null references guilds(id) on delete cascade,
       report_code text not null,
       report_url text not null,
       title text,
       raid text,
       raid_date date,
       status text not null default 'pending',
       summary jsonb not null default '{}'::jsonb,
       discord_channel_id text,
       discord_message_id text,
       discord_author text,
       posted_at timestamptz,
       analyzed_at timestamptz,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now(),
       unique (guild_id, report_code)
     )`
  );
  await query(
    `create index if not exists log_analyses_guild_created_idx
     on log_analyses (guild_id, created_at desc)`
  );
}

async function getLogAnalyses({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const limit = Math.min(Math.max(Number(params.limit || 50), 1), 200);
  const result = await query(
    `select *
     from log_analyses
     where guild_id = $1
     order by coalesce(raid_date, posted_at::date, created_at::date) desc, posted_at desc nulls last, created_at desc
     limit $2`,
    [guildId, limit]
  );

  return {
    success: true,
    analyses: result.rows.map(normalizeLogAnalysis)
  };
}

async function getPublicLogAnalyses({ guildId, query: params }) {
  await ensureLogAnalysesTable();

  const limit = Math.min(Math.max(Number(params.limit || 12), 1), 40);
  const result = await query(
    `select *
     from log_analyses
     where guild_id = $1
     order by coalesce(raid_date, posted_at::date, created_at::date) desc, posted_at desc nulls last, created_at desc
     limit $2`,
    [guildId, limit]
  );

  return {
    success: true,
    analyses: result.rows.map(normalizeLogAnalysis)
  };
}

async function saveLogAnalysis({ guildId, query: params }) {
  requireMasterOrQueueToken(params);
  await ensureLogAnalysesTable();

  const reportUrl = clean(params.reportUrl || params.url || params.logUrl);
  const reportCode = clean(params.reportCode || extractWarcraftLogsReportCode(reportUrl));
  if (!reportCode) {
    const error = new Error("Warcraft-Logs-Report wurde nicht erkannt.");
    error.statusCode = 400;
    throw error;
  }

  const summary = typeof params.summary === "string"
    ? JSON.parse(params.summary || "{}")
    : (params.summary || {});
  const normalizedUrl = normalizeWarcraftLogsReportUrl(reportUrl, reportCode);
  const reportMeta = await fetchWarcraftLogsReportMetaSafe(reportCode);
  const logTitle = clean(params.title) || reportMeta.title || "";
  const logRaid = normalizeLogRaidType(params.raid || summary.raid || reportMeta.raid || "");
  const logDate = clean(params.raidDate || summary.raidDate || reportMeta.raidDate || "");

  const result = await query(
    `insert into log_analyses (
       guild_id, report_code, report_url, title, raid, raid_date, status, summary,
       discord_channel_id, discord_message_id, discord_author, posted_at, updated_at
     )
     values ($1,$2,$3,$4,$5,nullif($6,'')::date,$7,$8::jsonb,$9,$10,$11,nullif($12,'')::timestamptz,now())
     on conflict (guild_id, report_code) do update
       set report_url = excluded.report_url,
           title = coalesce(nullif(excluded.title, ''), log_analyses.title),
           raid = coalesce(nullif(excluded.raid, ''), log_analyses.raid),
           raid_date = coalesce(excluded.raid_date, log_analyses.raid_date),
           status = case
             when excluded.status in ('pending', '')
                  and (
                    nullif(log_analyses.summary->>'claDownloadUrl', '') is not null
                    or nullif(log_analyses.summary->>'rpbDownloadUrl', '') is not null
                    or log_analyses.status in ('cla_done', 'rpb_done')
                  )
               then log_analyses.status
             else coalesce(nullif(excluded.status, ''), log_analyses.status)
           end,
           summary = coalesce(log_analyses.summary, '{}'::jsonb) || coalesce(excluded.summary, '{}'::jsonb),
           discord_channel_id = coalesce(nullif(excluded.discord_channel_id, ''), log_analyses.discord_channel_id),
           discord_message_id = coalesce(nullif(excluded.discord_message_id, ''), log_analyses.discord_message_id),
           discord_author = coalesce(nullif(excluded.discord_author, ''), log_analyses.discord_author),
           posted_at = coalesce(excluded.posted_at, log_analyses.posted_at),
           updated_at = now()
     returning *`,
    [
      guildId,
      reportCode,
      normalizedUrl,
      logTitle,
      logRaid,
      logDate,
      clean(params.status || "pending"),
      JSON.stringify(summary || {}),
      clean(params.discordChannelId),
      clean(params.discordMessageId),
      clean(params.discordAuthor),
      clean(params.postedAt)
    ]
  );

  return {
    success: true,
    analysis: normalizeLogAnalysis(result.rows[0])
  };
}

async function runLogAnalysis({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  if (!isUuid(id)) {
    const error = new Error("Loganalyse-ID fehlt.");
    error.statusCode = 400;
    throw error;
  }
  if (!["cla", "rpb"].includes(type)) {
    const error = new Error("Unbekannter Analyse-Typ.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await query(
    `select *
     from log_analyses
     where guild_id = $1 and id = $2
     limit 1`,
    [guildId, id]
  );
  if (!existing.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const current = existing.rows[0];
  const reportMeta = (!current.raid || !current.raid_date)
    ? await fetchWarcraftLogsReportMetaSafe(current.report_code)
    : {};
  const downloadTokenKey = type === "cla" ? "claDownloadToken" : "rpbDownloadToken";
  const downloadUrlKey = type === "cla" ? "claDownloadUrl" : "rpbDownloadUrl";
  const downloadToken = current.summary?.[downloadTokenKey] || randomUUID();
  const generatorRunId = randomUUID();
  let generatorResult = null;
  let generatorError = "";
  try {
    generatorResult = await startExternalLogAnalysisGenerator({ analysis: current, type, guildId, generatorRunId });
  } catch (error) {
    generatorError = error.message || String(error);
    console.warn(`${type.toUpperCase()} Generator konnte nicht gestartet werden:`, error.message || error);
  }

  const generatedSheetUrl = generatorResult?.sheetUrl || generatorResult?.spreadsheetUrl || generatorResult?.url || "";
  const hasExternalGenerator = Boolean(generatorResult);
  const generatorStatus = generatedSheetUrl ? "done" : hasExternalGenerator ? "queued" : "failed";
  const summaryPatch = {
    lastRequestedAnalysis: type.toUpperCase(),
    analysisRequestedAt: new Date().toISOString(),
    [downloadTokenKey]: downloadToken,
    [`${type}GeneratorJobId`]: generatorResult?.jobId || "",
    [`${type}GeneratorRunId`]: generatorRunId,
    [`${type}GeneratorStartedAt`]: new Date().toISOString(),
    [`${type}GeneratorStatus`]: generatorResult?.status || generatorStatus,
    [`${type}GeneratorError`]: generatorError
  };
  if (generatedSheetUrl) summaryPatch[downloadUrlKey] = generatedSheetUrl;
  const nextStatus = generatedSheetUrl ? `${type}_done` : hasExternalGenerator ? `${type}_queued` : `${type}_failed`;
  const result = await query(
    `update log_analyses
     set status = $3,
         summary = coalesce(summary, '{}'::jsonb) || $4::jsonb,
         title = coalesce(nullif($5, ''), title),
         raid = coalesce(nullif($6, ''), raid),
         raid_date = coalesce(nullif($7, '')::date, raid_date),
         updated_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [
      guildId,
      id,
      nextStatus,
      JSON.stringify(summaryPatch),
      reportMeta.title || "",
      normalizeLogRaidType(reportMeta.raid || ""),
      reportMeta.raidDate || ""
    ]
  );

  return {
    success: true,
    analysisType: type.toUpperCase(),
    analysis: normalizeLogAnalysis(result.rows[0])
  };
}

function getLogAnalysisGeneratorConfig(type) {
  const prefix = type === "cla" ? "CLA" : "RPB";
  const url = process.env[`${prefix}_GENERATOR_URL`] || process.env.LOG_ANALYSIS_GENERATOR_URL || "";
  const token = process.env[`${prefix}_GENERATOR_TOKEN`] || process.env.LOG_ANALYSIS_GENERATOR_TOKEN || "";
  return { url: clean(url), token: clean(token) };
}

function buildLogAnalysisCallbackUrl(baseUrl) {
  const value = clean(baseUrl).replace(/\/$/, "");
  if (!value) return "";
  if (value.endsWith("/api/apps-script")) return value;
  return `${value}/api/apps-script`;
}

async function startExternalLogAnalysisGenerator({ analysis, type, guildId, generatorRunId }) {
  const config = getLogAnalysisGeneratorConfig(type);
  if (!config.url) return null;

  const callbackBaseUrl = process.env.LICHTLOOT_API_URL || process.env.PUBLIC_API_URL || "";
  const legacyApiKey = clean(
    process.env.WCL_V1_API_KEY ||
    process.env.WCL_API_KEY ||
    process.env.WARCRAFTLOGS_API_KEY ||
    process.env.RPB_CLIENT_KEY ||
    ""
  );
  const payload = {
    action: `create${type.toUpperCase()}`,
    type,
    analysisId: analysis.id,
    guildId,
    reportCode: analysis.report_code || "",
    reportUrl: analysis.report_url || "",
    raid: analysis.raid || "",
    raidDate: analysis.raid_date ? new Date(analysis.raid_date).toISOString().slice(0, 10) : "",
    title: analysis.title || "",
    apiKey: legacyApiKey,
    token: config.token,
    callbackToken: logAnalysisCallbackToken,
    jobToken: generatorRunId || "",
    generatorRunId: generatorRunId || "",
    callbackUrl: buildLogAnalysisCallbackUrl(callbackBaseUrl)
  };

  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `Generator antwortete mit HTTP ${response.status}`);
  }
  return data;
}

async function completeExternalLogAnalysis({ guildId, query: params }) {
  await ensureLogAnalysesTable();
  const token = clean(params.callbackToken || params.token);
  if (!logAnalysisCallbackToken || token !== logAnalysisCallbackToken) {
    const error = new Error("Generator-Rückmeldung ist nicht autorisiert.");
    error.statusCode = 403;
    throw error;
  }

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  if (!isUuid(id) || !["cla", "rpb"].includes(type)) {
    const error = new Error("Generator-Rückmeldung ist unvollständig.");
    error.statusCode = 400;
    throw error;
  }

  const sheetUrl = clean(params.sheetUrl || params.spreadsheetUrl || params.url || params.downloadUrl);
  const failed = clean(params.status).toLowerCase() === "failed" || clean(params.error);
  const callbackRunId = clean(params.jobToken || params.generatorRunId || params.runId);
  const downloadUrlKey = type === "cla" ? "claDownloadUrl" : "rpbDownloadUrl";
  if (callbackRunId) {
    const existing = await query(
      `select summary
       from log_analyses
       where guild_id = $1 and id = $2
       limit 1`,
      [guildId, id]
    );
    if (!existing.rows.length) {
      const error = new Error("Loganalyse wurde nicht gefunden.");
      error.statusCode = 404;
      throw error;
    }
    const activeRunId = clean(existing.rows[0].summary?.[`${type}GeneratorRunId`]);
    if (activeRunId && activeRunId !== callbackRunId) {
      return {
        success: true,
        ignored: true,
        reason: "stale_generator_callback",
        analysisType: type.toUpperCase()
      };
    }
    if (!activeRunId) {
      return {
        success: true,
        ignored: true,
        reason: "cancelled_generator_callback",
        analysisType: type.toUpperCase()
      };
    }
  }
  const summaryPatch = {
    [`${type}GeneratorStatus`]: failed ? "failed" : "done",
    [`${type}GeneratorFinishedAt`]: new Date().toISOString(),
    [`${type}GeneratorError`]: clean(params.error || ""),
    [`${type}GeneratorWarnings`]: clean(params.warnings || params.warning || "")
  };
  if (sheetUrl) summaryPatch[downloadUrlKey] = sheetUrl;

  const result = await query(
    `update log_analyses
     set status = $3,
         summary = coalesce(summary, '{}'::jsonb) || $4::jsonb,
         updated_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [
      guildId,
      id,
      failed ? `${type}_failed` : `${type}_done`,
      JSON.stringify(summaryPatch)
    ]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    analysisType: type.toUpperCase(),
    analysis: normalizeLogAnalysis(result.rows[0])
  };
}

async function setLogAnalysisSheetUrl({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  const sheetUrl = clean(params.sheetUrl || params.spreadsheetUrl || params.url || params.downloadUrl);
  if (!isUuid(id) || !["cla", "rpb"].includes(type)) {
    const error = new Error("Loganalyse-ID oder Typ fehlt.");
    error.statusCode = 400;
    throw error;
  }
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(sheetUrl)) {
    const error = new Error("Bitte einen Google-Sheets-Link einfügen.");
    error.statusCode = 400;
    throw error;
  }

  const downloadUrlKey = type === "cla" ? "claDownloadUrl" : "rpbDownloadUrl";
  const summaryPatch = {
    [downloadUrlKey]: sheetUrl,
    [`${type}GeneratorStatus`]: "done",
    [`${type}GeneratorFinishedAt`]: new Date().toISOString(),
    [`${type}GeneratorManualLink`]: true
  };
  const result = await query(
    `update log_analyses
     set status = $3,
         summary = coalesce(summary, '{}'::jsonb) || $4::jsonb,
         updated_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [guildId, id, `${type}_done`, JSON.stringify(summaryPatch)]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    analysisType: type.toUpperCase(),
    analysis: normalizeLogAnalysis(result.rows[0])
  };
}

async function cleanupIncompleteClaAnalyses({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const result = await query(
    `update log_analyses
     set status = case
           when nullif(summary->>'rpbDownloadUrl', '') is not null then 'rpb_done'
           when lower(coalesce(summary->>'rpbGeneratorStatus', '')) = 'queued' then 'rpb_queued'
           when lower(coalesce(summary->>'rpbGeneratorStatus', '')) = 'failed' then 'rpb_failed'
           else 'pending'
         end,
         summary = coalesce(summary, '{}'::jsonb)
           - 'claDownloadUrl'
           - 'claDownloadToken'
           - 'claGeneratorJobId'
           - 'claGeneratorRunId'
           - 'claGeneratorStartedAt'
           - 'claGeneratorStatus'
           - 'claGeneratorError'
           - 'claGeneratorWarnings'
           - 'claGeneratorFinishedAt'
           - 'claGeneratorManualLink',
         updated_at = now()
     where guild_id = $1
       and (
         status in ('cla_queued', 'cla_failed')
         or lower(coalesce(summary->>'claGeneratorStatus', '')) in ('queued', 'failed', 'error', 'started', 'running')
         or nullif(summary->>'claGeneratorError', '') is not null
         or (
           nullif(summary->>'claDownloadUrl', '') is not null
           and summary->>'claDownloadUrl' !~* '^https://docs\\.google\\.com/spreadsheets/d/'
         )
       )
     returning id`,
    [guildId]
  );

  return {
    success: true,
    deletedCla: result.rowCount
  };
}

async function cleanupIncompleteRpbAnalyses({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const result = await query(
    `update log_analyses
     set status = case
           when nullif(summary->>'claDownloadUrl', '') is not null then 'cla_done'
           when lower(coalesce(summary->>'claGeneratorStatus', '')) = 'queued' then 'cla_queued'
           when lower(coalesce(summary->>'claGeneratorStatus', '')) = 'failed' then 'cla_failed'
           else 'pending'
         end,
         summary = coalesce(summary, '{}'::jsonb)
           - 'rpbDownloadUrl'
           - 'rpbDownloadToken'
           - 'rpbGeneratorJobId'
           - 'rpbGeneratorRunId'
           - 'rpbGeneratorStartedAt'
           - 'rpbGeneratorStatus'
           - 'rpbGeneratorError'
           - 'rpbGeneratorWarnings'
           - 'rpbGeneratorFinishedAt'
           - 'rpbGeneratorManualLink',
         updated_at = now()
     where guild_id = $1
       and (
         status in ('rpb_queued', 'rpb_failed')
         or lower(coalesce(summary->>'rpbGeneratorStatus', '')) in ('queued', 'failed', 'error', 'started', 'running')
         or nullif(summary->>'rpbGeneratorError', '') is not null
         or (
           nullif(summary->>'rpbDownloadUrl', '') is not null
           and summary->>'rpbDownloadUrl' !~* '^https://docs\\.google\\.com/spreadsheets/d/'
         )
       )
     returning id`,
    [guildId]
  );

  return {
    success: true,
    deletedRpb: result.rowCount
  };
}

async function clearLogAnalysisType({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  await ensureLogAnalysesTable();

  const id = clean(params.id || params.analysisId);
  const type = clean(params.type || params.analysisType).toLowerCase();
  if (!isUuid(id) || !["cla", "rpb"].includes(type)) {
    const error = new Error("Loganalyse-ID oder Typ fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const otherType = type === "cla" ? "rpb" : "cla";
  const result = await query(
    `update log_analyses
     set status = case
           when nullif(summary->>$3, '') is not null then $4
           when lower(coalesce(summary->>$5, '')) = 'queued' then $6
           when lower(coalesce(summary->>$5, '')) = 'failed' then $7
           else 'pending'
         end,
         summary = coalesce(summary, '{}'::jsonb)
           - $8
           - $9
           - $10
           - $11
           - $12
           - $13
           - $14
           - $15
           - $16
           - $17,
         updated_at = now()
     where guild_id = $1 and id = $2
     returning *`,
    [
      guildId,
      id,
      `${otherType}DownloadUrl`,
      `${otherType}_done`,
      `${otherType}GeneratorStatus`,
      `${otherType}_queued`,
      `${otherType}_failed`,
      `${type}DownloadUrl`,
      `${type}DownloadToken`,
      `${type}GeneratorJobId`,
      `${type}GeneratorStatus`,
      `${type}GeneratorError`,
      `${type}GeneratorWarnings`,
      `${type}GeneratorFinishedAt`,
      `${type}GeneratorManualLink`,
      `${type}GeneratorRunId`,
      `${type}GeneratorStartedAt`
    ]
  );
  if (!result.rows.length) {
    const error = new Error("Loganalyse wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  return {
    success: true,
    analysisType: type.toUpperCase(),
    analysis: normalizeLogAnalysis(result.rows[0])
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
      status: "geschlossen",
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
  const status = normalizeStatus(params.status || "geschlossen");
  const p0plusFreigabe = normalizeStatus(params.p0PlusFreigabe || params.p0PlusOverride || "geöffnet");
  const createdBy = clean(params.createdBy || params.created_by || params.erstelltVon || params.ersteller);

  const result = await query(
    `insert into raids (
       guild_id, name, raid_type, raid_date, external_raid_id, raid_pin,
       lead_pin, raid_time, guild_name, player_link, status, p0plus_freigabe, created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
           created_by = coalesce(nullif(excluded.created_by, ''), raids.created_by),
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
      p0plusFreigabe,
      createdBy || null
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
       c.is_main,
       c.created_at as character_created_at,
       i1.name as p1,
       i2.name as p2,
       i3.name as p3
     from prios pr
     join characters c on c.id = pr.character_id
     left join items i1 on i1.id = pr.p1_item_id
     left join items i2 on i2.id = pr.p2_item_id
     left join items i3 on i3.id = pr.p3_item_id
     where pr.raid_id = $1
     order by c.is_main desc, c.created_at asc, c.class_name asc, c.name asc`,
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
        isMain: Boolean(row.is_main),
        main: Boolean(row.is_main),
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
    logAnalysesResult,
    hordenbuffEventsResult,
    hordenbuffEntriesResult,
    worldbuffEventsResult,
    worldbuffEntriesResult
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
    query("select * from log_analyses where guild_id = $1 order by created_at asc", [guildId]),
    query("select * from hordenbuff_events where guild_id = $1 order by event_date asc, event_time asc", [guildId]),
    query(
      `select he.*
       from hordenbuff_entries he
       join hordenbuff_events e on e.id = he.event_id
       where e.guild_id = $1
       order by e.event_date asc, e.event_time asc, he.created_at asc`,
      [guildId]
    ),
    query("select * from worldbuff_events where guild_id = $1 order by event_date asc, event_time asc", [guildId]),
    query(
      `select we.*
       from worldbuff_entries we
       join worldbuff_events e on e.id = we.event_id
       where e.guild_id = $1
       order by e.event_date asc, e.event_time asc, we.created_at asc`,
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
    logAnalyses: logAnalysesResult.rows,
    hordenbuffEvents: hordenbuffEventsResult.rows,
    hordenbuffEntries: hordenbuffEntriesResult.rows,
    worldbuffEvents: worldbuffEventsResult.rows,
    worldbuffEntries: worldbuffEntriesResult.rows
  };
}

function formatBackupDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return clean(value);
}

async function getRaidBackupSnapshot({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const limit = Math.min(Math.max(Number(params.limit || 120) || 120, 1), 500);
  const raidFilter = clean(params.raid || params.raidType);
  const raidId = clean(params.raidId || params.id);
  const values = [guildId, limit];
  const where = ["r.guild_id = $1"];

  if (raidFilter) {
    values.push(raidTypeSearchValues(raidFilter));
    where.push(`lower(r.raid_type) = any($${values.length})`);
  }

  if (raidId) {
    values.push(raidId);
    where.push(`(r.id::text = $${values.length} or r.external_raid_id = $${values.length} or r.raid_pin = $${values.length})`);
  }

  const raidsResult = await query(
    `select r.*,
            (
              select count(*)::int
              from prios pr
              where pr.raid_id = r.id
            ) as prio_count,
            (
              select count(*)::int
              from p0plus_points pp
              where pp.guild_id = r.guild_id
                and pp.note in (
                  concat('RaidID: ', coalesce(r.external_raid_id, r.id::text)),
                  concat('RaidID: ', r.id::text),
                  concat('RaidID: ', r.raid_pin),
                  concat('Bench RaidID: ', coalesce(r.external_raid_id, r.id::text)),
                  concat('Bench RaidID: ', r.id::text),
                  concat('Bench RaidID: ', r.raid_pin)
                )
            ) as p0plus_transfer_count
     from raids r
     where ${where.join(" and ")}
     order by r.raid_date desc nulls last, coalesce(r.raid_time, '') desc, r.created_at desc
     limit $2`,
    values
  );

  const raidRows = raidsResult.rows;
  const raidIds = raidRows.map(row => row.id);
  if (!raidIds.length) {
    return { success: true, generatedAt: new Date().toISOString(), raids: [] };
  }

  const [priosResult, p0PlusResult] = await Promise.all([
    query(
      `select
         pr.id,
         pr.raid_id,
         pr.comment,
         pr.bench,
         pr.created_at,
         pr.updated_at,
         c.name as player,
         c.server,
         c.class_name,
         c.is_main,
         i1.name as p1,
         i2.name as p2,
         i3.name as p3
       from prios pr
       join characters c on c.id = pr.character_id
       left join items i1 on i1.id = pr.p1_item_id
       left join items i2 on i2.id = pr.p2_item_id
       left join items i3 on i3.id = pr.p3_item_id
       where pr.raid_id = any($1::uuid[])
       order by c.is_main desc, c.created_at asc, c.class_name asc, c.name asc`,
      [raidIds]
    ),
    query(
      `select
         r.id as raid_id,
         pp.id,
         pp.points,
         pp.source,
         pp.note,
         pp.created_at,
         c.name as player,
         c.server,
         c.class_name,
         i.name as item,
         i.raid_type,
         i.quality
       from raids r
       join p0plus_points pp
         on pp.guild_id = r.guild_id
        and pp.note in (
          concat('RaidID: ', coalesce(r.external_raid_id, r.id::text)),
          concat('RaidID: ', r.id::text),
          concat('RaidID: ', r.raid_pin),
          concat('Bench RaidID: ', coalesce(r.external_raid_id, r.id::text)),
          concat('Bench RaidID: ', r.id::text),
          concat('Bench RaidID: ', r.raid_pin)
        )
       join characters c on c.id = pp.character_id
       left join items i on i.id = pp.item_id
       where r.id = any($1::uuid[])
       order by pp.created_at desc, c.name asc, i.name asc`,
      [raidIds]
    )
  ]);

  const priosByRaid = new Map();
  for (const row of priosResult.rows) {
    const meta = commentMeta(row.comment);
    const entry = {
      id: row.id,
      player: row.player || "",
      server: row.server || "",
      className: row.class_name || "",
      isMain: Boolean(row.is_main),
      p1: row.p1 || "",
      p2: row.p2 || "",
      p3: row.p3 || "",
      p0Plus: meta.p0Plus || "nein",
      p0Item: meta.p0Item || "",
      bench: row.bench || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    if (!priosByRaid.has(row.raid_id)) priosByRaid.set(row.raid_id, []);
    priosByRaid.get(row.raid_id).push(entry);
  }

  const p0PlusByRaid = new Map();
  for (const row of p0PlusResult.rows) {
    const entry = {
      id: row.id,
      player: row.player || "",
      server: row.server || "",
      className: row.class_name || "",
      item: row.item || "",
      raid: row.raid_type || "",
      quality: row.quality || "",
      points: Number(row.points || 0),
      source: row.source || "",
      note: row.note || "",
      createdAt: row.created_at
    };
    if (!p0PlusByRaid.has(row.raid_id)) p0PlusByRaid.set(row.raid_id, []);
    p0PlusByRaid.get(row.raid_id).push(entry);
  }

  const raids = raidRows.map(row => {
    const prios = priosByRaid.get(row.id) || [];
    const p0Plus = p0PlusByRaid.get(row.id) || [];
    const p0PlusPrios = prios.filter(entry => normalizeStatus(entry.p0Plus).toLowerCase() === "ja");
    return {
      ...normalizeRaidRow(row),
      raidDate: formatBackupDate(row.raid_date),
      date: formatBackupDate(row.raid_date),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      prioCount: prios.length,
      p0PlusPrioCount: p0PlusPrios.length,
      p0PlusTransferCount: p0Plus.length,
      prios,
      p0PlusPrios,
      p0PlusTransfers: p0Plus
    };
  });

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    count: raids.length,
    raids
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

async function deleteCharacterFromPlayer({ guildId, pin, charName, server }) {
  const player = await findPlayerByPin(guildId, pin);
  if (!player) {
    const error = new Error("Dieser SpielerLogin wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const countResult = await client.query(
      "select count(*)::int as count from characters where player_id = $1",
      [player.id]
    );

    if (Number(countResult.rows[0]?.count || 0) <= 1) {
      const error = new Error("Der letzte Charakter dieses SpielerLogins kann nicht gelöscht werden.");
      error.statusCode = 400;
      throw error;
    }

    const deleteResult = await client.query(
      `delete from characters
       where player_id = $1
         and lower(name) = lower($2)
         and lower(server) = lower($3)
       returning id, name, server, class_name`,
      [player.id, clean(charName), clean(server)]
    );

    if (!deleteResult.rows.length) {
      const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerLogin.");
      error.statusCode = 404;
      throw error;
    }

    const mainResult = await client.query(
      "select count(*)::int as count from characters where player_id = $1 and is_main = true",
      [player.id]
    );

    if (Number(mainResult.rows[0]?.count || 0) === 0) {
      await client.query(
        `update characters
         set is_main = true, updated_at = now()
         where id = (
           select id from characters
           where player_id = $1
           order by created_at asc
           limit 1
         )`,
        [player.id]
      );
    }

    await client.query("commit");
    return { success: true, deleted: 1, character: normalizeCharacter(deleteResult.rows[0]) };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function setMainCharacter({ guildId, pin, charName, server }) {
  const player = await findPlayerByPin(guildId, pin);
  if (!player) {
    const error = new Error("Dieser SpielerLogin wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "update characters set is_main = false, updated_at = now() where player_id = $1",
      [player.id]
    );
    const result = await client.query(
      `update characters
       set is_main = true, updated_at = now()
       where player_id = $1
         and lower(name) = lower($2)
         and lower(server) = lower($3)
       returning id, name, server, class_name, is_main, created_at, name as main_char`,
      [player.id, clean(charName), clean(server)]
    );
    if (!result.rows.length) {
      const error = new Error("Dieser Charakter gehört nicht zu diesem SpielerPin.");
      error.statusCode = 404;
      throw error;
    }
    await client.query("commit");
    return normalizeCharacter(result.rows[0]);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

async function deletePlayerLogin({ guildId, query: params }) {
  requireMasterCode(params.masterCode);

  const charName = clean(params.char || params.player || params.spieler);
  const server = clean(params.server);
  const character = await findCharacter(guildId, charName, server);
  if (!character) {
    const error = new Error("Dieser Charakter wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const countResult = await client.query(
      "select count(*)::int as count from characters where player_id = $1",
      [character.player_id]
    );
    await client.query(
      "delete from player_messages where guild_id = $1 and player_pin = $2",
      [guildId, character.player_pin]
    );
    const deleteResult = await client.query(
      "delete from players where guild_id = $1 and id = $2 returning id",
      [guildId, character.player_id]
    );
    await client.query("commit");
    return {
      success: true,
      deleted: deleteResult.rowCount,
      deletedCharacters: Number(countResult.rows[0]?.count || 0),
      player: character.name,
      server: character.server
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function setGuildMasterCode({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const newCode = clean(params.newMasterCode || params.newCode || params.password);
  if (newCode.length < 6) {
    const error = new Error("Der neue Master-Code muss mindestens 6 Zeichen haben.");
    error.statusCode = 400;
    throw error;
  }

  await query(
    `insert into guild_master_codes (guild_id, master_code, updated_at)
     values ($1, $2, now())
     on conflict (guild_id) do update
       set master_code = excluded.master_code,
           updated_at = now()`,
    [guildId, newCode]
  );
  masterCodeOverrides.set(String(guildId), newCode);
  return { success: true };
}

async function seedDefaultLootItemsOnce() {
  const markerKey = "default-loot-items-v1";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    const raw = await readFile(new URL("./default-loot-items.json", import.meta.url), "utf8");
    const items = JSON.parse(raw);
    let imported = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const raidType = normalizeRaidType(item.raid_type || item.raid || "");
      const name = clean(item.name);
      if (!raidType || !name) continue;
      await client.query(
        `insert into items (raid_type, item_id, name, quality, icon_url)
         values ($1, nullif($2, ''), $3, nullif($4, ''), nullif($5, ''))
         on conflict (raid_type, name) do update
           set item_id = coalesce(nullif(excluded.item_id, ''), items.item_id),
               quality = coalesce(nullif(excluded.quality, ''), items.quality),
               icon_url = coalesce(nullif(excluded.icon_url, ''), items.icon_url)`,
        [raidType, clean(item.item_id), name, clean(item.quality), clean(item.icon_url)]
      );
      imported += 1;
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, String(imported)]
    );
    await client.query("commit");
    console.log(`Standard-Lootdaten importiert: ${imported} Items`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyLootItemCorrectionsOnce() {
  const markerKey = "loot-item-corrections-v4-ony-backup-exact";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    const raw = await readFile(new URL("./default-loot-items.json", import.meta.url), "utf8");
    const corrections = JSON.parse(raw).filter(item => normalizeRaidType(item.raid_type) === "ony");
    let upserted = 0;
    for (const item of corrections) {
      const raidType = normalizeRaidType(item.raid_type || item.raid || "");
      const name = clean(item.name);
      if (!raidType || !name) continue;
      const result = await client.query(
        `insert into items (raid_type, item_id, name, quality, icon_url)
         values ($1, nullif($2, ''), $3, nullif($4, ''), nullif($5, ''))
         on conflict (raid_type, name) do update
           set item_id = excluded.item_id,
               quality = excluded.quality,
               icon_url = excluded.icon_url`,
        [raidType, clean(item.item_id), name, clean(item.quality), clean(item.icon_url)]
      );
      upserted += result.rowCount;
    }
    const correctionNames = corrections.map(item => clean(item.name).toLowerCase()).filter(Boolean);
    const deleted = await client.query(
      `delete from items i
       where lower(i.raid_type) = 'ony'
         and not (lower(i.name) = any($1))
         and not exists (
           select 1 from prios pr
           where pr.p1_item_id = i.id
              or pr.p2_item_id = i.id
              or pr.p3_item_id = i.id
         )
         and not exists (
           select 1 from p0plus_points pp
           where pp.item_id = i.id
         )`,
      [correctionNames]
    );

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ upserted, deleted: deleted.rowCount })]
    );
    await client.query("commit");
    console.log(`Lootdaten-Korrekturen angewendet: ${upserted} Ony-Items, ${deleted.rowCount} alte entfernt`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyLootSetPieceCleanupOnce() {
  const markerKey = "loot-set-piece-cleanup-v1";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    const raidKeys = ["mc", "bwl", "aq40", "naxx", "zg", "aq20", "ony"];
    const staticItemsByRaid = await Promise.all(raidKeys.map(raidKey => loadStaticLootItems(raidKey)));
    const cleanupItems = staticItemsByRaid.flat()
      .map(item => normalizeLootItemForApi(null, item))
      .filter(isLootPageSetPiece)
      .map(item => ({
        raidType: normalizeRaidType(item.raidKey || item.raid),
        name: clean(item.name).toLowerCase()
      }))
      .filter(item => item.raidType && item.name);

    let deletedTotal = 0;
    for (const item of cleanupItems) {
      const deleted = await client.query(
        `delete from items i
         where lower(i.raid_type) = $1
           and lower(i.name) = $2
           and not exists (
             select 1 from prios pr
             where pr.p1_item_id = i.id
                or pr.p2_item_id = i.id
                or pr.p3_item_id = i.id
           )
           and not exists (
             select 1 from p0plus_points pp
             where pp.item_id = i.id
           )`,
        [item.raidType, item.name]
      );
      deletedTotal += deleted.rowCount;
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ candidates: cleanupItems.length, deleted: deletedTotal })]
    );
    await client.query("commit");
    console.log(`Setteil-Bereinigung angewendet: ${deletedTotal}/${cleanupItems.length} Items entfernt`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function ensureLootItemMetadataColumns() {
  await query(
    `alter table items
       add column if not exists slot text,
       add column if not exists type text,
       add column if not exists boss text,
       add column if not exists bind text,
       add column if not exists category text,
       add column if not exists wowhead text,
       add column if not exists stats_text text,
       add column if not exists tooltip text,
       add column if not exists needed text,
       add column if not exists equip text,
       add column if not exists price text,
       add column if not exists dropchance text,
       add column if not exists token_group text,
       add column if not exists token_name text,
       add column if not exists token_item_id text`
  );
}

async function importLootItemMetadata() {
  const markerKey = "loot-item-metadata-import-latest";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );

    const raidKeys = ["mc", "bwl", "aq40", "naxx", "zg", "aq20", "ony"];
    let candidates = 0;
    let updated = 0;
    const sources = {};
    for (const raidKey of raidKeys) {
      const { items, source } = await loadLootMetadataSourceItems(raidKey);
      sources[raidKey] = { source, count: items.length };
      for (const rawItem of items) {
        const item = normalizeLootItemForApi(null, rawItem);
        const raidType = normalizeRaidType(rawItem.raid_type || rawItem.raid || item.raidKey || item.raid || raidKey);
        const name = clean(item.name);
        if (!raidType || !name) continue;
        candidates += 1;

        const result = await client.query(
          `update items
           set item_id = coalesce(nullif($3, ''), item_id),
               quality = coalesce(nullif($4, ''), quality),
               icon_url = coalesce(nullif($5, ''), icon_url),
               slot = nullif($6, ''),
               type = nullif($7, ''),
               boss = nullif($8, ''),
               bind = nullif($9, ''),
               category = nullif($10, ''),
               wowhead = nullif($11, ''),
               stats_text = nullif($12, ''),
               tooltip = nullif($13, ''),
               needed = nullif($14, ''),
               equip = nullif($15, ''),
               price = nullif($16, ''),
               dropchance = nullif($17, ''),
               token_group = nullif($18, ''),
               token_name = nullif($19, ''),
               token_item_id = nullif($20, '')
           where lower(raid_type) = $1
             and (
               lower(name) = lower($2)
               or (nullif($3, '') is not null and item_id = $3)
             )`,
          [
            raidType,
            name,
            item.itemId,
            item.quality,
            item.iconName || item.icon,
            item.slot,
            item.type,
            item.boss,
            item.bind,
            item.category,
            item.wowhead,
            item.statsText,
            item.tooltip,
            item.needed,
            item.equip,
            item.price,
            item.dropchance || item.dropChance,
            item.tokenGroup,
            item.tokenName,
            item.tokenItemId
          ]
        );
        updated += result.rowCount;
      }
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ candidates, updated, sources })]
    );
    await client.query("commit");
    console.log(`Item-Metadaten nach Railway übertragen: ${updated}/${candidates} Updates`);
    return { success: true, candidates, updated, sources };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function restoreLootItemsFromStaticDataOnce() {
  const markerKey = "loot-items-restore-set-pieces-v3";
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    const raidKeys = ["mc", "bwl", "aq40", "naxx", "zg", "aq20", "ony"];
    let candidates = 0;
    let upserted = 0;
    const sources = {};
    for (const raidKey of raidKeys) {
      const { items, source } = await loadLootMetadataSourceItems(raidKey);
      sources[raidKey] = { source, count: items.length };
      for (const rawItem of items) {
        const item = normalizeLootItemForApi(null, rawItem);
        const raidType = normalizeRaidType(rawItem.raid_type || rawItem.raid || item.raidKey || item.raid || raidKey);
        const name = clean(item.name);
        if (!raidType || !name) continue;
        candidates += 1;

        const result = await client.query(
          `insert into items (
             raid_type, item_id, name, quality, icon_url,
             slot, type, boss, bind, category, wowhead,
             stats_text, tooltip, needed, equip, price, dropchance,
             token_group, token_name, token_item_id
           )
           values (
             $1, nullif($2, ''), $3, nullif($4, ''), nullif($5, ''),
             nullif($6, ''), nullif($7, ''), nullif($8, ''), nullif($9, ''),
             nullif($10, ''), nullif($11, ''), nullif($12, ''), nullif($13, ''),
             nullif($14, ''), nullif($15, ''), nullif($16, ''), nullif($17, ''),
             nullif($18, ''), nullif($19, ''), nullif($20, '')
           )
           on conflict (raid_type, name) do update
             set item_id = coalesce(nullif(excluded.item_id, ''), items.item_id),
                 quality = coalesce(nullif(excluded.quality, ''), items.quality),
                 icon_url = coalesce(nullif(excluded.icon_url, ''), items.icon_url),
                 slot = coalesce(nullif(excluded.slot, ''), items.slot),
                 type = coalesce(nullif(excluded.type, ''), items.type),
                 boss = coalesce(nullif(excluded.boss, ''), items.boss),
                 bind = coalesce(nullif(excluded.bind, ''), items.bind),
                 category = coalesce(nullif(excluded.category, ''), items.category),
                 wowhead = coalesce(nullif(excluded.wowhead, ''), items.wowhead),
                 stats_text = coalesce(nullif(excluded.stats_text, ''), items.stats_text),
                 tooltip = coalesce(nullif(excluded.tooltip, ''), items.tooltip),
                 needed = coalesce(nullif(excluded.needed, ''), items.needed),
                 equip = coalesce(nullif(excluded.equip, ''), items.equip),
                 price = coalesce(nullif(excluded.price, ''), items.price),
                 dropchance = coalesce(nullif(excluded.dropchance, ''), items.dropchance),
                 token_group = coalesce(nullif(excluded.token_group, ''), items.token_group),
                 token_name = coalesce(nullif(excluded.token_name, ''), items.token_name),
                 token_item_id = coalesce(nullif(excluded.token_item_id, ''), items.token_item_id)`,
          [
            raidType,
            item.itemId,
            name,
            item.quality,
            item.iconName || item.icon,
            item.slot,
            item.type,
            item.boss,
            item.bind,
            item.category,
            item.wowhead,
            item.statsText,
            item.tooltip,
            item.needed,
            item.equip,
            item.price,
            item.dropchance || item.dropChance,
            item.tokenGroup,
            item.tokenName,
            item.tokenItemId
          ]
        );
        upserted += result.rowCount;
      }
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ candidates, upserted, sources })]
    );
    await client.query("commit");
    console.log(`Lootdaten wiederhergestellt: ${upserted}/${candidates} Items`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyLootRaidAssignmentCorrectionsOnce() {
  const markerKey = "loot-raid-assignment-corrections-v1";
  const corrections = [
    ["16900", "ony"],
    ["16939", "ony"],
    ["16914", "ony"],
    ["16955", "ony"],
    ["16908", "ony"],
    ["16929", "ony"],
    ["16963", "ony"],
    ["16921", "ony"],
    ["16947", "ony"],
    ["16901", "mc"],
    ["16938", "mc"],
    ["16915", "mc"],
    ["16954", "mc"],
    ["16909", "mc"],
    ["16930", "mc"],
    ["16962", "mc"],
    ["16922", "mc"],
    ["16946", "mc"]
  ];
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    let movedReferences = 0;
    let removedWrongRows = 0;
    let reassignedRows = 0;
    for (const [itemId, targetRaid] of corrections) {
      const targetResult = await client.query(
        `select id
         from items
         where item_id = $1
           and lower(raid_type) = $2
         order by created_at asc
         limit 1`,
        [itemId, targetRaid]
      );
      const wrongResult = await client.query(
        `select id
         from items
         where item_id = $1
           and lower(raid_type) = 'bwl'`,
        [itemId]
      );
      if (!wrongResult.rows.length) continue;

      let targetId = targetResult.rows[0]?.id || "";
      if (!targetId) {
        const reassigned = await client.query(
          `update items
           set raid_type = $2
           where id = $1
           returning id`,
          [wrongResult.rows[0].id, targetRaid]
        );
        targetId = reassigned.rows[0]?.id || "";
        reassignedRows += reassigned.rowCount;
      }

      for (const wrongRow of wrongResult.rows) {
        if (!targetId || wrongRow.id === targetId) continue;
        const p1 = await client.query("update prios set p1_item_id = $1 where p1_item_id = $2", [targetId, wrongRow.id]);
        const p2 = await client.query("update prios set p2_item_id = $1 where p2_item_id = $2", [targetId, wrongRow.id]);
        const p3 = await client.query("update prios set p3_item_id = $1 where p3_item_id = $2", [targetId, wrongRow.id]);
        const p0 = await client.query("update p0plus_points set item_id = $1 where item_id = $2", [targetId, wrongRow.id]);
        movedReferences += p1.rowCount + p2.rowCount + p3.rowCount + p0.rowCount;
        const deleted = await client.query("delete from items where id = $1", [wrongRow.id]);
        removedWrongRows += deleted.rowCount;
      }
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ corrections: corrections.length, movedReferences, removedWrongRows, reassignedRows })]
    );
    await client.query("commit");
    console.log(`Loot-Raid-Zuordnungen korrigiert: ${removedWrongRows} BWL-Duplikate entfernt, ${movedReferences} Referenzen verschoben`);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function applyEterniumLockboxRaidItemsOnce() {
  const markerKey = "eternium-lockbox-raid-items-v2";
  const raidTypes = ["mc", "bwl", "naxx"];
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      `create table if not exists app_state (
         key text primary key,
         value text,
         updated_at timestamptz not null default now()
       )`
    );
    const marker = await client.query("select value from app_state where key = $1", [markerKey]);
    if (marker.rows.length) {
      await client.query("commit");
      return;
    }

    let upserted = 0;
    for (const raidType of raidTypes) {
      const result = await client.query(
        `insert into items (
           raid_type, item_id, name, quality, icon_url, slot, type, boss, category
         )
         values (
           $1, '5760', 'Eterniumschließkassette', 'common', 'Inv_misc_ornatebox',
           'Sonstiges', 'Sonstiges', 'Trash', 'Sonstiges'
         )
         on conflict (raid_type, name) do update
           set item_id = excluded.item_id,
               quality = excluded.quality,
               icon_url = excluded.icon_url,
               slot = excluded.slot,
               type = excluded.type,
               boss = excluded.boss,
               category = excluded.category`,
        [raidType]
      );
      upserted += result.rowCount;
    }

    await client.query(
      `insert into app_state (key, value, updated_at)
       values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [markerKey, JSON.stringify({ raidTypes, upserted })]
    );
    await client.query("commit");
    console.log("Eterniumschließkassette für MC, BWL und Naxx ergänzt");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function loadLootMetadataSourceItems(raidType) {
  const raidKey = normalizeRaidType(raidType);
  if (!raidKey) return { items: [], source: "none" };

  try {
    const raw = await readFile(new URL(`../public/data/${raidKey}.json`, import.meta.url), "utf8");
    const parsed = JSON.parse(raw);
    return { items: Array.isArray(parsed) ? parsed : [], source: "public/data" };
  } catch (localError) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/Ariee-Lichtbringer/lichtloot/main/data/${encodeURIComponent(raidKey)}.json`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = await response.json();
      return { items: Array.isArray(parsed) ? parsed : [], source: "github" };
    } catch (githubError) {
      console.warn(`Metadatenquelle fuer ${raidKey} nicht ladbar:`, githubError.message || githubError);
      return { items: [], source: "missing" };
    }
  }
}

async function adminSearchItems({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const searchTerms = clean(params.search || params.item || "")
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean)
    .slice(0, 6);
  const raidType = normalizeRaidType(params.raid);
  const values = [];
  const searchClauses = [];
  for (const term of searchTerms) {
    values.push(`%${term}%`);
    searchClauses.push(`i.name ilike $${values.length}`);
  }
  const searchClause = searchClauses.length ? `and ${searchClauses.join(" and ")}` : "";
  let raidClause = "";
  if (raidType) {
    values.push(raidTypeSearchValues(raidType));
    raidClause = `and (
      lower(i.raid_type) = any($${values.length})
      or lower(regexp_replace(i.raid_type, '[^a-z0-9]+', '-', 'g')) = any($${values.length})
    )`;
  }

  const result = await query(
    `select
       i.id,
       i.raid_type,
       i.item_id,
       i.name,
       i.quality,
       i.icon_url,
       i.slot,
       i.type,
       i.boss,
       i.bind,
       i.category,
       i.wowhead,
       i.stats_text,
       i.tooltip,
       i.needed,
       i.equip,
       i.dropchance,
       (select count(*)::int from prios pr where pr.p1_item_id = i.id or pr.p2_item_id = i.id or pr.p3_item_id = i.id) as prio_count,
       (select count(*)::int from p0plus_points pp where pp.guild_id = $${values.length + 1} and pp.item_id = i.id) as p0plus_count
     from items i
     where 1 = 1
       ${searchClause}
       ${raidClause}
     order by i.raid_type asc, i.name asc
     limit 80`,
    [...values, guildId]
  );
  return { success: true, items: result.rows };
}

async function getLootItems({ query: params }) {
  const raidType = normalizeRaidType(params.raid || params.raidType || "");
  if (!raidType || raidType === "raid") {
    const error = new Error("Raid fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `select id, raid_type, item_id, name, quality, icon_url,
            slot, type, boss, bind, category, wowhead,
            stats_text, tooltip, needed, equip, price, dropchance,
            token_group, token_name, token_item_id
     from items
     where lower(raid_type) = any($1)
        or lower(regexp_replace(raid_type, '[^a-z0-9]+', '-', 'g')) = any($1)
     order by name asc`,
    [raidTypeSearchValues(raidType)]
  );

  const mergedItems = result.rows.map(row => normalizeLootItemForApi(row));

  mergedItems.sort((a, b) => clean(a.name).localeCompare(clean(b.name), "de"));

  return {
    success: true,
    raid: raidType,
    source: "Railway",
    enriched: true,
    items: mergedItems
  };
}

async function loadStaticLootItems(raidType) {
  const raidKey = normalizeRaidType(raidType);
  if (!raidKey) return [];
  const cached = staticLootCache.get(raidKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  try {
    const raw = await readFile(new URL(`../public/data/${raidKey}.json`, import.meta.url), "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [];
    staticLootCache.set(raidKey, { items, expiresAt: Date.now() + STATIC_LOOT_CACHE_TTL_MS });
    return items;
  } catch (error) {
    staticLootCache.set(raidKey, { items: [], expiresAt: Date.now() + STATIC_LOOT_CACHE_TTL_MS });
    return [];
  }
}

function normalizeLootItemForApi(row, detail = {}) {
  const raidType = normalizeRaidType(row?.raid_type || detail.raid_type || detail.raid || "");
  const itemId = clean(row?.item_id || detail.item_id || detail.itemId || detail.ItemID || "");
  const name = clean(row?.name || detail.name || detail.Item || "");
  const icon = clean(row?.icon_url || detail.iconName || detail.icon_url || detail.icon || detail.IconName || "");
  const quality = clean(row?.quality || detail.quality || detail["Qualität"] || "");
  const stats = Array.isArray(detail.stats)
    ? detail.stats
    : clean(row?.stats_text || detail.statsText || detail.Stats_DE || "").split("|").map(line => line.trim()).filter(Boolean);
  const tooltip = clean(row?.tooltip || detail.tooltip || detail.Tooltip || detail.Tooltip_DE || "");
  const slot = clean(row?.slot || detail.slot || detail.Slot || detail.Slot_DE || "");
  const type = clean(row?.type || detail.type || detail.Typ || detail.Typ_DE || "");
  const boss = clean(row?.boss || detail.boss || detail.Boss || "");
  const dropChance = clean(row?.dropchance || detail.dropChance || detail.dropchance || detail.Dropchance || "");
  const statsText = clean(row?.stats_text || detail.statsText || detail.Stats_DE || stats.join("|"));

  return {
    id: row?.id || itemId || name,
    raid: row?.raid_type || detail.raid || raidType,
    raidKey: raidType,
    itemId,
    ItemID: itemId,
    name,
    item: name,
    Item: name,
    quality,
    icon,
    iconName: icon,
    IconName: icon,
    slot,
    Slot: slot,
    Slot_DE: slot,
    type,
    Typ: type,
    Typ_DE: type,
    boss,
    Boss: boss,
    stats,
    statsText,
    Stats_DE: statsText,
    tooltip,
    Tooltip: tooltip,
    Tooltip_DE: tooltip,
    dropChance,
    dropchance: dropChance,
    Dropchance: dropChance,
    bind: clean(row?.bind || detail.bind || detail.Bindung || detail.Bind || ""),
    category: clean(row?.category || detail.category || detail.Kategorie || detail.Category || ""),
    wowhead: clean(row?.wowhead || detail.wowhead || detail.Wowhead || detail.WowheadLink || ""),
    needed: clean(row?.needed || detail.needed || detail["Benötigt"] || detail.Benötigt || ""),
    equip: clean(row?.equip || detail.equip || detail.Anlegen || ""),
    price: clean(row?.price || detail.price || detail.Preis || ""),
    tokenGroup: clean(row?.token_group || detail.tokenGroup || detail.TokenGroup || detail.tokenKey || detail.TokenKey || ""),
    tokenName: clean(row?.token_name || detail.tokenName || detail.TokenName || ""),
    tokenItemId: clean(row?.token_item_id || detail.tokenItemId || detail.TokenItemId || "")
  };
}

function isLootPageSetPiece(item) {
  if (!item) return false;
  const stats = Array.isArray(item.stats) ? item.stats.join(" | ") : "";
  const text = [
    item.name,
    item.slot,
    item.type,
    item.category,
    item.tooltipText,
    item.tooltip,
    item.statsText,
    item.Stats_DE,
    stats
  ].join(" | ");

  const hasSetBonus = /\(\d+\)\s*Set:/i.test(text) || /\(\d+\/\d+\)/.test(text);
  if (!hasSetBonus) return false;

  const hasClassRestriction = /Klassen:/i.test(text);
  const hasTokenRewardLink = Boolean(item.tokenGroup || item.tokenItemId || item.tokenName);
  const armorSlots = /^(Kopf|Schulter|Brust|Handgelenke|Hände|Taille|Beine|Füße|Finger)$/i;
  const isArmorReward = armorSlots.test(clean(item.slot));

  return hasClassRestriction || hasTokenRewardLink || isArmorReward;
}

async function adminUpdateItem({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const id = clean(params.id || params.itemId);
  if (!isUuid(id)) {
    const error = new Error("Item-ID fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `update items
     set icon_url = coalesce(nullif($2, ''), icon_url),
         quality = coalesce(nullif($3, ''), quality),
         item_id = coalesce(nullif($4, ''), item_id)
     where id = $1
     returning id, raid_type, item_id, name, quality, icon_url`,
    [id, clean(params.iconUrl || params.icon || params.icon_url), clean(params.quality), clean(params.itemGameId || params.item_id)]
  );
  if (!result.rows.length) {
    const error = new Error("Item wurde nicht gefunden.");
    error.statusCode = 404;
    throw error;
  }
  return { success: true, item: result.rows[0] };
}

async function adminCreateItem({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const raidType = normalizeRaidType(params.raid || params.raidType);
  const name = clean(params.name || params.itemName || params.item);
  const itemId = clean(params.itemGameId || params.item_id || params.itemId);
  const quality = clean(params.quality);
  const iconUrl = clean(params.iconUrl || params.icon || params.icon_url);
  const slot = clean(params.slot);
  const type = clean(params.type || params.itemType);
  const boss = clean(params.boss);
  const bind = clean(params.bind);
  const category = clean(params.category);
  const wowhead = clean(params.wowhead);
  const statsText = clean(params.statsText || params.stats_text).replace(/\r?\n/g, "|");
  const tooltip = clean(params.tooltip);
  const needed = clean(params.needed);
  const equip = clean(params.equip);
  const price = clean(params.price);
  const dropchance = clean(params.dropchance || params.dropChance);

  if (!raidType || raidType === "raid") {
    const error = new Error("Raid fehlt.");
    error.statusCode = 400;
    throw error;
  }
  if (!name) {
    const error = new Error("Itemname fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `insert into items (
       raid_type, item_id, name, quality, icon_url,
       slot, type, boss, bind, category, wowhead,
       stats_text, tooltip, needed, equip, price, dropchance
     )
     values (
       $1, nullif($2, ''), $3, nullif($4, ''), nullif($5, ''),
       nullif($6, ''), nullif($7, ''), nullif($8, ''), nullif($9, ''), nullif($10, ''), nullif($11, ''),
       nullif($12, ''), nullif($13, ''), nullif($14, ''), nullif($15, ''), nullif($16, ''), nullif($17, '')
     )
     on conflict (raid_type, name) do update
       set item_id = coalesce(nullif(excluded.item_id, ''), items.item_id),
           quality = coalesce(nullif(excluded.quality, ''), items.quality),
           icon_url = coalesce(nullif(excluded.icon_url, ''), items.icon_url),
           slot = coalesce(nullif(excluded.slot, ''), items.slot),
           type = coalesce(nullif(excluded.type, ''), items.type),
           boss = coalesce(nullif(excluded.boss, ''), items.boss),
           bind = coalesce(nullif(excluded.bind, ''), items.bind),
           category = coalesce(nullif(excluded.category, ''), items.category),
           wowhead = coalesce(nullif(excluded.wowhead, ''), items.wowhead),
           stats_text = coalesce(nullif(excluded.stats_text, ''), items.stats_text),
           tooltip = coalesce(nullif(excluded.tooltip, ''), items.tooltip),
           needed = coalesce(nullif(excluded.needed, ''), items.needed),
           equip = coalesce(nullif(excluded.equip, ''), items.equip),
           price = coalesce(nullif(excluded.price, ''), items.price),
           dropchance = coalesce(nullif(excluded.dropchance, ''), items.dropchance)
     returning id, raid_type, item_id, name, quality, icon_url,
               slot, type, boss, bind, category, wowhead,
               stats_text, tooltip, needed, equip, price, dropchance`,
    [
      raidType, itemId, name, quality, iconUrl,
      slot, type, boss, bind, category, wowhead,
      statsText, tooltip, needed, equip, price, dropchance
    ]
  );

  return { success: true, item: result.rows[0] };
}

async function adminDeleteItem({ guildId, query: params }) {
  requireMasterCode(params.masterCode);
  const id = clean(params.id || params.itemId);
  if (!isUuid(id)) {
    const error = new Error("Item-ID fehlt.");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from p0plus_points where guild_id = $1 and item_id = $2", [guildId, id]);
    await client.query("update prios set p1_item_id = null where p1_item_id = $1", [id]);
    await client.query("update prios set p2_item_id = null where p2_item_id = $1", [id]);
    await client.query("update prios set p3_item_id = null where p3_item_id = $1", [id]);
    const deleted = await client.query("delete from items where id = $1 returning name, raid_type", [id]);
    await client.query("commit");
    return { success: true, deleted: deleted.rowCount, item: deleted.rows[0] || null };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
           and raid_date >= current_date - interval '1 day'
           and coalesce(status, '') not in ('archiviert', 'archive')
         order by
           case when raid_date >= current_date then 0 else 1 end,
           case when raid_date >= current_date then raid_date end asc,
           case when raid_date < current_date then raid_date end desc,
           coalesce(raid_time, '') asc,
           created_at desc
         limit 50`,
        [guild.id]
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

    if (action === "guildRaidBackupSnapshot" || action === "raidBackupSnapshot") {
      const backup = await getRaidBackupSnapshot({ guildId: guild.id, query: req.query });
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

    if (action === "guildGetLogAnalyses") {
      const analyses = await getLogAnalyses({ guildId: guild.id, query: req.query });
      return res.json({ ...analyses, guild: guild.slug });
    }

    if (action === "getPublicLogAnalyses") {
      const analyses = await getPublicLogAnalyses({ guildId: guild.id, query: req.query });
      return res.json({ ...analyses, guild: guild.slug });
    }

    if (action === "getPublicLogAnalysisWeb") {
      const webAnalysis = await getPublicLogAnalysisWeb({ guildId: guild.id, query: req.query });
      return res.json({ ...webAnalysis, guild: guild.slug });
    }

    if (action === "setPublicLogAnalysisRaidRoles") {
      const saved = await setPublicLogAnalysisRaidRoles({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildSaveLogAnalysis") {
      const saved = await saveLogAnalysis({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildRunLogAnalysis") {
      const started = await runLogAnalysis({ guildId: guild.id, query: req.query });
      return res.json({ ...started, guild: guild.slug });
    }

    if (action === "guildSetLogAnalysisSheetUrl") {
      const saved = await setLogAnalysisSheetUrl({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildDownloadLogAnalysis") {
      return await downloadLogAnalysis({ guildId: guild.id, query: req.query, res });
    }

    if (action === "guildResolveIssueReport") {
      const resolved = await resolveIssueReport({ guildId: guild.id, query: req.query });
      return res.json({ ...resolved, guild: guild.slug });
    }

    if (action === "guildDeletePlayerLogin") {
      const deleted = await deletePlayerLogin({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildSetMasterCode") {
      const saved = await setGuildMasterCode({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildAdminSearchItems") {
      const items = await adminSearchItems({ guildId: guild.id, query: req.query });
      return res.json({ ...items, guild: guild.slug });
    }

    if (action === "refreshLootMetadata" || action === "guildRefreshLootMetadata") {
      requireMasterCode(req.query.masterCode);
      await ensureLootItemMetadataColumns();
      const metadata = await importLootItemMetadata();
      return res.json({ ...metadata, guild: guild.slug });
    }

    if (action === "getLootItems" || action === "guildGetLootItems") {
      const items = await getLootItems({ query: req.query });
      return res.json({ ...items, guild: guild.slug });
    }

    if (action === "guildAdminUpdateItem") {
      const item = await adminUpdateItem({ guildId: guild.id, query: req.query });
      return res.json({ ...item, guild: guild.slug });
    }

    if (action === "guildAdminCreateItem" || action === "guildAdminCreateltem") {
      const item = await adminCreateItem({ guildId: guild.id, query: req.query });
      return res.json({ ...item, guild: guild.slug });
    }

    if (action === "guildAdminDeleteItem") {
      const deleted = await adminDeleteItem({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
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

    if (action === "guildGetWorldbuffs" || action === "getPublicWorldbuffs") {
      const buffs = await getWorldbuffs({ guildId: guild.id, query: req.query });
      return res.json({ ...buffs, guild: guild.slug });
    }

    if (action === "guildGetHordenbuffs" || action === "getPublicHordenbuffs") {
      const buffs = await getHordenbuffs({ guildId: guild.id, query: req.query });
      return res.json({ ...buffs, guild: guild.slug });
    }

    if (action === "getPlayerWorldbuffs") {
      const buffs = await getPlayerWorldbuffs({ guildId: guild.id, query: req.query });
      return res.json({ ...buffs, guild: guild.slug });
    }

    if (action === "claimPlayerWorldbuff") {
      const saved = await claimPlayerWorldbuff({ guildId: guild.id, query: req.query });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "movePlayerWorldbuff") {
      const moved = await movePlayerWorldbuff({ guildId: guild.id, query: req.query });
      return res.json({ ...moved, guild: guild.slug });
    }

    if (action === "guildDeleteWorldbuffTerm") {
      const deleted = await deleteWorldbuffTerm({ guildId: guild.id, query: req.query });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildRestoreDeletedWorldbuffTerms") {
      requireMasterOrQueueToken(req.query);
      return res.json({ success: true, guild: guild.slug, restored: 0, skipped: 0 });
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

    if (action === "getCharacterGearFromWCL") {
      const gear = await getCharacterGearFromWCL({ query: req.query });
      return res.json({ ...gear, guild: guild.slug });
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

    if (action === "guildSavePrio" || action === "raidleadSavePrio") {
      const saved = await savePrioAsRaidlead({ guildId: guild.id, query: req.query });
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

    if (action === "deleteTwink" || action === "deleteCharacter") {
      const deleted = await deleteCharacterFromPlayer({
        guildId: guild.id,
        pin: req.query.pin,
        charName: req.query.char,
        server: req.query.server
      });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "setMainCharacter") {
      const character = await setMainCharacter({
        guildId: guild.id,
        pin: req.query.pin,
        charName: req.query.char,
        server: req.query.server
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
      const target = clean(postParams.target).toLowerCase();
      const created = target === "worldbuff"
        ? await createWorldbuffTerm({ guildId: guild.id, query: postParams })
        : await createHordenbuffTerm({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "guildSetWorldbuffCaster" || action === "lichtbotSetWorldbuffCaster" || action === "lichtbotClaimWorldbuffSlot") {
      const saved = await setWorldbuffCaster({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "claimPlayerWorldbuff") {
      const saved = await claimPlayerWorldbuff({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "movePlayerWorldbuff") {
      const moved = await movePlayerWorldbuff({ guildId: guild.id, query: postParams });
      return res.json({ ...moved, guild: guild.slug });
    }

    if (action === "createRaid") {
      const created = await createRaid({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "createRandomRaid") {
      const created = await createRandomRaid({ guildId: guild.id, query: postParams });
      return res.json({ ...created, guild: guild.slug });
    }

    if (action === "guildAdminCreateItem" || action === "guildAdminCreateltem") {
      const item = await adminCreateItem({ guildId: guild.id, query: postParams });
      return res.json({ ...item, guild: guild.slug });
    }

    if (action === "guildDeleteHordenbuffEntry" || action === "lichtbotDeleteHordenbuffEntry") {
      const deleted = await deleteHordenbuffEntry({ guildId: guild.id, query: postParams });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildDeleteWorldbuffTerm" || action === "lichtbotDeleteWorldbuffTerm") {
      const deleted = await deleteWorldbuffTerm({ guildId: guild.id, query: postParams });
      return res.json({ ...deleted, guild: guild.slug });
    }

    if (action === "guildSyncPublicBuffTerms" || action === "guildImportWorldbuffsFromSheets" || action === "lichtbotSyncWorldbuffTicker") {
      const imported = await importWorldbuffsFromSheets({ guildId: guild.id, query: postParams });
      return res.json({ ...imported, guild: guild.slug });
    }

    if (action === "guildRestoreDeletedWorldbuffTerms") {
      return res.json({ success: true, guild: guild.slug, restored: 0, skipped: 0 });
    }

    if (action === "guildRequestWorldbuffReplacement") {
      const queued = await enqueueBotUpdate({
        guildId: guild.id,
        type: "worldbuff_replacement",
        payload: {
          target: clean(postParams.target || "both"),
          buff: clean(postParams.buff),
          datum: clean(postParams.datum),
          uhrzeit: clean(postParams.uhrzeit),
          gilde: clean(postParams.gilde),
          charakter: clean(postParams.charakter),
          note: clean(postParams.note)
        }
      });
      return res.json({ ...queued, guild: guild.slug });
    }

    if (action === "guildQueueWorldbuffBotUpdate") {
      const queued = await queueBotUpdate({ guildId: guild.id, query: postParams });
      return res.json({ ...queued, guild: guild.slug });
    }

    if (action === "guildQueueRaidAnnouncement") {
      const queued = await queueRaidAnnouncement({ guildId: guild.id, query: postParams });
      return res.json({ ...queued, guild: guild.slug });
    }

    if (action === "guildQueueLogAnalysisPost") {
      const queued = await queueLogAnalysisDiscordPost({ guildId: guild.id, query: postParams });
      return res.json({ ...queued, guild: guild.slug });
    }

    if (action === "lichtbotResolveQueue") {
      const resolved = await resolveBotQueue({ guildId: guild.id, query: postParams });
      return res.json({ ...resolved, guild: guild.slug });
    }

    if (action === "guildSaveLogAnalysis" || action === "lichtbotSaveLogAnalysis") {
      const saved = await saveLogAnalysis({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildRunLogAnalysis") {
      const started = await runLogAnalysis({ guildId: guild.id, query: postParams });
      return res.json({ ...started, guild: guild.slug });
    }

    if (action === "guildCompleteLogAnalysis" || action === "logAnalysisGeneratorCallback") {
      const completed = await completeExternalLogAnalysis({ guildId: guild.id, query: postParams });
      return res.json({ ...completed, guild: guild.slug });
    }

    if (action === "guildSetLogAnalysisSheetUrl") {
      const saved = await setLogAnalysisSheetUrl({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "setPublicLogAnalysisRaidRoles") {
      const saved = await setPublicLogAnalysisRaidRoles({ guildId: guild.id, query: postParams });
      return res.json({ ...saved, guild: guild.slug });
    }

    if (action === "guildCleanupIncompleteClaAnalyses") {
      const cleaned = await cleanupIncompleteClaAnalyses({ guildId: guild.id, query: postParams });
      return res.json({ ...cleaned, guild: guild.slug });
    }

    if (action === "guildCleanupIncompleteRpbAnalyses") {
      const cleaned = await cleanupIncompleteRpbAnalyses({ guildId: guild.id, query: postParams });
      return res.json({ ...cleaned, guild: guild.slug });
    }

    if (action === "guildClearLogAnalysisType") {
      const cleared = await clearLogAnalysisType({ guildId: guild.id, query: postParams });
      return res.json({ ...cleared, guild: guild.slug });
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
