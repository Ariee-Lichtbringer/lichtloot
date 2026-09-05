// Gemeinsame Werteberechnung aus dem bestehenden Ausrüstungsplaner.
const WCL_ENCHANT_FALLBACKS={
  "911":{name:"Geringe Tempoerhöhung",effect:"Bewegungstempo"},
  "1891":{name:"Große Werte",effect:"+4 Stärke | +4 Beweglichkeit | +4 Ausdauer | +4 Intelligenz | +4 Willenskraft"},
  "2505":{name:"Heilkraft",effect:"+55 Heilung"},
  "2566":{name:"Heilkraft",effect:"+24 Heilung"},
  "2590":{name:"Prophetische Aura",effect:"+24 Heilung | +10 Ausdauer | Stellt alle 5 Sek. 4 Punkt(e) Mana wieder her."},
  "2617":{name:"Handschuhe - Heilkraft",effect:"+30 Heilung"},
  "2621":{name:"Umhang - Verstohlenheit",effect:"Verringert Eure Bedrohung leicht."},
  "2715":{name:"Zandalarisches Siegel der Inneren Ruhe",effect:"+33 Heilung"}
};

function gearStatNumber(value){
  return Number(String(value || "0").replace(",", ".")) || 0;
}

function addGearStat(stats,key,value){
  stats[key] = (stats[key] || 0) + gearStatNumber(value);
}

function gearStatLines(item){
  const lines=[];
  if(!item) return lines;

  if(Array.isArray(item.stats) && item.stats.length){
    item.stats.forEach(line => lines.push(String(line || "")));
  }else{
    String(item.tooltipText || "")
      .split("|")
      .map(line => line.trim())
      .filter(Boolean)
      .forEach(line => lines.push(line));
  }

  if(item.equip) lines.push(String(item.equip));
  gearEnchantLines(item).forEach(line => lines.push(line));
  (Array.isArray(item.plannerEnchantStats) ? item.plannerEnchantStats : []).forEach(line => lines.push(line));

  return lines;
}

function normalizeGearEnchantText(value){
  if(!value) return "";
  if(typeof value === "string" || typeof value === "number"){
    const fallback=WCL_ENCHANT_FALLBACKS[String(value)];
    return fallback ? fallback.name+(fallback.effect ? ": "+fallback.effect : "") : "Verzauberung #"+String(value);
  }
  const id=value.id || value.enchantment_id || value.enchantmentId || value.spellID || value.spellId || "";
  const fallback=id ? WCL_ENCHANT_FALLBACKS[String(id)] : null;
  const name=value.name || value.Name || value.enchantmentName || value.spellName || "";
  if(name) return name;
  if(fallback) return fallback.name+(fallback.effect ? ": "+fallback.effect : "");
  return id ? "Verzauberung #"+String(id) : "";
}

function gearEnchantLines(item){
  const lines=[];
  if(!item) return lines;

  const permanent=normalizeGearEnchantText(item.permanentEnchantName || item.permanentEnchant || item.enchant || item.enchantName);
  if(permanent) lines.push("Verzauberung: " + permanent);

  (Array.isArray(item.enchantments) ? item.enchantments : []).forEach(enchant=>{
    const text=normalizeGearEnchantText(enchant);
    if(text && !lines.includes("Verzauberung: " + text)) lines.push("Verzauberung: " + text);
  });

  return Array.from(new Set(lines));
}

function gearSetName(item){
  const lines=[
    ...String((item && item.tooltipText) || "").split("|"),
    ...((item && Array.isArray(item.stats)) ? item.stats : [])
  ].map(line => String(line || "").trim()).filter(Boolean);

  for(const line of lines){
    const match=line.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/);
    if(match && !/^\+/.test(line)){
      return match[1].trim();
    }
  }
  return "";
}

function gearSetBonusLines(item){
  return gearStatLines(item)
    .map(line => String(line || "").replace(/\s+/g," ").trim())
    .filter(line => /^\(\d+\)\s*Set:/i.test(line));
}

function activeGearSetBonusLines(items){
  const sets={};

  (items || []).forEach(item=>{
    const setName=gearSetName(item);
    if(!setName) return;

    if(!sets[setName]){
      sets[setName]={count:0,bonuses:[]};
    }

    sets[setName].count+=1;
    gearSetBonusLines(item).forEach(line=>{
      if(!sets[setName].bonuses.includes(line)){
        sets[setName].bonuses.push(line);
      }
    });
  });

  return Object.values(sets).flatMap(set=>{
    return set.bonuses.filter(line=>{
      const needed=line.match(/^\((\d+)\)\s*Set:/i);
      return needed && set.count >= Number(needed[1]);
    });
  });
}

function gearCalculationLineText(line){
  return String(line || "")
    .replace(/^\(\d+\)\s*Set:\s*/i,"")
    .replace(/^Verzauberung:\s*/i,"")
    .replace(/^Sockel:\s*/i,"")
    .replace(/\s+/g," ")
    .trim();
}

