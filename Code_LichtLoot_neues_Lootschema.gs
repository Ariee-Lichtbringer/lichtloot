const RAID_SHEET = "RAIDS";
const PRIO_SHEET = "PRIOS";
const P0PLUS_SHEET = "P0Plus";
const PLAYERPIN_SHEET = "PLAYERPINS";
const TEMP_PLAYERPIN_SHEET = "TEMP_PLAYERPINS";
const ISSUE_REPORT_SHEET = "Fehlermeldungen";
const PLAYER_MESSAGE_SHEET = "SpielerNachrichten";
const LOOT_SPREADSHEET_ID = "10_Rkl1biYanx7rEbiSzjd4q3LqPBa-OxH7hFSMMBNGQ";
const WORLDBUFF_SPREADSHEET_ID = "1eItzaMGhpJ28vv4sDA8wwmu0YhUxcbiz-2VLiCVyjv4";
const WORLDBUFF_SHEET_GID = 1498762908;
const HORDENBUFF_SHEET_GID = 1246908857;
const WORLDBUFF_BOT_QUEUE_SHEET = "BotQueue";
const WORLDBUFF_TICKER_CACHE_SHEET = "WorldbuffTickerCache";
const PUBLIC_BUFF_TERMS_SPREADSHEET_ID = "1o7fzOAn9wC0iWcauC3bDo2RYR8kZ1xQMjkvSi1lJG8Q";
const PUBLIC_BUFF_TERMS_SHEET_GID = 0;

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
    const contentType = String((e && e.postData && e.postData.type) || "").toLowerCase();
    const body = String((e && e.postData && e.postData.contents) || "").trim();
    let data = {};

    if (body && (contentType.indexOf("application/json") !== -1 || body.charAt(0) === "{" || body.charAt(0) === "[")) {
      data = JSON.parse(body || "{}");
    } else {
      data = Object.assign({}, (e && e.parameter) || {});
    }

    if (data.action === "createRaid") return createRaid(data);
    if (data.action === "savePrio") return savePrio(data);
    if (data.action === "createPlayerPin") return createPlayerPin({ parameter: data });
    if (data.action === "resetPlayerPin") return resetPlayerPin({ parameter: data });
    if (data.action === "resetPlayerPinBySecurity") return resetPlayerPinBySecurity({ parameter: data });
    if (data.action === "addTwink") return addTwink({ parameter: data });
    if (data.action === "getGuildLeadershipOverview") return jsonOutput(getGuildLeadershipOverview({ parameter: data }));
    if (data.action === "getPlayerWorldbuffs") return jsonOutput(getPlayerWorldbuffsData({ parameter: data }));
    if (data.action === "movePlayerWorldbuff") return jsonOutput(movePlayerWorldbuffData({ parameter: data }));
    if (data.action === "claimPlayerWorldbuff") return jsonOutput(claimPlayerWorldbuffData({ parameter: data }));
    if (data.action === "getPublicWorldbuffs") return jsonOutput(getPublicWorldbuffsData({ parameter: data }));
    if (data.action === "guildResetPlayerLogin") return guildResetPlayerLogin({ parameter: data });
    if (data.action === "guildSetRaidStatus") return guildSetRaidStatus({ parameter: data });
    if (data.action === "guildSetPrioBench") return guildSetPrioBench({ parameter: data });
    if (data.action === "guildSetP0PlusPoints") return guildSetP0PlusPoints({ parameter: data });
    if (data.action === "guildGetIssueReports") return jsonOutput(guildGetIssueReportsData({ parameter: data }));
    if (data.action === "guildResolveIssueReport") return jsonOutput(guildResolveIssueReportData({ parameter: data }));
    if (data.action === "getPlayerMessages") return jsonOutput(getPlayerMessagesData({ parameter: data }));
    if (data.action === "markPlayerMessageRead") return jsonOutput(markPlayerMessageReadData({ parameter: data }));
    if (data.action === "guildGetWorldbuffs") return jsonOutput(guildGetWorldbuffsData({ parameter: data }));
    if (data.action === "guildSetWorldbuffCaster") return jsonOutput(guildSetWorldbuffCasterData({ parameter: data }));
    if (data.action === "guildGetHordenbuffs") return jsonOutput(guildGetHordenbuffsData({ parameter: data }));
    if (data.action === "guildSetHordenbuffEntry") return jsonOutput(guildSetHordenbuffEntryData({ parameter: data }));
    if (data.action === "guildCreateBuffTerm") return jsonOutput(guildCreateBuffTermData({ parameter: data }));
    if (data.action === "guildSyncPublicBuffTerms") return jsonOutput(guildSyncPublicBuffTermsData({ parameter: data }));
    if (data.action === "guildQueueWorldbuffBotUpdate") return jsonOutput(guildQueueWorldbuffBotUpdateData({ parameter: data }));
    if (data.action === "lichtbotGetQueue") return jsonOutput(lichtbotGetQueueData({ parameter: data }));
    if (data.action === "lichtbotResolveQueue") return jsonOutput(lichtbotResolveQueueData({ parameter: data }));
    if (data.action === "lichtbotSyncWorldbuffTicker") return jsonOutput(lichtbotSyncWorldbuffTickerData({ parameter: data }));
    if (data.action === "lichtbotSetWorldbuffCaster") return jsonOutput(lichtbotSetWorldbuffCasterData({ parameter: data }));
    if (data.action === "lichtbotClaimWorldbuffSlot") return jsonOutput(lichtbotClaimWorldbuffSlotData({ parameter: data }));
    if (data.action === "lichtbotSetHordenbuffEntry") return jsonOutput(lichtbotSetHordenbuffEntryData({ parameter: data }));
    if (data.action === "lichtbotDeleteHordenbuffEntry") return jsonOutput(lichtbotDeleteHordenbuffEntryData({ parameter: data }));

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
          "createRaid",
          "testCreateRaid",
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
          "getPlayerWorldbuffs",
          "movePlayerWorldbuff",
          "claimPlayerWorldbuff",
          "getPublicWorldbuffs",
          "reportIssue",
          "getCharacterGearFromWCL",
          "setP0PlusOverride",
          "getGuildLeadershipOverview",
          "guildResetPlayerLogin",
          "guildSetRaidStatus",
          "guildSetPrioBench",
          "guildSetP0PlusPoints",
          "guildGetIssueReports",
          "guildResolveIssueReport",
          "getPlayerMessages",
          "markPlayerMessageRead",
          "guildGetWorldbuffs",
          "guildSetWorldbuffCaster",
          "guildGetHordenbuffs",
          "guildSetHordenbuffEntry",
          "guildCreateBuffTerm",
          "guildSyncPublicBuffTerms",
          "guildQueueWorldbuffBotUpdate",
          "lichtbotGetQueue",
          "lichtbotResolveQueue",
          "lichtbotSyncWorldbuffTicker",
          "lichtbotSetWorldbuffCaster",
          "lichtbotClaimWorldbuffSlot",
          "lichtbotSetHordenbuffEntry",
          "lichtbotDeleteHordenbuffEntry"
        ]
      }, callback);
    }

    if (action === "testCreateRaid") {
      return jsonOrJsonp(createRaidData_({
        raidId: "TEST-" + Date.now(),
        raid: "test",
        raidName: "Script Test",
        raidDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
        raidTime: "20:00",
        playerPin: "TST",
        leadPin: "TEST",
        status: "geschlossen",
        p0PlusFreigabe: "geschlossen",
        guild: "Script Test"
      }), callback);
    }

    if (action === "createRaid") return jsonOrJsonp(createRaidData_(e.parameter), callback);

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
    if (action === "getPlayerWorldbuffs") return jsonOrJsonp(getPlayerWorldbuffsData(e), callback);
    if (action === "movePlayerWorldbuff") return jsonOrJsonp(movePlayerWorldbuffData(e), callback);
    if (action === "claimPlayerWorldbuff") return jsonOrJsonp(claimPlayerWorldbuffData(e), callback);
    if (action === "getPublicWorldbuffs") return jsonOrJsonp(getPublicWorldbuffsData(e), callback);
    if (action === "getGuildLeadershipOverview") return jsonOrJsonp(getGuildLeadershipOverview(e), callback);
    if (action === "guildResetPlayerLogin") return jsonOrJsonp(guildResetPlayerLoginData(e), callback);
    if (action === "guildSetRaidStatus") return jsonOrJsonp(guildSetRaidStatusData(e), callback);
    if (action === "guildSetPrioBench") return jsonOrJsonp(guildSetPrioBenchData(e), callback);
    if (action === "guildSetP0PlusPoints") return jsonOrJsonp(guildSetP0PlusPointsData(e), callback);
    if (action === "guildGetIssueReports") return jsonOrJsonp(guildGetIssueReportsData(e), callback);
    if (action === "guildResolveIssueReport") return jsonOrJsonp(guildResolveIssueReportData(e), callback);
    if (action === "getPlayerMessages") return jsonOrJsonp(getPlayerMessagesData(e), callback);
    if (action === "markPlayerMessageRead") return jsonOrJsonp(markPlayerMessageReadData(e), callback);
    if (action === "guildGetWorldbuffs") return jsonOrJsonp(guildGetWorldbuffsData(e), callback);
    if (action === "guildSetWorldbuffCaster") return jsonOrJsonp(guildSetWorldbuffCasterData(e), callback);
    if (action === "guildGetHordenbuffs") return jsonOrJsonp(guildGetHordenbuffsData(e), callback);
    if (action === "guildSetHordenbuffEntry") return jsonOrJsonp(guildSetHordenbuffEntryData(e), callback);
    if (action === "guildCreateBuffTerm") return jsonOrJsonp(guildCreateBuffTermData(e), callback);
    if (action === "guildSyncPublicBuffTerms") return jsonOrJsonp(guildSyncPublicBuffTermsData(e), callback);
    if (action === "guildQueueWorldbuffBotUpdate") return jsonOrJsonp(guildQueueWorldbuffBotUpdateData(e), callback);
    if (action === "lichtbotGetQueue") return jsonOrJsonp(lichtbotGetQueueData(e), callback);
    if (action === "lichtbotResolveQueue") return jsonOrJsonp(lichtbotResolveQueueData(e), callback);
    if (action === "lichtbotSetWorldbuffCaster") return jsonOrJsonp(lichtbotSetWorldbuffCasterData(e), callback);
    if (action === "lichtbotClaimWorldbuffSlot") return jsonOrJsonp(lichtbotClaimWorldbuffSlotData(e), callback);
    if (action === "lichtbotSetHordenbuffEntry") return jsonOrJsonp(lichtbotSetHordenbuffEntryData(e), callback);
    if (action === "lichtbotDeleteHordenbuffEntry") return jsonOrJsonp(lichtbotDeleteHordenbuffEntryData(e), callback);
    if (action === "validateLeadPin") return validateLeadPin(e);
    if (action === "setRaidStatus") return setRaidStatus(e);
    if (action === "setP0PlusOverride") return setP0PlusOverride(e);
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
  return jsonOutput(createRaidData_(data));
}

function createRaidData_(data) {
  const sheet = getRequiredSheet(RAID_SHEET);
  const raidId = data.raidId || data.RaidID || "";
  const raid = data.raid || data.Raid || "";
  const raidName = data.raidName || data.RaidName || "";
  const raidDate = data.raidDate || data.RaidDate || data.datum || data.Datum || "";
  const raidTime = data.raidTime || data.RaidTime || data.uhrzeit || data.Uhrzeit || "";
  const playerPin = data.playerPin || data.PlayerPin || "";
  const leadPin = data.leadPin || data.LeadPin || "";
  const playerLink = data.playerLink || data.PlayerLink || "";
  const createdAt = data.createdAt || data.CreatedAt || new Date().toISOString();
  const status = data.status || data.Status || "geschlossen";
  const p0PlusFreigabe = data.p0PlusFreigabe || data.P0PlusFreigabe || data.p0PlusOverride || "geschlossen";
  const guild = data.guild || data.gilde || data.Gilde || data.Guild || "";

  sheet.appendRow([
    raidId,
    raid,
    raidName,
    raidDate,
    raidTime,
    playerPin,
    leadPin,
    playerLink,
    createdAt,
    status,
    p0PlusFreigabe,
    guild
  ]);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: "Raid gespeichert.",
    raidId: raidId,
    raid: raid,
    raidName: raidName,
    raidDate: raidDate,
    raidTime: raidTime,
    playerPin: playerPin,
    leadPin: leadPin,
    p0PlusFreigabe: p0PlusFreigabe
  };
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

