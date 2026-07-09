#!/usr/bin/env node

const RPB_TABS = [
  "General",
  "Caster",
  "Caster - casts",
  "Healer",
  "Healer - casts",
  "Physical",
  "Physical - casts",
  "Tank",
  "Tank - casts"
];

const CLA_TABS = [
  "combat buffs",
  "gear issues",
  "world buffs",
  "gear listing",
  "ignites",
  "frost resistance",
  "pulls"
];

const CLASS_BY_DE = new Map([
  ["krieger", "Warrior"],
  ["schurke", "Rogue"],
  ["schurken", "Rogue"],
  ["jaeger", "Hunter"],
  ["jäger", "Hunter"],
  ["magier", "Mage"],
  ["mage", "Mage"],
  ["hexenmeister", "Warlock"],
  ["hexer", "Warlock"],
  ["priester", "Priest"],
  ["priest", "Priest"],
  ["paladin", "Paladin"],
  ["paladine", "Paladin"],
  ["druide", "Druid"],
  ["druiden", "Druid"],
  ["druid", "Druid"],
  ["shaman", "Shaman"],
  ["schamane", "Shaman"]
]);

function usage() {
  console.log(`
LichtLoot Sheet-Ausleser

Beispiele:
  node scripts/read-log-sheet.mjs --url "https://docs.google.com/spreadsheets/d/..." --type rpb --out /tmp/rpb.json
  node scripts/read-log-sheet.mjs --url "https://docs.google.com/spreadsheets/d/..." --type rpb --player Bangoo --metric "relative active % total"
  node scripts/read-log-sheet.mjs --url "https://docs.google.com/spreadsheets/d/..." --type cla --players "Saitl:Warrior,Ariee:Priest"

Optionen:
  --url              Google-Sheet-Link
  --type             rpb oder cla
  --tabs             Kommagetrennte Reiter, falls nur bestimmte gelesen werden sollen
  --players          Spieler-Liste: Name oder Name:Klasse, kommagetrennt
  --player           Nur ein Spieler im Ergebnis
  --metric           Nur Metriken, deren Name diesen Text enthält
  --out              JSON-Datei schreiben
  --include-zero     Auch 0-Werte ausgeben
  --no-prio          Prioliste nicht aus LichtLoot laden
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--include-zero") args.includeZero = true;
    else if (arg === "--no-prio") args.noPrio = true;
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[++i] || "";
  }
  return args;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function key(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

function parseSpreadsheetId(value) {
  const match = clean(value).match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : clean(value);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
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
  return rows.map(items => {
    let last = items.length - 1;
    while (last >= 0 && !clean(items[last])) last--;
    return items.slice(0, last + 1);
  });
}

async function fetchCsv(spreadsheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${sheetName}: Google antwortet mit ${response.status}`);
  const text = await response.text();
  if (/<!doctype html|<html/i.test(text)) throw new Error(`${sheetName}: Sheet ist nicht als CSV lesbar`);
  return parseCsvRows(text);
}

function parsePlayers(value) {
  const players = new Map();
  clean(value).split(",").map(clean).filter(Boolean).forEach(item => {
    const [name, classRaw = ""] = item.split(":").map(clean);
    if (!name) return;
    const className = CLASS_BY_DE.get(key(classRaw)) || classRaw || "";
    players.set(key(name), { name, className });
  });
  return players;
}

async function fetchPrioPlayers() {
  try {
    const response = await fetch("https://lichtloot-production.up.railway.app/api/apps-script?action=getPublicPrioCharacters");
    if (!response.ok) return new Map();
    const data = await response.json();
    const players = new Map();
    for (const item of Array.isArray(data.characters) ? data.characters : []) {
      const name = clean(item.name || item.player || item.Spieler);
      if (!name) continue;
      const classRaw = clean(item.className || item.Klasse || item.class_name);
      players.set(key(name), {
        name,
        className: CLASS_BY_DE.get(key(classRaw)) || classRaw || ""
      });
    }
    return players;
  } catch {
    return new Map();
  }
}

function isNumberLike(value) {
  return /^-?\d+(?:[.,]\d+)?(?:\s*%|\s*\([^)]*\))?$/.test(clean(value));
}

function isUsefulValue(value, includeZero) {
  const text = clean(value);
  if (!text) return false;
  if (includeZero) return true;
  return !["0", "0%", "0 (0%)", "-"].includes(text);
}

function findLabelLeft(row, column, playerKeys) {
  for (let c = column - 1; c >= 0; c--) {
    const value = clean(row[c]);
    if (!value) continue;
    if (playerKeys.has(key(value))) continue;
    if (isNumberLike(value)) continue;
    return { label: value, column: c };
  }
  return { label: "", column: -1 };
}

function previousCategory(values, rowIndex) {
  for (let r = rowIndex; r >= 0; r--) {
    const row = values[r] || [];
    const filled = row.map(clean).filter(Boolean);
    if (filled.length === 1 && !isNumberLike(filled[0])) return filled[0];
  }
  return "";
}

