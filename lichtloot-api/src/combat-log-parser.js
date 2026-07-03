const CLASS_BY_SPELL_ID = new Map([
  [1126, "Druid"], [21849, "Druid"], [21850, "Druid"], [8936, "Druid"], [9858, "Druid"], [774, "Druid"], [26982, "Druid"], [5176, "Druid"], [8921, "Druid"], [768, "Druid"], [9634, "Druid"], [5229, "Druid"],
  [75, "Hunter"], [19434, "Hunter"], [20900, "Hunter"], [5118, "Hunter"], [25296, "Hunter"], [20906, "Hunter"], [19801, "Hunter"],
  [133, "Mage"], [10150, "Mage"], [116, "Mage"], [10181, "Mage"], [1953, "Mage"], [2139, "Mage"], [23028, "Mage"], [10157, "Mage"], [11958, "Mage"], [12051, "Mage"], [11426, "Mage"],
  [19742, "Paladin"], [19900, "Paladin"], [10293, "Paladin"], [19943, "Paladin"], [19993, "Paladin"], [10328, "Paladin"], [20271, "Paladin"], [10308, "Paladin"], [498, "Paladin"], [642, "Paladin"],
  [2060, "Priest"], [10965, "Priest"], [2061, "Priest"], [10917, "Priest"], [139, "Priest"], [10929, "Priest"], [21562, "Priest"], [21564, "Priest"], [27681, "Priest"], [27683, "Priest"], [17, "Priest"], [10901, "Priest"], [10909, "Priest"], [14751, "Priest"], [527, "Priest"], [988, "Priest"], [552, "Priest"],
  [53, "Rogue"], [11290, "Rogue"], [11293, "Rogue"], [1752, "Rogue"], [11297, "Rogue"], [1766, "Rogue"], [11286, "Rogue"], [11279, "Rogue"], [5171, "Rogue"], [6774, "Rogue"], [1787, "Rogue"],
  [686, "Warlock"], [11660, "Warlock"], [172, "Warlock"], [25311, "Warlock"], [980, "Warlock"], [11712, "Warlock"], [603, "Warlock"], [17928, "Warlock"], [11719, "Warlock"], [11730, "Warlock"],
  [6673, "Warrior"], [11551, "Warrior"], [2457, "Warrior"], [71, "Warrior"], [2458, "Warrior"], [23881, "Warrior"], [11581, "Warrior"], [2687, "Warrior"], [18499, "Warrior"], [7384, "Warrior"], [11585, "Warrior"], [11599, "Warrior"]
]);

const BOSS_ONLY_EVENTS = new Set([
  "SPELL_CAST_SUCCESS", "SPELL_CAST_START", "SPELL_HEAL", "SPELL_PERIODIC_HEAL",
  "SPELL_DAMAGE", "SPELL_PERIODIC_DAMAGE", "SWING_DAMAGE", "RANGE_DAMAGE",
  "SPELL_AURA_APPLIED", "SPELL_AURA_REMOVED", "SPELL_INTERRUPT", "UNIT_DIED", "COMBATANT_INFO"
]);