function getPrioBenchColumnIndex_(values) {
  const headers = values && values.length ? values[0] : [];
  const wanted = ["bench", "gebencht", "benched", "ersatzbank"];

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || "").trim().toLowerCase();
    if (wanted.indexOf(header) !== -1) return i;
  }

  return -1;
}

function ensurePrioBenchColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 12);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues();
  const existingIndex = getPrioBenchColumnIndex_(headers);
  if (existingIndex >= 0) return existingIndex + 1;

  const benchCol = lastColumn + 1;
  sheet.getRange(1, benchCol).setValue("Bench");
  return benchCol;
}

function isBenchActive_(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "ja" ||
    normalized === "true" ||
    normalized === "1" ||
    normalized === "bench" ||
    normalized === "gebencht" ||
    normalized === "benched"
  );
}

function savePrio(data) {
  const raidSheet = getRequiredSheet(RAID_SHEET);
  const prioSheet = getRequiredSheet(PRIO_SHEET);
  const benchCol = ensurePrioBenchColumn_(prioSheet);

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
  let existingBench = "";

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
      existingBench = String(existing[i][benchCol - 1] || "").trim();
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

  const prioRow = [
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
  ];
  prioRow[benchCol - 1] = existingBench;

  prioSheet.appendRow(prioRow);

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
  const benchIndex = getPrioBenchColumnIndex_(prios);

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
        rowNumber: i + 1,
        Spieler: prios[i][3],
        Server: prios[i][4],
        Klasse: prios[i][5],
        P1: prios[i][6],
        P2: prios[i][7],
        P3: prios[i][8],
        P0Plus: prios[i][9],
        Bench: benchIndex >= 0 ? prios[i][benchIndex] : ""
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
    allRaids: allActiveRaids.sort((a, b) => b.timestamp - a.timestamp),
    worldbuffs: buildWorldbuffListResponse_({ parameter: { days: 7 } }, 7).buffs
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

function guildGetIssueReports(e) {
  return jsonOutput(guildGetIssueReportsData(e));
}

function guildGetIssueReportsData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const sheet = getOrCreateIssueReportSheet_();
  const values = sheet.getDataRange().getValues();
  const reports = [];

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    const empty = row.every(function(cell) {
      return String(cell || "").trim() === "";
    });
    if (empty) continue;

    reports.push({
      rowNumber: i + 1,
      time: formatIssueReportDate_(row[0]),
      type: String(row[1] || "").trim(),
      source: String(row[2] || "").trim(),
      category: String(row[3] || "").trim(),
      raid: String(row[4] || "").trim(),
      item: String(row[5] || "").trim(),
      slot: String(row[6] || "").trim(),
      points: String(row[7] || "").trim(),
      player: String(row[8] || "").trim(),
      server: String(row[9] || "").trim(),
      note: String(row[10] || "").trim(),
      page: String(row[11] || "").trim(),
      createdAt: String(row[12] || "").trim()
    });
  }

  return {
    success: true,
    count: reports.length,
    reports: reports.slice(0, 200)
  };
}

function guildResolveIssueReport(e) {
  return jsonOutput(guildResolveIssueReportData(e));
}

function guildResolveIssueReportData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const rowNumber = Number(e.parameter.rowNumber || 0);
  const sheet = getOrCreateIssueReportSheet_();

  if (rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
    return { success: false, error: "Meldung nicht gefunden." };
  }

  const row = sheet.getRange(rowNumber, 1, 1, 13).getValues()[0];
  const notification = createIssueResolvedPlayerMessage_(row);
  sheet.deleteRow(rowNumber);

  return {
    success: true,
    deleted: true,
    rowNumber: rowNumber,
    notified: notification.notified,
    notificationError: notification.error || ""
  };
}

function createIssueResolvedPlayerMessage_(issueRow) {
  const player = String(issueRow[8] || "").trim();
  const server = String(issueRow[9] || "").trim();
  if (!player) {
    return { notified: false, error: "Kein Spieler in der Meldung." };
  }

  const entry = findPlayerPinEntry(player, server);
  if (!entry || !entry.pin) {
    return { notified: false, error: "SpielerLogin wurde nicht gefunden." };
  }

  const raid = String(issueRow[4] || "").trim();
  const item = String(issueRow[5] || "").trim();
  const category = String(issueRow[3] || issueRow[1] || "Fehlermeldung").trim();
  const note = String(issueRow[10] || "").trim();
  const title = "Fehlermeldung erledigt";
  const bodyParts = [
    "Deine Fehlermeldung wurde von der Gildenleitung erledigt.",
    raid ? "Raid: " + raid : "",
    item ? "Item: " + item : "",
    category ? "Kategorie: " + category : "",
    note ? "Dein Hinweis: " + note : ""
  ].filter(Boolean);

  addPlayerMessage_({
    playerPin: entry.pin,
    title: title,
    body: bodyParts.join("\n"),
    raidName: raid,
    sender: "Gildenleitung"
  });

  return { notified: true };
}

function getOrCreatePlayerMessageSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PLAYER_MESSAGE_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(PLAYER_MESSAGE_SHEET);
    sheet.appendRow([
      "Zeit",
      "SpielerPin",
      "Titel",
      "Nachricht",
      "RaidID",
      "RaidName",
      "RaidDatum",
      "RaidZeit",
      "LeadPin",
      "Absender",
      "GelesenAm"
    ]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function addPlayerMessage_(message) {
  const sheet = getOrCreatePlayerMessageSheet_();
  sheet.appendRow([
    new Date(),
    normalizePlayerPin(message.playerPin || ""),
    message.title || "Nachricht",
    message.body || "",
    message.raidId || "",
    message.raidName || "",
    message.raidDate || "",
    message.raidTime || "",
    message.leadPin || "",
    message.sender || "Gildenleitung",
    ""
  ]);
}

function getPlayerMessagesData(e) {
  const playerPin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  if (!playerPin) {
    return { success: false, error: "SpielerPin fehlt." };
  }

  const sheet = getOrCreatePlayerMessageSheet_();
  const values = sheet.getDataRange().getValues();
  const messages = [];

  for (let i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    if (normalizePlayerPin(row[1]) !== playerPin) continue;

    messages.push({
      id: String(i + 1),
      rowNumber: i + 1,
      time: formatIssueReportDate_(row[0]),
      playerPin: String(row[1] || "").trim(),
      title: String(row[2] || "").trim(),
      body: String(row[3] || "").trim(),
      raidId: String(row[4] || "").trim(),
      raidName: String(row[5] || "").trim(),
      raidDate: String(row[6] || "").trim(),
      raidTime: String(row[7] || "").trim(),
      leadPin: String(row[8] || "").trim(),
      sender: String(row[9] || "").trim(),
      readAt: formatIssueReportDate_(row[10]),
      read: Boolean(row[10])
    });

    if (messages.length >= 50) break;
  }

  return {
    success: true,
    count: messages.length,
    messages: messages
  };
}

function markPlayerMessageReadData(e) {
  const playerPin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const rowNumber = Number(e.parameter.rowNumber || e.parameter.id || e.parameter.messageId || 0);
  const sheet = getOrCreatePlayerMessageSheet_();

  if (!playerPin || rowNumber <= 1 || rowNumber > sheet.getLastRow()) {
    return { success: false, error: "Nachricht nicht gefunden." };
  }

  const rowPin = normalizePlayerPin(sheet.getRange(rowNumber, 2).getValue());
  if (rowPin !== playerPin) {
    return { success: false, error: "Nachricht gehört nicht zu diesem SpielerPin." };
  }

  if (!sheet.getRange(rowNumber, 11).getValue()) {
    sheet.getRange(rowNumber, 11).setValue(new Date());
  }

  return {
    success: true,
    rowNumber: rowNumber
  };
}

function formatIssueReportDate_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  }
  return String(value || "");
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

function setP0PlusOverride(e) {
  const raidId = String(e.parameter.raidId || "").trim();
  const leadPin = String(e.parameter.leadPin || "").trim();
  const enabledValue = String(
    e.parameter.enabled ||
    e.parameter.value ||
    e.parameter.p0PlusFreigabe ||
    e.parameter.p0PlusOverride ||
    ""
  ).trim().toLowerCase();
  const p0PlusFreigabe =
    enabledValue === "true" ||
    enabledValue === "ja" ||
    enabledValue === "aktiv" ||
    enabledValue === "freigeschaltet" ||
    enabledValue === "offen" ||
    enabledValue === "geöffnet"
      ? "geöffnet"
      : "geschlossen";

  if (!raidId && !leadPin) {
    return jsonOutput({ success: false, error: "RaidID oder LeadPIN fehlt." });
  }

  const sheet = getRequiredSheet(RAID_SHEET);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowRaidId = String(values[i][0] || "").trim();
    const rowLeadPin = String(values[i][6] || "").trim();

    if ((raidId && rowRaidId === raidId) || (leadPin && rowLeadPin === leadPin)) {
      sheet.getRange(i + 1, 11).setValue(p0PlusFreigabe);
      return jsonOutput({
        success: true,
        raidId: rowRaidId,
        p0PlusFreigabe: p0PlusFreigabe,
        p0PlusOverride: isP0PlusFreigabeActive_(p0PlusFreigabe)
      });
    }
  }

  return jsonOutput({ success: false, error: "RaidID oder LeadPIN nicht gefunden." });
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
          className: gearResult.className || "",
          talents: gearResult.talents || [],
          rawTalents: gearResult.rawTalents || null,
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
    const talents = normalizeWarcraftLogsTalents_(combatantInfo);

    if (items.length) {
      return {
        items: items,
        className: actor.subType || actor.type || "",
        talents: talents,
        rawTalents: combatantInfo && (combatantInfo.talents || combatantInfo.talentTree || combatantInfo.specs || combatantInfo.spec) || null,
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
    const enchantments = normalizeWarcraftLogsEnchantments_(item);
    return {
      slot: slot,
      slotName: slotNames[slot] || String(slot || "Slot"),
      id: id,
      itemId: id,
      name: item.name || item.itemName || (id ? "Item " + id : "Unbekannt"),
      quality: item.quality || "",
      icon: normalizeIconName(item.icon || item.iconName || ""),
      itemLevel: item.itemLevel || item.ilvl || "",
      permanentEnchant: item.permanentEnchant || item.permanentEnchantName || item.enchant || "",
      permanentEnchantName: item.permanentEnchantName || item.enchantName || "",
      enchantments: enchantments,
      gems: normalizeWarcraftLogsGems_(item.gems || item.gem || item.socketedGems || [])
    };
  }).filter(item => item.id);
}

function normalizeWarcraftLogsEnchantments_(item) {
  const raw = item.enchantments || item.enchants || [];
  const enchants = [];

  if (item.permanentEnchant || item.permanentEnchantName || item.enchant || item.enchantName) {
    enchants.push({
      id: item.permanentEnchant || item.enchant || "",
      name: item.permanentEnchantName || item.enchantName || "",
      type: "PERMANENT"
    });
  }

  (Array.isArray(raw) ? raw : []).forEach(function(enchant) {
    if (!enchant) return;
    enchants.push({
      id: enchant.id || enchant.enchantment_id || enchant.enchantmentId || enchant.spellID || enchant.spellId || "",
      name: enchant.name || enchant.enchantmentName || enchant.spellName || "",
      type: enchant.type || (enchant.enchantment_slot && enchant.enchantment_slot.type) || ""
    });
  });

  return enchants;
}

