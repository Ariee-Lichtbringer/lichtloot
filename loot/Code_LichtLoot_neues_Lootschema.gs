const RAID_SHEET = "Raids";
const PRIO_SHEET = "Prios";
const P0PLUS_SHEET = "P0Plus";
const PLAYERPIN_SHEET = "PLAYERPINS";
const TEMP_PLAYERPIN_SHEET = "TEMP_PLAYERPINS";
const ISSUE_REPORT_SHEET = "Fehlermeldungen";

const MASTER_CODE = "Lichtbringer-Master";

const LOOT_SHEETS = {
  MC: "LOOT_MC",
  BWL: "LOOT_BWL",
  ZG: "LOOT_ZG",
  AQ20: "LOOT_AQ20",
  AQ40: "LOOT_AQ40",
  NAXX: "LOOT_NAXX",
  ONY: "LOOT_ONY"
};

/**
 * LichtLoot / Lichtbringer Raid API
 *
 * Wichtige URLs nach dem Veröffentlichen als Web-App:
 *
 * Test:
 * ?action=ping
 *
 * Addon-Export aus P0Plus:
 * ?action=getAddonExport
 * ?action=getAddonExport&raid=ZG
 *
 * Vollständiger Loot-Datenbank-Export aller Raid-Sheets:
 * ?action=getFullExport
 *
 * Vollständiger Export nur für einen Raid:
 * ?action=getFullExport&raid=ZG
 *
 * Gesamtimport-Text für LichtLoot-Addon:
 * ?action=getFullExportText
 * ?action=getFullExportText&raid=AQ40
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");

    if (data.action === "createRaid") return createRaid(data);
    if (data.action === "savePrio") return savePrio(data);
    if (data.action === "createPlayerPin") return createPlayerPin({ parameter: data });
    if (data.action === "resetPlayerPin") return resetPlayerPin({ parameter: data });
    if (data.action === "resetPlayerPinBySecurity") return resetPlayerPinBySecurity({ parameter: data });
    if (data.action === "addTwink") return addTwink({ parameter: data });

    throw new Error("Unbekannte POST-Aktion.");
  } catch (error) {
    return jsonOutput({ success: false, error: error.message });
  }
}

function doGet(e) {
  try {
    e = e || { parameter: {} };
    const action = String(e.parameter.action || "ping");
    const callback = e.parameter.callback || "";

    if (action === "ping") {
      return jsonOrJsonp({
        success: true,
        message: "LichtLoot API läuft.",
        actions: [
          "getFullExport",
          "getFullExportText",
          "getAddonExport",
          "getP0Plus",
          "getPublishedPrios",
          "savePrio",
          "getPlayerPin",
          "createPlayerPin",
          "resetPlayerPin",
          "resetPlayerPinBySecurity",
          "getPlayerByPin",
          "getRaidTemporaryPin",
          "createRaidTemporaryPin",
          "getPlayerPrioHistory",
          "getCharactersByPin",
          "getActiveRaids",
          "reportIssue",
          "getCharacterGearFromWCL"
        ]
      }, callback);
    }

    if (action === "savePrio") {
      return savePrio({
        raidPin: e.parameter.raidPin || e.parameter.playerPin,
        characterPin: e.parameter.characterPin || e.parameter.playerPin,
        raid: e.parameter.raid,
        player: e.parameter.player,
        server: e.parameter.server,
        className: e.parameter.className,
        p1: e.parameter.p1,
        p2: e.parameter.p2,
        p3: e.parameter.p3,
        p0: e.parameter.p0 || e.parameter.p0Item || e.parameter.p0PlusItem,
        p0Plus: e.parameter.p0Plus,
        createdAt: new Date().toISOString()
      });
    }

    if (action === "getPlayerPin") return getPlayerPin(e);
    if (action === "createPlayerPin") return createPlayerPin(e);
    if (action === "addTwink") return addTwink(e);
    if (action === "resetPlayerPin") return resetPlayerPin(e);
    if (action === "resetPlayerPinBySecurity") return resetPlayerPinBySecurity(e);
    if (action === "getPlayerByPin") return getPlayerByPin(e);
    if (action === "getRaidTemporaryPin") return getRaidTemporaryPin(e);
    if (action === "createRaidTemporaryPin") return createRaidTemporaryPin(e);
    if (action === "getPlayerPrioHistory") return getPlayerPrioHistory(e);
    if (action === "getCharactersByPin") return getCharactersByPin(e);

    if (action === "getPublishedPrios") return jsonOrJsonp(getPublishedPriosData(e), callback);
    if (action === "getActiveRaids") return jsonOrJsonp(getActiveRaidsData(e), callback);
    if (action === "getCharacterGearFromWCL") return jsonOrJsonp(getCharacterGearFromWCL(e), callback);
    if (action === "reportIssue") return jsonOrJsonp(reportIssue(e), callback);
    if (action === "validateLeadPin") return validateLeadPin(e);
    if (action === "setRaidStatus") return setRaidStatus(e);
    if (action === "deletePrio") return deletePrio(e);
    if (action === "transferP0PlusPoints") return transferP0PlusPoints(e);
    if (action === "clearP0PlusForPlayer") return clearP0PlusForPlayer(e);
    if (action === "getAddonExport") return getAddonExport(e);
    if (action === "getFullExport") return jsonOrJsonp(getFullExportData(e), callback);
    if (action === "getFullExportText") return getFullExportText(e);

    if (action === "getP0Plus") {
      return jsonOrJsonp(getP0PlusData(e), callback);
    }

    return jsonOutput({ success: false, error: "Unbekannte GET-Aktion: " + action });

  } catch (error) {
    return jsonOutput({ success: false, error: error.message });
  }
}

/* =========================================================
   RAIDS / PRIORITÄTEN
   ========================================================= */

function createRaid(data) {
  const sheet = getRequiredSheet(RAID_SHEET);

  sheet.appendRow([
    data.raidId || "",
    data.raid || "",
    data.raidName || "",
    data.raidDate || "",
    data.raidTime || "",
    data.playerPin || "",
    data.leadPin || "",
    data.playerLink || "",
    data.createdAt || new Date().toISOString(),
    data.status || "geschlossen",
    data.p0PlusFreigabe || "",
    data.guild || data.gilde || ""
  ]);

  return jsonOutput({ success: true, message: "Raid gespeichert." });
}

function getRaidSheetHeaderIndex_(values, names, fallbackIndex) {
  const headers = values && values.length ? values[0] : [];
  const wanted = names.map(function(name) {
    return String(name || "").trim().toLowerCase();
  });

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || "").trim().toLowerCase();
    if (wanted.indexOf(header) !== -1) return i;
  }

  return fallbackIndex;
}

function getRaidGuildFromRow_(row, values) {
  const fallbackIndex = row && row.length > 11 ? 11 : 10;
  const guildIndex = getRaidSheetHeaderIndex_(values, ["GildeName", "Gilde", "Guild"], fallbackIndex);
  return String(row[guildIndex] || "").trim();
}

function getRaidP0PlusFreigabeFromRow_(row, values) {
  const freigabeIndex = getRaidSheetHeaderIndex_(
    values,
    ["P0PlusFreigabe", "P0+ Freigabe", "POPlusFreigabe", "PO+ Freigabe"],
    row && row.length > 11 ? 10 : -1
  );
  if (freigabeIndex < 0) return "";
  return String(row[freigabeIndex] || "").trim();
}

function isP0PlusFreigabeActive_(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "ja" ||
    normalized === "true" ||
    normalized === "aktiv" ||
    normalized === "freigeschaltet" ||
    normalized === "offen" ||
    normalized === "geöffnet"
  );
}

function savePrio(data) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);

  const raidPin = String(data.raidPin || data.playerPin || "").trim();
  const characterPin = normalizePlayerPin(data.characterPin || "");

  if (!raidPin) throw new Error("Prio-PIN fehlt.");
  if (!characterPin) throw new Error("SpielerPin fehlt.");

  const raidInfo = findRaidByPin(raidPin);
  if (!raidInfo || !raidInfo.raidId) {
    throw new Error("Prio-PIN keinem Raid zugeordnet.");
  }

  const raidDate = String(raidInfo.raidDate || "").trim();
  const raidTime = String(raidInfo.raidTime || "").trim();
  const p0PlusFreigegeben = isP0PlusFreigabeActive_(raidInfo.p0PlusFreigabe);

  if (raidDate && raidTime) {
    const raidStart = new Date(raidDate + "T" + raidTime + ":00");
    const deadline = new Date(raidStart.getTime() - (30 * 60 * 1000));
    const now = new Date();

    const p0Requested =
      String(data.p0 || data.p0Item || data.p0PlusItem || "").trim() !== "" ||
      String(data.p0Plus || "").toLowerCase() === "ja";

    if (p0Requested && now > deadline && !p0PlusFreigegeben) {
      throw new Error("P0/P0+ Anmeldungen sind 30 Minuten vor Raidstart geschlossen.");
    }
  }

  const raidId = raidInfo.raidId;
  const raidName = raidInfo.raidName;
  const raidShort = raidInfo.raidShort;

  const player = String(data.player || "").trim();
  const server = String(data.server || "").trim();

  if (!player || !server) throw new Error("Spieler oder Server fehlt.");

  const registeredPin = normalizePlayerPin(findPlayerPin(player, server));
  const tempEntry = findTempPlayerPinEntry(raidId, player, server);
  const tempPin = tempEntry ? normalizePlayerPin(tempEntry.tempPin) : "";

  const isMasterPin = Boolean(registeredPin && registeredPin === characterPin);
  const isTemporaryPin = isTemporaryPlayerPin(characterPin);
  const isCorrectTempPin = Boolean(tempPin && tempPin === characterPin);
  const isNewTempPin = Boolean(!tempPin && isTemporaryPin);

  const existing = prioSheet.getDataRange().getValues();
  let existingRowFound = false;
  let existingRowPin = "";

  for (let i = existing.length - 1; i >= 1; i--) {
    const rowRaidId = String(existing[i][0] || "");
    const rowPlayer = String(existing[i][3] || "").trim().toLowerCase();
    const rowServer = String(existing[i][4] || "").trim().toLowerCase();

    if (
      rowRaidId === String(raidId) &&
      rowPlayer === normalizeName(player) &&
      rowServer === normalizeName(server)
    ) {
      existingRowFound = true;
      existingRowPin = normalizePlayerPin(existing[i][10] || "");
      break;
    }
  }

  let allowed = false;

  if (existingRowFound) {
    const existingWasSavedWithMasterPin = Boolean(registeredPin && existingRowPin === registeredPin);
    const existingWasSavedWithTempPin = isTemporaryPlayerPin(existingRowPin);

    if (existingWasSavedWithMasterPin) {
      // Eine mit Master-SpielerPin erstellte Prio darf nur mit genau diesem Master-SpielerPin geändert werden.
      allowed = isMasterPin;

      if (!allowed) {
        throw new Error("Diese Prio wurde mit dem Master-SpielerPin erstellt und kann nicht mit einem temporären SpielerPin überschrieben werden.");
      }
    } else if (existingWasSavedWithTempPin) {
      // Eine temporäre Prio darf mit demselben Temp-Pin oder jederzeit mit dem Master-SpielerPin geändert werden.
      allowed = isMasterPin || existingRowPin === characterPin || isCorrectTempPin;

      if (!allowed) {
        throw new Error("Dieser Charakter ist für diesen Raid bereits durch einen anderen temporären SpielerPin geschützt.");
      }
    } else {
      // Fallback für alte Einträge ohne sauberes Pin-Format.
      allowed = (existingRowPin && existingRowPin === characterPin) || isMasterPin;

      if (!allowed) {
        throw new Error("Dieser Charakter ist für diesen Raid bereits durch einen anderen SpielerPin geschützt.");
      }
    }
  } else {
    if (registeredPin) {
      // Neuer Eintrag: Master-Pin ist erlaubt. Temp-Pin ist nur erlaubt, wenn er korrekt zum Raid/Spieler passt oder neu angelegt wird.
      allowed = isMasterPin || isCorrectTempPin || isNewTempPin;
    } else {
      allowed = isCorrectTempPin || isNewTempPin;
    }

    if (!allowed) {
      if (registeredPin) {
        throw new Error("Falscher SpielerPin für diesen Charakter.");
      }
      throw new Error("Ungültiger temporärer SpielerPin. Temporäre Pins müssen mit T beginnen und genau drei Zahlen enthalten, z. B. T123.");
    }
  }

  if (isTemporaryPin) {
    ensureTempPlayerPinRegistered(raidId, raidPin, player, server, characterPin);
  }

  for (let i = existing.length - 1; i >= 1; i--) {
    const rowRaidId = String(existing[i][0] || "");
    const rowPlayer = String(existing[i][3] || "").trim().toLowerCase();
    const rowServer = String(existing[i][4] || "").trim().toLowerCase();

    if (
      rowRaidId === String(raidId) &&
      rowPlayer === normalizeName(player) &&
      rowServer === normalizeName(server)
    ) {
      prioSheet.deleteRow(i + 1);
    }
  }

  const p0Plus = String(data.p0Plus || "").toLowerCase() === "ja" ? "ja" : "nein";

  prioSheet.appendRow([
    raidId,
    raidName,
    raidShort,
    player,
    server,
    data.className || "",
    data.p1 || "",
    data.p2 || "",
    data.p3 || "",
    p0Plus,
    characterPin,
    data.createdAt || new Date().toISOString()
  ]);

  return jsonOutput({
    success: true,
    raidId: raidId,
    characterPin: characterPin,
    tempPin: isTemporaryPin ? characterPin : tempPin
  });
}