function isGearStatCalculationLine(line,options){
  const value=String(line || "").replace(/\s+/g," ").trim();
  const allowSet=Boolean(options && options.allowSet);
  if(!value) return false;
  if(/^\(\d+\)\s*Set:/i.test(value) && !allowSet) return false;
  if(/^Klassen:/i.test(value)) return false;
  if(/^Benötigt/i.test(value)) return false;
  if(/^Wird beim/i.test(value)) return false;
  if(/^Einzigartig/i.test(value)) return false;
  if(/^Benutzen:/i.test(value)) return false;
  if(/^Chance bei Treffer:/i.test(value)) return false;

  const calculationValue=gearCalculationLineText(value);

  return (
    /^\+\s*\d+/.test(calculationValue) ||
    /^\d+\s*Rüstung/i.test(calculationValue) ||
    /^Anlegen:/i.test(calculationValue) ||
    /Erhöht .*?(Heilung|Schaden|Trefferchance|kritische Trefferchance|Mana|Rüstung|Verteidigung|Angriffskraft|Widerstand).*?\d+/i.test(calculationValue)
  );
}

function applyGearStatLine(stats,rawLine,options){
  const originalLine=String(rawLine || "").replace(/\s+/g," ").trim();
  if(!originalLine) return;
  if(!isGearStatCalculationLine(originalLine,options)) return;

  const line=gearCalculationLineText(originalLine);

  const attrMatch=line.match(/\+?\s*(\d+)\s*(Ausdauer|Intelligenz|Willenskraft|Stärke|Staerke|Beweglichkeit)/i);
  if(attrMatch){
    const label=attrMatch[2].toLowerCase();
    if(label.includes("ausdauer")) addGearStat(stats,"sta",attrMatch[1]);
    else if(label.includes("intelligenz")) addGearStat(stats,"int",attrMatch[1]);
    else if(label.includes("willenskraft")) addGearStat(stats,"spi",attrMatch[1]);
    else if(label.includes("stärke") || label.includes("staerke")) addGearStat(stats,"str",attrMatch[1]);
    else if(label.includes("beweglichkeit")) addGearStat(stats,"agi",attrMatch[1]);
  }

  const armorMatch=line.match(/^\s*(\d+)\s*Rüstung/i);
  if(armorMatch) addGearStat(stats,"armor",armorMatch[1]);

  const healthMatch=line.match(/\+?\s*(\d+)\s*(?:Gesundheit|Lebenspunkte|HP)\b/i);
  if(healthMatch) addGearStat(stats,"health",healthMatch[1]);

  const manaFlatMatch=line.match(/\+?\s*(\d+)\s*Mana\b/i);
  if(manaFlatMatch) addGearStat(stats,"mana",manaFlatMatch[1]);

  const defenseMatch=line.match(/Verteidigung[^0-9+]*(?:\+|um)?\s*(\d+)/i);
  if(defenseMatch) addGearStat(stats,"defense",defenseMatch[1]);

  const attackPowerMatch=line.match(/Angriffskraft[^0-9+]*(?:\+|um)?\s*(\d+)/i);
  if(attackPowerMatch) addGearStat(stats,"attackPower",attackPowerMatch[1]);

  const healMatch=line.match(/Heilung[^0-9]*(?:um bis zu|um)?\s*(\d+)/i);
  if(healMatch && !/Schaden und Heilung/i.test(line)) addGearStat(stats,"healing",healMatch[1]);

  const dmgHealMatch=line.match(/Schaden und Heilung[^0-9]*(?:um bis zu|um)?\s*(\d+)/i);
  if(dmgHealMatch){
    addGearStat(stats,"spellDamage",dmgHealMatch[1]);
    addGearStat(stats,"healing",dmgHealMatch[1]);
  }

  const spellDmgMatch=line.match(/(?:Zauberschaden|verursachte[nr]? Schaden)[^0-9]*(?:um bis zu|um)?\s*(\d+)/i);
  if(spellDmgMatch && !dmgHealMatch) addGearStat(stats,"spellDamage",spellDmgMatch[1]);

  const mp5Match=line.match(/(?:Stellt.*?(\d+).*?Mana.*?5\s*Sek|(\d+).*?Mana.*?5\s*Sek)/i);
  if(mp5Match) addGearStat(stats,"mp5",mp5Match[1] || mp5Match[2]);

  const critMatch=line.match(/Kritisch[^0-9]*(\d+(?:[,.]\d+)?)\s*%/i);
  if(critMatch) addGearStat(stats,"spellCrit",critMatch[1]);

  const hitMatch=line.match(/Trefferchance[^0-9]*(\d+(?:[,.]\d+)?)\s*%/i);
  if(hitMatch) addGearStat(stats,"spellHit",hitMatch[1]);

  const meleeCritMatch=line.match(/(?:kritische Trefferchance.*?Nahkampf|Nahkampfkrit)[^0-9]*(\d+(?:[,.]\d+)?)\s*%/i);
  if(meleeCritMatch) addGearStat(stats,"meleeCrit",meleeCritMatch[1]);

  const meleeHitMatch=line.match(/(?:Trefferchance.*?Nahkampf|Nahkampftreffer)[^0-9]*(\d+(?:[,.]\d+)?)\s*%/i);
  if(meleeHitMatch) addGearStat(stats,"meleeHit",meleeHitMatch[1]);

  const spellPenMatch=line.match(/Zauberdurchschlag[^0-9]*(\d+)/i);
  if(spellPenMatch) addGearStat(stats,"spellPen",spellPenMatch[1]);

  [
    ["arcaneRes","Arkan"],
    ["fireRes","Feuer"],
    ["natureRes","Natur"],
    ["frostRes","Frost"],
    ["shadowRes","Schatten"]
  ].forEach(([key,label])=>{
    const match=line.match(new RegExp("\\\\+?\\\\s*(\\\\d+)\\\\s*"+label+"widerstand","i"));
    if(match) addGearStat(stats,key,match[1]);
  });
}