function normalizeWarcraftLogsGems_(gems) {
  return (Array.isArray(gems) ? gems : [gems]).filter(Boolean).map(function(gem) {
    if (typeof gem === "string" || typeof gem === "number") {
      return { id: gem, name: "" };
    }
    return {
      id: gem.id || gem.itemID || gem.itemId || "",
      name: gem.name || gem.itemName || "",
      icon: normalizeIconName(gem.icon || gem.iconName || "")
    };
  });
}

function normalizeWarcraftLogsTalents_(combatantInfo) {
  if (!combatantInfo) return [];

  const rawTalents =
    combatantInfo.talents ||
    combatantInfo.talentTree ||
    combatantInfo.specs ||
    combatantInfo.spec ||
    [];

  const talents = [];

  if (Array.isArray(rawTalents) && rawTalents.length && rawTalents.every(function(talent) {
    return typeof talent === "number" || (/^\d+$/.test(String(talent || "")));
  })) {
    return [{
      name: "Spec",
      rank: rawTalents.join("/") + (rawTalents.length === 2 ? "/0" : ""),
      type: "spec",
      trees: rawTalents
    }];
  }

  function addTalent_(talent, treeName) {
    if (!talent) return;

    if (typeof talent === "string") {
      talents.push({ name: talent, rank: "", tree: treeName || "" });
      return;
    }

    const name =
      talent.name ||
      talent.talentName ||
      talent.abilityName ||
      talent.spellName ||
      talent.id ||
      talent.guid ||
      "";

    const rank =
      talent.rank ||
      talent.points ||
      talent.amount ||
      talent.value ||
      "";

    if (name || rank) {
      talents.push({
        name: String(name || "Talent"),
        rank: rank,
        tree: treeName || talent.tree || talent.treeName || talent.category || "",
        id: talent.id || talent.guid || talent.spellID || talent.spellId || ""
      });
    }
  }

  if (Array.isArray(rawTalents)) {
    rawTalents.forEach(function(talent) {
      if (talent && Array.isArray(talent.talents)) {
        talent.talents.forEach(function(child) {
          addTalent_(child, talent.name || talent.tree || talent.treeName || "");
        });
      } else {
        addTalent_(talent, "");
      }
    });
  } else if (typeof rawTalents === "object") {
    Object.keys(rawTalents).forEach(function(key) {
      const value = rawTalents[key];
      if (Array.isArray(value)) {
        value.forEach(function(talent) {
          addTalent_(talent, key);
        });
      } else if (typeof value === "object") {
        addTalent_(value, key);
      } else if (value) {
        addTalent_({ name: key, rank: value }, "");
      }
    });
  }

  return talents;
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
   GILDENLEITUNG
   ========================================================= */

function hasValidGuildMasterCode_(e) {
  return String((e && e.parameter && e.parameter.masterCode) || "") === MASTER_CODE;
}

function getGuildLeadershipOverview(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  return {
    success: true,
    raids: getGuildLeadershipRaids_(),
    players: getGuildLeadershipPlayers_()
  };
}

function getGuildLeadershipRaids_() {
  const sheet = getRequiredSheet(RAID_SHEET);
  const values = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const raidId = String(row[0] || "").trim();
    const raid = String(row[1] || "").trim();
    const playerPin = String(row[5] || "").trim();
    const leadPin = String(row[6] || "").trim();

    if (!raidId && !raid && !playerPin && !leadPin) continue;

    result.push({
      rowNumber: i + 1,
      raidId: raidId,
      raid: raid,
      raidName: String(row[2] || "").trim(),
      raidDate: formatRaidDateValue_(row[3]),
      raidTime: formatRaidTimeValue_(row[4]),
      playerPin: playerPin,
      leadPin: leadPin,
      playerLink: String(row[7] || "").trim(),
      createdAt: String(row[8] || "").trim(),
      status: String(row[9] || "geschlossen").trim(),
      p0PlusFreigabe: getRaidP0PlusFreigabeFromRow_(row, values),
      guild: getRaidGuildFromRow_(row, values)
    });
  }

  result.sort(function(a, b) {
    const dateA = Date.parse((a.raidDate || "") + "T" + (a.raidTime || "00:00")) || Date.parse(a.createdAt || "") || 0;
    const dateB = Date.parse((b.raidDate || "") + "T" + (b.raidTime || "00:00")) || Date.parse(b.createdAt || "") || 0;
    return dateB - dateA;
  });

  return result;
}

function getGuildLeadershipPlayers_() {
  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  const result = [];
  const seen = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const charName = String(row[0] || "").trim();
    const server = String(row[1] || "").trim();
    const pin = normalizePlayerPin(getPlayerPinFromRow(row));

    if (!charName && !server && !pin) continue;

    const accountId = getAccountIdFromRow(row) || (pin ? "ACC-" + pin : "");
    const key = normalizeName(charName) + "|" + normalizeName(server) + "|" + pin;
    if (seen[key]) continue;
    seen[key] = true;

    result.push({
      rowNumber: i + 1,
      char: charName,
      player: charName,
      server: server,
      className: getPlayerClassFromRow(row),
      mainChar: getMainCharFromRow(row),
      hasSecurityQuestion: Boolean(getSecurityQuestionFromRow(row)),
      linkedCharacters: countLinkedCharactersForPin_(values, pin, accountId)
    });
  }

  result.sort(function(a, b) {
    const mainA = normalizeName(a.mainChar || a.char);
    const mainB = normalizeName(b.mainChar || b.char);
    if (mainA !== mainB) return mainA.localeCompare(mainB);
    return normalizeName(a.char).localeCompare(normalizeName(b.char));
  });

  return result;
}

function countLinkedCharactersForPin_(values, pin, accountId) {
  let count = 0;
  const targetPin = normalizePlayerPin(pin);
  const targetAccount = String(accountId || "").trim();

  for (let i = 1; i < values.length; i++) {
    const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
    const rowAccount = String(getAccountIdFromRow(values[i]) || "").trim();

    if ((targetAccount && rowAccount === targetAccount) || (targetPin && rowPin === targetPin)) {
      count++;
    }
  }

  return count;
}

function guildResetPlayerLogin(e) {
  return jsonOutput(guildResetPlayerLoginData(e));
}

function guildResetPlayerLoginData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const rowNumber = Number(e.parameter.rowNumber || 0);
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const charName = String(e.parameter.char || e.parameter.player || "").trim();
  const server = String(e.parameter.server || "").trim();

  const sheet = getPlayerPinSheet_();
  const values = sheet.getDataRange().getValues();
  let targetIndex = -1;

  if (rowNumber > 1 && rowNumber <= values.length) {
    targetIndex = rowNumber - 1;
  } else {
    const targetChar = normalizeName(charName);
    const targetServer = normalizeName(server);

    for (let i = 1; i < values.length; i++) {
      const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
      const rowChar = normalizeName(values[i][0] || "");
      const rowServer = normalizeName(values[i][1] || "");

      if (pin && rowPin === pin) {
        targetIndex = i;
        break;
      }

      if (targetChar && targetServer && rowChar === targetChar && rowServer === targetServer) {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex < 1) {
    return { success: false, error: "Spielerlogin nicht gefunden." };
  }

  const oldPin = normalizePlayerPin(getPlayerPinFromRow(values[targetIndex]));
  const mainChar = getMainCharFromRow(values[targetIndex]) || String(values[targetIndex][0] || "").trim();
  const accountId = getAccountIdFromRow(values[targetIndex]) || ("ACC-" + oldPin);
  const newPin = createUniqueMasterPlayerPin();
  let updated = 0;

  for (let i = 1; i < values.length; i++) {
    const rowPin = normalizePlayerPin(getPlayerPinFromRow(values[i]));
    const rowAccount = String(getAccountIdFromRow(values[i]) || "").trim();
    const sameAccount = accountId && rowAccount === accountId;
    const samePin = oldPin && rowPin === oldPin;

    if (i === targetIndex || sameAccount || samePin) {
      sheet.getRange(i + 1, 4).setValue(newPin);
      sheet.getRange(i + 1, 5).setValue(mainChar);
      sheet.getRange(i + 1, 6).setValue(accountId || ("ACC-" + newPin));
      updated++;
    }
  }

  return {
    success: true,
    updated: updated,
    char: String(values[targetIndex][0] || "").trim(),
    server: String(values[targetIndex][1] || "").trim(),
    mainChar: mainChar
  };
}

function guildSetRaidStatus(e) {
  return jsonOutput(guildSetRaidStatusData(e));
}

function guildSetRaidStatusData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const raidId = String(e.parameter.raidId || "").trim();
  const status = String(e.parameter.status || "geschlossen").trim();
  const hasP0PlusFreigabe =
    Object.prototype.hasOwnProperty.call(e.parameter, "p0PlusFreigabe") ||
    Object.prototype.hasOwnProperty.call(e.parameter, "p0PlusOverride");
  const p0PlusFreigabe = String(e.parameter.p0PlusFreigabe || e.parameter.p0PlusOverride || "").trim();

  if (!raidId) {
    return { success: false, error: "RaidID fehlt." };
  }

  const sheet = getRequiredSheet(RAID_SHEET);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || "").trim() !== raidId) continue;

    sheet.getRange(i + 1, 10).setValue(status);
    if (hasP0PlusFreigabe) {
      sheet.getRange(i + 1, 11).setValue(p0PlusFreigabe);
    }

    return {
      success: true,
      raidId: raidId,
      status: status,
      p0PlusFreigabe: hasP0PlusFreigabe ? p0PlusFreigabe : getRaidP0PlusFreigabeFromRow_(values[i], values)
    };
  }

  return { success: false, error: "RaidID nicht gefunden." };
}

/* =========================================================
   WORLDBUFFS / LICHTBOT
   ========================================================= */

function guildGetWorldbuffsData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  return buildWorldbuffListResponse_(e, 60);
}

function getPublicWorldbuffsData(e) {
  return buildWorldbuffListResponse_(e, 7);
}

function buildWorldbuffListResponse_(e, defaultDays) {
  e = e || { parameter: {} };
  const days = normalizeBuffDays_(e.parameter.days || defaultDays || 60, defaultDays || 60);
  const includePast = String(e.parameter.includePast || "").toLowerCase() === "true";
  const buffFilter = normalizeWorldbuffName_(e.parameter.buff || "");
  const rows = getCombinedWorldbuffRows_();
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maxDate = new Date(todayOnly.getTime() + days * 24 * 60 * 60 * 1000);

  const filtered = rows.filter(function(row) {
    if (buffFilter && !worldbuffRowMatchesFilter_(row, buffFilter)) return false;

    const dateValue = parseWorldbuffDate_(row.datum);
    if (!dateValue) return includePast;

    if (!includePast && dateValue < todayOnly) return false;
    return dateValue <= maxDate;
  });

  filtered.sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    const timeA = String(a.uhrzeit || "");
    const timeB = String(b.uhrzeit || "");
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) || timeA.localeCompare(timeB);
  });

  return {
    success: true,
    days: days,
    count: filtered.length,
    buffs: filtered
  };
}

function worldbuffRowMatchesFilter_(row, buffFilter) {
  const wanted = normalizeWorldbuffName_(buffFilter);
  const rowBuff = normalizeWorldbuffName_(row && row.buff);
  if (!wanted || rowBuff === wanted) return true;
  return isWorldbuffOpen_(row && row.status) &&
    !(row && row.charakter) &&
    isOnyNefWorldbuff_(wanted) &&
    isOnyNefWorldbuff_(rowBuff);
}

function isOnyNefWorldbuff_(buff) {
  const value = normalizeWorldbuffName_(buff);
  return value === "Ony" || value === "Nef";
}