function detectPlayerHeaders(values, players) {
  const headers = [];
  const playerKeys = new Set(players.keys());
  values.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const player = players.get(key(cell));
      if (!player) return;
      headers.push({ player, rowIndex, columnIndex });
    });
  });
  return { headers, playerKeys };
}

function extractSheet({ sheetName, values, players, includeZero, metricNeedle, playerNeedle }) {
  const { headers, playerKeys } = detectPlayerHeaders(values, players);
  const byPlayer = new Map();
  for (const { player, rowIndex: headerRow, columnIndex } of headers) {
    if (playerNeedle && key(player.name) !== key(playerNeedle)) continue;
    for (let r = headerRow + 1; r < values.length; r++) {
      const row = values[r] || [];
      const nextHeaderSameColumn = players.get(key(row[columnIndex]));
      if (nextHeaderSameColumn) break;
      const value = row[columnIndex];
      if (!isUsefulValue(value, includeZero)) continue;
      const found = findLabelLeft(row, columnIndex, playerKeys);
      if (!found.label) continue;
      if (metricNeedle && !key(found.label).includes(key(metricNeedle))) continue;
      const entry = {
        sheetName,
        playerName: player.name,
        className: player.className,
        metricLabel: found.label,
        valueText: clean(value),
        row: r + 1,
        column: columnIndex + 1,
        labelColumn: found.column + 1,
        category: previousCategory(values, r)
      };
      if (!byPlayer.has(player.name)) byPlayer.set(player.name, []);
      byPlayer.get(player.name).push(entry);
    }
  }
  return {
    name: sheetName,
    rowCount: values.length,
    columnCount: Math.max(0, ...values.map(row => row.length)),
    detectedPlayerCells: headers.length,
    metrics: Array.from(byPlayer.values()).flat()
  };
}

function compactPlayerSummary(sheets) {
  const summary = new Map();
  for (const sheet of sheets) {
    for (const metric of sheet.metrics) {
      if (!summary.has(metric.playerName)) {
        summary.set(metric.playerName, { name: metric.playerName, className: metric.className, metricCount: 0, sheets: new Set() });
      }
      const row = summary.get(metric.playerName);
      row.metricCount++;
      row.sheets.add(metric.sheetName);
    }
  }
  return Array.from(summary.values()).map(row => ({
    ...row,
    sheets: Array.from(row.sheets)
  })).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const type = key(args.type || "rpb");
  if (!["rpb", "cla"].includes(type)) throw new Error("--type muss rpb oder cla sein");
  const spreadsheetId = parseSpreadsheetId(args.url);
  const tabs = clean(args.tabs)
    ? clean(args.tabs).split(",").map(clean).filter(Boolean)
    : (type === "cla" ? CLA_TABS : RPB_TABS);
  const players = parsePlayers(args.players || "");
  if (!args.noPrio) {
    const prioPlayers = await fetchPrioPlayers();
    for (const [id, player] of prioPlayers) if (!players.has(id)) players.set(id, player);
  }
  if (!players.size) {
    throw new Error("Keine Spielerliste gefunden. Bitte --players \"Name:Klasse,Name2:Klasse\" angeben.");
  }

  const sheets = [];
  for (const tab of tabs) {
    try {
      const values = await fetchCsv(spreadsheetId, tab);
      sheets.push(extractSheet({
        sheetName: tab,
        values,
        players,
        includeZero: !!args.includeZero,
        metricNeedle: args.metric || "",
        playerNeedle: args.player || ""
      }));
    } catch (error) {
      sheets.push({ name: tab, error: error.message, rowCount: 0, columnCount: 0, detectedPlayerCells: 0, metrics: [] });
    }
  }

  const result = {
    spreadsheetId,
    type,
    generatedAt: new Date().toISOString(),
    filters: {
      player: args.player || "",
      metric: args.metric || "",
      includeZero: !!args.includeZero
    },
    playerSummary: compactPlayerSummary(sheets),
    sheets
  };

  if (args.out) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(args.out, JSON.stringify(result, null, 2), "utf8");
  }

  const totalMetrics = sheets.reduce((sum, sheet) => sum + sheet.metrics.length, 0);
  console.log(`Gelesen: ${sheets.length} Reiter, ${result.playerSummary.length} Spieler, ${totalMetrics} Werte`);
  sheets.forEach(sheet => {
    const suffix = sheet.error ? ` FEHLER: ${sheet.error}` : ` ${sheet.rowCount} Zeilen, ${sheet.columnCount} Spalten, ${sheet.metrics.length} Werte`;
    console.log(`- ${sheet.name}:${suffix}`);
  });
  if (args.out) console.log(`JSON geschrieben: ${args.out}`);
}

main().catch(error => {
  console.error(`Fehler: ${error.message}`);
  process.exit(1);
});
