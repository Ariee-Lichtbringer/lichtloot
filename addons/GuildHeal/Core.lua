local addonName,GH=...
_G.GuildHeal=GH
-- GuildHeal: einfache Heilerframes mit Klickzaubern. Alles Wichtige ist vorbelegt, Feinschliff über /gheal.
GH.MEDIA='Interface\\AddOns\\GuildHeal\\Media\\'
GH.VERSION=GetAddOnMetadata and GetAddOnMetadata(addonName,'Version') or (C_AddOns and C_AddOns.GetAddOnMetadata(addonName,'Version')) or ''

-- Klickbelegungen: Modifikator × Maustaste (1–5) bzw. Mausrad. Attributpräfix in WoW-Reihenfolge alt-ctrl-shift-.
GH.MODIFIERS={{mod='',label='keine'},{mod='alt-',label='Alt'},{mod='ctrl-',label='Strg'},{mod='shift-',label='Umschalt'},{mod='alt-ctrl-',label='Alt + Strg'},{mod='alt-shift-',label='Alt + Umschalt'},{mod='ctrl-shift-',label='Strg + Umschalt'},{mod='alt-ctrl-shift-',label='Alt + Strg + Umschalt'}}
GH.BUTTONS={{key='1',label='Linke Taste'},{key='2',label='Rechte Taste'},{key='3',label='Mittlere Taste'},{key='4',label='Taste 4'},{key='5',label='Taste 5'},{key='wheelup',label='Mausrad auf',wheel='MOUSEWHEELUP'},{key='wheeldown',label='Mausrad ab',wheel='MOUSEWHEELDOWN'}}
GH.BINDINGS={}
for _,m in ipairs(GH.MODIFIERS) do for _,b in ipairs(GH.BUTTONS) do GH.BINDINGS[#GH.BINDINGS+1]={key=b.key,mod=m.mod,label=(m.mod=='' and '' or m.label..' + ')..b.label,wheel=b.wheel} end end
function GH.ModifierKeyPrefix(mod) return (mod:gsub('alt%-','ALT-'):gsub('ctrl%-','CTRL-'):gsub('shift%-','SHIFT-')) end
function GH.BindingId(b) return b.mod..b.key end

-- Zauber-IDs (Rang 1) liefern den lokalisierten Namen; gezaubert wird per Name = höchster bekannter Rang.
local S={
 flashHeal=2061,greaterHeal=2060,heal=2054,lesserHeal=2050,renew=139,shield=17,dispelMagic=527,cureDisease=528,abolishDisease=552,prayerOfHealing=596,
 healingTouch=5185,regrowth=8936,rejuvenation=774,removeCurse=2782,abolishPoison=2893,curePoison=8946,rebirth=20484,innervate=29166,swiftmend=18562,
 holyLight=635,flashOfLight=19750,cleanse=4987,purify=1152,blessingOfProtection=1022,layOnHands=633,holyShock=20473,blessingOfFreedom=1044,
 healingWave=331,lesserHealingWave=8004,chainHeal=1064,shamanCurePoison=526,shamanCureDisease=2870,ancestralSpirit=2008,
 removeLesserCurse=475,
}
GH.SPELLS=S
-- Vorbelegung je Klasse. Jede Belegung ist eine Liste von Alternativen (erste bekannte gewinnt).
GH.DEFAULTS={
 -- Priester nach Vorlage (VuhDo-Belegung von Ariee): feste Ränge, wenn bekannt, sonst höchster Rang.
 PRIEST={['1']={{id=S.greaterHeal,rank=1},S.greaterHeal,S.heal,S.lesserHeal},['2']={{id=S.flashHeal,rank=5},S.flashHeal,S.lesserHeal},['3']={S.shield},['4']={S.dispelMagic},['5']={S.cureDisease,S.abolishDisease},
  ['shift-1']={{id=S.renew,rank=10},S.renew},['shift-2']={{id=S.flashHeal,rank=7},S.flashHeal},['shift-3']={S.prayerOfHealing}},
 DRUID={['1']={S.healingTouch},['2']={S.regrowth,S.healingTouch},['3']={S.rejuvenation},['shift-1']={S.swiftmend},['shift-2']={S.rebirth},['ctrl-1']={S.removeCurse},['ctrl-2']={S.abolishPoison,S.curePoison},['alt-1']={S.innervate},['alt-2']={'target'}},
 PALADIN={['1']={S.flashOfLight,S.holyLight},['2']={S.holyLight},['3']={S.holyShock},['shift-1']={S.blessingOfProtection},['shift-2']={S.layOnHands},['ctrl-1']={S.cleanse,S.purify},['ctrl-2']={S.blessingOfFreedom},['alt-1']={'target'},['alt-2']={'menu'}},
 SHAMAN={['1']={S.lesserHealingWave,S.healingWave},['2']={S.healingWave},['3']={S.chainHeal},['shift-2']={S.ancestralSpirit},['ctrl-1']={S.shamanCurePoison},['ctrl-2']={S.shamanCureDisease},['alt-1']={'target'},['alt-2']={'menu'}},
 MAGE={['1']={'target'},['2']={'menu'},['ctrl-1']={S.removeLesserCurse}},
}
GH.DEFAULT_OTHER={['1']={'target'},['2']={'menu'}}
-- Entfernbare Debuff-Typen je Klasse (für die farbige Umrandung und das Debuff-Symbol).
GH.DISPEL={PRIEST={Magic=true,Disease=true},PALADIN={Magic=true,Poison=true,Disease=true},DRUID={Curse=true,Poison=true},SHAMAN={Poison=true,Disease=true},MAGE={Curse=true}}
GH.DEBUFF_COLORS={Magic={.2,.6,1},Curse={.6,.2,1},Poison={.2,.8,.2},Disease={.6,.4,0}}

local defaults={
 width=84,height=38,horizontal=true,showMana=true,showDebuffs=true,showIncoming=true,locked=false,castOnDown=false,hideSolo=false,scale=1,
 fadeRange=.4,classColors=true,showPets=false,showAuras=true,showCooldowns=true,aggroBorder=true,nameClick=true,
 emergency=true,emergencyThreshold=50,emergencySound=true,
 overhealWarn=true,overhealThreshold=40,overhealSound=true,overhealSkipTanks=true,tanks='',
 targetOnHeal=false, showTargetFrame=false,showTankFrames=true,bossDebuffSound=true,healerManaWarn=true,healerManaThreshold=20,healerManaSound=true,healthGradient=false,perCharacter=false,sortMode='group',
 position=nil,classes={},
}
-- Auren (HoTs, Schilde, Schutz-Debuffs), die als kleine Symbole mit Restzeit auf dem Feld erscheinen.
GH.AURA_DEFAULTS={
 PRIEST={139,17,6788,6346,10060},DRUID={774,8936,2893,29166},PALADIN={1022,1044,25771,6940},SHAMAN={29203,16177},
}
function GH.DB()
 GuildHealDB=GuildHealDB or {}
 for k,v in pairs(defaults) do if GuildHealDB[k]==nil then GuildHealDB[k]=(type(v)=='table' and {} or v) end end
 return GuildHealDB
end
function GH.PlayerClass() local _,class=UnitClass('player');return class end
function GH.SpellName(id)
 if type(id)~='number' then return nil end
 local name=GetSpellInfo(id);return name
end
-- Bekannt = im Zauberbuch vorhanden (GetSpellInfo per Name liefert nur bekannte Zauber).
function GH.Known(id)
 local name=GH.SpellName(id);if not name then return false end
 return GetSpellInfo(name)~=nil
end
function GH.SpellIcon(id) local _,_,icon=GetSpellInfo(id);return icon end
-- Aktuelle Belegung: gespeicherte Werte je Klasse, sonst die Vorgabe (erste bekannte Alternative).
function GH.Bindings()
 local class=GH.PlayerClass();local saved=GH.ClassStore();local out={}
 for _,b in ipairs(GH.BINDINGS) do
  local id=GH.BindingId(b);local value=saved[id]
  if value==nil then
   local options=(GH.DEFAULTS[class] or GH.DEFAULT_OTHER)[id]
   if options then for _,opt in ipairs(options) do
    if type(opt)=='table' then local full=GH.RankedSpell(opt.id,opt.rank);if full then value=full;break end
    elseif type(opt)=='string' or GH.Known(opt) then value=opt;break end
   end end
  end
  if value==false then value=nil end
  out[id]=value
 end
 return out
end
function GH.SetBinding(id,value)
 local store=GH.ClassStore();if value==nil then store[id]=false else store[id]=value end
 GH.ApplyBindings()
end
function GH.ResetBindings() local db=GH.DB();local key=GH.ClassStoreKey();local c=db.classes[key] or {};db.classes[key]={keys=c.keys,chains=c.chains,auras=c.auras};GH.ApplyBindings() end
-- Belegung je Klasse, wahlweise je Charakter (Profil 'KLASSE@Name-Realm', startet als Kopie der Klassenbelegung).
local function copyTable(src) if type(src)~='table' then return src end;local out={};for k,v in pairs(src) do out[k]=copyTable(v) end;return out end
function GH.ClassStore()
 local db=GH.DB();local class=GH.PlayerClass()
 if db.perCharacter then
  local key=class..'@'..(UnitName('player') or '?')..'-'..(GetRealmName() or '')
  if not db.classes[key] then db.classes[key]=copyTable(db.classes[class] or {}) end
  return db.classes[key]
 end
 db.classes[class]=db.classes[class] or {};return db.classes[class]
end
function GH.ClassStoreKey() local db=GH.DB();local class=GH.PlayerClass();return db.perCharacter and (class..'@'..(UnitName('player') or '?')..'-'..(GetRealmName() or '')) or class end
-- Mausüber-Tasten: Taste (z. B. F1, SHIFT-F2, BUTTON4) → Zauber oder Aktion, wirkt auf das Feld unter der Maus.
function GH.Keys() local c=GH.ClassStore();c.keys=c.keys or {};return c.keys end
function GH.SetKey(index,key,value)
 local keys=GH.Keys();for i=#keys+1,index do keys[i]=keys[i] or {} end
 if key~=nil then keys[index].key=key end;if key==nil then keys[index].value=value end
 GH.ApplyBindings()
end
function GH.RemoveKey(index) table.remove(GH.Keys(),index);GH.ApplyBindings() end
-- Zauberketten: vor dem Hauptzauber werden Schmuckstücke und Zusatzzauber (ohne GCD, z. B. Innerer Fokus) ausgelöst.
function GH.Chain(id) local c=GH.ClassStore();c.chains=c.chains or {};c.chains[id]=c.chains[id] or {spells={}};return c.chains[id] end
function GH.ChainActive(id) local c=GH.ClassStore();local chain=c.chains and c.chains[id];return chain and (chain.trinket13 or chain.trinket14 or (chain.spells and #chain.spells>0)) end
function GH.TrackedAuras()
 local c=GH.ClassStore();if c.auras then return c.auras end
 local list={};for _,id in ipairs(GH.AURA_DEFAULTS[GH.PlayerClass()] or {}) do local name=GH.SpellName(id);if name then list[#list+1]=name end end
 return list
end
-- Boss-Debuffs (Standard über Zauber-IDs aus MC, BWL, AQ40 und Naxxramas), groß und mit Ton hervorgehoben.
GH.BOSS_DEBUFF_IDS={20475,19659,23170,23169,23154,23155,22687,23340,26180,25646,28169,28410,27808,28522,29213,28542,25471,26476}
function GH.BossDebuffs()
 local c=GH.ClassStore();if c.bossDebuffs then return c.bossDebuffs end
 local list,seen={},{};for _,id in ipairs(GH.BOSS_DEBUFF_IDS) do local name=GH.SpellName(id);if name and not seen[name] then seen[name]=true;list[#list+1]=name end end
 return list
end
function GH.SetBossDebuffs(list) GH.ClassStore().bossDebuffs=list;if GH.RefreshAll then GH.RefreshAll() end end
function GH.ResetBossDebuffs() GH.ClassStore().bossDebuffs=nil;if GH.RefreshAll then GH.RefreshAll() end end
GH.HEALER_CLASSES={PRIEST=true,DRUID=true,PALADIN=true,SHAMAN=true}
function GH.SetTrackedAuras(list) GH.ClassStore().auras=list;if GH.RefreshAll then GH.RefreshAll() end end
function GH.ResetTrackedAuras() GH.ClassStore().auras=nil;if GH.RefreshAll then GH.RefreshAll() end end
-- Makrotext für Ketten: Schmuckstücke und Zusatzzauber zuerst, dann der Hauptzauber auf das Feld unter der Maus.
function GH.MacroText(value,chain,mouseover)
 local lines={}
 if chain then
  if chain.trinket13 then lines[#lines+1]='/use 13' end
  if chain.trinket14 then lines[#lines+1]='/use 14' end
  for _,name in ipairs(chain.spells or {}) do if GH.ValidSpell(name) then lines[#lines+1]='/cast '..name end end
 end
 local main=type(value)=='number' and GH.SpellName(value) or value
 if type(main)=='string' and GH.ValidSpell(main) then lines[#lines+1]='/cast [@mouseover,exists] '..main end
 return table.concat(lines,'\n')
end
-- Freitext wie bei VuhDo: Zaubername (mit Rang), Makroname, Gegenstand oder target/focus/assist/menu.
GH.ACTIONS={target='Ziel anvisieren',focus='Fokus setzen',assist='Assistieren',menu='Einheitenmenü',stopcasting='Zauber abbrechen'}
function GH.ParseInput(text)
 text=(text or ''):match('^%s*(.-)%s*$');if text=='' then return nil end
 local lower=text:lower();if lower=='dropdown' then lower='menu' end
 if GH.ACTIONS[lower] then return lower end
 if GH.ValidSpell(text) then return text end
 if GetMacroIndexByName and GetMacroIndexByName(text)>0 then return 'macro:'..text end
 if GetItemInfo and GetItemInfo(text) then return 'item:'..text end
 return text
end
function GH.BindingText(value)
 if GH.ACTIONS[value] then return GH.ACTIONS[value] end
 if type(value)=='string' and value:sub(1,6)=='macro:' then return 'Makro: '..value:sub(7) end
 if type(value)=='string' and value:sub(1,5)=='item:' then return 'Gegenstand: '..value:sub(6) end
 if type(value)=='number' then local name=GH.SpellName(value);if not name then return 'Unbekannter Zauber' end;if not GH.Known(value) then return name..' (nicht gelernt)' end;return name
 elseif type(value)=='string' and value~='' then local base,rank=value:match('^(.-)%((.-)%)$');if base then return base..' · '..rank..(GH.ValidSpell(value) and '' or ' (unbekannt)') end;return value..(GH.ValidSpell(value) and '' or ' (unbekannt)') end
 return '– leer –'
end
-- Rohtext für das Eingabefeld.
function GH.BindingInput(value)
 if type(value)=='number' then return GH.SpellName(value) or '' end
 if type(value)=='string' then return (value:gsub('^macro:',''):gsub('^item:','')) end
 return ''
end
-- Alle Zauber des Zauberbuchs mit Rängen. 'Name' = höchster Rang, 'Name(Rang 3)' = fester Rang.
local bookCache,bookTime
function GH.SpellbookSpells()
 if bookCache and bookTime==GetTime() then return bookCache end
 local list,byName={},{}
 if not GetSpellBookItemName or not GetSpellTabInfo then return list end
 local tabs=GetNumSpellTabs and GetNumSpellTabs() or 0
 for tab=1,tabs do
  local _,_,offset,count=GetSpellTabInfo(tab)
  for i=offset+1,offset+count do
   local name,rank=GetSpellBookItemName(i,BOOKTYPE_SPELL or 'spell')
   local kind,id=GetSpellBookItemInfo(i,BOOKTYPE_SPELL or 'spell')
   if name and kind=='SPELL' and not IsPassiveSpell(i,BOOKTYPE_SPELL or 'spell') then
    local _,_,icon=GetSpellInfo(name);rank=rank and rank~='' and rank or nil
    if not byName[name] then byName[name]={name=name,icon=icon,id=id,ranks={}};list[#list+1]=byName[name] end
    if rank then table.insert(byName[name].ranks,{rank=rank,full=name..'('..rank..')',id=id}) end
   end
  end
 end
 table.sort(list,function(a,b) return a.name<b.name end)
 bookCache,bookTime=list,GetTime();return list
end
-- 'Name(Rang N)' aus dem Zauberbuch, falls dieser Rang bekannt ist.
function GH.RankedSpell(id,rank)
 local name=GH.SpellName(id);if not name then return nil end
 for _,s in ipairs(GH.SpellbookSpells()) do
  if s.name==name then for _,r in ipairs(s.ranks) do if tonumber(r.rank:match('%d+'))==rank then return r.full end end end
 end
 return nil
end
function GH.BaseName(value) return (tostring(value or ''):gsub('%(.*%)$','')) end
-- Gültig, wenn der Zauber (ggf. mit Rang) im Zauberbuch steht.
function GH.ValidSpell(value)
 if type(value)~='string' or value=='' then return false end
 for _,s in ipairs(GH.SpellbookSpells()) do
  if s.name==value then return true end
  for _,r in ipairs(s.ranks) do if r.full==value then return true end end
 end
 return false
end
function GH.SpellIconOf(value)
 if type(value)=='number' then return GH.SpellIcon(value) end
 local base=GH.BaseName(value);for _,s in ipairs(GH.SpellbookSpells()) do if s.name==base then return s.icon end end
end
-- Tank-Erkennung: Haupttank/Hauptassistent im Schlachtzug oder Namen aus der Einstellung (kommagetrennt).
function GH.IsTank(unit)
 local name=UnitName(unit);if not name then return false end
 local list=GH.DB().tanks or ''
 for entry in list:gmatch('[^,;]+') do entry=entry:match('^%s*(.-)%s*$');if entry~='' and entry:lower()==name:lower() then return true end end
 if IsInRaid() and GetRaidRosterInfo then
  for i=1,GetNumGroupMembers() do local n,_,_,_,_,_,_,_,_,role=GetRaidRosterInfo(i);if n and (n==name or n:match('^(.-)%-')==name) and (role=='MAINTANK' or role=='MAINASSIST') then return true end end
 end
 if UnitGroupRolesAssigned then local role=UnitGroupRolesAssigned(unit);if role=='TANK' then return true end end
 return false
end
function GH.Print(msg) print('|cff2ad1bcGuildHeal:|r '..tostring(msg)) end
function GH.ClassColor(unit)
 local _,class=UnitClass(unit);local c=class and (CUSTOM_CLASS_COLORS or RAID_CLASS_COLORS)[class]
 if c then return c.r,c.g,c.b end;return .6,.6,.6
end
function GH.PowerColor(unit)
 local kind=UnitPowerType(unit);local c=PowerBarColor[kind] or PowerBarColor['MANA'];return c.r,c.g,c.b
end
function GH.Short(n)
 if n>=10000 then return string.format('%.0fk',n/1000) elseif n>=1000 then return string.format('%.1fk',n/1000) end;return tostring(n)
end

SLASH_GUILDHEAL1='/gheal';SLASH_GUILDHEAL2='/guildheal'
SlashCmdList.GUILDHEAL=function(msg)
 msg=(msg or ''):lower():match('^%s*(.-)%s*$')
 if msg=='lock' or msg=='sperren' then GH.DB().locked=true;GH.ApplyLayout();GH.Print('Frames gesperrt.')
 elseif msg=='unlock' or msg=='entsperren' then GH.DB().locked=false;GH.ApplyLayout();GH.Print('Frames entsperrt: am Anker ziehen.')
 elseif msg=='reset' then GH.DB().position=nil;GH.ApplyLayout();GH.Print('Position zurückgesetzt.')
 elseif msg=='hilfe' or msg=='help' then
  for _,line in ipairs({'|cffffcc40GuildHeal Befehle:|r','/gheal – Einstellungen (Klickzauber, Tasten, Ketten, Anzeige, Warnungen)','/gheal lock | unlock – Frames sperren / entsperren','/gheal reset – Position zurücksetzen'}) do print(line) end
 else GH.ToggleConfig() end
end