function getPlayerWorldbuffsData(e) {
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const days = normalizeBuffDays_(e.parameter.days || 90, 90);

  if (!pin || isTemporaryPlayerPin(pin)) {
    return { success: false, error: "Für Worldbuff-Termine brauchst du deinen Master-SpielerPin." };
  }

  const characters = getPlayerCharactersForPin_(pin);
  if (!characters.length) {
    return { success: false, error: "Zu diesem SpielerPin wurden keine Charaktere gefunden." };
  }

  const characterMap = {};
  characters.forEach(function(character) {
    characterMap[normalizeWorldbuffComparable_(character.char)] = character;
  });

  const rows = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maxDate = new Date(todayOnly.getTime() + days * 24 * 60 * 60 * 1000);

  const ownBuffs = rows.filter(function(row) {
    const casterKey = normalizeWorldbuffComparable_(row.charakter);
    const dateValue = parseWorldbuffDate_(row.datum);
    if (!casterKey || !characterMap[casterKey]) return false;
    if (isHordeWorldbuffRow_(row)) return false;
    if (!dateValue || dateValue < todayOnly || dateValue > maxDate) return false;
    return true;
  }).map(function(row) {
    const alternatives = getOpenWorldbuffAlternatives_(rows, row, todayOnly, maxDate);
    return Object.assign({}, row, {
      matchedCharacter: characterMap[normalizeWorldbuffComparable_(row.charakter)] || null,
      alternatives: alternatives
    });
  });
  const openSlots = getOpenWorldbuffSlots_(rows, todayOnly, maxDate, 60);

  ownBuffs.sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) ||
      String(a.uhrzeit || "").localeCompare(String(b.uhrzeit || ""));
  });

  return {
    success: true,
    count: ownBuffs.length,
    characters: characters,
    buffs: ownBuffs,
    openSlots: openSlots
  };
}

function movePlayerWorldbuffData(e) {
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const fromRowNumber = Number(e.parameter.fromRowNumber || e.parameter.rowNumber || 0);
  const toRowNumber = Number(e.parameter.toRowNumber || e.parameter.targetRowNumber || 0);

  if (!pin || isTemporaryPlayerPin(pin)) {
    return { success: false, error: "Für Worldbuff-Termine brauchst du deinen Master-SpielerPin." };
  }

  if (fromRowNumber < 2 || toRowNumber < 2 || fromRowNumber === toRowNumber) {
    return { success: false, error: "Alter oder neuer Termin fehlt." };
  }

  const characters = getPlayerCharactersForPin_(pin);
  const characterMap = {};
  characters.forEach(function(character) {
    characterMap[normalizeWorldbuffComparable_(character.char)] = character;
  });

  const rows = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const from = rows.find(function(row) { return Number(row.rowNumber) === fromRowNumber; });
  const to = rows.find(function(row) { return Number(row.rowNumber) === toRowNumber; });

  if (!from || !to) {
    return { success: false, error: "Termin wurde nicht gefunden." };
  }

  const casterKey = normalizeWorldbuffComparable_(from.charakter);
  if (!casterKey || !characterMap[casterKey]) {
    return { success: false, error: "Dieser Worldbuff-Termin gehört nicht zu deinem Spielerlogin." };
  }

  if (isHordeWorldbuffRow_(from) || isHordeWorldbuffRow_(to)) {
    return { success: false, error: "Hordenbuffs können hier nicht verschoben werden." };
  }

  if (normalizeWorldbuffName_(from.buff) !== normalizeWorldbuffName_(to.buff)) {
    return { success: false, error: "Du kannst nur auf denselben Buff-Typ verschieben." };
  }

  if (to.charakter || !isWorldbuffOpen_(to.status)) {
    return { success: false, error: "Der Zieltermin ist nicht mehr frei." };
  }

  const caster = from.charakter;
  const fromStatus = normalizeBuffStatusForSheet_("offen");
  const toStatus = normalizeBuffStatusForSheet_("bestätigt");
  const clearOld = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, fromRowNumber, "", fromStatus, null, null);
  if (!clearOld.success) return clearOld;

  const setNew = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, toRowNumber, caster, toStatus, null, null);
  if (!setNew.success) return setNew;

  queueWorldbuffBotUpdate_("worldbuff_update", {
    source: "mein-lichtloot",
    moved: true,
    fromRowNumber: fromRowNumber,
    toRowNumber: toRowNumber,
    charakter: caster
  });

  return {
    success: true,
    moved: true,
    charakter: caster,
    from: from,
    to: Object.assign({}, to, { charakter: caster, status: toStatus })
  };
}

function claimPlayerWorldbuffData(e) {
  const pin = normalizePlayerPin(e.parameter.pin || e.parameter.playerPin || "");
  const rowNumber = Number(e.parameter.rowNumber || e.parameter.targetRowNumber || 0);
  const charakter = String(e.parameter.charakter || e.parameter.char || "").trim();
  const selectedBuff = normalizeWorldbuffName_(e.parameter.buff || e.parameter.selectedBuff || "");

  if (!pin || isTemporaryPlayerPin(pin)) {
    return { success: false, error: "Für Worldbuff-Termine brauchst du deinen Master-SpielerPin." };
  }

  if (rowNumber < 2 || !charakter) {
    return { success: false, error: "Termin oder Charakter fehlt." };
  }

  const characters = getPlayerCharactersForPin_(pin);
  const ownsCharacter = characters.some(function(character) {
    return sameWorldbuffName_(character.char, charakter);
  });

  if (!ownsCharacter) {
    return { success: false, error: "Dieser Charakter gehört nicht zu deinem Spielerlogin." };
  }

  const rows = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const target = rows.find(function(row) { return Number(row.rowNumber) === rowNumber; });

  if (!target) {
    return { success: false, error: "Termin wurde nicht gefunden." };
  }

  if (isHordeWorldbuffRow_(target)) {
    return { success: false, error: "Hordenbuffs können hier nicht übernommen werden." };
  }

  if (target.charakter || !isWorldbuffOpen_(target.status)) {
    return { success: false, error: "Der Termin ist nicht mehr frei." };
  }

  const status = normalizeBuffStatusForSheet_("bestätigt");
  const buffToSave = selectedBuff || normalizeWorldbuffName_(target.buff);
  const saved = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, rowNumber, charakter, status, null, null, buffToSave);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("worldbuff_update", {
    source: "mein-lichtloot",
    claimed: true,
    rowNumber: rowNumber,
    buff: buffToSave,
    charakter: charakter
  });

  return {
    success: true,
    claimed: true,
    charakter: charakter,
    term: Object.assign({}, target, { buff: buffToSave, charakter: charakter, status: status })
  };
}

function getPlayerCharactersForPin_(pin) {
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

  return characters;
}

function getOpenWorldbuffAlternatives_(rows, sourceRow, todayOnly, maxDate) {
  return rows.filter(function(row) {
    if (Number(row.rowNumber) === Number(sourceRow.rowNumber)) return false;
    if (isHordeWorldbuffRow_(row)) return false;
    if (normalizeWorldbuffName_(row.buff) !== normalizeWorldbuffName_(sourceRow.buff)) return false;
    if (row.charakter || !isWorldbuffOpen_(row.status)) return false;

    const dateValue = parseWorldbuffDate_(row.datum);
    if (!dateValue || dateValue < todayOnly || dateValue > maxDate) return false;

    return true;
  }).sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) ||
      String(a.uhrzeit || "").localeCompare(String(b.uhrzeit || ""));
  }).slice(0, 8).map(function(row) {
    return {
      rowNumber: row.rowNumber,
      tag: row.tag,
      datum: row.datum,
      uhrzeit: row.uhrzeit,
      buff: row.buff,
      gilde: row.gilde,
      status: row.status
    };
  });
}

function getOpenWorldbuffSlots_(rows, todayOnly, maxDate, limit) {
  const slots = [];

  rows.filter(function(row) {
    if (isHordeWorldbuffRow_(row)) return false;
    if (row.charakter || !isWorldbuffOpen_(row.status)) return false;

    const dateValue = parseWorldbuffDate_(row.datum);
    if (!dateValue || dateValue < todayOnly || dateValue > maxDate) return false;

    return true;
  }).sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) ||
      String(a.uhrzeit || "").localeCompare(String(b.uhrzeit || ""));
  }).forEach(function(row) {
    getWorldbuffSignupChoicesForRow_(row).forEach(function(buff) {
      slots.push({
        rowNumber: row.rowNumber,
        slotId: [row.rowNumber, buff].join("|"),
        tag: row.tag,
        datum: row.datum,
        uhrzeit: row.uhrzeit,
        buff: buff,
        originalBuff: row.buff,
        gilde: row.gilde,
        status: row.status
      });
    });
  });

  return slots.slice(0, limit || 14);
}

function getWorldbuffSignupChoicesForRow_(row) {
  const buff = normalizeWorldbuffName_(row && row.buff);
  if (buff === "Ony") return ["Ony", "Nef"];
  if (buff === "Nef") return ["Nef", "Ony"];
  return buff ? [buff] : [];
}

function isHordeWorldbuffRow_(row) {
  const guild = normalizeWorldbuffComparable_(row && row.gilde);
  return guild === "horde" || guild.indexOf("hordeworldbuff") !== -1 || guild.indexOf("hordenbuff") !== -1;
}

function guildGetHordenbuffsData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const days = normalizeBuffDays_(e.parameter.days || 60, 60);
  const includePast = String(e.parameter.includePast || "").toLowerCase() === "true";
  const rows = getWorldbuffRows_(HORDENBUFF_SHEET_GID);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maxDate = new Date(todayOnly.getTime() + days * 24 * 60 * 60 * 1000);

  const filtered = rows.filter(function(row) {
    const dateValue = parseWorldbuffDate_(row.datum);
    if (!dateValue) return includePast;
    if (!includePast && dateValue < todayOnly) return false;
    return dateValue <= maxDate;
  });

  filtered.sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    const timeA = String(a.uhrzeit || "");
    const timeB = String(b.uhrzeit || "");
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) || timeA.localeCompare(timeB);
  });

  return {
    success: true,
    days: days,
    count: filtered.length,
    buffs: filtered
  };
}

function guildSetWorldbuffCasterData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const rowNumber = Number(e.parameter.rowNumber || 0);
  const charakter = String(e.parameter.charakter || e.parameter.caster || "").trim();
  const status = normalizeBuffStatusForSheet_(e.parameter.status || "");
  const buff = normalizeWorldbuffName_(e.parameter.buff || "");

  if (rowNumber < 2) {
    return { success: false, error: "Worldbuff-Zeile fehlt." };
  }

  const saved = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, rowNumber, charakter, status, null, null, buff || null);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("worldbuff_update", {
    source: "gildenleitung",
    rowNumber: rowNumber,
    buff: buff,
    charakter: charakter,
    status: status
  });

  return {
    success: true,
    rowNumber: rowNumber,
    buff: buff,
    charakter: charakter,
    status: status,
    queued: true
  };
}

function guildSetHordenbuffEntryData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const rowNumber = Number(e.parameter.rowNumber || 0);
  const charakter = String(e.parameter.charakter || e.parameter.caster || "").trim();
  const status = normalizeBuffStatusForSheet_(e.parameter.status || "");
  const note = String(e.parameter.note || e.parameter.notiz || "").trim();
  const uebernehmer = String(e.parameter.uebernehmer || e.parameter.helper || "").trim();

  if (rowNumber < 2) {
    return { success: false, error: "Hordenbuff-Zeile fehlt." };
  }

  const saved = setWorldbuffSheetEntry_(HORDENBUFF_SHEET_GID, rowNumber, charakter, status, note, uebernehmer);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("hordenbuff_update", {
    source: "gildenleitung",
    rowNumber: rowNumber,
    charakter: charakter,
    status: status,
    note: note
  });

  return {
    success: true,
    rowNumber: rowNumber,
    charakter: charakter,
    status: status,
    note: note,
    uebernehmer: uebernehmer,
    queued: true,
    saved: saved
  };
}