export function parseCombatLogText(text, options = {}) {
  const analysis = {
    source: "combat-log",
    file: options.fileName || "",
    generatedAt: new Date().toISOString(),
    zone: "",
    raid: "",
    startedAt: "",
    endedAt: "",
    encounters: [],
    players: {},
    totals: { lines: 0, bossLines: 0, casts: 0, heals: 0, buffs: 0, combatantInfo: 0 }
  };
  let activeEncounter = null;
  let firstTimestamp = "";
  let lastTimestamp = "";
  const combatantInfoByGuid = new Map();

  function parseCsv(line) {
    const values = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "\"") {
        if (quoted && line[i + 1] === "\"") {
          current += "\"";
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  function splitLogLine(line) {
    const match = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\.\d+)\s{2}(.+)$/);
    return match ? { timestamp: match[1], fields: parseCsv(match[2]) } : null;
  }

  function cleanName(value) {
    return String(value || "").replace(/^"|"$/g, "").replace(/-(Everlook|Lakeshire)-EU$/i, "").trim();
  }

  function player(name, guid = "") {
    if (guid && !String(guid).startsWith("Player-")) return null;
    const cleaned = cleanName(name);
    if (!cleaned || cleaned === "nil") return null;
    if (!analysis.players[cleaned]) {
      analysis.players[cleaned] = {
        name: cleaned,
        guid,
        className: "",
        raidRole: "",
        activeSeconds: 0,
        activeSecondSet: new Set(),
        casts: {},
        castIds: {},
        healing: {},
        healingDone: 0,
        overheal: 0,
        healEvents: 0,
        buffs: {},
        gearSnapshots: []
      };
    }
    if (guid && !analysis.players[cleaned].guid) analysis.players[cleaned].guid = guid;
    return analysis.players[cleaned];
  }

  function markClass(record, spellId) {
    if (!record || record.className) return;
    const className = CLASS_BY_SPELL_ID.get(Number(spellId));
    if (className) record.className = className;
  }

  function activeSecond(timestamp) {
    const match = timestamp.match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d+)/);
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : null;
  }

  function markActive(record, timestamp) {
    const second = activeSecond(timestamp);
    if (record && second !== null) record.activeSecondSet.add(second);
  }

  function inBossWindow(eventType) {
    if (["ENCOUNTER_START", "ENCOUNTER_END", "COMBAT_LOG_VERSION", "ZONE_CHANGE"].includes(eventType)) return true;
    return activeEncounter && BOSS_ONLY_EVENTS.has(eventType);
  }

  function addCast(timestamp, fields) {
    const source = player(fields[2], fields[1]);
    if (!source) return;
    const spellId = Number(fields[9] || 0);
    const spellName = fields[10] || `Spell ${spellId}`;
    markClass(source, spellId);
    markActive(source, timestamp);
    source.casts[spellName] = (source.casts[spellName] || 0) + 1;
    source.castIds[spellId] = spellName;
    analysis.totals.casts++;
  }

  function addHeal(timestamp, fields) {
    const source = player(fields[2], fields[1]);
    if (!source) return;
    const spellId = Number(fields[9] || 0);
    const spellName = fields[10] || `Spell ${spellId}`;
    const amount = Number(fields[fields.length - 5] || 0);
    const overheal = Number(fields[fields.length - 3] || 0);
    markClass(source, spellId);
    markActive(source, timestamp);
    source.healing[spellName] ||= { casts: 0, amount: 0, overheal: 0 };
    source.healing[spellName].casts++;
    source.healing[spellName].amount += amount;
    source.healing[spellName].overheal += overheal;
    source.healingDone += amount;
    source.overheal += overheal;
    source.healEvents++;
    analysis.totals.heals++;
  }

  function addBuff(fields) {
    const target = player(fields[6], fields[5]);
    if (!target) return;
    const spellId = Number(fields[9] || 0);
    const spellName = fields[10] || `Spell ${spellId}`;
    target.buffs[spellName] = (target.buffs[spellName] || 0) + 1;
    markClass(player(fields[2], fields[1]), spellId);
    analysis.totals.buffs++;
  }

  function addCombatantInfo(fields) {
    const guid = fields[1];
    if (!guid || !guid.startsWith("Player-")) return;
    if (!combatantInfoByGuid.has(guid)) combatantInfoByGuid.set(guid, []);
    combatantInfoByGuid.get(guid).push({
      encounter: activeEncounter?.name || "",
      raw: fields.slice(24).join(",")
    });
    analysis.totals.combatantInfo++;
  }

  String(text || "").split(/\r?\n/).forEach(line => {
    analysis.totals.lines++;
    const parsed = splitLogLine(line);
    if (!parsed) return;
    const { timestamp, fields } = parsed;
    const eventType = fields[0];
    if (!firstTimestamp) firstTimestamp = timestamp;
    lastTimestamp = timestamp;
    if (eventType === "ZONE_CHANGE") {
      analysis.zone = fields[2] || analysis.zone;
      analysis.raid = analysis.zone;
      return;
    }
    if (eventType === "ENCOUNTER_START") {
      activeEncounter = {
        id: Number(fields[1] || 0),
        name: fields[2] || "Unbekannter Boss",
        difficulty: Number(fields[3] || 0),
        groupSize: Number(fields[4] || 0),
        start: timestamp,
        end: "",
        success: null
      };
      analysis.encounters.push(activeEncounter);
      return;
    }
    if (eventType === "ENCOUNTER_END") {
      const id = Number(fields[1] || 0);
      const open = [...analysis.encounters].reverse().find(encounter => encounter.id === id && !encounter.end) || activeEncounter;
      if (open) {
        open.end = timestamp;
        open.success = fields[5] === "1";
      }
      activeEncounter = null;
      return;
    }
    if (!inBossWindow(eventType)) return;
    analysis.totals.bossLines++;
    if (eventType === "SPELL_CAST_SUCCESS") addCast(timestamp, fields);
    else if (eventType === "SPELL_HEAL" || eventType === "SPELL_PERIODIC_HEAL") addHeal(timestamp, fields);
    else if (eventType === "SPELL_AURA_APPLIED") addBuff(fields);
    else if (eventType === "COMBATANT_INFO") addCombatantInfo(fields);
  });

  analysis.startedAt = firstTimestamp;
  analysis.endedAt = lastTimestamp;
  for (const record of Object.values(analysis.players)) {
    if (record.guid && combatantInfoByGuid.has(record.guid)) record.gearSnapshots = combatantInfoByGuid.get(record.guid);
    record.activeSeconds = record.activeSecondSet.size;
    delete record.activeSecondSet;
    record.castTotal = Object.values(record.casts).reduce((sum, value) => sum + value, 0);
    record.overhealPercent = record.healingDone + record.overheal > 0
      ? Math.round(record.overheal * 100 / (record.healingDone + record.overheal))
      : 0;
    if (!record.className) record.className = "Unknown";
  }
  analysis.playerList = Object.values(analysis.players)
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map(({ name, guid, className, raidRole, activeSeconds, castTotal, healingDone, overheal, overhealPercent, healEvents }) => ({
      name, guid, className, raidRole, activeSeconds, castTotal, healingDone, overheal, overhealPercent, healEvents
    }));
  return analysis;
}