function getPublishedPrios(e) {
  return jsonOutput(getPublishedPriosData(e));
}

function getPublishedPriosData(e) {
  const inputPin = e.parameter.playerPin || "";
  const requestedRaid = normalizeRaidForP0(e.parameter.raid || "");
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);

  const raids = raidSheet.getDataRange().getValues();
  const prios = prioSheet.getDataRange().getValues();

  let raidId = "";
  let raidShort = "";
  let raidName = "";
  let raidDate = "";
  let raidTime = "";
  let playerPin = "";
  let leadPin = "";
  let guild = "";
  let p0PlusFreigabe = "";
  let status = "geschlossen";
  let fallbackRaid = null;

  for (let i = 1; i < raids.length; i++) {
    const rowRaidId = String(raids[i][0] || "");
    const rowRaidShort = String(raids[i][1] || "");
    const rowRaidName = String(raids[i][2] || "");
    const rowRaidDate = formatRaidDateValue_(raids[i][3]);
    const rowRaidTime = formatRaidTimeValue_(raids[i][4]);
    const rowPlayerPin = String(raids[i][5] || "");
    const rowLeadPin = String(raids[i][6] || "");
    const rowStatus = String(raids[i][9] || "geschlossen").toLowerCase();
    const rowP0PlusFreigabe = getRaidP0PlusFreigabeFromRow_(raids[i], raids);
    const rowGuild = getRaidGuildFromRow_(raids[i], raids);
    const rowTimestamp = activeRaidTimestamp_(rowRaidDate, rowRaidTime, String(raids[i][8] || ""));

    if (
      requestedRaid &&
      normalizeRaidForP0(rowRaidShort || rowRaidName || rowRaidId) === requestedRaid &&
      !["archiviert","archive","beendet","abgeschlossen"].includes(rowStatus)
    ) {
      if (!fallbackRaid || rowTimestamp >= fallbackRaid.timestamp) {
        fallbackRaid = {
          raidId: rowRaidId,
          raidShort: rowRaidShort,
          raidName: rowRaidName,
          raidDate: rowRaidDate,
          raidTime: rowRaidTime,
          playerPin: rowPlayerPin,
          leadPin: rowLeadPin,
          guild: rowGuild,
          p0PlusFreigabe: rowP0PlusFreigabe,
          status: rowStatus,
          timestamp: rowTimestamp
        };
      }
    }

    if (
      rowPlayerPin === String(inputPin) ||
      rowRaidId === String(inputPin) ||
      rowLeadPin === String(inputPin)
    ) {
      raidId = rowRaidId;
      raidShort = rowRaidShort;
      raidName = rowRaidName;
      raidDate = rowRaidDate;
      raidTime = rowRaidTime;
      playerPin = rowPlayerPin;
      leadPin = rowLeadPin;
      guild = rowGuild;
      p0PlusFreigabe = rowP0PlusFreigabe;
      status = rowStatus;
      break;
    }
  }

  if (!raidId && fallbackRaid) {
    raidId = fallbackRaid.raidId;
    raidShort = fallbackRaid.raidShort;
    raidName = fallbackRaid.raidName;
    raidDate = fallbackRaid.raidDate;
    raidTime = fallbackRaid.raidTime;
    playerPin = fallbackRaid.playerPin;
    leadPin = fallbackRaid.leadPin;
    guild = fallbackRaid.guild;
    p0PlusFreigabe = fallbackRaid.p0PlusFreigabe;
    status = fallbackRaid.status;
  }

  if (!raidId) return { success: false, error: "Kein Raid gefunden." };

  const published =
    status === "geöffnet" ||
    status === "offen" ||
    status === "published" ||
    status === "true";

  const result = [];

  for (let i = 1; i < prios.length; i++) {
    if (String(prios[i][0]) === String(raidId)) {
      result.push({
        Spieler: prios[i][3],
        Server: prios[i][4],
        Klasse: prios[i][5],
        P1: prios[i][6],
        P2: prios[i][7],
        P3: prios[i][8],
        P0Plus: prios[i][9]
      });
    }
  }

  return {
    success: true,
    published: published,
    raidId: raidId,
    raid: raidShort,
    raidName: raidName,
    raidDate: raidDate,
    raidTime: raidTime,
    guild: guild,
    p0PlusFreigabe: p0PlusFreigabe,
    p0PlusOverride: isP0PlusFreigabeActive_(p0PlusFreigabe),
    playerPin: playerPin,
    leadPin: leadPin,
    prios: result
  };
}

function getActiveRaidsData(e) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const values = raidSheet.getDataRange().getValues();
  const latestByRaid = {};
  const allActiveRaids = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const raid = String(row[1] || "").trim().toLowerCase();
    const raidId = String(row[0] || "").trim();
    const raidDate = formatRaidDateValue_(row[3]);
    const raidTime = formatRaidTimeValue_(row[4]);
    const playerPin = String(row[5] || "").trim();
    const status = String(row[9] || "geschlossen").trim().toLowerCase();
    const guild = getRaidGuildFromRow_(row, values);

    if (!raid || !raidId || !playerPin) continue;

    const archived =
      status === "archiviert" ||
      status === "archive" ||
      status === "beendet" ||
      status === "abgeschlossen";

    if (archived) continue;

    const createdAt = String(row[8] || "").trim();
    const timestamp = activeRaidTimestamp_(raidDate, raidTime, createdAt);
    if (!activeRaidIsTodayOrFuture_(raidDate, timestamp)) continue;

    const entry = {
      raidId: raidId,
      raid: raid,
      raidName: String(row[2] || "").trim(),
      raidDate: raidDate,
      raidTime: raidTime,
      guild: guild,
      playerPin: playerPin,
      leadPin: String(row[6] || "").trim(),
      playerLink: String(row[7] || "").trim(),
      createdAt: createdAt,
      status: status,
      timestamp: timestamp
    };

    allActiveRaids.push(entry);

    if (!latestByRaid[raid] || timestamp >= latestByRaid[raid].timestamp) {
      latestByRaid[raid] = entry;
    }
  }

  const raids = Object.keys(latestByRaid)
    .map(key => latestByRaid[key])
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    success: true,
    raids: raids,
    allRaids: allActiveRaids.sort((a, b) => b.timestamp - a.timestamp)
  };
}

function activeRaidTimestamp_(raidDate, raidTime, createdAt) {
  const raidDay = parseRaidDate_(raidDate);
  if (raidDay) {
    const timeParts = parseRaidTimeParts_(raidTime);
    raidDay.setHours(timeParts.hours, timeParts.minutes, 0, 0);
    return raidDay.getTime();
  }

  if (createdAt) {
    const created = new Date(createdAt);
    if (!isNaN(created.getTime())) return created.getTime();
  }

  return 0;
}

function parseRaidDate_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value || "").trim();
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(raw);
  if (isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function parseRaidTimeParts_(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) return { hours: 0, minutes: 0 };

  return {
    hours: Math.max(0, Math.min(23, Number(match[1]) || 0)),
    minutes: Math.max(0, Math.min(59, Number(match[2]) || 0))
  };
}

function formatRaidDateValue_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return String(value || "").trim();
}

function formatRaidTimeValue_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }

  return String(value || "").trim();
}

function activeRaidIsTodayOrFuture_(raidDate, timestamp) {
  if (!raidDate && !timestamp) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let raidDay = parseRaidDate_(raidDate);

  if (!raidDay && timestamp) {
    raidDay = new Date(timestamp);
    raidDay.setHours(0, 0, 0, 0);
  }

  if (!raidDay || isNaN(raidDay.getTime())) return true;
  raidDay.setHours(0, 0, 0, 0);
  return raidDay.getTime() >= today.getTime();
}

function reportIssue(e) {
  const sheet = getOrCreateIssueReportSheet_();
  const p = e.parameter || {};

  sheet.appendRow([
    new Date(),
    p.type || "",
    p.source || "",
    p.category || "",
    p.raid || "",
    p.item || "",
    p.slot || "",
    p.points || "",
    p.player || "",
    p.server || "",
    p.note || "",
    p.page || "",
    p.createdAt || ""
  ]);

  return {
    success: true,
    message: "Fehlermeldung gespeichert."
  };
}

function getOrCreateIssueReportSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ISSUE_REPORT_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(ISSUE_REPORT_SHEET);
    sheet.appendRow([
      "Zeit",
      "Art",
      "Quelle",
      "Kategorie",
      "Raid",
      "Item",
      "Slot",
      "Punkte",
      "Spieler",
      "Server",
      "Hinweis",
      "Seite",
      "Originaldatum"
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function validateLeadPin(e) {
  const leadPin = e.parameter.leadPin || "";
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const raids = raidSheet.getDataRange().getValues();

  for (let i = 1; i < raids.length; i++) {
    if (String(raids[i][6]) === String(leadPin)) {
      return jsonOutput({
        success: true,
        raidId: raids[i][0],
        raid: raids[i][1],
        raidName: raids[i][2],
        raidDate: raids[i][3],
        raidTime: raids[i][4],
        playerPin: raids[i][5],
        leadPin: raids[i][6],
        role: "generated-lead"
      });
    }
  }

  return jsonOutput({ success: false, error: "LeadPIN nicht gefunden." });
}

function setRaidStatus(e) {
  const raidId = e.parameter.raidId || "";
  const status = e.parameter.status || "geschlossen";
  const hasP0PlusFreigabe =
    Object.prototype.hasOwnProperty.call(e.parameter, "p0PlusFreigabe") ||
    Object.prototype.hasOwnProperty.call(e.parameter, "p0PlusOverride");
  const p0PlusFreigabe = e.parameter.p0PlusFreigabe || e.parameter.p0PlusOverride || "";
  const sheet = getRequiredSheet(RAID_SHEET);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(raidId)) {
      sheet.getRange(i + 1, 10).setValue(status);
      if (hasP0PlusFreigabe) {
        sheet.getRange(i + 1, 11).setValue(p0PlusFreigabe);
      }
      return jsonOutput({
        success: true,
        raidId: raidId,
        status: status,
        p0PlusFreigabe: hasP0PlusFreigabe ? p0PlusFreigabe : getRaidP0PlusFreigabeFromRow_(values[i], values),
        p0PlusOverride: hasP0PlusFreigabe
          ? isP0PlusFreigabeActive_(p0PlusFreigabe)
          : isP0PlusFreigabeActive_(getRaidP0PlusFreigabeFromRow_(values[i], values))
      });
    }
  }

  return jsonOutput({ success: false, error: "RaidID nicht gefunden." });
}