function guildCreateBuffTermData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const target = String(e.parameter.target || "worldbuff").toLowerCase();
  const sheetGid = target === "hordenbuff" ? HORDENBUFF_SHEET_GID : WORLDBUFF_SHEET_GID;
  const datum = formatWorldbuffDateValue_(e.parameter.datum || e.parameter.date || "");
  const uhrzeit = formatWorldbuffTimeValue_(e.parameter.uhrzeit || e.parameter.time || "");
  const buff = normalizeWorldbuffName_(e.parameter.buff || (target === "hordenbuff" ? "Rend" : ""));
  const gilde = String(e.parameter.gilde || e.parameter.guild || e.parameter.fraktion || (target === "hordenbuff" ? "Horde" : "")).trim();
  const charakter = String(e.parameter.charakter || e.parameter.caster || "").trim();
  const status = normalizeBuffStatusForSheet_(e.parameter.status || "offen");
  const note = String(e.parameter.note || e.parameter.notiz || "").trim();
  const uebernehmer = String(e.parameter.uebernehmer || e.parameter.helper || "").trim();

  if (!datum || !uhrzeit || !buff || !gilde) {
    return { success: false, error: "Datum, Uhrzeit, Buff und Gilde/Fraktion sind Pflicht." };
  }

  const sheetInfo = getWorldbuffSheetInfo_(sheetGid);
  const rowNumber = insertBuffTermRow_(sheetInfo, {
    tag: makeWorldbuffTagFromDate_(datum),
    datum: datum,
    uhrzeit: uhrzeit,
    buff: buff,
    gilde: gilde,
    charakter: charakter,
    status: status,
    note: note,
    uebernehmer: uebernehmer
  });
  const publicSync = syncPublicBuffTerm_(target, rowNumber, {
    tag: makeWorldbuffTagFromDate_(datum),
    datum: datum,
    uhrzeit: uhrzeit,
    buff: buff,
    gilde: gilde
  });

  queueWorldbuffBotUpdate_(target === "hordenbuff" ? "hordenbuff_update" : "worldbuff_update", {
    source: "gildenleitung",
    created: true,
    rowNumber: rowNumber,
    datum: datum,
    uhrzeit: uhrzeit,
    buff: buff,
    gilde: gilde
  });

  return {
    success: true,
    rowNumber: rowNumber,
    term: {
      rowNumber: rowNumber,
      tag: makeWorldbuffTagFromDate_(datum),
      datum: datum,
      uhrzeit: uhrzeit,
      buff: buff,
      gilde: gilde,
      charakter: charakter,
      status: status,
      note: note,
      uebernehmer: uebernehmer
    },
    publicSync: publicSync
  };
}

function guildSyncPublicBuffTermsData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const cleanup = cleanupMisplacedPublicBuffTerms_();
  const worldbuffs = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const hordenbuffs = getWorldbuffRows_(HORDENBUFF_SHEET_GID);
  let synced = 0;
  const errors = [];

  worldbuffs.forEach(function(term) {
    const result = syncPublicBuffTerm_("worldbuff", term.rowNumber, term);
    if (result && result.success) synced++;
    else errors.push(result && result.error ? result.error : "Worldbuff-Termin konnte nicht synchronisiert werden.");
  });

  hordenbuffs.forEach(function(term) {
    const result = syncPublicBuffTerm_("hordenbuff", term.rowNumber, term);
    if (result && result.success) synced++;
    else errors.push(result && result.error ? result.error : "Hordenbuff-Termin konnte nicht synchronisiert werden.");
  });

  return {
    success: errors.length === 0,
    synced: synced,
    cleaned: cleanup.cleaned || 0,
    errors: errors.slice(0, 5),
    error: errors.length ? errors[0] : ""
  };
}

function guildQueueWorldbuffBotUpdateData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const requestedType = String(e.parameter.type || e.parameter.updateType || "worldbuff_update").trim();
  const type = requestedType === "hordenbuff_update" ? "hordenbuff_update" : "worldbuff_update";

  queueWorldbuffBotUpdate_(type, {
    source: "gildenleitung",
    manual: true
  });

  return {
    success: true,
    queued: true
  };
}

function lichtbotSetWorldbuffCasterData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const buff = normalizeWorldbuffName_(e.parameter.buff || "");
  const charakter = String(e.parameter.charakter || e.parameter.caster || "").trim();

  if (!buff || !charakter) {
    return { success: false, error: "Buff und Charakter sind Pflicht." };
  }

  const match = findNextOpenWorldbuffRow_(buff, e.parameter.gilde || e.parameter.guild || "Lichtbringer");
  if (!match) {
    return { success: false, message: "Kein freier Lichtbringer-Termin für " + buff + " innerhalb der nächsten 3 Monate gefunden." };
  }

  const status = normalizeBuffStatusForSheet_(e.parameter.status || "bestätigt");
  const saved = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, match.rowNumber, charakter, status, null, null, buff);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("worldbuff_update", {
    source: "lichtbot",
    rowNumber: match.rowNumber,
    buff: buff,
    charakter: charakter
  });

  return {
    success: true,
    rowNumber: match.rowNumber,
    buff: buff,
    datum: match.datum,
    uhrzeit: match.uhrzeit,
    gilde: match.gilde,
    charakter: charakter,
    status: status,
    queued: true
  };
}

function lichtbotClaimWorldbuffSlotData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const buff = normalizeWorldbuffName_(e.parameter.buff || "");
  const datum = formatWorldbuffDateValue_(e.parameter.datum || e.parameter.date || "");
  const uhrzeit = formatWorldbuffTimeValue_(e.parameter.uhrzeit || e.parameter.time || "");
  const gilde = String(e.parameter.gilde || e.parameter.guild || "Lichtbringer").trim();
  const charakter = String(e.parameter.charakter || e.parameter.caster || "").trim();

  if (!buff || !datum || !uhrzeit || !charakter) {
    return { success: false, error: "Buff, Datum, Uhrzeit und Charakter sind Pflicht." };
  }

  const match = findOpenWorldbuffRowBySlot_(buff, datum, uhrzeit, gilde);
  if (!match) {
    return { success: false, error: "Dieser Worldbuff-Termin ist nicht mehr frei oder wurde nicht gefunden." };
  }

  const status = normalizeBuffStatusForSheet_(e.parameter.status || "bestätigt");
  const saved = setWorldbuffSheetEntry_(WORLDBUFF_SHEET_GID, match.rowNumber, charakter, status, null, null, buff);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("worldbuff_update", {
    source: "lichtbot",
    selectedSlot: true,
    rowNumber: match.rowNumber,
    buff: buff,
    datum: datum,
    uhrzeit: uhrzeit,
    gilde: match.gilde,
    charakter: charakter
  });

  return {
    success: true,
    rowNumber: match.rowNumber,
    buff: buff,
    datum: match.datum,
    uhrzeit: match.uhrzeit,
    gilde: match.gilde,
    charakter: charakter,
    status: status,
    queued: true
  };
}

function lichtbotSetHordenbuffEntryData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const datum = formatWorldbuffDateValue_(e.parameter.datum || e.parameter.date || "");
  const uhrzeit = formatWorldbuffTimeValue_(e.parameter.uhrzeit || e.parameter.time || "");
  const charakter = String(e.parameter.charakter || e.parameter.char || e.parameter.caster || "").trim();
  const uebernehmer = String(e.parameter.uebernehmer || e.parameter.helper || "").trim();
  const status = normalizeBuffStatusForSheet_(e.parameter.status || (uebernehmer ? "zugeteilt" : "offen"));
  const note = String(e.parameter.note || e.parameter.notiz || "").trim();

  if (!datum || !uhrzeit) {
    return { success: false, error: "Datum und Uhrzeit sind Pflicht." };
  }

  if (!charakter && !uebernehmer) {
    return { success: false, error: "Charakter oder Übernehmer fehlt." };
  }

  const sheetInfo = getWorldbuffSheetInfo_(HORDENBUFF_SHEET_GID);
  const existingRow = findHordenbuffEntryRow_(sheetInfo, datum, uhrzeit, charakter, uebernehmer);
  const rowNumber = existingRow || insertBuffTermRow_(sheetInfo, {
    tag: makeWorldbuffTagFromDate_(datum),
    datum: datum,
    uhrzeit: uhrzeit,
    buff: "Rend",
    gilde: "Horde",
    charakter: charakter,
    status: status,
    note: note,
    uebernehmer: uebernehmer
  });

  const saved = setWorldbuffSheetEntry_(HORDENBUFF_SHEET_GID, rowNumber, charakter, status, note, uebernehmer);
  if (!saved.success) return saved;

  queueWorldbuffBotUpdate_("hordenbuff_update", {
    source: "lichtbot",
    rowNumber: rowNumber,
    datum: datum,
    uhrzeit: uhrzeit,
    charakter: charakter,
    uebernehmer: uebernehmer
  });

  return {
    success: true,
    rowNumber: rowNumber,
    datum: datum,
    uhrzeit: uhrzeit,
    charakter: charakter,
    uebernehmer: uebernehmer,
    status: status,
    queued: true
  };
}

function lichtbotDeleteHordenbuffEntryData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const datum = formatWorldbuffDateValue_(e.parameter.datum || e.parameter.date || "");
  const uhrzeit = formatWorldbuffTimeValue_(e.parameter.uhrzeit || e.parameter.time || "");
  const name = String(e.parameter.name || e.parameter.charakter || e.parameter.helper || "").trim();

  if (!datum || !uhrzeit || !name) {
    return { success: false, error: "Datum, Uhrzeit und Name sind Pflicht." };
  }

  const sheetInfo = getWorldbuffSheetInfo_(HORDENBUFF_SHEET_GID);
  const sheet = sheetInfo.sheet;
  const columns = sheetInfo.columns;
  const helperColumn = ensureWorldbuffColumn_(sheetInfo, "uebernehmer", "Übernehmer");
  const values = sheetInfo.values;
  let deleted = 0;
  let cleared = 0;

  for (let i = values.length - 1; i > sheetInfo.headerRowIndex; i--) {
    const row = values[i];
    const firstCell = normalizeWorldbuffHeader_(getWorldbuffCell_(row, 0));
    if (firstCell.indexOf("uebernahmen") !== -1 || firstCell.indexOf("befehle") !== -1 || firstCell.indexOf("quelle") !== -1) continue;

    const rowDatum = formatWorldbuffDateValue_(getWorldbuffCell_(row, columns.datum));
    const rowUhrzeit = formatWorldbuffTimeValue_(getWorldbuffCell_(row, columns.uhrzeit));
    if (rowDatum !== datum || rowUhrzeit !== uhrzeit) continue;

    const charakter = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.charakter));
    const uebernehmer = cleanWorldbuffCell_(getWorldbuffCell_(row, helperColumn));
    const rowNumber = i + 1;

    if (sameWorldbuffName_(charakter, name)) {
      sheet.deleteRow(rowNumber);
      deleted++;
      continue;
    }

    if (sameWorldbuffName_(uebernehmer, name)) {
      if (charakter) {
        sheet.getRange(rowNumber, helperColumn + 1).setValue("-");
        if (columns.status !== -1) sheet.getRange(rowNumber, columns.status + 1).setValue(normalizeBuffStatusForSheet_("offen"));
        cleared++;
      } else {
        sheet.deleteRow(rowNumber);
        deleted++;
      }
    }
  }

  queueWorldbuffBotUpdate_("hordenbuff_update", {
    source: "lichtbot",
    deleted: deleted,
    cleared: cleared,
    datum: datum,
    uhrzeit: uhrzeit,
    name: name
  });

  return {
    success: true,
    deleted: deleted,
    cleared: cleared,
    queued: true
  };
}

function lichtbotGetQueueData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const sheet = getWorldbuffBotQueueSheet_(false);
  if (!sheet) {
    return { success: true, count: 0, items: [] };
  }

  const values = sheet.getDataRange().getValues();
  const items = [];

  for (let i = 1; i < values.length; i++) {
    const status = cleanWorldbuffCell_(values[i][3]).toLowerCase();
    if (status && status !== "offen") continue;

    items.push({
      rowNumber: i + 1,
      time: formatIssueReportDate_(values[i][0]),
      type: cleanWorldbuffCell_(values[i][1]),
      payload: cleanWorldbuffCell_(values[i][2]),
      status: cleanWorldbuffCell_(values[i][3]) || "offen"
    });
  }

  return {
    success: true,
    count: items.length,
    items: items
  };
}

