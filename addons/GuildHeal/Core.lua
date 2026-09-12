local addonName,GH=...
_G.GuildHeal=GH
-- GuildHeal: einfache Heilerframes mit Klickzaubern. Alles Wichtige ist vorbelegt, Feinschliff über /gheal.
GH.MEDIA='Interface\\AddOns\\GuildHeal\\Media\\'
GH.VERSION=GetAddOnMetadata and GetAddOnMetadata(addonName,'Version') or (C_AddOns and C_AddOns.GetAddOnMetadata(addonName,'Version')) or ''

-- Klickbelegungen: Attributname der SecureUnitButtons + Anzeigename.
GH.BINDINGS={
 {key='1',mod='',label='Linksklick'},
 {key='2',mod='',label='Rechtsklick'},
 {key='3',mod='',label='Mittelklick'},
 {key='1',mod='shift-',label='Shift + Linksklick'},
 {key='2',mod='shift-',label='Shift + Rechtsklick'},
 {key='1',mod='ctrl-',label='Strg + Linksklick'},
 {key='2',mod='ctrl-',label='Strg + Rechtsklick'},
 {key='1',mod='alt-',label='Alt + Linksklick'},
 {key='2',mod='alt-',label='Alt + Rechtsklick'},
}
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
 PRIEST={['1']={S.flashHeal,S.lesserHeal},['2']={S.greaterHeal,S.heal,S.lesserHeal},['3']={S.renew},['shift-1']={S.shield},['shift-2']={S.heal},['ctrl-1']={S.dispelMagic},['ctrl-2']={S.abolishDisease,S.cureDisease},['alt-1']={S.prayerOfHealing},['alt-2']={'target'}},
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
 fadeRange=.4,classColors=true,showPets=false,
 position=nil,classes={},
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
 local db=GH.DB();local class=GH.PlayerClass();db.classes[class]=db.classes[class] or {}
 local saved=db.classes[class];local out={}
 for _,b in ipairs(GH.BINDINGS) do
  local id=GH.BindingId(b);local value=saved[id]
  if value==nil then
   local options=(GH.DEFAULTS[class] or GH.DEFAULT_OTHER)[id]
   if options then for _,opt in ipairs(options) do if type(opt)=='string' or GH.Known(opt) then value=opt;break end end end
  end
  if value==false then value=nil end
  out[id]=value
 end
 return out
end
function GH.SetBinding(id,value)
 local db=GH.DB();local class=GH.PlayerClass();db.classes[class]=db.classes[class] or {}
 if value==nil then db.classes[class][id]=false else db.classes[class][id]=value end
 GH.ApplyBindings()
end
function GH.ResetBindings() local db=GH.DB();db.classes[GH.PlayerClass()]={};GH.ApplyBindings() end
function GH.BindingText(value)
 if value=='target' then return 'Ziel anvisieren' elseif value=='menu' then return 'Einheitenmenü' elseif value=='focus' then return 'Fokus setzen'
 elseif type(value)=='number' then local name=GH.SpellName(value);if not name then return 'Unbekannter Zauber' end;if not GH.Known(value) then return name..' (nicht gelernt)' end;return name
 elseif type(value)=='string' and value~='' then return value end
 return '– leer –'
end
-- Alle Zauber des Zauberbuchs (ein Eintrag je Name, höchster Rang) für die Auswahl.
function GH.SpellbookSpells()
 local seen,list={},{}
 if not GetSpellBookItemName or not GetSpellTabInfo then return list end
 local tabs=GetNumSpellTabs and GetNumSpellTabs() or 0
 for tab=1,tabs do
  local _,_,offset,count=GetSpellTabInfo(tab)
  for i=offset+1,offset+count do
   local name=GetSpellBookItemName(i,BOOKTYPE_SPELL or 'spell')
   local kind,id=GetSpellBookItemInfo(i,BOOKTYPE_SPELL or 'spell')
   if name and kind=='SPELL' and not seen[name] and not IsPassiveSpell(i,BOOKTYPE_SPELL or 'spell') then
    seen[name]=true;local _,_,icon=GetSpellInfo(name);list[#list+1]={name=name,id=id,icon=icon}
   end
  end
 end
 table.sort(list,function(a,b) return a.name<b.name end)
 return list
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
  for _,line in ipairs({'|cffffcc40GuildHeal Befehle:|r','/gheal – Einstellungen (Klickzauber, Größe, Anzeige)','/gheal lock | unlock – Frames sperren / entsperren','/gheal reset – Position zurücksetzen'}) do print(line) end
 else GH.ToggleConfig() end
end