function deletePrio(e) {
  const raidId = e.parameter.raidId || "";
  const player = String(e.parameter.player || "").toLowerCase();
  const server = String(e.parameter.server || "").toLowerCase();
  const prioSheet = getRequiredSheet(PRIO_SHEET);
  const values = prioSheet.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaidId = String(values[i][0] || "");
    const rowPlayer = String(values[i][3] || "").toLowerCase();
    const rowServer = String(values[i][4] || "").toLowerCase();

    if (
      rowRaidId === String(raidId) &&
      rowPlayer === player &&
      (!server || rowServer === server)
    ) {
      prioSheet.deleteRow(i + 1);
      return jsonOutput({ success: true, message: "Prio gelöscht." });
    }
  }

  return jsonOutput({ success: false, error: "Prio nicht gefunden." });
}

/* =========================================================
   WARCRAFT LOGS / AUSRÜSTUNGSPLANER
   Script Properties:
   WCL_CLIENT_ID
   WCL_CLIENT_SECRET
   Optional: WCL_REGION = EU
   Optional: WCL_BASE_URL = https://vanilla.warcraftlogs.com
   ========================================================= */

function getCharacterGearFromWCL(e) {
  const callback = e.parameter.callback || "";
  const character = String(e.parameter.character || e.parameter.player || "").trim();
  const server = String(e.parameter.server || "").trim();
  const region = String(e.parameter.region || getScriptProperty_("WCL_REGION") || "EU").trim().toUpperCase();

  if (!character || !server) {
    return { success: false, error: "Bitte zuerst Charakter und Server auswählen." };
  }

  const clientId = getScriptProperty_("WCL_CLIENT_ID");
  const clientSecret = getScriptProperty_("WCL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return {
      success: false,
      needsSetup: true,
      error: "Warcraft-Logs-Zugang fehlt. Bitte WCL_CLIENT_ID und WCL_CLIENT_SECRET in den Apps-Script-Properties eintragen."
    };
  }

  try {
    const baseUrl = getWarcraftLogsBaseUrl_();
    const token = getWarcraftLogsAccessToken_(clientId, clientSecret, baseUrl);
    const serverSlug = toWarcraftLogsSlug_(server);
    const characterInfo = fetchWarcraftLogsCharacter_(token, character, serverSlug, region, baseUrl);
    const reports = (((characterInfo || {}).recentReports || {}).data || [])
      .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0));

    for (let i = 0; i < Math.min(reports.length, 8); i++) {
      const report = reports[i];
      const gearResult = fetchWarcraftLogsReportGear_(token, report.code, character, server, baseUrl);
      if (gearResult && gearResult.items && gearResult.items.length) {
        return {
          success: true,
          source: "Warcraft Logs",
          character: characterInfo.name || character,
          server: server,
          region: region,
          report: {
            code: report.code,
            title: report.title || "",
            startTime: report.startTime || ""
          },
          fight: gearResult.fight || null,
          items: gearResult.items,
          rawStats: gearResult.rawStats || null
        };
      }
    }

    return {
      success: false,
      character: character,
      server: server,
      error: "Keine Ausrüstung in den letzten Warcraft-Logs-Reports gefunden."
    };
  } catch (error) {
    return {
      success: false,
      error: "Warcraft-Logs-Import fehlgeschlagen: " + error.message
    };
  }
}

function getScriptProperty_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function getWarcraftLogsBaseUrl_() {
  const configured = String(getScriptProperty_("WCL_BASE_URL") || "").trim();
  const base = configured || "https://vanilla.warcraftlogs.com";
  return base.replace(/\/+$/g, "");
}

function getWarcraftLogsAccessToken_(clientId, clientSecret, baseUrl) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "WCL_ACCESS_TOKEN_" + Utilities.base64EncodeWebSafe(baseUrl).slice(0, 24);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const response = UrlFetchApp.fetch(baseUrl + "/oauth/token", {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(clientId + ":" + clientSecret)
    },
    payload: {
      grant_type: "client_credentials"
    }
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Token konnte nicht geholt werden (" + code + "): " + text);
  }

  const data = JSON.parse(text);
  if (!data.access_token) {
    throw new Error("Warcraft Logs lieferte keinen Access Token.");
  }

  cache.put(cacheKey, data.access_token, Math.min(21600, Math.max(60, Number(data.expires_in || 3600) - 120)));
  return data.access_token;
}

function warcraftLogsGraphql_(token, query, variables, baseUrl) {
  let code = 0;
  let text = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = UrlFetchApp.fetch(baseUrl + "/api/v2/client", {
      method: "post",
      muteHttpExceptions: true,
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify({
        query: query,
        variables: variables || {}
      })
    });

    code = response.getResponseCode();
    text = response.getContentText();

    if (code >= 200 && code < 300) break;
    if (![500, 502, 503, 504].includes(code) || attempt === 3) break;

    Utilities.sleep(700 * attempt);
  }

  if (code < 200 || code >= 300) {
    if (code === 502) {
      throw new Error("Warcraft Logs Vanilla API antwortet gerade mit 502. Bitte in 1-2 Minuten erneut versuchen. Endpunkt: " + baseUrl);
    }
    throw new Error("GraphQL HTTP " + code + ": " + text);
  }

  const data = JSON.parse(text);
  if (data.errors && data.errors.length) {
    throw new Error(data.errors.map(err => err.message).join("; "));
  }

  return data.data || {};
}

function fetchWarcraftLogsCharacter_(token, character, serverSlug, region, baseUrl) {
  const query =
    "query($name:String!,$serverSlug:String!,$serverRegion:String!){"+
    "characterData{"+
    "character(name:$name,serverSlug:$serverSlug,serverRegion:$serverRegion){"+
    "id name recentReports(limit:8){data{code title startTime}}"+
    "}"+
    "}"+
    "}";

  const data = warcraftLogsGraphql_(token, query, {
    name: character,
    serverSlug: serverSlug,
    serverRegion: region
  }, baseUrl);

  const found = data.characterData && data.characterData.character;
  if (!found) {
    throw new Error("Charakter wurde bei Warcraft Logs nicht gefunden.");
  }
  return found;
}

function fetchWarcraftLogsReportGear_(token, reportCode, character, server, baseUrl) {
  const actorQuery =
    "query($code:String!){"+
    "reportData{report(code:$code){fights{ id name startTime endTime } masterData{actors{ id name server type subType }}}}"+
    "}";

  const actorData = warcraftLogsGraphql_(token, actorQuery, { code: reportCode }, baseUrl);
  const report = ((actorData.reportData || {}).report || {});
  const actors = ((report.masterData || {}).actors || []);
  const actor = actors.find(a =>
    itemKey(a.name) === itemKey(character) &&
    (!server || itemKey(a.server) === itemKey(server) || !a.server)
  ) || actors.find(a => itemKey(a.name) === itemKey(character));

  if (!actor || !actor.id) return null;

  const fights = (report.fights || [])
    .filter(fight => Number(fight.id) && Number(fight.endTime) > Number(fight.startTime))
    .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0));

  if (!fights.length) return null;

  const eventQuery =
    "query($code:String!,$sourceID:Int!,$fightIDs:[Int]){"+
    "reportData{report(code:$code){events(dataType:CombatantInfo,sourceID:$sourceID,fightIDs:$fightIDs,limit:1){data}}}"+
    "}";

  for (let i = 0; i < fights.length; i++) {
    const fight = fights[i];
    const eventData = warcraftLogsGraphql_(token, eventQuery, {
      code: reportCode,
      sourceID: Number(actor.id),
      fightIDs: [Number(fight.id)]
    }, baseUrl);

    const eventsRaw = ((((eventData.reportData || {}).report || {}).events || {}).data || []);
    const events = typeof eventsRaw === "string" ? JSON.parse(eventsRaw) : eventsRaw;
    const combatantInfo = Array.isArray(events) ? events[0] : events;
    const gear = (combatantInfo && combatantInfo.gear) || [];
    const items = normalizeWarcraftLogsGear_(gear);

    if (items.length) {
      return {
        items: items,
        rawStats: combatantInfo && (combatantInfo.stats || combatantInfo.expansion || null),
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

function normalizeWarcraftLogsGear_(gear) {
  const slotNames = {
    0: "Kopf",
    1: "Hals",
    2: "Schultern",
    3: "Hemd",
    4: "Brust",
    5: "Taille",
    6: "Beine",
    7: "Füße",
    8: "Handgelenke",
    9: "Hände",
    10: "Ring 1",
    11: "Ring 2",
    12: "Schmuck 1",
    13: "Schmuck 2",
    14: "Rücken",
    15: "Waffenhand",
    16: "Schildhand",
    17: "Distanz"
  };

  return (Array.isArray(gear) ? gear : []).map((item, index) => {
    const id = item.id || item.itemID || item.itemId || "";
    const slot = item.slot !== undefined && item.slot !== null && item.slot !== "" ? item.slot : index;
    return {
      slot: slot,
      slotName: slotNames[slot] || String(slot || "Slot"),
      id: id,
      itemId: id,
      name: item.name || item.itemName || (id ? "Item " + id : "Unbekannt"),
      quality: item.quality || "",
      icon: normalizeIconName(item.icon || item.iconName || ""),
      itemLevel: item.itemLevel || item.ilvl || "",
      permanentEnchant: item.permanentEnchant || "",
      gems: item.gems || []
    };
  }).filter(item => item.id);
}

function toWarcraftLogsSlug_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['’`´]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}




function findRaidByPin(inputPin) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const raids = raidSheet.getDataRange().getValues();
  const pin = String(inputPin || "").trim();

  for (let i = 1; i < raids.length; i++) {
    const rowRaidId = String(raids[i][0] || "");
    const rowPlayerPin = String(raids[i][5] || "");
    const rowLeadPin = String(raids[i][6] || "");

    if (rowPlayerPin === pin || rowRaidId === pin || rowLeadPin === pin) {
      return {
        raidId: rowRaidId,
        raidShort: String(raids[i][1] || ""),
        raidName: String(raids[i][2] || ""),
        raidDate: String(raids[i][3] || ""),
        raidTime: String(raids[i][4] || ""),
        raidPin: rowPlayerPin,
        leadPin: rowLeadPin,
        p0PlusFreigabe: getRaidP0PlusFreigabeFromRow_(raids[i], raids)
      };
    }
  }

  return null;
}

function getTempPlayerPinSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TEMP_PLAYERPIN_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(TEMP_PLAYERPIN_SHEET);
    sheet.appendRow(["RaidID", "PrioPin", "Spieler", "Server", "TempPin", "CreatedAt"]);
  }

  return sheet;
}

function findTempPlayerPinEntry(raidId, charName, server) {
  const sheet = getTempPlayerPinSheet();
  const values = sheet.getDataRange().getValues();
  const targetRaidId = String(raidId || "").trim();
  const targetChar = normalizeName(charName || "");
  const targetServer = normalizeName(server || "");

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaidId = String(values[i][0] || "").trim();
    const rowChar = String(values[i][2] || "").trim().toLowerCase();
    const rowServer = String(values[i][3] || "").trim().toLowerCase();

    if (rowRaidId === targetRaidId && rowChar === targetChar && rowServer === targetServer) {
      return {
        row: i + 1,
        raidId: rowRaidId,
        prioPin: String(values[i][1] || "").trim(),
        player: String(values[i][2] || "").trim(),
        server: String(values[i][3] || "").trim(),
        tempPin: normalizePlayerPin(values[i][4] || "")
      };
    }
  }

  return null;
}