function lichtbotResolveQueueData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  const rowNumber = Number(e.parameter.rowNumber || 0);
  const sheet = getWorldbuffBotQueueSheet_(false);

  if (!sheet || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    return { success: false, error: "Queue-Eintrag nicht gefunden." };
  }

  sheet.getRange(rowNumber, 4).setValue("erledigt");
  sheet.getRange(rowNumber, 5).setValue(new Date());

  return {
    success: true,
    rowNumber: rowNumber
  };
}

function lichtbotSyncWorldbuffTickerData(e) {
  if (!hasValidLichtbotQueueToken_(e)) {
    return { success: false, error: "Bot-Token ungültig oder nicht eingerichtet." };
  }

  let buffs = [];
  try {
    buffs = JSON.parse(String(e.parameter.buffs || "[]"));
  } catch (error) {
    return { success: false, error: "Ticker-Daten konnten nicht gelesen werden." };
  }

  if (!Array.isArray(buffs)) {
    return { success: false, error: "Ticker-Daten haben das falsche Format." };
  }

  const sheet = getWorldbuffTickerCacheSheet_();
  const rows = [["Datum", "Buff", "Uhrzeit", "Gilde"]];

  buffs.forEach(function(buff) {
    const datum = formatWorldbuffDateValue_(buff && buff.datum);
    const name = normalizeWorldbuffName_(buff && buff.buff);
    const uhrzeit = formatWorldbuffTimeValue_(buff && buff.uhrzeit);
    const gilde = cleanWorldbuffCell_(buff && buff.gilde);
    if (!datum || !name || !uhrzeit || !gilde) return;
    rows.push([datum, name, uhrzeit, gilde]);
  });

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);

  return {
    success: true,
    count: rows.length - 1
  };
}

function setWorldbuffSheetEntry_(sheetGid, rowNumber, charakter, status, note, uebernehmer, buffOverride) {
  const sheetInfo = getWorldbuffSheetInfo_(sheetGid);
  const columns = sheetInfo.columns;

  if (columns.charakter === -1) {
    return { success: false, error: "Im Buff-Sheet wurde keine Charakter-Spalte gefunden." };
  }

  const lastRow = sheetInfo.sheet.getLastRow();
  if (rowNumber > lastRow) {
    return { success: false, error: "Buff-Zeile nicht gefunden." };
  }

  sheetInfo.sheet.getRange(rowNumber, columns.charakter + 1).setValue(charakter);

  if (columns.buff !== -1 && buffOverride !== null && buffOverride !== undefined && String(buffOverride || "").trim()) {
    sheetInfo.sheet.getRange(rowNumber, columns.buff + 1).setValue(normalizeWorldbuffName_(buffOverride));
  }

  if (columns.status !== -1) {
    sheetInfo.sheet.getRange(rowNumber, columns.status + 1).setValue(status);
  }

  if (columns.note !== -1 && note !== null && note !== undefined) {
    sheetInfo.sheet.getRange(rowNumber, columns.note + 1).setValue(note);
  }

  if (uebernehmer !== null && uebernehmer !== undefined) {
    const helperColumn = ensureWorldbuffColumn_(sheetInfo, "uebernehmer", "Übernehmer");
    sheetInfo.sheet.getRange(rowNumber, helperColumn + 1).setValue(uebernehmer);
  }
  const publicTerm = getWorldbuffRows_(sheetGid).find(function(row) {
    return Number(row.rowNumber) === Number(rowNumber);
  });
  const publicSync = publicTerm
    ? syncPublicBuffTerm_(sheetGid === HORDENBUFF_SHEET_GID ? "hordenbuff" : "worldbuff", rowNumber, publicTerm)
    : { success: false, error: "Termin wurde für den öffentlichen Sync nicht gefunden." };

  return {
    success: true,
    rowNumber: rowNumber,
    publicSync: publicSync
  };
}

function findNextOpenWorldbuffRow_(buff, gilde) {
  const rows = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maxDate = new Date(now.getTime() + 92 * 24 * 60 * 60 * 1000);
  const normalizedBuff = normalizeWorldbuffName_(buff);
  const wantedGuild = normalizeWorldbuffComparable_(gilde || "Lichtbringer");

  const matches = rows.filter(function(row) {
    const dateValue = parseWorldbuffDate_(row.datum);
    if (!dateValue || dateValue < now || dateValue > maxDate) return false;
    if (!isSelectableWorldbuffChoice_(row.buff, normalizedBuff)) return false;
    if (!isWorldbuffOpen_(row.status) || row.charakter) return false;

    const rowGuild = normalizeWorldbuffComparable_(row.gilde);
    return rowGuild.indexOf(wantedGuild) !== -1 || wantedGuild.indexOf(rowGuild) !== -1;
  });

  matches.sort(function(a, b) {
    const dateA = parseWorldbuffDate_(a.datum);
    const dateB = parseWorldbuffDate_(b.datum);
    return ((dateA && dateA.getTime()) || 0) - ((dateB && dateB.getTime()) || 0) ||
      String(a.uhrzeit || "").localeCompare(String(b.uhrzeit || ""));
  });

  return matches[0] || null;
}

function findOpenWorldbuffRowBySlot_(buff, datum, uhrzeit, gilde) {
  const rows = getWorldbuffRows_(WORLDBUFF_SHEET_GID);
  const normalizedBuff = normalizeWorldbuffName_(buff);
  const normalizedDate = formatWorldbuffDateValue_(datum);
  const normalizedTime = formatWorldbuffTimeValue_(uhrzeit);
  const wantedGuild = normalizeWorldbuffComparable_(gilde || "Lichtbringer");

  return rows.find(function(row) {
    if (!isSelectableWorldbuffChoice_(row.buff, normalizedBuff)) return false;
    if (formatWorldbuffDateValue_(row.datum) !== normalizedDate) return false;
    if (formatWorldbuffTimeValue_(row.uhrzeit) !== normalizedTime) return false;
    if (row.charakter || !isWorldbuffOpen_(row.status)) return false;

    const rowGuild = normalizeWorldbuffComparable_(row.gilde);
    if (!wantedGuild) return true;
    return rowGuild.indexOf(wantedGuild) !== -1 || wantedGuild.indexOf(rowGuild) !== -1;
  }) || null;
}

function isSelectableWorldbuffChoice_(rowBuff, selectedBuff) {
  const rowValue = normalizeWorldbuffName_(rowBuff);
  const selectedValue = normalizeWorldbuffName_(selectedBuff);
  if (rowValue === selectedValue) return true;
  return (rowValue === "Ony" || rowValue === "Nef") && (selectedValue === "Ony" || selectedValue === "Nef");
}

function findHordenbuffEntryRow_(sheetInfo, datum, uhrzeit, charakter, uebernehmer) {
  const values = sheetInfo.values;
  const columns = sheetInfo.columns;
  const helperColumn = ensureWorldbuffColumn_(sheetInfo, "uebernehmer", "Übernehmer");
  const wantedCharakter = normalizeWorldbuffComparable_(charakter);
  const wantedHelper = normalizeWorldbuffComparable_(uebernehmer);
  let firstOpenRow = 0;

  for (let i = sheetInfo.headerRowIndex + 1; i < values.length; i++) {
    const row = values[i];
    const firstCell = normalizeWorldbuffHeader_(getWorldbuffCell_(row, 0));
    if (firstCell.indexOf("uebernahmen") !== -1 || firstCell.indexOf("befehle") !== -1 || firstCell.indexOf("quelle") !== -1) break;

    const rowDatum = formatWorldbuffDateValue_(getWorldbuffCell_(row, columns.datum));
    const rowUhrzeit = formatWorldbuffTimeValue_(getWorldbuffCell_(row, columns.uhrzeit));
    if (rowDatum !== datum || rowUhrzeit !== uhrzeit) continue;

    const rowCharakter = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.charakter));
    const rowHelper = cleanWorldbuffCell_(getWorldbuffCell_(row, helperColumn));

    if (wantedCharakter && sameWorldbuffName_(rowCharakter, charakter)) return i + 1;
    if (!wantedCharakter && wantedHelper && sameWorldbuffName_(rowHelper, uebernehmer)) return i + 1;
    if (!firstOpenRow && (!rowCharakter || rowCharakter === "-")) firstOpenRow = i + 1;
  }

  if (wantedCharakter) return 0;
  return firstOpenRow;
}

function isWorldbuffOpen_(status) {
  const clean = normalizeWorldbuffComparable_(status).replace(/gelb|yellow/g, "");
  return !clean || clean.indexOf("offen") !== -1 || clean.indexOf("frei") !== -1;
}

function normalizeWorldbuffComparable_(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[🟡🟢✅🔴🟠⚪]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sameWorldbuffName_(a, b) {
  const left = normalizeWorldbuffComparable_(a);
  const right = normalizeWorldbuffComparable_(b);
  return Boolean(left && right && left === right);
}

function getWorldbuffRows_(sheetGid) {
  const sheetInfo = getWorldbuffSheetInfo_(sheetGid || WORLDBUFF_SHEET_GID);
  const values = sheetInfo.values;
  const columns = sheetInfo.columns;
  const result = [];
  let lastTag = "";
  let lastDatum = "";

  for (let i = sheetInfo.headerRowIndex + 1; i < values.length; i++) {
    const row = values[i];
    let tag = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.tag));
    let datum = formatWorldbuffDateValue_(getWorldbuffCell_(row, columns.datum));
    const uhrzeit = formatWorldbuffTimeValue_(getWorldbuffCell_(row, columns.uhrzeit));
    const buff = normalizeWorldbuffName_(getWorldbuffCell_(row, columns.buff));
    const gilde = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.gilde));
    const charakter = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.charakter));
    const status = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.status));
    const note = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.note));
    const uebernehmer = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.uebernehmer));

    if (tag) lastTag = tag;
    else tag = lastTag;

    if (datum) lastDatum = datum;
    else datum = lastDatum;

    if (!tag && datum) tag = makeWorldbuffTagFromDate_(datum);
    if (!datum || !uhrzeit || !buff || !gilde) continue;

    result.push({
      rowNumber: i + 1,
      tag: tag,
      datum: datum,
      uhrzeit: uhrzeit,
      buff: buff,
      gilde: gilde,
      charakter: charakter,
      status: status,
      note: note,
      uebernehmer: uebernehmer,
      key: [datum, uhrzeit, buff, gilde].join("|")
    });
  }

  return result;
}

function getCombinedWorldbuffRows_() {
  const all = [];
  const combined = [];
  const byTerm = {};
  const realSlotKeys = {};

  getWorldbuffRows_(WORLDBUFF_SHEET_GID).forEach(function(row) {
    all.push(normalizeWorldbuffRowForDisplay_(row, "Worldbuff-Sheet"));
  });

  getPublicWorldbuffTickerRows_().forEach(function(row) {
    all.push(normalizeWorldbuffRowForDisplay_(row, "Worldbuffticker"));
  });

  all.forEach(function(row) {
    const slotKey = getWorldbuffSlotMergeKey_(row);
    if (!slotKey || isWorldbuffTickerPlaceholderGuild_(row.gilde)) return;
    realSlotKeys[slotKey] = true;
  });

  all.forEach(function(row) {
    const slotKey = getWorldbuffSlotMergeKey_(row);
    if (!slotKey) return;

    if (isWorldbuffTickerPlaceholderGuild_(row.gilde) && realSlotKeys[slotKey]) {
      return;
    }

    const key = getWorldbuffTermMergeKey_(row);
    if (!key) return;

    if (byTerm[key]) {
      mergeWorldbuffTickerInfo_(byTerm[key], row);
      return;
    }

    byTerm[key] = row;
    combined.push(row);
  });

  return combined;
}

function normalizeWorldbuffRowForDisplay_(row, source) {
  const datum = formatWorldbuffDateValue_(row && row.datum);
  const buff = normalizeWorldbuffName_(row && row.buff);
  return Object.assign({}, row, {
    tag: (row && row.tag) || makeWorldbuffTagFromDate_(datum),
    datum: datum,
    uhrzeit: formatWorldbuffTimeValue_(row && row.uhrzeit),
    buff: buff,
    source: source || (row && row.source) || ""
  });
}