function calculateGearStats(items){
  const stats={
    sta:0,
    int:0,
    spi:0,
    str:0,
    agi:0,
    healing:0,
    spellDamage:0,
    mp5:0,
    spellCrit:0,
    spellHit:0,
    spellPen:0,
    armor:0,
    health:0,
    mana:0,
    defense:0,
    attackPower:0,
    meleeCrit:0,
    meleeHit:0,
    rangedCrit:0,
    rangedHit:0,
    arcaneRes:0,
    fireRes:0,
    natureRes:0,
    frostRes:0,
    shadowRes:0
  };

  (items || []).forEach(item=>{
    gearStatLines(item).forEach(rawLine=>{
      applyGearStatLine(stats,rawLine);
    });
  });

  activeGearSetBonusLines(items).forEach(line=>{
    applyGearStatLine(stats,line,{allowSet:true});
  });

  return stats;
}

function plannerEnchantCalculationLines(value){
    const text=String(value||"").replace(/Verzauberung\s*#?/gi,"").replace(/Verzaubert:\s*/gi,"");
    const lines=[];
    const add=(key,amount)=>{const number=Number(String(amount||"").replace(",","."));if(!number)return;if(key==="healing")lines.push(`Anlegen: Heilung um ${number}`);else if(key==="defense")lines.push(`Anlegen: Verteidigung um ${number}`);else if(key==="attackPower")lines.push(`Anlegen: Angriffskraft um ${number}`);else if(key==="mp5")lines.push(`Anlegen: Stellt ${number} Mana alle 5 Sek. wieder her`);else lines.push(`+${number} ${key}`);};
    const rules=[
      ["healing",/(?:Heilzauber|Heilung)\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["defense",/Verteidigung\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["attackPower",/Angriffskraft\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["mp5",/(?:MP5|Mana(?:regeneration)?(?:\s+alle\s+5\s+Sek(?:unden)?)?)\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["Ausdauer",/Ausdauer\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["Intelligenz",/Intelligenz\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["Willenskraft",/Willenskraft\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["Stärke",/(?:Stärke|Staerke|Strength)\s*\+\s*(\d+(?:[,.]\d+)?)/gi],
      ["Beweglichkeit",/(?:Beweglichkeit|Agility)\s*\+\s*(\d+(?:[,.]\d+)?)/gi]
    ];
    rules.forEach(([key,pattern])=>{for(const match of text.matchAll(pattern))add(key,match[1]);});
    for(const match of text.matchAll(/(\d+(?:[,.]\d+)?)\s*Mana\s+alle\s+5\s+Sek/gi))add("mp5",match[1]);
    for(const match of text.matchAll(/Alle\s+(?:Werte|Stats)\s*\+\s*(\d+(?:[,.]\d+)?)/gi)){
      ["Ausdauer","Intelligenz","Willenskraft","Stärke","Beweglichkeit"].forEach(key=>add(key,match[1]));
    }
    return lines;
  }

function normalizeArmoryPlannerItem(item){const tooltip=String(item?.tooltip||item?.statsText||"").replace(/\r?\n/g,"|"),enchant=item?.enchant||item?.enchantName||"",baseStats=Array.isArray(item?.stats)?item.stats:tooltip.split("|").map(line=>line.trim()).filter(Boolean);return{...item,id:item?.itemId||item?.id||"",itemId:item?.itemId||item?.id||"",slotName:item?.slot||item?.slotName||"",icon:item?.iconUrl||item?.icon||"",quality:String(item?.quality||"").toLowerCase(),tooltipText:tooltip,stats:baseStats,plannerEnchantStats:plannerEnchantCalculationLines(enchant),permanentEnchantName:enchant,source:"Blizzard Armory"};}

export { calculateGearStats, normalizeArmoryPlannerItem };