function findTempPlayerPinOwner(raidId, tempPin) {
  const sheet = getTempPlayerPinSheet();
  const values = sheet.getDataRange().getValues();
  const targetRaidId = String(raidId || "").trim();
  const targetPin = normalizePlayerPin(tempPin);

  for (let i = 1; i < values.length; i++) {
    const rowRaidId = String(values[i][0] || "").trim();
    const rowPin = normalizePlayerPin(values[i][4] || "");

    if (rowRaidId === targetRaidId && rowPin === targetPin) {
      return {
        row: i + 1,
        raidId: rowRaidId,
        player: String(values[i][2] || "").trim(),
        server: String(values[i][3] || "").trim(),
        tempPin: rowPin
      };
    }
  }

  return null;
}

function ensureTempPlayerPinRegistered(raidId, raidPin, charName, server, tempPin) {
  const pin = normalizePlayerPin(tempPin);

  if (!isTemporaryPlayerPin(pin)) {
    throw new Error("Ungültiger temporärer SpielerPin. Temporäre Pins müssen mit T beginnen und genau drei Zahlen enthalten, z. B. T123.");
  }

  const existingForPlayer = findTempPlayerPinEntry(raidId, charName, server);

  if (existingForPlayer) {
    if (normalizePlayerPin(existingForPlayer.tempPin) !== pin) {
      throw new Error("Dieser Charakter hat für diesen Raid bereits einen anderen temporären SpielerPin.");
    }
    return existingForPlayer;
  }

  const owner = findTempPlayerPinOwner(raidId, pin);

  if (owner) {
    throw new Error("Dieser temporäre SpielerPin ist in diesem Raid bereits vergeben. Bitte Seite neu laden oder neuen Temp-Pin erzeugen.");
  }

  const sheet = getTempPlayerPinSheet();
  sheet.appendRow([
    raidId,
    raidPin,
    charName,
    server,
    pin,
    new Date().toISOString()
  ]);

  return {
    raidId: raidId,
    prioPin: raidPin,
    player: charName,
    server: server,
    tempPin: pin
  };
}

function createRaidTemporaryPin(e) {
  const raidPin = String(e.parameter.raidPin || "").trim();
  const charName = String(e.parameter.char || e.parameter.player || "").trim();
  const server = String(e.parameter.server || "").trim();

  if (!raidPin || !charName || !server) {
    return jsonOutput({ success: false, error: "Prio-PIN, Charaktername oder Server fehlt." });
  }

  const raidInfo = findRaidByPin(raidPin);
  if (!raidInfo || !raidInfo.raidId) {
    return jsonOutput({ success: false, error: "Prio-PIN keinem Raid zugeordnet." });
  }

  const registeredPin = normalizePlayerPin(findPlayerPin(charName, server));
  const latestPrio = findLatestPrioForPlayerAndRaidPin(charName, server, raidPin);
  const latestPrioPin = latestPrio ? normalizePlayerPin(latestPrio.characterPin || "") : "";

  // Master-Prio bleibt Master-Prio: Danach wird kein neuer Temp-Pin mehr für diesen Eintrag erzeugt.
  if (registeredPin && latestPrioPin === registeredPin) {
    return jsonOutput({
      success: false,
      error: "Diese Prio ist bereits durch den Master-SpielerPin geschützt. Bitte nutze deinen Master-SpielerPin zum Ändern.",
      protectedByMaster: true
    });
  }

  // Wenn die aktuelle Prio schon temporär gespeichert wurde, denselben Temp-Pin wieder ausgeben.
  if (latestPrioPin && isTemporaryPlayerPin(latestPrioPin)) {
    ensureTempPlayerPinRegistered(raidInfo.raidId, raidPin, charName, server, latestPrioPin);

    return jsonOutput({
      success: true,
      exists: true,
      pin: latestPrioPin,
      raidId: raidInfo.raidId
    });
  }

  const existing = findTempPlayerPinEntry(raidInfo.raidId, charName, server);
  if (existing && existing.tempPin) {
    return jsonOutput({
      success: true,
      exists: true,
      pin: existing.tempPin,
      raidId: raidInfo.raidId
    });
  }

  let pin = "";
  for (let attempt = 0; attempt < 1000; attempt++) {
    pin = createTempPinT3();
    if (!findTempPlayerPinOwner(raidInfo.raidId, pin)) break;
    pin = "";
  }

  if (!pin) {
    return jsonOutput({ success: false, error: "Kein freier temporärer SpielerPin verfügbar." });
  }

  ensureTempPlayerPinRegistered(raidInfo.raidId, raidPin, charName, server, pin);

  return jsonOutput({
    success: true,
    exists: false,
    pin: pin,
    raidId: raidInfo.raidId
  });
}

function createTempPinT3() {
  return "T" + String(Math.floor(100 + Math.random() * 900));
}

/* =========================================================
   PLAYERPINS
   ========================================================= */

function getPlayerPinSheet_() {
  const sheet = getRequiredSheet(PLAYERPIN_SHEET);
  ensurePlayerPinSheetColumns_(sheet);
  return sheet;
}

function ensurePlayerPinSheetColumns_(sheet) {
  const headers = [
    "Charakter",
    "Server",
    "Klasse",
    "SpielerPin",
    "MainChar",
    "AccountID",
    "Sicherheitsfrage",
    "Sicherheitsantwort"
  ];

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasAnyValue = firstRow.some(function(value) {
    return String(value || "").trim() !== "";
  });

  if (!hasAnyValue) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const expectedByColumn = {
    1: ["charakter", "char", "spieler", "name"],
    2: ["server", "realm"],
    3: ["klasse", "class", "classname"],
    4: ["spielerpin", "pin", "playerpin"],
    5: ["mainchar", "main", "hauptchar"],
    6: ["accountid", "account", "konto"],
    7: ["sicherheitsfrage", "securityquestion", "frage"],
    8: ["sicherheitsantwort", "securityanswer", "antwort"]
  };

  const firstColumn = normalizeName(firstRow[0] || "").replace(/[^a-z0-9]/g, "");
  const secondColumn = normalizeName(firstRow[1] || "").replace(/[^a-z0-9]/g, "");
  const looksLikeHeader =
    expectedByColumn[1].indexOf(firstColumn) !== -1 ||
    expectedByColumn[2].indexOf(secondColumn) !== -1;

  if (!looksLikeHeader) return;

  for (let i = 0; i < headers.length; i++) {
    const current = String(firstRow[i] || "").trim();
    const normalized = normalizeName(current).replace(/[^a-z0-9]/g, "");
    const accepted = expectedByColumn[i + 1] || [];
    if (!current || accepted.indexOf(normalized) !== -1) {
      sheet.getRange(1, i + 1).setValue(headers[i]);
    }
  }
}

function getCharactersByPin(e) {
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");

  if (!pin) {
    return jsonOutput({
      success: false,
      error: "SpielerPin fehlt."
    });
  }

  if (isTemporaryPlayerPin(pin)) {
    return jsonOutput({
      success: false,
      error: "Für Mein LichtLoot brauchst du deinen Master-SpielerPin."
    });
  }

  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  const characters = [];
  const seen = {};

  for (let i = 1; i < values.length; i++) {
    const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));

    if (rowPin !== pin) continue;

    const charName = String(values[i][0] || "").trim();
    const server = String(values[i][1] || "").trim();
    const className = getPlayerClassFromRow(values[i]);

    if (!charName || !server) continue;

    const key = normalizeName(charName) + "|" + normalizeName(server);
    if (seen[key]) continue;
    seen[key] = true;

    characters.push({
      char: charName,
      player: charName,
      server: server,
      className: className || "",
      mainChar: getMainCharFromRow(values[i]) || "",
      accountId: getAccountIdFromRow(values[i]) || ""
    });
  }

  characters.sort(function(a, b) {
    const mainA = normalizeName(a.mainChar || a.char);
    const mainB = normalizeName(b.mainChar || b.char);

    if (mainA !== mainB) return mainA.localeCompare(mainB);

    return normalizeName(a.char).localeCompare(normalizeName(b.char));
  });

  if (!characters.length) {
    return jsonOutput({
      success: false,
      error: "Zu diesem SpielerPin wurden keine Charaktere gefunden."
    });
  }

  return jsonOutput({
    success: true,
    count: characters.length,
    characters: characters
  });
}


function getPlayerPrioHistory(e) {
  const charName = String(e.parameter.char || e.parameter.player || "").trim();
  const playerPin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");

  if (!charName || !playerPin) {
    return jsonOutput({
      success: false,
      error: "Charaktername oder SpielerPin fehlt."
    });
  }

  if (isTemporaryPlayerPin(playerPin)) {
    return jsonOutput({
      success: false,
      error: "Für diese Übersicht brauchst du deinen Master-SpielerPin. Temporäre Raid-Pins zeigen nur einen einzelnen Raid."
    });
  }

  const pinOwner = findPlayerPinEntryByPinAndChar(playerPin, charName);

  if (!pinOwner) {
    return jsonOutput({
      success: false,
      error: "Dieser Charakter gehört nicht zu diesem SpielerPin."
    });
  }

  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);
  const raids = raidSheet.getDataRange().getValues();
  const prios = prioSheet.getDataRange().getValues();

  const raidMap = {};

  for (let i = 1; i < raids.length; i++) {
    const raidId = String(raids[i][0] || "").trim();
    if (!raidId) continue;

    const status = String(raids[i][9] || "geschlossen").trim().toLowerCase();
    const isCurrent =
      status === "geöffnet" ||
      status === "offen" ||
      status === "published" ||
      status === "true";

    raidMap[raidId] = {
      raidId: raidId,
      raid: String(raids[i][1] || "").trim(),
      raidName: String(raids[i][2] || "").trim(),
      raidDate: formatRaidDateValue_(raids[i][3]),
      raidTime: formatRaidTimeValue_(raids[i][4]),
      prioPin: String(raids[i][5] || "").trim(),
      leadPin: String(raids[i][6] || "").trim(),
      guild: getRaidGuildFromRow_(raids[i], raids),
      createdAt: String(raids[i][8] || "").trim(),
      status: status,
      current: isCurrent
    };
  }

  const targetChar = normalizeName(pinOwner.charName);
  const targetServer = normalizeName(pinOwner.server);
  const result = [];

  for (let i = 1; i < prios.length; i++) {
    const rowRaidId = String(prios[i][0] || "").trim();
    const rowChar = normalizeName(prios[i][3] || "");
    const rowServer = normalizeName(prios[i][4] || "");
    const rowPin = normalizePlayerPin(prios[i][10] || "");

    if (rowChar !== targetChar || rowServer !== targetServer) continue;

    const wasOwnMasterPin = rowPin === playerPin;
    const wasOwnTempPin = isTemporaryPlayerPin(rowPin);

    /*
      Der Charakter wurde bereits über den Master-SpielerPin verifiziert.
      Deshalb dürfen hier ALLE Prios dieses Charakters angezeigt werden.
      Wichtig: Ältere oder raidbezogene Einträge wurden oft mit temporärem Pin gespeichert.
      Diese dürfen in "Mein LichtLoot" trotzdem erscheinen.
    */

    const raidInfo = raidMap[rowRaidId] || {};
    const createdAt = String(prios[i][11] || raidInfo.createdAt || "").trim();

    result.push({
      raidId: rowRaidId,
      raid: raidInfo.raid || String(prios[i][2] || ""),
      raidName: raidInfo.raidName || String(prios[i][1] || ""),
      raidDate: raidInfo.raidDate || "",
      raidTime: raidInfo.raidTime || "",
      guild: raidInfo.guild || "",
      prioPin: raidInfo.prioPin || "",
      status: raidInfo.status || "",
      current: Boolean(raidInfo.current),
      createdAt: createdAt,
      player: String(prios[i][3] || ""),
      server: String(prios[i][4] || ""),
      className: String(prios[i][5] || ""),
      p1: String(prios[i][6] || ""),
      p2: String(prios[i][7] || ""),
      p3: String(prios[i][8] || ""),
      p0Plus: String(prios[i][9] || "nein"),
      pinType: wasOwnMasterPin ? "Master" : (wasOwnTempPin ? "Temporär" : "Alt")
    });
  }

  result.sort(function(a, b) {
    const dateA = Date.parse(a.createdAt || "") || 0;
    const dateB = Date.parse(b.createdAt || "") || 0;
    return dateB - dateA;
  });

  const currentEntries = result.filter(entry => entry.current);
  const lastEntries = result.filter(entry => !entry.current).slice(0, 5);
  const combined = [];
  const seen = {};

  currentEntries.concat(lastEntries).forEach(entry => {
    const key = entry.raidId || (entry.raidName + "_" + entry.createdAt);
    if (seen[key]) return;
    seen[key] = true;
    combined.push(entry);
  });

  const ownP0PlusPoints = getOwnP0PlusPointsForPlayer(pinOwner.charName);

  combined.forEach(function(entry) {
    const raidKey = normalizeRaidForP0(entry.raid || entry.raidName || "");
    entry.ownP0PlusPoints = ownP0PlusPoints.filter(function(point) {
      return normalizeRaidForP0(point.raid || "") === raidKey;
    });
  });

  return jsonOutput({
    success: true,
    player: pinOwner.charName,
    server: pinOwner.server,
    className: pinOwner.className || "",
    count: combined.length,
    currentCount: currentEntries.length,
    entries: combined,
    ownP0PlusPoints: ownP0PlusPoints
  });
}