function getWorldbuffTermMergeKey_(row) {
  if (!row || !row.datum || !row.uhrzeit || !row.buff) return "";
  const buff = normalizeWorldbuffName_(row.buff);
  const slotKey = getWorldbuffSlotMergeKey_(row);
  if (!slotKey || buff === "Rend") return slotKey;

  const guildKey = normalizeWorldbuffGuildForOverview_(row.gilde);
  return [slotKey, guildKey || "WORLDBUFFTICKER"].join("|");
}

function getWorldbuffSlotMergeKey_(row) {
  if (!row || !row.datum || !row.uhrzeit || !row.buff) return "";
  return [row.datum, row.uhrzeit, normalizeWorldbuffName_(row.buff)].join("|");
}

function mergeWorldbuffTickerInfo_(target, ticker) {
  if (isWorldbuffTickerPlaceholderGuild_(target.gilde)) {
    target.gilde = ticker.gilde || target.gilde || "-";
  }
  if (!target.charakter || target.charakter === "-") target.charakter = ticker.charakter || target.charakter || "";
  if (!target.status || target.status === "-") target.status = ticker.status || target.status || "";
  target.source = target.source === "Worldbuffticker" ? target.source : target.source + " + Worldbuffticker";
}

function isWorldbuffTickerPlaceholderGuild_(gilde) {
  const value = normalizeWorldbuffComparable_(gilde);
  return !value || value === "worldbuffticker" || value === "worldbuff" || value === "worldbuffs" || value === "ticker";
}

function normalizeWorldbuffGuildForOverview_(gilde) {
  const raw = String(gilde || "").trim();
  const value = normalizeWorldbuffComparable_(raw);
  if (isWorldbuffTickerPlaceholderGuild_(raw)) return "";
  if (value.indexOf("lichtbringer") !== -1) return "LICHTBRINGER";
  if (value.indexOf("horde") !== -1) return "HORDE";
  return raw;
}

function getPublicWorldbuffTickerRows_() {
  const sheet = getWorldbuffTickerCacheSheet_(false);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  const columns = {
    datum: 0,
    buff: 1,
    uhrzeit: 2,
    gilde: 3
  };
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const datum = formatWorldbuffDateValue_(getWorldbuffCell_(row, columns.datum));
    const buff = normalizeWorldbuffName_(getWorldbuffCell_(row, columns.buff));
    const uhrzeit = formatWorldbuffTimeValue_(getWorldbuffCell_(row, columns.uhrzeit));
    const gilde = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.gilde));
    if (!datum || !buff || !uhrzeit || !gilde) continue;

    result.push({
      rowNumber: i + 1,
      tag: makeWorldbuffTagFromDate_(datum),
      datum: datum,
      uhrzeit: uhrzeit,
      buff: buff,
      gilde: gilde,
      charakter: "",
      status: "",
      note: "",
      source: "Worldbuffticker",
      key: [datum, uhrzeit, buff].join("|")
    });
  }

  return result;
}

function getWorldbuffTickerCacheSheet_(createIfMissing) {
  const spreadsheet = getLootSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(WORLDBUFF_TICKER_CACHE_SHEET);
  if (!sheet && createIfMissing !== false) {
    sheet = spreadsheet.insertSheet(WORLDBUFF_TICKER_CACHE_SHEET);
    sheet.getRange(1, 1, 1, 4).setValues([["Datum", "Buff", "Uhrzeit", "Gilde"]]);
  }
  return sheet;
}

function getWorldbuffSheetInfo_(sheetGid) {
  const spreadsheet = SpreadsheetApp.openById(WORLDBUFF_SPREADSHEET_ID);
  const sheets = spreadsheet.getSheets();
  let sheet = null;
  const targetGid = Number(sheetGid || WORLDBUFF_SHEET_GID);

  for (let i = 0; i < sheets.length; i++) {
    if (Number(sheets[i].getSheetId()) === targetGid) {
      sheet = sheets[i];
      break;
    }
  }

  if (!sheet) {
    throw new Error("Worldbuff-Sheet wurde nicht gefunden.");
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headerInfo = findWorldbuffHeader_(values);

  return {
    sheet: sheet,
    values: values,
    headerRowIndex: headerInfo.headerRowIndex,
    columns: headerInfo.columns
  };
}

function findWorldbuffHeader_(values) {
  for (let i = 0; i < values.length; i++) {
    const headers = values[i].map(function(cell) {
      return normalizeWorldbuffHeader_(cell);
    });
    const tag = headers.indexOf("tag");
    const datum = headers.indexOf("datum");
    const uhrzeit = findWorldbuffColumn_(headers, ["uhrzeit", "zeit"]);
    const buff = headers.indexOf("buff");

    if (tag !== -1 && datum !== -1 && uhrzeit !== -1 && buff !== -1) {
      return {
        headerRowIndex: i,
        columns: {
          tag: tag,
          datum: datum,
          uhrzeit: uhrzeit,
          buff: buff,
          gilde: findWorldbuffColumn_(headers, ["gilde", "guild", "gildefraktion", "fraktion"]),
          charakter: findWorldbuffColumn_(headers, ["charakter", "char", "werfer"]),
          uebernehmer: findWorldbuffColumn_(headers, ["uebernehmer", "übernehmer", "helfer", "helper"]),
          status: headers.indexOf("status"),
          note: findWorldbuffColumn_(headers, ["notiz", "note", "hinweis"])
        }
      };
    }
  }

  throw new Error("Im Worldbuff-Sheet wurde keine Kopfzeile gefunden.");
}

function findWorldbuffColumn_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index !== -1) return index;
  }
  return -1;
}

function getWorldbuffCell_(row, index) {
  if (index === -1 || index === null || index === undefined || index >= row.length) return "";
  return row[index];
}

function insertBuffTermRow_(sheetInfo, term) {
  const sheet = sheetInfo.sheet;
  const columns = sheetInfo.columns;
  let rowNumber = getBuffTermInsertRow_(sheetInfo);

  if (rowNumber <= sheet.getLastRow()) {
    sheet.insertRowsBefore(rowNumber, 1);
  } else {
    rowNumber = sheet.getLastRow() + 1;
  }

  const maxColumn = Math.max(
    columns.tag,
    columns.datum,
    columns.uhrzeit,
    columns.buff,
    columns.gilde,
    columns.charakter,
    columns.status,
    columns.note,
    columns.uebernehmer
  );
  const row = new Array(Math.max(maxColumn + 1, sheet.getLastColumn())).fill("");

  if (columns.tag !== -1) row[columns.tag] = term.tag || "";
  if (columns.datum !== -1) row[columns.datum] = term.datum || "";
  if (columns.uhrzeit !== -1) row[columns.uhrzeit] = term.uhrzeit || "";
  if (columns.buff !== -1) row[columns.buff] = term.buff || "";
  if (columns.gilde !== -1) row[columns.gilde] = term.gilde || "";
  if (columns.charakter !== -1) row[columns.charakter] = term.charakter || "";
  if (columns.status !== -1) row[columns.status] = term.status || "";
  if (columns.note !== -1) row[columns.note] = term.note || "";

  if (term.uebernehmer) {
    const helperColumn = ensureWorldbuffColumn_(sheetInfo, "uebernehmer", "Übernehmer");
    row[helperColumn] = term.uebernehmer || "";
  }

  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  return rowNumber;
}

function getBuffTermInsertRow_(sheetInfo) {
  const values = sheetInfo.values;
  const headerIndex = sheetInfo.headerRowIndex;

  for (let i = headerIndex + 1; i < values.length; i++) {
    const firstCell = normalizeWorldbuffHeader_(values[i][0] || "");
    if (firstCell.indexOf("uebernahmen") !== -1 || firstCell.indexOf("befehle") !== -1 || firstCell.indexOf("quelle") !== -1) {
      return i + 1;
    }
  }

  return sheetInfo.sheet.getLastRow() + 1;
}

function ensureWorldbuffColumn_(sheetInfo, key, title) {
  if (sheetInfo.columns[key] !== undefined && sheetInfo.columns[key] !== -1) {
    return sheetInfo.columns[key];
  }

  const sheet = sheetInfo.sheet;
  const column = sheet.getLastColumn();
  sheet.insertColumnAfter(column);
  sheet.getRange(sheetInfo.headerRowIndex + 1, column + 1).setValue(title);
  sheetInfo.columns[key] = column;
  return column;
}

function normalizeWorldbuffHeader_(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function cleanWorldbuffCell_(value) {
  const text = String(value || "").trim();
  if (["nan", "none", "null"].indexOf(text.toLowerCase()) !== -1) return "";
  return text.replace(/;$/, "").trim();
}

function normalizeWorldbuffName_(value) {
  const text = cleanWorldbuffCell_(value)
    .replace(/\*\*/g, "")
    .replace(/[🟢🔴🟠⚪]/g, "")
    .trim()
    .toLowerCase();

  if (!text) return "";
  if (text === "zg" || text.indexOf("hakkar") !== -1) return "Hakkar";
  if (text.indexOf("ony") !== -1) return "Ony";
  if (text.indexOf("nef") !== -1) return "Nef";
  if (text.indexOf("rend") !== -1) return "Rend";

  return cleanWorldbuffCell_(value);
}

function normalizeBuffStatusForSheet_(value) {
  const raw = String(value || "").trim();
  const clean = raw
    .replace(/[🟡🟢✅]/g, "")
    .trim()
    .toLowerCase();

  if (!raw) return "";
  if (clean === "offen") return "🟡 offen";
  if (clean === "bestätigt" || clean === "bestaetigt" || clean === "reserviert") return "🟢 bestätigt";
  if (clean === "erledigt") return "erledigt";

  return raw;
}

function formatWorldbuffDateValue_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd.MM.yyyy");
  }

  const text = cleanWorldbuffCell_(value);
  const parsed = parseWorldbuffDate_(text);
  if (parsed) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "dd.MM.yyyy");
  }

  return text;
}

function formatWorldbuffTimeValue_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  }

  const text = cleanWorldbuffCell_(value).replace(" Uhr", "").replace("Uhr", "").trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) return ("0" + Number(match[1])).slice(-2) + ":" + match[2];
  return text;
}

function parseWorldbuffDate_(value) {
  const text = cleanWorldbuffCell_(value);
  if (!text) return null;

  let match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (match) {
    const year = Number(match[3].length === 2 ? "20" + match[3] : match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1]));
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const fallback = new Date(text);
  if (!isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  return null;
}

function normalizeBuffDays_(value, fallback) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "all" || text === "alle" || text === "open" || text === "offen") return 9999;

  const number = Number(text || fallback || 60);
  if (!isFinite(number)) return fallback || 60;
  return Math.max(1, Math.min(9999, number));
}

function makeWorldbuffTagFromDate_(datum) {
  const date = parseWorldbuffDate_(datum);
  if (!date) return "";
  return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][date.getDay()];
}

function queueWorldbuffBotUpdate_(type, payload) {
  const sheet = getWorldbuffBotQueueSheet_(true);

  sheet.appendRow([
    new Date(),
    type || "worldbuff_update",
    JSON.stringify(payload || {}),
    "offen"
  ]);
}

function getWorldbuffBotQueueSheet_(createIfMissing) {
  const spreadsheet = SpreadsheetApp.openById(WORLDBUFF_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(WORLDBUFF_BOT_QUEUE_SHEET);

  if (!sheet && createIfMissing) {
    sheet = spreadsheet.insertSheet(WORLDBUFF_BOT_QUEUE_SHEET);
    sheet.appendRow(["Zeit", "Typ", "Payload", "Status", "ErledigtAm"]);
  }

  return sheet;
}

function hasValidLichtbotQueueToken_(e) {
  const configured = String(PropertiesService.getScriptProperties().getProperty("LICHTBOT_QUEUE_TOKEN") || "").trim();
  const provided = String((e && e.parameter && (e.parameter.queueToken || e.parameter.botToken)) || "").trim();

  return Boolean(configured && provided && configured === provided);
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
  const benchIndex = getPrioBenchColumnIndex_(prios);
  let candidates = 0;
  let awarded = 0;

  for (let i = 1; i < prios.length; i++) {
    const rowRaidId = String(prios[i][0] || "");
    const player = String(prios[i][3] || "").trim();
    const item = String(prios[i][6] || "").trim();
    const p0Plus = String(prios[i][9] || "").toLowerCase();
    const bench = benchIndex >= 0 ? isBenchActive_(prios[i][benchIndex]) : false;

    if (rowRaidId !== raidId) continue;
    if (bench) continue;
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

function guildSetPrioBench(e) {
  return jsonOutput(guildSetPrioBenchData(e));
}

function hasValidRaidLeadAccess_(e, raidId) {
  if (hasValidGuildMasterCode_(e)) return true;

  const leadPin = String(e.parameter.leadPin || "").trim();
  if (!raidId || !leadPin) return false;

  const raidSheet = getRequiredSheet(RAID_SHEET);
  const values = raidSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const rowRaidId = String(values[i][0] || "").trim();
    const rowLeadPin = String(values[i][6] || "").trim();
    if (rowRaidId === raidId && rowLeadPin === leadPin) return true;
  }

  return false;
}

function guildSetPrioBenchData(e) {
  const raidId = String(e.parameter.raidId || "").trim();
  let rowNumber = Number(e.parameter.rowNumber || 0);
  const inputPlayer = String(e.parameter.player || "").trim();
  const inputServer = String(e.parameter.server || "").trim();
  const bench = isBenchActive_(e.parameter.bench);

  if (!hasValidRaidLeadAccess_(e, raidId)) {
    return { success: false, error: "Keine Berechtigung für diesen Raid." };
  }

  if (!raidId) {
    return { success: false, error: "Raid fehlt." };
  }

  const prioSheet = getRequiredSheet(PRIO_SHEET);
  const benchCol = ensurePrioBenchColumn_(prioSheet);
  const lastRow = prioSheet.getLastRow();
  const values = prioSheet.getDataRange().getValues();

  if ((!rowNumber || rowNumber < 2) && inputPlayer) {
    const playerKey = normalizeName(inputPlayer);
    const serverKey = normalizeName(inputServer);
    for (let i = values.length - 1; i >= 1; i--) {
      const rowRaidId = String(values[i][0] || "").trim();
      const rowPlayer = normalizeName(values[i][3] || "");
      const rowServer = normalizeName(values[i][4] || "");
      if (
        rowRaidId === raidId &&
        rowPlayer === playerKey &&
        (!serverKey || rowServer === serverKey)
      ) {
        rowNumber = i + 1;
        break;
      }
    }
  }

  if (!rowNumber || rowNumber < 2) {
    return { success: false, error: "Prio-Zeile wurde nicht gefunden." };
  }

  if (rowNumber > lastRow) {
    return { success: false, error: "Prio-Zeile wurde nicht gefunden." };
  }

  const row = prioSheet.getRange(rowNumber, 1, 1, Math.max(prioSheet.getLastColumn(), benchCol)).getValues()[0];
  if (String(row[0] || "") !== raidId) {
    return { success: false, error: "Prio gehört nicht zu diesem Raid." };
  }

  const raid = normalizeRaidForP0(String(e.parameter.raid || row[2] || row[1] || ""));
  const player = String(row[3] || "").trim();
  const item = String(row[6] || "").trim();
  const slot = raid && item ? findSlotForItem(raid, item) : "";

  prioSheet.getRange(rowNumber, benchCol).setValue(bench ? "ja" : "");

  let pointsResult = null;
  if (raid && player && item) {
    if (bench) {
      pointsResult = setP0PlusPointsDirect_(raid, item, slot, player, 0.5);
    } else {
      pointsResult = clearBenchP0PlusPoint_(raid, item, player);
    }
  }

  return {
    success: true,
    raidId: raidId,
    rowNumber: rowNumber,
    player: player,
    item: item,
    bench: bench,
    points: pointsResult
  };
}

function guildSetP0PlusPoints(e) {
  return jsonOutput(guildSetP0PlusPointsData(e));
}

function guildSetP0PlusPointsData(e) {
  if (!hasValidGuildMasterCode_(e)) {
    return { success: false, error: "Master-Code ungültig." };
  }

  const raid = normalizeRaidForP0(e.parameter.raid || "");
  const item = String(e.parameter.item || "").trim();
  const slot = String(e.parameter.slot || "").trim();
  const player = String(e.parameter.player || "").trim();
  const pointsRaw = String(e.parameter.points || e.parameter.count || "0").replace(",", ".");
  const points = Number(pointsRaw);

  if (!raid || !item || !player) {
    return { success: false, error: "Raid, Spieler oder Item fehlt." };
  }

  if (!isFinite(points) || points < 0) {
    return { success: false, error: "Punkte müssen 0 oder größer sein." };
  }

  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);
  const values = p0Sheet.getDataRange().getValues();
  const itemKeyValue = itemKey(item);
  const playerKeyValue = itemKey(player);

  for (let i = 1; i < values.length; i++) {
    const rowRaid = normalizeRaidForP0(values[i][0] || "");
    const rowItem = String(values[i][1] || "");
    const rowPlayer = String(values[i][3] || "");

    if (
      rowRaid === raid &&
      itemKey(rowItem) === itemKeyValue &&
      itemKey(rowPlayer) === playerKeyValue
    ) {
      if (points === 0) {
        p0Sheet.deleteRow(i + 1);
        return {
          success: true,
          deleted: true,
          raid: raid,
          item: item,
          player: player,
          points: 0
        };
      }

      p0Sheet.getRange(i + 1, 3).setValue(slot || String(values[i][2] || ""));
      p0Sheet.getRange(i + 1, 5).setValue(points);
      return {
        success: true,
        deleted: false,
        raid: raid,
        item: item,
        slot: slot || String(values[i][2] || ""),
        player: player,
        points: points
      };
    }
  }

  if (points === 0) {
    return {
      success: true,
      deleted: true,
      raid: raid,
      item: item,
      player: player,
      points: 0
    };
  }

  p0Sheet.appendRow([
    raid,
    item,
    slot || "",
    player,
    points
  ]);

  return {
    success: true,
    deleted: false,
    raid: raid,
    item: item,
    slot: slot || "",
    player: player,
    points: points
  };
}

function setP0PlusPointsDirect_(raid, item, slot, player, points) {
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);
  const values = p0Sheet.getDataRange().getValues();
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
      p0Sheet.getRange(i + 1, 3).setValue(slot || String(values[i][2] || ""));
      p0Sheet.getRange(i + 1, 5).setValue(points);
      return { updated: true, deleted: false, points: points };
    }
  }

  p0Sheet.appendRow([raidKey, item, slot || "", player, points]);
  return { updated: false, deleted: false, points: points };
}

function clearBenchP0PlusPoint_(raid, item, player) {
  const p0Sheet = getRequiredSheet(P0PLUS_SHEET);
  const values = p0Sheet.getDataRange().getValues();
  const raidKey = normalizeRaidForP0(raid);
  const itemKeyValue = itemKey(item);
  const playerKeyValue = itemKey(player);

  for (let i = values.length - 1; i >= 1; i--) {
    const rowRaid = normalizeRaidForP0(values[i][0] || "");
    const rowItem = String(values[i][1] || "");
    const rowPlayer = String(values[i][3] || "");
    const points = Number(values[i][4] || 0);

    if (
      rowRaid === raidKey &&
      itemKey(rowItem) === itemKeyValue &&
      itemKey(rowPlayer) === playerKeyValue &&
      points === 0.5
    ) {
      p0Sheet.deleteRow(i + 1);
      return { updated: false, deleted: true, points: 0 };
    }
  }

  return { updated: false, deleted: false, points: 0 };
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

function getLootSpreadsheet_() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (error) {}
  return SpreadsheetApp.openById(LOOT_SPREADSHEET_ID);
}

function syncPublicBuffTerm_(target, sourceRowNumber, term) {
  try {
    if (!term || !term.datum || !term.uhrzeit || !term.buff) {
      return { success: false, error: "Termin ist unvollständig." };
    }

    const sheetInfo = getPublicBuffTermSheetInfo_();
    const sheet = sheetInfo.sheet;
    const columns = sheetInfo.columns;
    const rowNumber = findPublicBuffTermRow_(sheetInfo, term) || getNextPublicBuffTermRow_(sheetInfo);
    sheet.getRange(rowNumber, columns.datum + 1).setValue(term.datum || "");
    sheet.getRange(rowNumber, columns.buff + 1).setValue(term.buff || "");
    sheet.getRange(rowNumber, columns.uhrzeit + 1).setValue(term.uhrzeit || "");
    return {
      success: true,
      rowNumber: rowNumber
    };
  } catch (error) {
    try {
      Logger.log("Public buff term sync failed: " + error.message);
    } catch (logError) {}
    return {
      success: false,
      error: error.message
    };
  }
}

function getPublicBuffTermSheetInfo_() {
  const spreadsheet = SpreadsheetApp.openById(PUBLIC_BUFF_TERMS_SPREADSHEET_ID);
  const sheet = getSheetByGid_(spreadsheet, PUBLIC_BUFF_TERMS_SHEET_GID) || spreadsheet.getSheets()[0];

  return {
    sheet: sheet,
    values: sheet.getDataRange().getDisplayValues(),
    headerRowIndex: -1,
    columns: {
      datum: 0,
      buff: 1,
      uhrzeit: 2
    }
  };
}

function findPublicBuffTermRow_(sheetInfo, term) {
  const values = sheetInfo.values;
  const columns = sheetInfo.columns;
  const datum = formatWorldbuffDateValue_(term.datum);
  const uhrzeit = formatWorldbuffTimeValue_(term.uhrzeit);
  const buff = normalizeWorldbuffName_(term.buff);

  for (let i = sheetInfo.headerRowIndex + 1; i < values.length; i++) {
    const row = values[i];
    if (formatWorldbuffDateValue_(getWorldbuffCell_(row, columns.datum)) !== datum) continue;
    if (formatWorldbuffTimeValue_(getWorldbuffCell_(row, columns.uhrzeit)) !== uhrzeit) continue;
    if (normalizeWorldbuffName_(getWorldbuffCell_(row, columns.buff)) !== buff) continue;
    return i + 1;
  }

  return 0;
}

function getNextPublicBuffTermRow_(sheetInfo) {
  const values = sheetInfo.values;
  const columns = sheetInfo.columns;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const datum = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.datum));
    const buff = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.buff));
    const uhrzeit = cleanWorldbuffCell_(getWorldbuffCell_(row, columns.uhrzeit));
    if (!datum && !buff && !uhrzeit) return i + 1;
  }

  return values.length + 1;
}

function cleanupMisplacedPublicBuffTerms_() {
  try {
    const spreadsheet = SpreadsheetApp.openById(PUBLIC_BUFF_TERMS_SPREADSHEET_ID);
    const sheet = getSheetByGid_(spreadsheet, PUBLIC_BUFF_TERMS_SHEET_GID) || spreadsheet.getSheets()[0];
    const lastRow = Math.max(sheet.getLastRow(), 1);
    sheet.getRange(1, 4, lastRow, 3).clearContent();

    return {
      success: true,
      cleaned: lastRow
    };
  } catch (error) {
    try {
      Logger.log("Public buff misplaced cleanup failed: " + error.message);
    } catch (logError) {}
    return {
      success: false,
      cleaned: 0,
      error: error.message
    };
  }
}

function getSheetByGid_(spreadsheet, gid) {
  const sheets = spreadsheet.getSheets();
  const targetGid = Number(gid);
  for (let i = 0; i < sheets.length; i++) {
    if (Number(sheets[i].getSheetId()) === targetGid) return sheets[i];
  }
  return null;
}

function getRequiredSheet(name) {
  const spreadsheet = getLootSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.getSheets().find(function(candidate) {
    return String(candidate.getName() || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
  });
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