function getOwnP0PlusPointsForPlayer(playerName) {
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);
  const values = p0Sheet.getDataRange().getValues();
  const targetPlayer = itemKey(playerName);
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const raid = normalizeRaidForP0(values[i][0] || "");
    const item = String(values[i][1] || "").trim();
    const slot = String(values[i][2] || "").trim();
    const player = String(values[i][3] || "").trim();
    const count = Number(values[i][4] || 0);

    if (!raid || !item || !player || !count) continue;
    if (itemKey(player) !== targetPlayer) continue;

    result.push({
      raid: raid,
      item: item,
      slot: slot,
      player: player,
      count: count
    });
  }

  result.sort(function(a, b) {
    if (String(a.raid) !== String(b.raid)) return String(a.raid).localeCompare(String(b.raid));
    return Number(b.count || 0) - Number(a.count || 0);
  });

  return result;
}

function getPlayerPin(e) {
  const charName = String(e.parameter.char || "").trim();
  const server = String(e.parameter.server || "").trim();

  if (!charName || !server) {
    return jsonOutput({
      success: false,
      error: "Charaktername oder Server fehlt."
    });
  }

  const entry = findPlayerPinEntry(charName, server);

  if (entry) {
    return jsonOutput({
      success: true,
      exists: true,
      className: entry.className || ""
    });
  }

  return jsonOutput({
    success: true,
    exists: false
  });
}

function getPlayerByPin(e) {
  const pin = normalizePlayerPin(e.parameter.pin || "");
  const raidPin = String(e.parameter.raidPin || "").trim();

  if (!pin) {
    return jsonOutput({
      success: false,
      error: "SpielerPin fehlt."
    });
  }

  const entry = findPlayerByPin(pin);

  if (entry) {
    const result = {
      success: true,
      char: entry.charName,
      server: entry.server,
      className: entry.className || ""
    };

    if (raidPin) {
      const prio = findLatestPrioForPlayerAndRaidPin(entry.charName, entry.server, raidPin);

      if (prio) {
        result.p1 = prio.p1 || "";
        result.p2 = prio.p2 || "";
        result.p3 = prio.p3 || "";
        result.p0Plus = prio.p0Plus || "nein";
        result.raidId = prio.raidId || "";
      }
    }

    return jsonOutput(result);
  }

  if (raidPin && isTemporaryPlayerPin(pin)) {
    const tempPrio = findLatestPrioByRaidPinAndCharacterPin(raidPin, pin);

    if (tempPrio) {
      return jsonOutput({
        success: true,
        char: tempPrio.charName,
        server: tempPrio.server,
        className: tempPrio.className || "",
        p1: tempPrio.p1 || "",
        p2: tempPrio.p2 || "",
        p3: tempPrio.p3 || "",
        p0Plus: tempPrio.p0Plus || "nein",
        raidId: tempPrio.raidId || ""
      });
    }
  }

  return jsonOutput({
    success: false,
    error: "SpielerPin wurde nicht gefunden."
  });
}

function getRaidTemporaryPin(e) {
  const raidPin = String(e.parameter.raidPin || "").trim();
  const charName = String(e.parameter.char || e.parameter.player || "").trim();
  const server = String(e.parameter.server || "").trim();

  if (!raidPin || !charName || !server) {
    return jsonOutput({
      success: false,
      error: "Prio-PIN, Charaktername oder Server fehlt."
    });
  }

  const raidInfo = findRaidByPin(raidPin);
  if (!raidInfo || !raidInfo.raidId) {
    return jsonOutput({ success: false, error: "Prio-PIN keinem Raid zugeordnet." });
  }

  const registeredPin = normalizePlayerPin(findPlayerPin(charName, server));
  const latestPrio = findLatestPrioForPlayerAndRaidPin(charName, server, raidPin);
  const latestPrioPin = latestPrio ? normalizePlayerPin(latestPrio.characterPin || "") : "";

  // Wenn die aktuelle Prio mit Master-SpielerPin gespeichert wurde, wird kein Temp-Pin ausgeliefert.
  // Damit kann eine Master-Prio später nicht versehentlich per Temp-Pin überschrieben werden.
  if (registeredPin && latestPrioPin === registeredPin) {
    return jsonOutput({
      success: true,
      exists: false,
      pin: "",
      protectedByMaster: true,
      message: "Diese Prio ist durch den Master-SpielerPin geschützt."
    });
  }

  // Wenn die aktuelle Prio mit Temp-Pin gespeichert wurde, darf dieser Temp-Pin angezeigt werden.
  if (latestPrioPin && isTemporaryPlayerPin(latestPrioPin)) {
    ensureTempPlayerPinRegistered(raidInfo.raidId, raidPin, charName, server, latestPrioPin);

    return jsonOutput({
      success: true,
      exists: true,
      pin: latestPrioPin,
      raidId: latestPrio.raidId || raidInfo.raidId
    });
  }

  const tempEntry = findTempPlayerPinEntry(raidInfo.raidId, charName, server);

  if (tempEntry && tempEntry.tempPin) {
    return jsonOutput({
      success: true,
      exists: true,
      pin: normalizePlayerPin(tempEntry.tempPin),
      raidId: raidInfo.raidId
    });
  }

  return jsonOutput({
    success: true,
    exists: false,
    pin: ""
  });
}

function createPlayerPin(e) {
  const charName = String(e.parameter.char || "").trim();
  const server = String(e.parameter.server || "").trim();
  const className = String(e.parameter.className || "").trim();
  const requestedPin = getRequestedMasterPinParam(e);
  const securityQuestion = getSecurityQuestionParam(e);
  const securityAnswer = getSecurityAnswerParam(e);

  if (!charName || !server || !className) {
    return jsonOutput({
      success: false,
      error: "Charaktername, Server oder Klasse fehlt."
    });
  }

  if (!securityQuestion || !securityAnswer) {
    return jsonOutput({
      success: false,
      error: "Sicherheitsfrage oder Antwort fehlt."
    });
  }

  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowChar = normalizeName(values[i][0] || "");
    const rowServer = normalizeName(values[i][1] || "");

    if (
      rowChar === normalizeName(charName) &&
      rowServer === normalizeName(server)
    ) {
      const currentPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
      if (requestedPin && currentPin === requestedPin) {
        if (className) sheet.getRange(i + 1, 3).setValue(className);
        sheet.getRange(i + 1, 5).setValue(getMainCharFromRow(values[i]) || charName);
        sheet.getRange(i + 1, 6).setValue(getAccountIdFromRow(values[i]) || ("ACC-" + currentPin));
        sheet.getRange(i + 1, 7).setValue(securityQuestion);
        sheet.getRange(i + 1, 8).setValue(securityAnswer);

        return jsonOutput({
          success: true,
          exists: true,
          pin: currentPin,
          message: "Sicherheitsfrage wurde für den bestehenden SpielerPin gespeichert."
        });
      }

      return jsonOutput({
        success: false,
        error: "Für diesen Charakter existiert bereits ein SpielerPin."
      });
    }
  }

  const pin = requestedPin || createUniqueMasterPlayerPin();
  const validation = validateMasterPlayerPin(pin, charName, server);

  if (!validation.success) {
    return jsonOutput(validation);
  }

  sheet.appendRow([
    charName,
    server,
    className,
    pin,
    charName,
    "ACC-" + pin,
    securityQuestion,
    securityAnswer
  ]);

  return jsonOutput({
    success: true,
    exists: true,
    pin: pin
  });
}


function addTwink(e) {
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const charName = String(e.parameter.char || e.parameter.player || "").trim();
  const server = String(e.parameter.server || "").trim();
  const className = String(e.parameter.className || "").trim();

  if (!pin || !charName || !server || !className) {
    return jsonOutput({
      success: false,
      error: "SpielerPin, Charaktername, Server oder Klasse fehlt."
    });
  }

  if (isTemporaryPlayerPin(pin)) {
    return jsonOutput({
      success: false,
      error: "Twinks können nur mit dem Master-SpielerPin hinzugefügt werden."
    });
  }

  const owner = findPlayerByPin(pin);

  if (!owner) {
    return jsonOutput({
      success: false,
      error: "SpielerPin wurde nicht gefunden."
    });
  }

  const existingChar = findPlayerPinEntry(charName, server);

  if (existingChar) {
    const existingPin = normalizePlayerPin(existingChar.pin || "");

    if (existingPin === pin) {
      return jsonOutput({
        success: true,
        exists: true,
        message: "Dieser Twink ist bereits mit diesem SpielerPin verknüpft.",
        char: existingChar.charName,
        server: existingChar.server,
        className: existingChar.className || ""
      });
    }

    return jsonOutput({
      success: false,
      error: "Für diesen Charakter existiert bereits ein anderer SpielerPin."
    });
  }

  const sheet = getPlayerPinSheet_();

  const mainChar = owner.mainChar || owner.charName || charName;
  const accountId = owner.accountId || ("ACC-" + pin);
  const securityQuestion = owner.securityQuestion || "";
  const securityAnswer = owner.securityAnswer || "";

  sheet.appendRow([
    charName,
    server,
    className,
    pin,
    mainChar,
    accountId,
    securityQuestion,
    securityAnswer
  ]);

  return jsonOutput({
    success: true,
    exists: false,
    message: "Twink wurde gespeichert.",
    char: charName,
    server: server,
    className: className,
    mainChar: mainChar,
    accountId: accountId
  });
}


function resetPlayerPin(e) {
  const charName = String(e.parameter.char || "").trim();
  const server = String(e.parameter.server || "").trim();
  const oldPin = normalizePlayerPin(e.parameter.oldPin || "");
  const className = String(e.parameter.className || "").trim();
  const requestedPin = getRequestedMasterPinParam(e);
  const securityQuestion = getSecurityQuestionParam(e);
  const securityAnswer = getSecurityAnswerParam(e);

  if (!charName || !server) {
    return jsonOutput({
      success: false,
      error: "Charaktername oder Server fehlt."
    });
  }

  if (!oldPin) {
    return jsonOutput({
      success: false,
      error: "Alter SpielerPin fehlt."
    });
  }

  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowChar = normalizeName(values[i][0] || "");
    const rowServer = normalizeName(values[i][1] || "");

    if (
      rowChar === normalizeName(charName) &&
      rowServer === normalizeName(server)
    ) {
      const currentPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));

      if (currentPin !== oldPin) {
        return jsonOutput({
          success: false,
          error: "Falscher alter SpielerPin."
        });
      }

      const newPin = requestedPin || createUniqueMasterPlayerPin();
      const validation = validateMasterPlayerPin(newPin, charName, server);

      if (!validation.success) {
        return jsonOutput(validation);
      }

      // Neues Format: Char | Server | Klasse | Pin
      if (values[i].length >= 4) {
        if (className) sheet.getRange(i + 1, 3).setValue(className);
        sheet.getRange(i + 1, 4).setValue(newPin);
      } else {
        sheet.getRange(i + 1, 3).setValue(className || "");
        sheet.getRange(i + 1, 4).setValue(newPin);
      }

      const mainChar = getMainCharFromRow(values[i]) || String(values[i][0] || "").trim();
      const accountId = getAccountIdFromRow(values[i]) || ("ACC-" + oldPin);
      const updateAllLinkedRows = oldPin && !isTemporaryPlayerPin(oldPin);

      for (let r = 1; r < values.length; r++) {
        const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[r]));
        const sameAccount = String(getAccountIdFromRow(values[r]) || "") === accountId;
        const samePin = updateAllLinkedRows && rowPin === oldPin;

        if (r === i || sameAccount || samePin) {
          sheet.getRange(r + 1, 4).setValue(newPin);
          sheet.getRange(r + 1, 5).setValue(mainChar);
          sheet.getRange(r + 1, 6).setValue(accountId || ("ACC-" + newPin));
          if (securityQuestion && securityAnswer) {
            sheet.getRange(r + 1, 7).setValue(securityQuestion);
            sheet.getRange(r + 1, 8).setValue(securityAnswer);
          }
        }
      }

      return jsonOutput({
        success: true,
        exists: true,
        pin: newPin
      });
    }
  }

  return jsonOutput({
    success: false,
    error: "Charakter nicht gefunden."
  });
}

function resetPlayerPinBySecurity(e) {
  const charName = String(e.parameter.char || e.parameter.player || e.parameter.charName || "").trim();
  const server = String(e.parameter.server || "").trim();
  const securityQuestion = getSecurityQuestionParam(e);
  const securityAnswer = getSecurityAnswerParam(e);
  const requestedPin = getRequestedMasterPinParam(e);

  if (!charName || !server) {
    return jsonOutput({
      success: false,
      error: "Charaktername oder Server fehlt."
    });
  }

  if (!securityQuestion || !securityAnswer) {
    return jsonOutput({
      success: false,
      error: "Sicherheitsfrage oder Antwort fehlt."
    });
  }

  const newPin = requestedPin || createUniqueMasterPlayerPin();
  const validation = validateMasterPlayerPin(newPin, charName, server);

  if (!validation.success) {
    return jsonOutput(validation);
  }

  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  const targetChar = normalizeName(charName);
  const targetServer = normalizeName(server);

  for (let i = 1; i < values.length; i++) {
    const rowChar = normalizeName(values[i][0] || "");
    const rowServer = normalizeName(values[i][1] || "");

    if (rowChar !== targetChar || rowServer !== targetServer) continue;

    const rowQuestion = normalizeSecurityQuestion(getSecurityQuestionFromRow(values[i]));
    const rowAnswer = normalizeSecurityAnswer(getSecurityAnswerFromRow(values[i]));

    if (!rowQuestion || !rowAnswer) {
      return jsonOutput({
        success: false,
        error: "Für diesen Charakter ist keine Sicherheitsfrage gespeichert."
      });
    }

    if (rowQuestion !== securityQuestion || rowAnswer !== securityAnswer) {
      return jsonOutput({
        success: false,
        error: "Sicherheitsfrage oder Antwort ist falsch."
      });
    }

    const oldPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
    const mainChar = getMainCharFromRow(values[i]) || String(values[i][0] || "").trim();
    const accountId = getAccountIdFromRow(values[i]) || ("ACC-" + oldPin);
    const updateAllLinkedRows = oldPin && !isTemporaryPlayerPin(oldPin);

    for (let r = 1; r < values.length; r++) {
      const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[r]));
      const sameAccount = String(getAccountIdFromRow(values[r]) || "") === accountId;
      const samePin = updateAllLinkedRows && rowPin === oldPin;

      if (r === i || sameAccount || samePin) {
        sheet.getRange(r + 1, 4).setValue(newPin);
        sheet.getRange(r + 1, 5).setValue(mainChar);
        sheet.getRange(r + 1, 6).setValue(accountId || ("ACC-" + newPin));
        sheet.getRange(r + 1, 7).setValue(securityQuestion);
        sheet.getRange(r + 1, 8).setValue(securityAnswer);
      }
    }

    return jsonOutput({
      success: true,
      exists: true,
      pin: newPin,
      message: "SpielerPin wurde zurückgesetzt."
    });
  }

  return jsonOutput({
    success: false,
    error: "Charakter nicht gefunden."
  });
}

function findPlayerPin(charName, server) {
  const entry = findPlayerPinEntry(charName, server);
  return entry ? entry.pin : "";
}

function findPlayerPinEntry(charName, server) {
  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();

  const targetChar = normalizeName(charName || "");
  const targetServer = normalizeName(server || "");

  for (let i = 1; i < values.length; i++) {
    const rowChar = normalizeName(values[i][0] || "");
    const rowServer = normalizeName(values[i][1] || "");

    if (rowChar === targetChar && rowServer === targetServer) {
      return {
        charName: String(values[i][0] || "").trim(),
        server: String(values[i][1] || "").trim(),
        className: getPlayerClassFromRow(values[i]),
        pin: getPlayerPinFromRow(values[i]),
        mainChar: getMainCharFromRow(values[i]),
        accountId: getAccountIdFromRow(values[i]),
        securityQuestion: getSecurityQuestionFromRow(values[i]),
        securityAnswer: getSecurityAnswerFromRow(values[i])
      };
    }
  }

  return null;
}

function findPlayerByPin(pin) {
  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  const targetPin = String(pin || "").trim();

  for (let i = 1; i < values.length; i++) {
    const rowPin = getPlayerPinFromRow(values[i]);

    if (rowPin === targetPin) {
      return {
        charName: String(values[i][0] || "").trim(),
        server: String(values[i][1] || "").trim(),
        className: getPlayerClassFromRow(values[i]),
        pin: rowPin,
        mainChar: getMainCharFromRow(values[i]),
        accountId: getAccountIdFromRow(values[i]),
        securityQuestion: getSecurityQuestionFromRow(values[i]),
        securityAnswer: getSecurityAnswerFromRow(values[i])
      };
    }
  }

  return null;
}


function findPlayerPinEntryByPinAndChar(pin, charName) {
  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  const targetPin = normalizePlayerPin(pin);
  const targetChar = normalizeName(charName);

  for (let i = 1; i < values.length; i++) {
    const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
    const rowChar = normalizeName(values[i][0] || "");

    if (rowPin === targetPin && rowChar === targetChar) {
      return {
        charName: String(values[i][0] || "").trim(),
        server: String(values[i][1] || "").trim(),
        className: getPlayerClassFromRow(values[i]),
        pin: rowPin,
        mainChar: getMainCharFromRow(values[i]),
        accountId: getAccountIdFromRow(values[i]),
        securityQuestion: getSecurityQuestionFromRow(values[i]),
        securityAnswer: getSecurityAnswerFromRow(values[i])
      };
    }
  }

  return null;
}

function getMainCharFromRow(row) {
  if (row.length >= 5) {
    return String(row[4] || "").trim();
  }

  return "";
}

function getAccountIdFromRow(row) {
  if (row.length >= 6) {
    return String(row[5] || "").trim();
  }

  return "";
}

function getSecurityQuestionFromRow(row) {
  if (row.length >= 7) {
    return String(row[6] || "").trim();
  }

  return "";
}

function getSecurityAnswerFromRow(row) {
  if (row.length >= 8) {
    return String(row[7] || "").trim();
  }

  return "";
}

function getPlayerClassFromRow(row) {
  // Neues Format: Char | Server | Klasse | Pin
  // Altes Format: Char | Server | Pin
  if (row.length >= 4) {
    return String(row[2] || "").trim();
  }

  return "";
}

function getPlayerPinFromRow(row) {
  // Neues Format: Char | Server | Klasse | Pin
  // Altes Format: Char | Server | Pin
  if (row.length >= 4) {
    return String(row[3] || "").trim();
  }

  return String(row[2] || "").trim();
}

function findLatestPrioForPlayerAndRaidPin(charName, server, raidPin) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);

  const raids = raidSheet.getDataRange().getValues();
  let raidId = "";

  for (let i = 1; i < raids.length; i++) {
    if (
      String(raids[i][5] || "") === String(raidPin) ||
      String(raids[i][0] || "") === String(raidPin) ||
      String(raids[i][6] || "") === String(raidPin)
    ) {
      raidId = String(raids[i][0] || "");
      break;
    }
  }

  if (!raidId) return null;

  const values = prioSheet.getDataRange().getValues();
  const targetChar = normalizeName(charName || "");
  const targetServer = normalizeName(server || "");

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaidId = String(values[i][0] || "");
    const rowChar = String(values[i][3] || "").trim().toLowerCase();
    const rowServer = String(values[i][4] || "").trim().toLowerCase();

    if (
      rowRaidId === raidId &&
      rowChar === targetChar &&
      rowServer === targetServer
    ) {
      return {
        raidId: raidId,
        className: String(values[i][5] || ""),
        p1: String(values[i][6] || ""),
        p2: String(values[i][7] || ""),
        p3: String(values[i][8] || ""),
        p0Plus: String(values[i][9] || "nein"),
        characterPin: normalizePlayerPin(values[i][10] || "")
      };
    }
  }

  return null;
}

function findLatestPrioByCharacterPinAndRaidPin(characterPin, raidPin) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);

  const raids = raidSheet.getDataRange().getValues();
  let raidId = "";

  for (let i = 1; i < raids.length; i++) {
    if (
      String(raids[i][5] || "") === String(raidPin) ||
      String(raids[i][0] || "") === String(raidPin) ||
      String(raids[i][6] || "") === String(raidPin)
    ) {
      raidId = String(raids[i][0] || "");
      break;
    }
  }

  if (!raidId) return null;

  const values = prioSheet.getDataRange().getValues();
  const targetPin = normalizePlayerPin(characterPin);

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaidId = String(values[i][0] || "");
    const rowPin = normalizePlayerPin(values[i][10] || "");

    if (rowRaidId === raidId && rowPin === targetPin) {
      return {
        raidId: raidId,
        charName: String(values[i][3] || "").trim(),
        server: String(values[i][4] || "").trim(),
        className: String(values[i][5] || ""),
        p1: String(values[i][6] || ""),
        p2: String(values[i][7] || ""),
        p3: String(values[i][8] || ""),
        p0Plus: String(values[i][9] || "nein"),
        characterPin: normalizePlayerPin(values[i][10] || "")
      };
    }
  }

  return null;
}

function findLatestPrioByRaidPinAndCharacterPin(raidPin, characterPin) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);

  const raids = raidSheet.getDataRange().getValues();
  let raidId = "";

  for (let i = 1; i < raids.length; i++) {
    if (
      String(raids[i][5] || "") === String(raidPin) ||
      String(raids[i][0] || "") === String(raidPin) ||
      String(raids[i][6] || "") === String(raidPin)
    ) {
      raidId = String(raids[i][0] || "");
      break;
    }
  }

  if (!raidId) return null;

  const values = prioSheet.getDataRange().getValues();
  const targetPin = normalizePlayerPin(characterPin);

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaidId = String(values[i][0] || "");
    const rowPin = normalizePlayerPin(values[i][10] || "");

    if (rowRaidId === raidId && rowPin === targetPin) {
      return {
        raidId: raidId,
        charName: String(values[i][3] || ""),
        server: String(values[i][4] || ""),
        className: String(values[i][5] || ""),
        p1: String(values[i][6] || ""),
        p2: String(values[i][7] || ""),
        p3: String(values[i][8] || ""),
        p0Plus: String(values[i][9] || "nein"),
        characterPin: rowPin
      };
    }
  }

  return null;
}


function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ");
}

function normalizePlayerPin(value) {
  return String(value || "").trim().toUpperCase();
}

function getRequestedMasterPinParam(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  return normalizePlayerPin(
    p.customPin ||
    p.newPin ||
    p.newPlayerPin ||
    p.newPlayerLogin ||
    p.playerLogin ||
    p.login ||
    p.pin ||
    p.playerPin ||
    ""
  );
}

function getSecurityQuestionParam(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  return normalizeSecurityQuestion(
    p.securityQuestion ||
    p.security_question ||
    p.question ||
    p.questionKey ||
    p.security ||
    p.sicherheitsfrage ||
    ""
  );
}

function getSecurityAnswerParam(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  return normalizeSecurityAnswer(
    p.securityAnswer ||
    p.security_answer ||
    p.answer ||
    p.answerText ||
    p.securityAnswerText ||
    p.antwort ||
    ""
  );
}

function normalizeSecurityQuestion(value) {
  const raw = String(value || "").trim();
  const normalized = normalizeName(raw)
    .replace(/[?!.:]/g, "")
    .trim();

  if (!normalized) return "";
  if (["pet", "haustier", "tier"].includes(normalized)) return "pet";
  if (["food", "essen", "lieblingsessen"].includes(normalized)) return "food";
  if (["city", "stadt", "geburtsstadt"].includes(normalized)) return "city";
  if (["teacher", "lehrer", "lehrerin"].includes(normalized)) return "teacher";
  if (normalized.includes("haustier")) return "pet";
  if (normalized.includes("essen")) return "food";
  if (normalized.includes("stadt")) return "city";
  if (normalized.includes("lehrer")) return "teacher";

  return normalized;
}

function normalizeSecurityAnswer(value) {
  return normalizeName(value || "");
}

function isTemporaryPlayerPin(pin) {
  const value = normalizePlayerPin(pin);

  // Temporäre Pins haben immer das Format T + drei Zahlen, z. B. T123.
  return /^T\d{3}$/.test(value);
}

function createNumericPin4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function validateMasterPlayerPin(pin, charName, server) {
  const value = normalizePlayerPin(pin);

  if (!value) {
    return { success: false, error: "Bitte einen SpielerPin eingeben." };
  }

  if (value.length < 4 || value.length > 8) {
    return { success: false, error: "Der Master-SpielerPin muss 4 bis 8 Zeichen lang sein." };
  }

  if (!/^[A-Z0-9]+$/.test(value)) {
    return { success: false, error: "Der Master-SpielerPin darf nur Buchstaben und Zahlen enthalten." };
  }

  if (isTemporaryPlayerPin(value)) {
    return { success: false, error: "Pins im Format T123 sind für temporäre Raid-Pins reserviert." };
  }

  const owner = findPlayerByPin(value);

  if (owner) {
    const sameCharacter =
      String(owner.charName || "").trim().toLowerCase() === normalizeName(charName || "") &&
      String(owner.server || "").trim().toLowerCase() === normalizeName(server || "");

    if (!sameCharacter) {
      return { success: false, error: "Dieser SpielerPin ist bereits vergeben. Bitte wähle einen anderen Pin." };
    }
  }

  return { success: true };
}

function createUniqueMasterPlayerPin() {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const pin = createNumericPin4();

    if (!findPlayerByPin(pin)) {
      return pin;
    }
  }

  throw new Error("Es konnte kein freier SpielerPin erzeugt werden.");
}

/* =========================================================
   P0PLUS
   ========================================================= */

function transferP0PlusPoints(e) {
  const masterCode = String(e.parameter.masterCode || "");
  const raidId = String(e.parameter.raidId || "");
  const raid = normalizeRaidForP0(e.parameter.raid || "");

  if (masterCode !== MASTER_CODE) {
    return jsonOutput({ success: false, error: "Master-Code ungültig." });
  }

  if (!["MC", "BWL", "AQ40", "NAXX"].includes(raid)) {
    return jsonOutput({ success: false, error: "Raid nicht für P0+ freigegeben." });
  }

  if (!raidId) {
    return jsonOutput({ success: false, error: "RaidID fehlt." });
  }

  const prioSheet = getRequiredSheet(PRIO_SHEET);
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);

  const prios = prioSheet.getDataRange().getValues();
  let candidates = 0;
  let awarded = 0;

  for (let i = 1; i < prios.length; i++) {
    const rowRaidId = String(prios[i][0] || "");
    const player = String(prios[i][3] || "").trim();
    const item = String(prios[i][6] || "").trim();
    const p0Plus = String(prios[i][9] || "").toLowerCase();

    if (rowRaidId !== raidId) continue;
    if (p0Plus !== "ja") continue;
    if (!player || !item) continue;

    candidates++;

    const slot = findSlotForItem(raid, item);
    const success = addOrUpdateP0PlusPoint(p0Sheet, raid, item, slot, player);

    if (success) awarded++;
  }

  return jsonOutput({
    success: true,
    raid: raid,
    raidId: raidId,
    candidates: candidates,
    awarded: awarded
  });
}

function clearP0PlusForPlayer(e) {
  const masterCode = String(e.parameter.masterCode || "");
  const raid = normalizeRaidForP0(e.parameter.raid || "");
  const player = String(e.parameter.player || "").trim();
  const item = String(e.parameter.item || "").trim();

  if (masterCode !== MASTER_CODE) {
    return jsonOutput({ success: false, error: "Master-Code ungültig." });
  }

  if (!["MC", "BWL", "AQ40", "NAXX"].includes(raid)) {
    return jsonOutput({ success: false, error: "Raid nicht für P0+ freigegeben." });
  }

  if (!raid || !player || !item) {
    return jsonOutput({ success: false, error: "Raid, Spieler oder Item fehlt." });
  }

  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);
  const values = p0Sheet.getDataRange().getValues();
  let deleted = 0;

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaid = normalizeRaidForP0(values[i][0] || "");
    const rowItem = String(values[i][1] || "");
    const rowPlayer = String(values[i][3] || "");

    if (
      rowRaid === raid &&
      itemKey(rowItem) === itemKey(item) &&
      itemKey(rowPlayer) === itemKey(player)
    ) {
      p0Sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return jsonOutput({
    success: true,
    raid: raid,
    item: item,
    player: player,
    deleted: deleted
  });
}

function getP0PlusData(e) {
  const raidFilter = normalizeRaidForP0(e.parameter.raid || "");
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);

  const values = p0Sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const raid = normalizeRaidForP0(values[i][0] || "");
    const item = String(values[i][1] || "").trim();
    const slot = String(values[i][2] || "").trim();
    const player = String(values[i][3] || "").trim();
    const count = Number(values[i][4] || 0);

    if (!raid || !item || !player || !count) continue;
    if (raidFilter && raid !== raidFilter) continue;

    result.push({
      raid: raid,
      item: item,
      slot: slot,
      player: player,
      count: count
    });
  }

  return {
    success: true,
    raid: raidFilter,
    count: result.length,
    entries: result
  };
}

function getAddonExport(e) {
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);

  const raidFilter = normalizeRaidForP0(e.parameter.raid || "");
  const p0Values = p0Sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < p0Values.length; i++) {
    const raid = normalizeRaidForP0(p0Values[i][0] || "");
    const item = String(p0Values[i][1] || "").trim();
    const fallbackSlot = String(p0Values[i][2] || "").trim();
    const player = String(p0Values[i][3] || "").trim();
    const points = Number(p0Values[i][4] || 0);

    if (!raid || !item || !player || !points) continue;
    if (raidFilter && raid !== raidFilter) continue;

    const lootInfo = getLootInfoForAddon(raid, item);

    result.push({
      raid: raid,
      boss: lootInfo.boss || "",
      slot: lootInfo.slot || fallbackSlot || "",
      typ: lootInfo.typ || "",
      item: lootInfo.item || item,
      itemId: lootInfo.itemId || "",
      icon: lootInfo.icon || "",
      quality: lootInfo.quality || "",
      dropchance: lootInfo.dropchance || "",
      stats: lootInfo.stats || "",
      tooltip: lootInfo.tooltip || "",
      itemLink: lootInfo.itemLink || "",
      player: player,
      points: points
    });
  }

  return jsonOutput({
    success: true,
    count: result.length,
    entries: result
  });
}

/* =========================================================
   FULL LOOT DATABASE EXPORT
   ========================================================= */

function getFullExport(e) {
  return jsonOutput(getFullExportData(e));
}

function getFullExportData(e) {
  const raidFilter = normalizeRaidForP0(e.parameter.raid || "");
  const raids = raidFilter ? [raidFilter] : Object.keys(LOOT_SHEETS);

  const entries = [];

  raids.forEach(raid => {
    const sheetName = getLootSheetNameByRaid(raid);
    if (!sheetName) return;

    const sheetEntries = getLootEntriesFromSheet(raid, sheetName);
    sheetEntries.forEach(entry => entries.push(entry));
  });

  return {
    success: true,
    mode: "full-loot-database-v2",
    raid: raidFilter || "ALL",
    count: entries.length,
    entries: entries
  };
}

function getFullExportText(e) {
  const raidFilter = normalizeRaidForP0(e.parameter.raid || "");
  const raids = raidFilter ? [raidFilter] : Object.keys(LOOT_SHEETS);

  const lines = [
    "Raid;Boss;ItemID;Item;Slot;Typ;Qualität;Icon;Dropchance;Stats;Tooltip;ItemLink;Spieler;Punkte"
  ];

  raids.forEach(raid => {
    const sheetName = getLootSheetNameByRaid(raid);
    if (!sheetName) return;

    const sheetEntries = getLootEntriesFromSheet(raid, sheetName);

    sheetEntries.forEach(entry => {
      lines.push([
        encodeAddonField(entry.raid),
        encodeAddonField(entry.boss),
        encodeAddonField(entry.itemId),
        encodeAddonField(entry.item),
        encodeAddonField(entry.slot),
        encodeAddonField(entry.typ),
        encodeAddonField(entry.quality),
        encodeAddonField(entry.icon),
        encodeAddonField(entry.dropchance),
        encodeAddonField(entry.stats),
        encodeAddonField(entry.tooltip),
        encodeAddonField(entry.itemLink),
        encodeAddonField(entry.player || "__Datenbank__"),
        encodeAddonField(entry.points || 0)
      ].join(";"));
    });
  });

  return ContentService
    .createTextOutput(lines.join("||"))
    .setMimeType(ContentService.MimeType.TEXT);
}

function getLootEntriesFromSheet(raid, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const itemCol = findHeaderAny(headers, ["Itemname_DE", "Item", "Itemname", "Name"]);

  if (itemCol === -1) return [];

  const result = [];

  for (let i = 1; i < values.length; i++) {
    const obj = rowToObject(headers, values[i]);
    const item = String(values[i][itemCol] || "").trim();

    if (!item) continue;

    result.push(normalizeLootEntryFromObject(raid, obj, item));
  }

  return result;
}

/* =========================================================
   LOOT-INFO / ITEMDATEN
   ========================================================= */

function getLootInfoForAddon(raid, itemName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getLootSheetNameByRaid(raid);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  const headers = values[0].map(h => String(h).trim());
  const itemCol = findHeaderAny(headers, ["Itemname_DE", "Item", "Itemname", "Name"]);

  if (itemCol === -1) return {};

  const target = itemKey(itemName);

  for (let i = 1; i < values.length; i++) {
    const rowItem = String(values[i][itemCol] || "");

    if (itemKey(rowItem) !== target) continue;

    const obj = rowToObject(headers, values[i]);
    return normalizeLootEntryFromObject(raid, obj, rowItem);
  }

  return {};
}

function normalizeLootEntryFromObject(raid, obj, fallbackItem) {
  const item = getFirstValue(obj, ["Itemname_DE", "Item", "Itemname", "Name"]) || fallbackItem || "";
  const tooltip = getFirstValue(obj, ["Tooltip_DE", "Tooltip", "Beschreibung"]);
  const stats = getFirstValue(obj, ["Stats_DE", "Stats", "Werte", "Effekt"]) || collectAddonStats(obj);

  return {
    raid: normalizeRaidForP0(getFirstValue(obj, ["Raid"]) || raid),
    boss: getFirstValue(obj, ["Boss", "BossName"]),
    slot: getFirstValue(obj, ["Slot_DE", "Slot", "ItemSlot"]),
    typ: getFirstValue(obj, ["Typ_DE", "Typ", "Type", "Kategorie"]),
    item: item,
    itemId: getFirstValue(obj, ["ItemID", "ItemId", "ID"]),
    icon: normalizeIconName(getFirstValue(obj, ["Icon", "IconName"])),
    quality: getFirstValue(obj, ["Qualität", "Qualitaet", "Quality"]),
    dropchance: getFirstValue(obj, ["Dropchance", "Drop", "DropChance"]),
    stats: stats,
    tooltip: tooltip,
    itemLink: getFirstValue(obj, ["ItemLink", "Link"]),
    player: "__Datenbank__",
    points: 0
  };
}

function rowToObject(headers, row) {
  const obj = {};

  headers.forEach((header, index) => {
    obj[header] = row[index];
  });

  return obj;
}

function collectAddonStats(obj) {
  const stats = [];
  const seen = {};

  function add(value) {
    const clean = String(value || "").trim();
    if (!clean) return;

    const key = itemKey(clean);
    if (seen[key]) return;

    seen[key] = true;
    stats.push(clean);
  }

  [
    "Stats_DE",
    "Stats",
    "Stat1",
    "Stat2",
    "Stat3",
    "Stat4",
    "Stat5",
    "Stat6",
    "Benötigt",
    "Eigenschaften",
    "Werte",
    "Effekt",
    "Beschreibung"
  ].forEach(col => {
    if (!obj[col]) return;

    String(obj[col])
      .split(/;|\n|\|/)
      .forEach(part => add(part));
  });

  return stats.join(" | ");
}

function findSlotForItem(raid, itemName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getLootSheetNameByRaid(raid);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return "";

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return "";

  const headers = values[0].map(h => String(h).trim());

  const itemCol = findHeaderAny(headers, ["Itemname_DE", "Item", "Itemname", "Name"]);
  const slotCol = findHeaderAny(headers, ["Slot_DE", "Slot", "ItemSlot"]);

  if (itemCol === -1 || slotCol === -1) return "";

  const targetKey = itemKey(itemName);

  for (let i = 1; i < values.length; i++) {
    const rowItem = String(values[i][itemCol] || "");

    if (itemKey(rowItem) === targetKey) {
      return String(values[i][slotCol] || "").trim();
    }
  }

  return "";
}

function findHeaderAny(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = findHeader(headers, names[i]);
    if (index !== -1) return index;
  }
  return -1;
}

function getLootSheetNameByRaid(raid) {
  const value = normalizeRaidForP0(raid);
  return LOOT_SHEETS[value] || "";
}

/* =========================================================
   WOWHEAD ITEM-ID / ICON SYNC
   ========================================================= */

function syncMCOnly() {
  syncItemIdsAndIconsForOneSheet("LOOT_MC");
}

function syncBWLOnly() {
  syncItemIdsAndIconsForOneSheet("LOOT_BWL");
}

function syncZGOnly() {
  syncItemIdsAndIconsForOneSheet("LOOT_ZG");
}

function syncAQ20Only() {
  syncItemIdsAndIconsForOneSheet("LOOT_AQ20");
}

function syncAQ40Only() {
  syncItemIdsAndIconsForOneSheet("LOOT_AQ40");
}

function syncNaxxOnly() {
  syncItemIdsAndIconsForOneSheet("LOOT_NAXX");
}

function syncOnyOnly() {
  syncItemIdsAndIconsForOneSheet("LOOT_ONY");
}

function syncAllLootSheets() {
  Object.keys(LOOT_SHEETS).forEach(raid => {
    syncItemIdsAndIconsForOneSheet(LOOT_SHEETS[raid]);
  });
}

function syncItemIdsAndIconsForOneSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log("Tab nicht gefunden: " + sheetName);
    return;
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    Logger.log(sheetName + ": Keine Daten vorhanden.");
    return;
  }

  const headers = values[0].map(h => String(h).trim());

  const itemCol = findHeader(headers, "Item");
  const itemIdCol = findHeader(headers, "ItemID");
  const iconCol = findHeader(headers, "Icon");

  if (itemCol === -1 || itemIdCol === -1 || iconCol === -1) {
    Logger.log(sheetName + ": Item, ItemID oder Icon fehlt.");
    return;
  }

  for (let i = 1; i < values.length; i++) {
    const itemName = String(values[i][itemCol] || "").trim();

    if (!itemName) continue;

    const data = findWowheadClassicItemByName(itemName);

    if (data && data.itemId) {
      sheet.getRange(i + 1, itemIdCol + 1).setValue(data.itemId);
    }

    if (data && data.icon) {
      sheet.getRange(i + 1, iconCol + 1).setValue(data.icon);
    }

    Utilities.sleep(350);
  }

  Logger.log(sheetName + ": ItemID/Icon-Abgleich abgeschlossen.");
}

function findWowheadClassicItemByName(itemName) {
  try {
    const searchUrl =
      "https://www.wowhead.com/classic/search?q=" +
      encodeURIComponent(itemName);

    const html = UrlFetchApp.fetch(searchUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    }).getContentText();

    const escapedName = escapeRegex(itemName);

    const idMatch =
      html.match(new RegExp('/classic/item=(\\d+)[^"]*">\\s*' + escapedName, "i")) ||
      html.match(/\/classic\/item=(\d+)/i) ||
      html.match(/"id":\s*(\d+)/i);

    if (!idMatch || !idMatch[1]) {
      Logger.log("Keine ItemID gefunden für: " + itemName);
      return null;
    }

    const itemId = idMatch[1];
    const icon = getWowheadIconByItemId(itemId);

    return {
      itemId: itemId,
      icon: icon
    };

  } catch (err) {
    Logger.log("Fehler bei Itemname " + itemName + ": " + err.message);
    return null;
  }
}

function getWowheadIconByItemId(itemId) {
  try {
    const urls = [
      "https://www.wowhead.com/classic/tooltip/item/" + encodeURIComponent(itemId),
      "https://classic.wowhead.com/tooltip/item/" + encodeURIComponent(itemId),
      "https://www.wowhead.com/classic/item=" + encodeURIComponent(itemId)
    ];

    for (const url of urls) {
      const response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const text = response.getContentText();

      const match =
        text.match(/"icon"\s*:\s*"([^"]+)"/) ||
        text.match(/<icon>([^<]+)<\/icon>/) ||
        text.match(/\/wow\/icons\/large\/([^".]+)\.jpg/);

      if (match && match[1]) {
        return normalizeIconName(match[1]);
      }
    }

    return "";
  } catch (err) {
    Logger.log("Icon-Fehler bei ItemID " + itemId + ": " + err.message);
    return "";
  }
}

/* =========================================================
   HILFSFUNKTIONEN
   ========================================================= */

function getRequiredSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Tabellenblatt '" + name + "' wurde nicht gefunden.");
  return sheet;
}

function getFirstValue(obj, names) {
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (obj[name] !== undefined && obj[name] !== null && String(obj[name]).trim() !== "") {
      return String(obj[name]).trim();
    }
  }
  return "";
}

function normalizeRaidForP0(value) {
  const raid = String(value || "").trim().toUpperCase();

  if (raid === "MC" || raid.includes("MOLTEN")) return "MC";
  if (raid === "BWL" || raid.includes("BLACKWING")) return "BWL";
  if (raid === "ZG" || raid.includes("ZUL")) return "ZG";
  if (raid === "AQ20" || raid.includes("RUINS")) return "AQ20";
  if (raid === "AQ40" || raid === "AQ" || raid.includes("TEMPLE")) return "AQ40";
  if (raid === "NAXX" || raid.includes("NAXX")) return "NAXX";
  if (raid === "ONY" || raid === "ONYXIA" || raid.includes("ONYXIA")) return "ONY";

  return raid;
}

function addOrUpdateP0PlusPoint(sheet, raid, item, slot, player) {
  const values = sheet.getDataRange().getValues();

  const raidKey = normalizeRaidForP0(raid);
  const itemKeyValue = itemKey(item);
  const playerKeyValue = itemKey(player);

  for (let i = 1; i < values.length; i++) {
    const rowRaid = normalizeRaidForP0(values[i][0] || "");
    const rowItem = String(values[i][1] || "");
    const rowPlayer = String(values[i][3] || "");

    if (
      rowRaid === raidKey &&
      itemKey(rowItem) === itemKeyValue &&
      itemKey(rowPlayer) === playerKeyValue
    ) {
      const current = Number(values[i][4] || 0);
      sheet.getRange(i + 1, 5).setValue(current + 1);
      return true;
    }
  }

  sheet.appendRow([
    raidKey,
    item,
    slot || "",
    player,
    1
  ]);

  return true;
}

function findHeader(headers, name) {
  return headers.findIndex(h =>
    String(h).trim().toLowerCase() === String(name).trim().toLowerCase()
  );
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function itemKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['’`´]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeIconName(icon) {
  icon = String(icon || "").trim();
  if (!icon) return "";

  icon = icon.replace(/\.jpg$/i, "");
  icon = icon.replace(/\.blp$/i, "");
  icon = icon.replace(/^https:\/\/wow\.zamimg\.com\/images\/wow\/icons\/large\//i, "");
  icon = icon.replace(/^Interface\\Icons\\/i, "");
  icon = icon.replace(/^interface\\icons\\/i, "");

  return icon.toLowerCase();
}

function encodeAddonField(value) {
  return String(value || "")
    .replace(/%/g, "%PCT%")
    .replace(/\r/g, "")
    .replace(/\n/g, "%BR%")
    .replace(/;/g, "%SEP%")
    .replace(/\|/g, "%PIPE%");
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp(obj, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(obj) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonOutput(obj);
}
