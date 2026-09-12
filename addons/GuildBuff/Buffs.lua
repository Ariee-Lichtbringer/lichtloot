local _,GL=...
-- All casts stay on fixed secure buttons. No timer or combat event casts spells.
local B={};GL.Buffs=B
local function safe(s) return tostring(s or ''):gsub('|','||') end
local function norm(s) return tostring(s or ''):gsub('^%s+',''):gsub('%s+$',''):lower() end
local classNames={PRIEST='Priester',MAGE='Magier',DRUID='Druide',PALADIN='Paladin'}
local spells={
 PRIEST={{21564,21562},{27681},{27683}}, MAGE={{23028}}, DRUID={{21850,21849}},
 PALADIN={{25918,25894},{25916,25782},{25898},{25895},{25899},{25917,25890}},
}
local singleBuffRanks={
 [21564]={10938,10937,2791,1245,1244,1243},[21562]={10938,10937,2791,1245,1244,1243},
 [27681]={27841,14819,14818,14752},[27683]={10958,10957,976},
 [23028]={10157,10156,1461,1460,1459},
 [21850]={9885,9884,8907,5234,6756,5232,1126},[21849]={9885,9884,8907,5234,6756,5232,1126},
}
local categories={
 {key='fortitude',name='Ausdauer',ids={1243,1244,1245,2791,10937,10938,21562,21564}},
 {key='intellect',name='Intelligenz',ids={1459,1460,1461,10156,10157,23028}},
 {key='mark',name='Mal',ids={1126,5232,6756,5234,8907,9884,9885,21849,21850}},
 {key='spirit',name='Willenskraft',ids={14752,14818,14819,27841,27681}},
 {key='shadow',name='Schattenschutz',ids={976,10957,10958,27683}},
 {key='blessing',name='Segen',ids={19740,19834,19835,19836,19837,19838,25291,25782,25916,19742,19850,19852,19853,19854,25290,25894,25918,20217,25898,1038,25895,20911,20912,20913,20914,25899,19977,19978,19979,25890,25917}},
 {key='food',name='Bufffood',ids={19705,19706,19708,19709,19710,19711,18125,18141,18191,24799,24870,25661}},
 {key='flask',name='Fläschchen',ids={17626,17627,17628,17629}},
 {key='elixir',name='Elixier',ids={24363,17538,17539,17537,17535,11334,11348,11349,11390,11405,11406,11474,11476,11477,11478,11479,11480,26276,21920,17925}},
}
categories[#categories+1]={key='mainhand',name='Waffe MH',ids={},icon='Interface\\Icons\\INV_Potion_100'}
categories[#categories+1]={key='offhand',name='Waffe NH',ids={},icon='Interface\\Icons\\INV_Potion_100'}
B.categories=categories
local function spellName(id)
 if GetSpellInfo then return GetSpellInfo(id) end
 if C_Spell and C_Spell.GetSpellInfo then local s=C_Spell.GetSpellInfo(id);return s and s.name end
end
local spellCache={}
local uncachedSpellName=spellName
spellName=function(id)
 if not spellCache[id] then spellCache[id]=uncachedSpellName(id) end
 return spellCache[id]
end
local categoryById,categoryByName={},{}
local function prepareCategories()
 for _,c in ipairs(categories) do for _,id in ipairs(c.ids) do
  categoryById[id]=c.key;local name=spellName(id);if name then categoryByName[name]=c.key end
 end end
end
local function aura(unit,i)
 if C_UnitAuras and C_UnitAuras.GetAuraDataByIndex then return C_UnitAuras.GetAuraDataByIndex(unit,i,'HELPFUL') end
 if UnitBuff then local n,icon,count,_,duration,expires,source,_,_,id=UnitBuff(unit,i);if n then return {name=n,icon=icon,applications=count,duration=duration,expirationTime=expires,sourceUnit=source,spellId=id} end end
end
-- Temporary weapon buffs are self-only in the client API. Peers report their
-- own numeric state; never infer another player's oil from their visible auras.
B.weaponPrefix='GLBuffGear1';B.weaponPeers={}
local oilNames={[2629]='Hervorragendes Manaöl',[2628]='Hervorragendes Zauberöl',[2625]='Geringes Manaöl',[2626]='Geringes Zauberöl',[2624]='Schwaches Manaöl',[2623]='Schwaches Zauberöl',[2627]='Zauberöl',[2506]='Elementarwetzstein',[1643]='Verdichteter Wetzstein',[1703]='Verdichteter Gewichtsstein',[625]='Sofort wirkendes Gift VI',[2630]='Tödliches Gift V',[2685]='Gesegnetes Zauberöl',[26]='Frostöl',[25]='Schattenöl'}
local states={'unknown','missing','present','na'}
function B.OwnWeapons()
 local out={};local values=GetWeaponEnchantInfo and {GetWeaponEnchantInfo()} or {}
 for i,slot in ipairs({16,17}) do
  local offset=(i-1)*4;local state='unknown';local id=tonumber(values[offset+4]) or 0;local seconds=math.max(0,math.floor((tonumber(values[offset+2]) or 0)/1000))
  if GetWeaponEnchantInfo and GetInventoryItemLink then
   local link=GetInventoryItemLink('player',slot)
   if not link then state='na'
   else
    local itemClass=GetItemInfoInstant and select(6,GetItemInfoInstant(link))
    if itemClass==2 then state=values[offset+1] and 'present' or 'missing'
    elseif itemClass then state='na' end
   end
  end
  out[i]={status=state,id=id,seconds=seconds}
 end
 return out
end
function B.ReadWeapons(unit,out)
 local own=UnitGUID(unit)==UnitGUID('player');local data=own and B.OwnWeapons() or nil
 if not own then local peer=B.weaponPeers[UnitGUID(unit)];if peer and GetTime()-peer.at<=45 then data=peer.items end end
 for i,key in ipairs({'mainhand','offhand'}) do
  local item=data and data[i];local status=item and item.status or 'unknown'
  if not own and item and item.expires and item.expires<=GetTime() and status=='present' then status='missing' end
  if not out.readable then status='unknown' end
  out.status[key]=status
  if status=='present' then out.details[key]={oilNames[item.id] or ('Waffenbuff #'..tostring(item.id))} end
 end
end
function B.BroadcastWeapons()
 if not IsInRaid() or not C_ChatInfo or not C_ChatInfo.SendAddonMessage then return end
 if B.weaponSentAt and GetTime()-B.weaponSentAt<15 then return end
 B.weaponSentAt=GetTime();local parts={}
 for _,item in ipairs(B.OwnWeapons()) do
  local code=0;for i,state in ipairs(states) do if state==item.status then code=i-1 end end
  parts[#parts+1]=code..','..item.id..','..math.min(86400,item.seconds)
 end
 pcall(C_ChatInfo.SendAddonMessage,B.weaponPrefix,table.concat(parts,';'),'RAID')
end
function B.ReceiveWeapons(prefix,text,channel,sender)
 if prefix~=B.weaponPrefix or channel~='RAID' or not IsInRaid() or type(text)~='string' or #text>90 then return end
 local R=GL.RaidBuffAssignments;local member=R and R.Member(sender);if not member or member.guid==UnitGUID('player') then return end
 local a,b,c,d,e,f=text:match('^(%d),(%d+),(%d+);(%d),(%d+),(%d+)$')
 local nums={tonumber(a),tonumber(b),tonumber(c),tonumber(d),tonumber(e),tonumber(f)};if #nums~=6 then return end
 local items={}
 for i=1,2 do local n=(i-1)*3;local code,id,seconds=nums[n+1],nums[n+2],nums[n+3]
  if code>3 or id>1000000 or seconds>86400 then return end
  items[i]={status=states[code+1],id=id,expires=seconds>0 and (GetTime()+seconds) or nil}
 end
 B.weaponPeers[member.guid]={at=GetTime(),items=items}
end
function B.CheckRelevant(player,category)
 local selected=GL.db.buffCheckRequired or {}
 if selected[category.key]==false then return false end
 if (category.key=='intellect' or category.key=='spirit') and (player.class=='WARRIOR' or player.class=='ROGUE') then return false end
 return true
end
function B.Missing(player)
 local missing,unknown={},{}
 for _,c in ipairs(categories) do if B.CheckRelevant(player,c) then
  local state=(player.status or {})[c.key]
  if state=='missing' then missing[#missing+1]=c.name
  elseif not state or state=='unknown' then unknown[#unknown+1]=c.name end
 end end
 return missing,unknown
end
B.whisperTimes={}
function B.WhisperMissing(guid)
 local R=GL.RaidBuffAssignments
 if not IsInRaid() or not R or not R.CanEdit() then return false,'Nur Raidleitung und Assistenten (A) dürfen erinnern.' end
 local member=R.Member(guid)
 if not member or member.guid==UnitGUID('player') then return false,'Kein anderer Raidspieler ausgewählt.' end
 if B.whisperTimes[guid] and GetTime()-B.whisperTimes[guid]<30 then return false,'Dieser Spieler wurde gerade erinnert (30 Sekunden Pause).' end
 -- Re-read current auras and membership at the click, never whisper from history.
 local player=B.ReadUnit(member.unit);local missing=B.Missing(player)
 if #missing==0 then return false,'Keine sicher erkannten fehlenden Buffs.' end
 local text='GuildBuff: Dir fehlt noch: '..table.concat(missing,', ')..'.'
 if #text>250 then return false,'Zu viele Kategorien; bitte Auswahl eingrenzen.' end
 SendChatMessage(text,'WHISPER',nil,member.name);B.whisperTimes[guid]=GetTime()
 return true,'Erinnerung an '..member.name..' gesendet.'
end
function B.ReadUnit(unit)
 local name,realm=UnitFullName(unit);local _,class=UnitClass(unit)
 local out={player=name or unit,realm=realm or GetRealmName(),guid=UnitGUID(unit),class=class,auras={},status={},details={}}
 local readable=UnitExists(unit) and UnitIsConnected(unit) and UnitIsVisible(unit) and not UnitIsDeadOrGhost(unit)
 if not UnitBuff and not (C_UnitAuras and C_UnitAuras.GetAuraDataByIndex) then readable=false end
 out.readable=readable and true or false
 for _,c in ipairs(categories) do out.status[c.key]=readable and 'missing' or 'unknown' end
 B.ReadWeapons(unit,out)
 if not readable then return out end
 if not next(categoryById) then prepareCategories() end
 for i=1,64 do
  local a=aura(unit,i);if not a then break end
  local remaining=(a.expirationTime or 0)>0 and math.max(0,a.expirationTime-GetTime()) or nil
  out.auras[#out.auras+1]={id=a.spellId,name=a.name,remaining=remaining,duration=a.duration,source=a.sourceUnit and UnitGUID(a.sourceUnit)}
  local category=categoryById[a.spellId] or categoryByName[a.name]
  if category then out.status[category]='present';out.details[category]=out.details[category] or {};out.details[category][#out.details[category]+1]=a.name end
 end
 return out
end
function B.Roster()
 local rows={}
 if IsInRaid() then
  for i=1,GetNumGroupMembers() do
   local unit='raid'..i
   if UnitExists(unit) then local row=B.ReadUnit(unit);row.unit=unit;row.group=select(3,GetRaidRosterInfo(i));rows[#rows+1]=row end
  end
 else local r=B.ReadUnit('player');r.unit='player';r.group=1;rows[1]=r end
 return rows
end
-- Require the explicit buff heading and class header; never search arbitrary
-- occurrences of the player's name in boss assignments or decurse tables.
function B.ParseAssignments(rows,player,realm,class)
 local result={};local heading=false;local column;local started=false
 local wanted=norm(classNames[class]);if wanted=='' or class=='PALADIN' then return result end
 for _,row in ipairs(rows or {}) do
  for _,cell in ipairs(row) do if norm(cell):find('buffeinteilung',1,true) then heading=true;column=nil;started=false end end
  if heading then
   for j,cell in ipairs(row) do if norm(cell)==wanted then column=j end end
   if column then
    local group
    for _,cell in ipairs(row) do local s=norm(cell);group=tonumber(s:match('^grp%.?%s*(%d)$') or s:match('^gruppe%s*(%d)$') or s:match('^group%s*(%d)$'));if group then break end end
    if group and group>=1 and group<=8 then
     started=true;local assigned=norm(row[column])
     if assigned==norm(player) or assigned==norm(player..'-'..realm) then result[group]=true end
    elseif started then break end
   end
  end
 end
 return result
end
function B.ParseTankAssignments(rows,player,realm)
 local tanks,seen={},{};local tankColumn;local healColumns={};local currentTank
 for _,row in ipairs(rows or {}) do
  for _,cell in ipairs(row) do if norm(cell):find('buffeinteilung',1,true) then return tanks end end
  for c,cell in ipairs(row) do
   local value=norm(cell)
   if value=='tanks' and c<=6 then tankColumn=c end
   if value:match('^tankheiler') and c<=6 then healColumns[c]=true end
  end
  if tankColumn and next(healColumns) then
   local value=row[tankColumn]
   if value and norm(value)~='' and norm(value)~='tanks' then currentTank=value end
   for c in pairs(healColumns) do
    local healer=norm(row[c]);if currentTank and (healer==norm(player) or healer==norm(player..'-'..realm)) and not seen[currentTank] then
     tanks[#tanks+1]=currentTank;seen[currentTank]=true
    end
   end
  end
 end
 return tanks
end
local cachedSheets,cachedGuild,cachedSources
function B.Sources()
 local p=(GL.db.guildProfiles or {})[GL.db.selectedGuild] or {};local sheets=(p.activeRaids or {}).sheets or {};local out={}
 if cachedSheets==sheets and cachedGuild==GL.db.selectedGuild then return cachedSources end
 local keys={};for key in pairs(sheets) do keys[#keys+1]=key end;table.sort(keys)
 for _,key in ipairs(keys) do local sheet=sheets[key]
  if sheet.available==1 then
   local tabs=sheet.tabs or {{name=key,rows=sheet.rows}}
   for _,tab in ipairs(tabs) do
    local found=false
    for _,row in ipairs(tab.rows or {}) do for _,cell in ipairs(row) do if norm(cell):find('buffeinteilung',1,true) then found=true end end end
    if found then out[#out+1]={key=tostring(GL.db.selectedGuild)..':'..key..':'..tostring(tab.gid or tab.name),name=key..' · Feste Buffeinteilung',rows=tab.rows,stamp=sheet.exportedAt};break end
   end
  end
 end
 cachedSheets=sheets;cachedGuild=GL.db.selectedGuild;cachedSources=out
 return out
end
function B.Snapshot(reason)
 local r=GL.Active();if not r or not GL.InInstance(r) then return end
 r.buffChecks=r.buffChecks or {}
 if #r.buffChecks>=150 then r.buffCheckLimit=true;return end
 r.buffChecks[#r.buffChecks+1]={at=GetServerTime(),reason=reason,players=B.Roster()}
 return r.buffChecks[#r.buffChecks]
end
-- Only combat-log confirmations caused by the actual player can announce.
local announcements={};local announceStarted,announceLast
local announceCategories={};local groupAnnouncementSpells={}
for _,c in ipairs(categories) do
 if c.key=='fortitude' or c.key=='spirit' or c.key=='intellect' or c.key=='mark' or c.key=='shadow' or c.key=='blessing' then
  for _,id in ipairs(c.ids) do announceCategories[id]=c.key=='blessing' and 'Segen' or c.name end
 end
end
for _,rows in pairs(spells) do for _,ranks in ipairs(rows) do for _,id in ipairs(ranks) do groupAnnouncementSpells[id]=true end end end
-- Own successful casts (UNIT_SPELLCAST_SUCCEEDED for 'player') gate every announcement:
-- the combat log alone can attribute refreshed group buffs to the wrong caster.
local ownCasts={}
function B.RecordOwnCast(unit,spellId)
 if unit=='player' and groupAnnouncementSpells[spellId] then ownCasts[spellId]=GetTime() end
end
function B.ConfirmBuff(kind,source,destination,id)
 if GL.db.buffAnnounce==false or not IsInRaid() or source~=UnitGUID('player') or
    (kind~='SPELL_AURA_APPLIED' and kind~='SPELL_AURA_REFRESH') or not groupAnnouncementSpells[id] then return end
 if not ownCasts[id] or GetTime()-ownCasts[id]>8 then return end
 local group
 for i=1,GetNumGroupMembers() do if UnitGUID('raid'..i)==destination then group=select(3,GetRaidRosterInfo(i));break end end
 if not group then return end
 local name=id
 local row=announcements[name] or {groups={},players={}};announcements[name]=row
 row.groups[group]=true;row.players[destination]=true
 announceStarted=announceStarted or GetTime();announceLast=GetTime()
end
function B.FlushAnnouncements()
 if not announceLast or (GetTime()-announceLast<6 and GetTime()-announceStarted<25) then return end
 local seen={};local groups={}
 for _,row in pairs(announcements) do for group in pairs(row.groups) do seen[group]=true end end
 for group in pairs(seen) do groups[#groups+1]=group end;table.sort(groups)
 if GL.db.buffAnnounce~=false and IsInRaid() and #groups>0 then
  local text=UnitName('player')..' hat '..(#groups==1 and 'Gruppe ' or 'Gruppen ')..table.concat(groups,' und ')..' gebufft.'
  if #text<=250 then SendChatMessage(text,'RAID') end
 end
 announcements={};announceStarted=nil;announceLast=nil
end
function B.WarningLead(id,duration)
 if announceCategories[id]=='Segen' then return 60 end
 if (duration or 0)>=3600 then return 300 end
 return 120
end
local warningSeen={}
function B.Warnings(rows,groups,class,spell)
 if GL.db.buffWarnings==false then return end
 local own=UnitGUID('player');local now=GetTime();local messages={}
 for _,r in ipairs(rows) do
  for _,a in ipairs(r.auras) do
   local mine=r.guid==own
   local assigned=groups[r.group] and a.source==own
   if class=='PALADIN' then assigned=a.source==own and (a.name==spell or announceCategories[a.id]=='Segen') end
   if (mine or assigned) and ((a.duration or 0)>=600 or announceCategories[a.id]=='Segen') and a.remaining and a.remaining>0 and a.remaining<=B.WarningLead(a.id,a.duration) then
    local key=tostring(r.guid)..':'..tostring(a.id or a.name)
    if not warningSeen[key] or now-warningSeen[key]>180 then messages[a.name]=true;warningSeen[key]=now end
   end
  end
 end
 local names={};for name in pairs(messages) do names[#names+1]=safe(name) end;table.sort(names)
 if #names>0 then
  DEFAULT_CHAT_FRAME:AddMessage('|cffdd88ffGuildBuff:|r Läuft bald aus: '..table.concat(names,', '))
  if GL.PlayReminderSound then GL.PlayReminderSound() end
 end
end
local panel,report,quick,sourceIndex,spellIndex= nil,nil,nil,0,1
local configWidgets={};local groupChecks={};local captureConfig=false
local function settings()
 GL.db.buffSelections=GL.db.buffSelections or {};local guid=UnitGUID('player');GL.db.buffSelections[guid]=GL.db.buffSelections[guid] or {};local s=GL.db.buffSelections[guid];if s.mode==nil or s.mode=='sheet' then s.mode='manual' end;return s
end
local buttons={};local lastRows={};local currentGroups={};local selectedSpell;local playerClass
local classes={'WARRIOR','PALADIN','HUNTER','ROGUE','PRIEST','SHAMAN','MAGE','WARLOCK','DRUID'}
local function label(parent,text,x,y,w)
 local f=parent:CreateFontString(nil,'OVERLAY','GameFontNormal');f:SetPoint('TOPLEFT',x,y);f:SetWidth(w);f:SetJustifyH('LEFT');f:SetText(text);if captureConfig and parent==panel then configWidgets[#configWidgets+1]=f end;return f
end
local function control(parent,text,x,y,w,fn)
 local b=CreateFrame('Button',nil,parent);b:SetPoint('TOPLEFT',x,y);b:SetSize(w,26);local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.08,.17,.21,1);b.bg=bg;local title=label(b,text,8,-6,w-16);b.SetText=function(_,value) title:SetText(value) end;b:SetScript('OnClick',fn);if captureConfig and parent==panel then configWidgets[#configWidgets+1]=b end;return b
end
local blessingFamily={}
for family,ids in ipairs({{19740,19834,19835,19836,19837,19838,25291,25782,25916},{19742,19850,19852,19853,19854,25290,25894,25918},{20217,25898},{1038,25895},{20911,20912,20913,20914,25899},{19977,19978,19979,25890,25917}}) do for _,id in ipairs(ids) do blessingFamily[id]=family end end
function B.BlessingStatus(members,spell)
 local remaining,unknown,missing=nil,false,0
 for _,r in ipairs(members) do
  if not r.readable then unknown=true
  else
   local found,best=false,nil
   for _,a in ipairs(r.auras or {}) do if spell and (a.name==spell.name or blessingFamily[a.id] and blessingFamily[a.id]==blessingFamily[spell.id]) then
    found=true;if a.remaining then best=math.max(best or 0,a.remaining) end
   end end
   if not found then missing=missing+1 elseif best then remaining=math.min(remaining or best,best) else unknown=true end
  end
 end
 return remaining,unknown,missing
end
function B.BlessingNeedsAttention(spell,count,remaining,missing)
 return spell~=nil and count>0 and (missing>0 or (remaining~=nil and remaining<=60))
end
function B.BlessingLabel(spell,remaining,unknown,missing,count)
 if not spell then return 'Nicht zugeteilt' end
 local name=spell.name:gsub('^Großer Segen der ',''):gsub('^Großer Segen des ',''):gsub('^Segen der ',''):gsub('^Segen des ','')
 local timer=remaining and string.format('%d:%02d',math.floor(remaining/60),math.floor(remaining%60)) or (count==0 and '–' or unknown and '?' or missing>0 and 'fehlt' or '?')
 return name..' · '..timer..(remaining and unknown and ' ?' or '')
end
local classDetail,detailIndex
local function refreshClassDetail()
 if not classDetail or not classDetail:IsShown() or not detailIndex then return end
 local b=buttons[detailIndex];if not b then return end
 classDetail.title:SetText(LOCALIZED_CLASS_NAMES_MALE[classes[detailIndex]] or classes[detailIndex]);local lines={}
 for _,r in ipairs(b.members or {}) do
  local remaining,unknown,missing=B.BlessingStatus({r},b.assignedSpell)
  lines[#lines+1]=safe(r.player)..': '..safe(B.BlessingLabel(b.assignedSpell,remaining,unknown,missing,1))
 end
 classDetail.content:SetText(#lines>0 and table.concat(lines,'\n\n') or 'Keine Spieler dieser Klasse im Raid.')
end
function B.ToggleClassDetails(index)
 if not classDetail then
  classDetail=CreateFrame('Frame','GuildBuffClassDetails',UIParent,'BackdropTemplate');classDetail:SetSize(230,340);classDetail:SetFrameStrata('DIALOG');classDetail:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});classDetail:SetBackdropColor(.025,.055,.08,.96)
  classDetail.title=label(classDetail,'',10,-10,180);control(classDetail,'×',198,-4,25,function() classDetail:Hide() end)
  local scroll=CreateFrame('ScrollFrame',nil,classDetail,'UIPanelScrollFrameTemplate');scroll:SetPoint('TOPLEFT',10,-38);scroll:SetSize(200,282)
  local body=CreateFrame('Frame',nil,scroll);body:SetSize(196,1500);scroll:SetScrollChild(body)
  classDetail.content=label(body,'',0,0,190);classDetail.content:SetFont(STANDARD_TEXT_FONT,11)
 end
 if detailIndex==index and classDetail:IsShown() then classDetail:Hide();return end
 detailIndex=index;classDetail:ClearAllPoints();classDetail:SetPoint('TOPLEFT',panel,'TOPRIGHT',6,0);classDetail:SetScale(panel:GetScale());classDetail:Show();refreshClassDetail()
end
local function knownSpells(class)
 local out={}
 for _,ranks in ipairs(spells[class] or {}) do for _,id in ipairs(ranks) do
  if IsSpellKnown and IsSpellKnown(id) and spellName(id) then out[#out+1]={id=id,name=spellName(id)};break end
 end end
 return out
end
function B.ClassBlessing(index,options,fallback)
 local id=(settings().classSpells or {})[classes[index]]
 for _,spell in ipairs(options)do if spell.id==id then return spell end end
 return fallback
end
function B.CycleClassBlessing(index)
 if InCombatLockdown()then return false,'Segen bitte außerhalb des Kampfes wechseln.' end
 if select(2,UnitClass('player'))~='PALADIN' or not classes[index]then return false,'Keine Paladin-Klasse ausgewählt.' end
 local options=knownSpells('PALADIN');if #options==0 then return false,'Kein erlernter Segen verfügbar.' end
 local s=settings();local current=options[1];for _,spell in ipairs(options)do if spell.id==s.spell then current=spell end end
 if s.mode=='raid' then current=GL.RaidBuffAssignments and GL.RaidBuffAssignments.AssignedSpell(UnitGUID('player'),index,options)
 else current=B.ClassBlessing(index,options,current)end
 local at=0;for i,spell in ipairs(options)do if current and spell.id==current.id then at=i end end
 local nextSpell=options[at%#options+1]
 if s.mode=='raid' then
  if not GL.RaidBuffAssignments or not GL.RaidBuffAssignments.ChangeOwnBlessing then return false,'Raidübersicht bitte neu öffnen.' end
  local ok,err=GL.RaidBuffAssignments.ChangeOwnBlessing(index,nextSpell.id);if not ok then return false,err end
 else s.classSpells=s.classSpells or {};s.classSpells[classes[index]]=nextSpell.id end
 B.Refresh();return true,nextSpell.name
end
function B.ApplyAppearance()
 local style,cfg
 if GL.Whispers and GL.Whispers.Preferences then local sound;style,sound,cfg=GL.Whispers.Preferences('buff') end
 style=style or {r=.025,g=.055,b=.08};cfg=cfg or {alpha=.96}
 if panel and not InCombatLockdown() then panel:SetBackdropColor(style.r,style.g,style.b,settings().compact and (cfg.compactAlpha or 0) or cfg.alpha) end
 if report then report:SetBackdropColor(style.r,style.g,style.b,cfg.alpha) end
 if quick then quick:SetBackdropColor(style.r,style.g,style.b,cfg.alpha) end
end
local reportChecks,reportIndex,reportCheck
local showReport
local checkTexture='|TInterface\\RaidFrame\\ReadyCheck-Ready:16:16|t'
local function movable(window,key)
 window:SetMovable(true);window:SetClampedToScreen(true);window:EnableMouse(true)
 local pos=settings()[key]
 if pos then window:ClearAllPoints();window:SetPoint(pos.point,UIParent,pos.relative,pos.x,pos.y) end
 local drag=CreateFrame('Frame',nil,window);drag:SetPoint('TOPLEFT',0,0);drag:SetPoint('TOPRIGHT',-135,0);drag:SetHeight(36);drag:EnableMouse(true);drag:RegisterForDrag('LeftButton')
 drag:SetScript('OnDragStart',function() window:StartMoving() end)
 drag:SetScript('OnDragStop',function()
  window:StopMovingOrSizing();local point,_,relative,x,y=window:GetPoint()
  settings()[key]={point=point,relative=relative,x=x,y=y}
 end)
 window.drag=drag
end
local function reportTooltip(widget,text)
 widget:EnableMouse(true);widget:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:AddLine(text(),1,1,1,true);GameTooltip:Show() end)
 widget:SetScript('OnLeave',function() GameTooltip:Hide() end)
end
local function whisperClick(row,notice)
 local _,message=B.WhisperMissing(row.guid);notice:SetText(safe(message))
end
local function canWhisper(player)
 return GL.RaidBuffAssignments and GL.RaidBuffAssignments.CanEdit() and player.guid and player.guid~=UnitGUID('player') and #B.Missing(player)>0
end
local function detailsFor(player,c)
 local names=player.details and player.details[c.key]
 if names and #names>0 then return table.concat(names,', ') end
 local names={}
 for _,a in ipairs(player.auras or {}) do
  if categoryById[a.id]==c.key or categoryByName[a.name]==c.key then names[#names+1]=a.name end
 end
 return table.concat(names,', ')
end
function B.CellText(player,c)
 local state=(player.status or {})[c.key]
 if state=='present' then
  local name=detailsFor(player,c)
  return checkTexture..((c.key=='elixir' or c.key=='flask' or c.key=='food' or c.key=='mainhand' or c.key=='offhand') and ('\n|cff55ee88'..safe(name~='' and name or 'vorhanden')..'|r') or '')
 end
 return state=='missing' and '|cffff7777fehlt|r' or state=='na' and '|cffaaaaaa–|r' or '|cffaaaaaa?|r'
end
function B.RefreshQuick()
 if not quick or not quick:IsShown() then return end
 local players=B.Roster();table.sort(players,function(a,b) if a.group~=b.group then return (a.group or 0)<(b.group or 0) end;return a.player<b.player end)
 for _,row in ipairs(quick.rows) do row:Hide() end
 local shown=0
 for _,player in ipairs(players) do
  local missing,unknown=B.Missing(player)
  if not quick.onlyMissing or #missing>0 or #unknown>0 then
   shown=shown+1;local row=quick.rows[shown]
   if not row then
    row=CreateFrame('Frame',nil,quick.body);row:SetSize(620,48);row:SetPoint('TOPLEFT',0,-(shown-1)*50)
    row.name=label(row,'',2,-4,135);row.summary=label(row,'',140,-3,364);row.summary:SetFont(STANDARD_TEXT_FONT,11)
    row.whisper=control(row,'Flüstern',510,-8,100,function() whisperClick(row,quick.notice) end)
    reportTooltip(row,function() return row.detail or '' end);quick.rows[shown]=row
   end
   row.guid=player.guid;row.name:SetText(safe(player.player)..' · G'..tostring(player.group or '?'))
   row.summary:SetText((#missing>0 and '|cffff7777'..safe(table.concat(missing,', '))..'|r' or #unknown>0 and '|cffaaaaaaNoch nicht vollständig prüfbar|r' or checkTexture..' Alles vorhanden')..(#unknown>0 and '\n|cffaaaaaa? '..safe(table.concat(unknown,', '))..'|r' or ''))
   row.detail='Fehlt: '..safe(table.concat(missing,', '))..'\nNicht prüfbar: '..safe(table.concat(unknown,', '))
   row.whisper:SetEnabled(canWhisper(player) and true or false);row:Show()
  end
 end
 quick.body:SetHeight(math.max(320,shown*50));quick.count:SetText(shown..' / '..#players..' Spieler · Aktualisierung alle 2 Sekunden')
end
function B.ShowQuick()
 if not quick then
  quick=CreateFrame('Frame','GuildBuffQuick',UIParent,'BackdropTemplate');quick:SetSize(660,440);quick:SetPoint('CENTER');quick:SetFrameStrata('DIALOG');quick:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});quick:SetBackdropColor(.025,.055,.08,.96)
  label(quick,'GuildBuff · Raid-Buffcheck (ziehen)',12,-12,480);control(quick,'Schließen',548,-6,100,function() quick:Hide() end);movable(quick,'buffQuickPosition')
  quick.onlyMissing=true;control(quick,'Nur Lücken / Alle',12,-40,155,function() quick.onlyMissing=not quick.onlyMissing;B.RefreshQuick() end)
  control(quick,'Detailansicht',180,-40,125,function() quick:Hide();reportChecks=nil;showReport() end)
  quick.count=label(quick,'',315,-47,330)
  local scroll=CreateFrame('ScrollFrame',nil,quick,'UIPanelScrollFrameTemplate');scroll:SetPoint('TOPLEFT',12,-78);scroll:SetSize(624,310)
  quick.body=CreateFrame('Frame',nil,scroll);quick.body:SetSize(620,320);scroll:SetScrollChild(quick.body);quick.rows={}
  quick.notice=label(quick,'Flüstern: nur Raidleitung / A · ? = nicht prüfbar',12,-408,630)
 end
 if report then report:Hide() end
 quick:Show();B.ApplyAppearance();B.RefreshQuick()
end
showReport=function(check)
 reportCheck=check
 if not next(categoryById) then prepareCategories() end
 if not report then
  report=CreateFrame('Frame','GuildBuffReport',UIParent,'BackdropTemplate');report:SetSize(1110,590);report:SetPoint('CENTER');report:SetFrameStrata('DIALOG')
  if UIParent.GetWidth and UIParent:GetWidth()>0 then report:SetScale(math.min(1,(UIParent:GetWidth()-30)/1110,(UIParent:GetHeight()-30)/590)) end
  report:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});report:SetBackdropColor(.025,.055,.08,.98)
  report.title=label(report,'GuildBuff · Buffübersicht (ziehen)',16,-12,940)
  control(report,'Schließen',995,-8,100,function() report:Hide() end);movable(report,'buffReportPosition')
  label(report,'Spieler / Gruppe',16,-75,156);report.headings={}
  for j,c in ipairs(categories) do
   local x=176+(j-1)*72;local icon=report:CreateTexture(nil,'ARTWORK');icon:SetPoint('TOPLEFT',x+24,-40);icon:SetSize(24,24)
   icon:SetTexture(c.icon or (GetSpellTexture and GetSpellTexture(c.ids[1])) or (GetSpellInfo and select(3,GetSpellInfo(c.ids[1]))) or 'Interface\\Icons\\INV_Misc_QuestionMark')
   local heading=control(report,c.name,x,-70,70,function()
    GL.db.buffCheckRequired=GL.db.buffCheckRequired or {};GL.db.buffCheckRequired[c.key]=GL.db.buffCheckRequired[c.key]==false;showReport(reportCheck);B.RefreshQuick()
   end)
   reportTooltip(heading,function() return c.name..'\nKlicken: für Fehl-Liste und Flüstern ein-/ausschalten.\nGrün = ein, grau = aus. Vorhandene Buffs bleiben sichtbar.' end)
   report.headings[j]=heading
  end
  label(report,'Erinnern',980,-75,110)
  local scroll=CreateFrame('ScrollFrame',nil,report,'UIPanelScrollFrameTemplate');scroll:SetPoint('TOPLEFT',16,-104);scroll:SetSize(1074,408)
  local body=CreateFrame('Frame',nil,scroll);body:SetSize(1066,1);scroll:SetScrollChild(body);report.body=body;report.rows={}
  control(report,'< Früher',16,-523,100,function() if reportChecks then reportIndex=math.max(1,reportIndex-1);showReport(reportChecks[reportIndex]) end end)
  control(report,'Später >',125,-523,100,function() if reportChecks then reportIndex=math.min(#reportChecks,reportIndex+1);showReport(reportChecks[reportIndex]) end end)
  control(report,'Jetzt prüfen',235,-523,120,function() reportChecks=nil;B.Snapshot('Manueller Buffcheck');showReport() end)
  control(report,'Raidansicht',366,-523,120,B.ShowQuick)
  report.notice=label(report,'Flüstern: Raidleitung / A · Spalten anklicken: Auswahl für Fehl-Liste',500,-530,590)
  label(report,'Grüner Haken: vorhanden · Rot: fehlt · ?: nicht prüfbar · –: keine Waffe · Titelleiste ziehen',16,-565,1080)
 end
 report.title:SetText(check and (safe(check.raidName or '')..' · '..date('%H:%M:%S',check.at)..' · '..safe(check.reason)) or 'GuildBuff · Aktueller Buffcheck (ziehen)')
 for j,c in ipairs(categories) do local selected=(GL.db.buffCheckRequired or {})[c.key]~=false;report.headings[j].bg:SetColorTexture(selected and .08 or .18,selected and .3 or .18,selected and .18 or .18,1) end
 for _,row in ipairs(report.rows) do row:Hide() end
 local players=check and check.players or B.Roster()
 for i,player in ipairs(players or {}) do
  local row=report.rows[i]
  if not row then
   row=CreateFrame('Frame',nil,report.body);row:SetPoint('TOPLEFT',0,-(i-1)*64);row:SetSize(1064,62)
   local bg=row:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.08,.17,.21,i%2==0 and .6 or .95)
   row.name=label(row,'',4,-4,152);row.name:SetFont(STANDARD_TEXT_FONT,11);row.cells={}
   for j=1,#categories do local cell=label(row,'',160+(j-1)*72,-4,70);cell:SetFont(STANDARD_TEXT_FONT,10);cell:SetJustifyH('CENTER');cell:SetHeight(56);row.cells[j]=cell end
   row.whisper=control(row,'Flüstern',958,-16,100,function() whisperClick(row,report.notice) end)
   reportTooltip(row,function() return row.detail or '' end);report.rows[i]=row
  end
  row.guid=player.guid;row:Show();row.name:SetText(safe(player.player)..' · G'..tostring(player.group or '?')..'\n'..safe(player.realm))
  local color=RAID_CLASS_COLORS and RAID_CLASS_COLORS[player.class];row.name:SetTextColor(color and color.r or 1,color and color.g or 1,color and color.b or 1)
  local detail={safe(player.player)}
  for j,c in ipairs(categories) do
   row.cells[j]:SetText(B.CellText(player,c));local names=detailsFor(player,c)
   detail[#detail+1]=c.name..': '..(names~='' and safe(names) or (player.status or {})[c.key]=='missing' and 'fehlt' or (player.status or {})[c.key]=='present' and 'vorhanden' or (player.status or {})[c.key]=='na' and 'keine Waffe' or 'nicht prüfbar')
  end
  row.detail=table.concat(detail,'\n');row.whisper:SetEnabled(not check and canWhisper(player) and true or false)
 end
 report.body:SetHeight(math.max(408,#(players or {})*64));B.ApplyAppearance();report:Show()
end
function B.ShowReport() reportChecks=nil;showReport() end
function B.RefreshCheckWindows()
 if report and report:IsShown() and not reportCheck then showReport() end
 B.RefreshQuick()
end
function B.ShowHistory()
 reportChecks={}
 for _,raid in ipairs(GL.db.raids or {}) do if raid.guild==GL.db.selectedGuild then
  for _,check in ipairs(raid.buffChecks or {}) do reportChecks[#reportChecks+1]={raidName=raid.raidName,at=check.at,reason=check.reason,players=check.players} end
 end end
 reportIndex=#reportChecks
 if reportIndex==0 then reportChecks=nil end
 showReport(reportChecks and reportChecks[reportIndex])
end
function B.CompactDimensions(count,spells,vertical,cellWidth,rowHeight)
 count=math.max(1,count);spells=math.max(1,spells)
 return (vertical and spells or count)*(cellWidth or 94)+56,(vertical and count or spells)*(rowHeight or 40)
end
function B.Refresh()
 if not GL.db then return end
 local name,realm=UnitFullName('player');realm=realm or GetRealmName();local _,class=UnitClass('player');playerClass=class
 lastRows=B.Roster()
 local sources=B.Sources();sourceIndex=math.min(sourceIndex,math.max(1,#sources));local source
 local selection=(GL.db.buffSelections or {})[UnitGUID('player')] or {}
 for i,candidate in ipairs(sources) do if candidate.key==selection.source then source=candidate;sourceIndex=i;break end end
 local groups=source and B.ParseAssignments(source.rows,name,realm,class) or {}
 if selection.mode=='manual' then groups=selection.groups or {}
 elseif selection.mode=='raid' then groups=GL.RaidBuffAssignments and GL.RaidBuffAssignments.Groups(UnitGUID('player')) or {} end
 currentGroups=groups
 local options=knownSpells(class);spellIndex=math.min(spellIndex,math.max(1,#options));selectedSpell=options[spellIndex]
 for i,option in ipairs(options) do if option.id==selection.spell then selectedSpell=option;spellIndex=i end end
 if not panel then B.Warnings(lastRows,groups,class,selectedSpell and selectedSpell.name);return end
 panel.title:SetText(safe(name)..' · Buffs');local color=RAID_CLASS_COLORS and RAID_CLASS_COLORS[class];if color then panel.title:SetTextColor(color.r,color.g,color.b) end
 panel.source:SetText(selection.mode=='raid' and 'Raidübersicht öffnen >' or source and (safe(source.name)..' >') or (#sources>0 and 'Bufftabelle auswählen >' or 'Keine Bufftabelle synchronisiert'))
 panel.spell:SetText(selectedSpell and (safe(selectedSpell.name)..' >') or 'Kein erlernter Gruppenbuff')
 panel.info:SetText(selection.mode=='raid' and 'Raid-Zuweisung · Änderungen über Raidübersicht' or selection.mode=='manual' and (class=='PALADIN' and 'Segen wählen · Klassen anklicken zum Buffen' or 'Gruppen links anhaken · Zuordnung bleibt gespeichert') or class=='PALADIN' and 'Segen manuell wählen · Klassen statt Gruppen' or (source and ('Sheet: '..date('%d.%m. %H:%M',source.stamp or 0)) or 'Raidsheet mit Buffeinteilung erforderlich'))
 local combat=InCombatLockdown()
 local compact=selection.compact==true
 local cellWidth=class=='PALADIN' and 146 or 94
 local rowHeight=class=='PALADIN' and 32 or 40
 local vertical=false;if GL.Whispers then local _,_,prefs=GL.Whispers.Preferences('buff');vertical=prefs.orientation=='vertical' end
 local tankNames=source and B.ParseTankAssignments(source.rows,name,realm) or {}
 panel.tanks:SetText(#tankNames>0 and ('Tank: '..safe(table.concat(tankNames,', '))) or '')
 if not combat then
  local count=0;for i=1,(class=='PALADIN' and 9 or 8) do if (class=='PALADIN' and selection.mode~='raid') or groups[i]==true then count=count+1 end end
  local compactWidth,compactHeight=B.CompactDimensions(count,class=='PALADIN' and 1 or #options,vertical,cellWidth,rowHeight)
  panel:SetSize(compact and (compactWidth+(#tankNames>0 and 210 or 0)) or 350,compact and compactHeight or 603)
  panel:SetScale(compact and class=='PALADIN' and .85 or 1);B.ApplyAppearance()
  if classDetail and not compact then classDetail:Hide() end
  panel.title:SetShown(not compact)
  panel.tanks:SetShown(compact and #tankNames>0);panel.tanks:ClearAllPoints();panel.tanks:SetPoint('TOPLEFT',compactWidth+4,-9)
  panel.close:ClearAllPoints();panel.close:SetPoint('TOPLEFT',compact and compactWidth-25 or 312,compact and -7 or -5);panel.close:SetSize(22,24)
  panel.close.bg:SetColorTexture(.08,.17,.21,compact and 0 or 1)
  for _,widget in ipairs(configWidgets) do widget:SetShown(not compact) end
  panel.modeSheet:SetChecked(selection.mode~='manual' and selection.mode~='raid');panel.modeManual:SetChecked(selection.mode=='manual');panel.modeRaid:SetChecked(selection.mode=='raid')
  panel.view:SetText(compact and '' or 'Raidansicht')
  panel.view:ClearAllPoints();panel.view:SetPoint('TOPLEFT',compact and compactWidth-53 or 10,compact and -7 or -568)
  panel.view:SetSize(compact and 24 or 155,26);panel.view.bg:SetColorTexture(.08,.17,.21,compact and 0 or 1);panel.view.gear:SetShown(compact)
  for i,check in ipairs(groupChecks) do check:SetShown(not compact and class~='PALADIN');check:SetChecked(groups[i]==true);check:SetEnabled(selection.mode=='manual') end
 end
 local visibleIndex=0
 for index,b in ipairs(buttons) do
  local groupCount=class=='PALADIN' and 9 or 8
  local i=(index-1)%groupCount+1;local buffRow=math.floor((index-1)/groupCount)
  local buttonSpell=selectedSpell
  if class=='PALADIN' and selection.mode~='raid' then buttonSpell=B.ClassBlessing(i,options,selectedSpell)end
  if compact and class~='PALADIN' then buttonSpell=options[buffRow+1] end
  if selection.mode=='raid' and class=='PALADIN' and GL.RaidBuffAssignments then buttonSpell=GL.RaidBuffAssignments.AssignedSpell(UnitGUID('player'),i,options) end
  local buttonGroups=selection.mode=='raid' and GL.RaidBuffAssignments and GL.RaidBuffAssignments.Groups(UnitGUID('player'),buttonSpell and buttonSpell.id or -1) or groups
  local showButton=(compact and buttonSpell~=nil and ((class=='PALADIN' and selection.mode~='raid') or buttonGroups[i]==true)) or (not compact and buffRow==0)
  if i==1 then visibleIndex=0 end
  if showButton then visibleIndex=visibleIndex+1 end
  local enabled=buttonSpell and ((class=='PALADIN' and selection.mode~='raid') or buttonGroups[i])
  local singleSpell,singleTarget
  for _,id in ipairs(singleBuffRanks[buttonSpell and buttonSpell.id] or {}) do
   if IsSpellKnown and IsSpellKnown(id) and spellName(id) then singleSpell=spellName(id);break end
  end
  local members={};local target;local missingCount=0;local missingNames={};local unknownCount=0;local missing=false;local expiring=false;local unknown=false
  for _,r in ipairs(lastRows) do
   if (class=='PALADIN' and r.class==classes[i]) or (class~='PALADIN' and r.group==i) then
    members[#members+1]=r;local has=false
    for _,a in ipairs(r.auras) do if buttonSpell and (a.name==buttonSpell.name or (class=='PALADIN' and blessingFamily[a.id] and blessingFamily[a.id]==blessingFamily[buttonSpell.id]) or (announceCategories[buttonSpell.id] and announceCategories[buttonSpell.id]~='Segen' and announceCategories[a.id]==announceCategories[buttonSpell.id])) then has=true;if a.remaining and a.remaining<=B.WarningLead(a.id,a.duration) then expiring=true end end end
    if r.readable and not has and not singleTarget and singleSpell and IsSpellInRange(singleSpell,r.unit)==1 then singleTarget=r.unit end
    if not r.readable then unknown=true;unknownCount=unknownCount+1 elseif not has then missing=true;missingCount=missingCount+1;missingNames[#missingNames+1]=safe(r.player or r.unit) end
    if r.readable and buttonSpell and IsSpellInRange(buttonSpell.name,r.unit)==1 then
     if not target or not has then target=r.unit end
    end
   end
  end
  -- Never mutate protected attributes, show/hide, or position during combat.
  if not combat then
   b:SetAttribute('type2',nil);b:SetAttribute('spell2',nil);b:SetAttribute('unit2',nil)
   if class~='PALADIN' and enabled and singleTarget then b:SetAttribute('type2','spell');b:SetAttribute('spell2',singleSpell);b:SetAttribute('unit2',singleTarget) end
   b:SetAttribute('type',nil);b:SetAttribute('type1',nil);b:SetAttribute('spell',nil);b:SetAttribute('unit',nil)
   if enabled and target then b:SetAttribute('type1','spell');b:SetAttribute('spell',buttonSpell.name);b:SetAttribute('unit',target) end
   b:ClearAllPoints();b:SetPoint('TOPLEFT',compact and ((vertical and buffRow or visibleIndex-1)*cellWidth) or 38,compact and (-(vertical and visibleIndex-1 or buffRow)*rowHeight) or (-210-(i-1)*27));b:SetSize(compact and (class=='PALADIN' and 29 or 37) or 300,compact and (class=='PALADIN' and 29 or 37) or 25)
   b.icon:ClearAllPoints();b.icon:SetPoint('LEFT',3,0);b.icon:SetSize(compact and (class=='PALADIN' and 25 or 31) or 22,compact and (class=='PALADIN' and 25 or 31) or 22)
   b.text:ClearAllPoints();b.text:SetPoint('TOPLEFT',compact and (class=='PALADIN' and 33 or 1) or 32,compact and (class=='PALADIN' and -3 or -22) or -5);b.text:SetWidth(compact and (class=='PALADIN' and 110 or 35) or 260)
   b.count:ClearAllPoints();b.count:SetPoint('TOPLEFT',compact and class=='PALADIN' and 33 or 40,compact and class=='PALADIN' and -17 or -10);b.count:SetWidth(class=='PALADIN' and 110 or 54)
   local visibility=showButton and 'show' or 'hide'
   if b.visibilityRule~=visibility then RegisterStateDriver(b,'visibility',visibility);b.visibilityRule=visibility end
   b:SetShown(showButton);b.count:SetShown(compact and showButton)
   b.text:SetFont(STANDARD_TEXT_FONT,compact and class=='PALADIN' and 10 or 12)
   b.count:SetFont(STANDARD_TEXT_FONT,compact and class=='PALADIN' and 9 or 10)
   if b.inspect then b.inspect:SetShown(compact and class=='PALADIN' and showButton) end
  end
  if b.icon then
   -- Paladin blessings target classes in both layouts; the tooltip names the spell.
   local icon
   if class=='PALADIN' and not compact then icon='Interface\\Icons\\ClassIcon_'..classes[i]
   else icon=buttonSpell and ((GetSpellTexture and GetSpellTexture(buttonSpell.id)) or (GetSpellInfo and select(3,GetSpellInfo(buttonSpell.id)))) end
   b.icon:SetTexture(icon or 'Interface\\Icons\\INV_Misc_QuestionMark')
  end
  b.text:SetText(compact and (class=='PALADIN' and ('|TInterface\\Icons\\ClassIcon_'..classes[i]..':12:12|t '..(LOCALIZED_CLASS_NAMES_MALE[classes[i]] or classes[i])) or tostring(i)) or (class=='PALADIN' and (LOCALIZED_CLASS_NAMES_MALE[classes[i]] or classes[i]) or 'Gruppe '..i)..' · '..#members)
  local r,g,blue=.22,.25,.28
  if enabled and #members>0 then if missing then r,g,blue=.55,.1,.13 elseif expiring then r,g,blue=.6,.45,.08 elseif not unknown then r,g,blue=.08,.4,.23 end end
  b.bg:SetColorTexture(r,g,blue,1)
  b.members=members;b.assignedSpell=buttonSpell
  local remaining,timerUnknown,blessingMissing=B.BlessingStatus(members,buttonSpell)
  local alert=enabled and (class=='PALADIN' and B.BlessingNeedsAttention(buttonSpell,#members,remaining,blessingMissing) or class~='PALADIN' and #members>0 and (missing or expiring))
  for _,edge in ipairs(b.alertEdges) do edge:SetAlpha(alert and 1 or 0) end
  b.count:SetText(compact and class=='PALADIN' and B.BlessingLabel(buttonSpell,remaining,timerUnknown,blessingMissing,#members) or (missingCount..' fehlen'..(unknownCount>0 and ' ?' or '')));b.count:SetTextColor(missingCount>0 and 1 or .5,missingCount>0 and .8 or 1,.6)
  local targetLabel=class=='PALADIN' and ('Klasse '..(LOCALIZED_CLASS_NAMES_MALE[classes[i]] or classes[i])) or ('Gruppe '..i)
  local singleHint=class=='PALADIN' and '\nRechtsklick: nächsten erlernten Segen für diese Klasse wählen (außerhalb des Kampfes)' or singleSpell and ('\nRechtsklick: Einzelbuff'..(singleTarget and (' für '..safe(UnitName(singleTarget))) or ' · kein fehlender Buff in Reichweite')) or ''
  b.detail=(#missingNames>0 and ('Fehlt bei: '..table.concat(missingNames,', ')..'\n') or '')..missingCount..' ohne Buff · '..#members..(class=='PALADIN' and ' Spieler dieser Klasse' or ' Spieler in der Gruppe')..(unknownCount>0 and (' · '..unknownCount..' nicht prüfbar') or '')..'\n'..(buttonSpell and safe(buttonSpell.name)..' · '..targetLabel..'\n' or '')..(enabled and 'Linksklick: Gruppenbuff' or 'Keine Zuweisung / kein Gruppenbuff')..singleHint..'\n'..(combat and 'Im Kampf: Ziel bleibt fest. Nach dem Kampf neu zugeordnet.' or (target and ('Ziel: '..safe(UnitName(target))) or 'Kein lebendes Ziel in Reichweite.'))
 end
 refreshClassDetail()
 B.Warnings(lastRows,groups,class,selectedSpell and selectedSpell.name)
end
function GL.ToggleBuffs()
 if select(2,UnitClass('player'))=='WARLOCK' and GL.Soulstone then GL.Soulstone.Toggle();return end
 if InCombatLockdown() then print('GuildBuff: Buffleiste außerhalb des Kampfes öffnen/schließen.');return end
 if panel then if classDetail then classDetail:Hide() end;panel:SetShown(not panel:IsShown());GL.db.buffPanelVisible=panel:IsShown();B.Refresh();return end
 panel=CreateFrame('Frame','GuildBuffPanel',UIParent,'BackdropTemplate');panel:SetSize(310,472);panel:SetPoint('CENTER',UIParent,'CENTER',360,0);panel:SetFrameStrata('MEDIUM')
 panel:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});panel:SetBackdropColor(.025,.055,.08,.96);panel:EnableMouse(true);panel:SetMovable(true);panel:RegisterForDrag('LeftButton')
 panel:SetScript('OnDragStart',function() if not InCombatLockdown() then panel:StartMoving() end end);panel:SetScript('OnDragStop',function() panel:StopMovingOrSizing() end)
 panel.title=label(panel,'GuildBuff · Buffs',10,-10,235)
 panel.tanks=label(panel,'',0,0,200);panel.tanks:SetTextColor(.5,1,.7)
 panel.close=control(panel,'×',272,-5,28,function() GL.ToggleBuffs() end)
 captureConfig=true
 panel.source=control(panel,'Sheet',10,-124,328,function() if settings().mode=='raid' and GL.RaidBuffAssignments then GL.RaidBuffAssignments.Open();return end;if not InCombatLockdown() then local sources=B.Sources();sourceIndex=sourceIndex%math.max(1,#sources)+1;GL.db.buffSelections=GL.db.buffSelections or {};local guid=UnitGUID('player');GL.db.buffSelections[guid]=GL.db.buffSelections[guid] or {};GL.db.buffSelections[guid].source=sources[sourceIndex] and sources[sourceIndex].key;B.Refresh() end end)
 panel.spell=control(panel,'Buff',10,-156,328,function() if not InCombatLockdown() then local options=knownSpells(playerClass);spellIndex=spellIndex%math.max(1,#options)+1;GL.db.buffSelections=GL.db.buffSelections or {};local guid=UnitGUID('player');GL.db.buffSelections[guid]=GL.db.buffSelections[guid] or {};GL.db.buffSelections[guid].classSpells=nil;GL.db.buffSelections[guid].spell=options[spellIndex] and options[spellIndex].id;B.Refresh() end end)
 panel.info=label(panel,'',10,-188,328)
 for i=1,(select(2,UnitClass('player'))=='PALADIN' and 9 or 8*math.max(1,#(spells[select(2,UnitClass('player'))] or {}))) do
  local b=CreateFrame('Button','GuildBuffCast'..i,panel,'SecureActionButtonTemplate');b:SetPoint('TOPLEFT',10,-123-(i-1)*27);b:SetSize(290,25);if select(2,UnitClass('player'))=='PALADIN' then b:RegisterForClicks('LeftButtonUp','LeftButtonDown','RightButtonUp')else b:RegisterForClicks('AnyUp','AnyDown')end
  b:SetScript('PostClick',function(_,which,down)
   if which~='RightButton' or down or select(2,UnitClass('player'))~='PALADIN' then return end
   local ok,message=B.CycleClassBlessing(i);print('|cff79e6c5GuildBuff:|r '..(ok and ((LOCALIZED_CLASS_NAMES_MALE[classes[i]]or classes[i])..': '..message)or message))
  end)
  b.bg=b:CreateTexture(nil,'BACKGROUND');b.bg:SetAllPoints();b.text=label(b,'',32,-5,250);b.count=label(b,'',40,-10,54);b.count:SetFont(STANDARD_TEXT_FONT,10);b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('LEFT',3,0);b.icon:SetSize(22,22)
  -- Texture-only border can update in combat without touching secure attributes.
  b.alertEdges={}
  for _,side in ipairs({'TOP','BOTTOM','LEFT','RIGHT'}) do
   local edge=b:CreateTexture(nil,'OVERLAY');edge:SetColorTexture(1,.05,.05,1)
   if side=='TOP' or side=='BOTTOM' then edge:SetPoint(side..'LEFT',b.icon,side..'LEFT',-1,0);edge:SetPoint(side..'RIGHT',b.icon,side..'RIGHT',1,0);edge:SetHeight(2)
   else edge:SetPoint('TOP'..side,b.icon,'TOP'..side,0,1);edge:SetPoint('BOTTOM'..side,b.icon,'BOTTOM'..side,0,-1);edge:SetWidth(2) end
   edge:SetAlpha(0);b.alertEdges[#b.alertEdges+1]=edge
  end
  b:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:AddLine(self.detail or '',1,1,1,true);GameTooltip:Show() end);b:SetScript('OnLeave',function() GameTooltip:Hide() end)
  RegisterStateDriver(b,'visibility','show');b.visibilityRule='show'
  b.inspect=CreateFrame('Button',nil,panel);b.inspect:SetPoint('TOPLEFT',b,'TOPRIGHT',2,0);b.inspect:SetSize(110,29);b.inspect:Hide()
  b.inspect:SetScript('OnClick',function() B.ToggleClassDetails(i) end)
  b.inspect:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:AddLine('Klicken: Segen pro Spieler anzeigen. Segensicon: buffen. Restzeit = kürzeste erkannte Laufzeit.',1,1,1,true);GameTooltip:Show() end)
  b.inspect:SetScript('OnLeave',function() GameTooltip:Hide() end)
  buttons[i]=b
 end
 control(panel,'Buffcheck',10,-466,155,function() B.Snapshot('Manueller Buffcheck');showReport() end)
 panel.warn=control(panel,'Warnung: an',175,-466,163,function() GL.db.buffWarnings=GL.db.buffWarnings==false;panel.warn:SetText(GL.db.buffWarnings and 'Warnung: an' or 'Warnung: aus') end)
 panel.warn:SetText(GL.db.buffWarnings==false and 'Warnung: aus' or 'Warnung: an')
 control(panel,GL.db.buffAnnounce==false and 'Raidchat: aus' or 'Raidchat: an',10,-498,328,function(self) GL.db.buffAnnounce=GL.db.buffAnnounce==false;self:SetText(GL.db.buffAnnounce and 'Raidchat: an' or 'Raidchat: aus') end)
 label(panel,'Rot: fehlt · Gelb: bald · Grün: erkannt\nGrau: unklar / ohne Auftrag · Ziehen: bewegen',10,-531,328)
 local function modeCheck(text,y,mode)
  local b=CreateFrame('CheckButton',nil,panel,'UICheckButtonTemplate');b:SetPoint('TOPLEFT',10,y);b:SetSize(24,24);label(b,text,28,-5,295);configWidgets[#configWidgets+1]=b
  b:SetScript('OnClick',function() if not InCombatLockdown() then settings().mode=mode;B.Refresh() end end);return b
 end
 panel.modeSheet=modeCheck('Buffeinteilung aus Sheet übernehmen',-34,'sheet')
 panel.modeSheet:Hide()
 panel.modeManual=modeCheck('Buffeinteilung manuell',-62,'manual')
 panel.modeRaid=modeCheck('Buffeinteilung Raid manuell',-90,'raid')
 panel.modeRaid:SetScript('OnClick',function() if not InCombatLockdown() then settings().mode='raid';B.Refresh();if GL.RaidBuffAssignments then GL.RaidBuffAssignments.Open() end end end)
 for i=1,8 do local check=CreateFrame('CheckButton',nil,panel,'UICheckButtonTemplate');check:SetPoint('TOPLEFT',8,-210-(i-1)*27);check:SetSize(24,24);groupChecks[i]=check
  check:SetScript('OnClick',function(self) if not InCombatLockdown() then local selected=settings();selected.groups=selected.groups or {};selected.groups[i]=self:GetChecked()==true;B.Refresh() end end)
 end
 control(panel,'Einstellungen',175,-568,163,function() if GL.Whispers then GL.Whispers.ToggleSettings('buff',panel) end end)
 captureConfig=false
 panel.view=control(panel,'Raidansicht',10,-568,328,function() if not InCombatLockdown() then local selected=settings();selected.compact=not selected.compact;B.Refresh() end end)
 panel.view.gear=panel.view:CreateTexture(nil,'ARTWORK');panel.view.gear:SetAllPoints();panel.view.gear:SetTexture('Interface\\Buttons\\UI-OptionsButton')
 panel.view:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:AddLine('Buff-Einstellungen',1,1,1);GameTooltip:Show() end)
 panel.view:SetScript('OnLeave',function() GameTooltip:Hide() end)
 GL.db.buffPanelVisible=true;B.Refresh()
end
local frame=CreateFrame('Frame');local elapsed=0;local lastCombatCheck=0
for _,e in ipairs({'PLAYER_ENTERING_WORLD','PLAYER_REGEN_ENABLED','PLAYER_REGEN_DISABLED','ENCOUNTER_START','COMBAT_LOG_EVENT_UNFILTERED','CHAT_MSG_ADDON','GROUP_ROSTER_UPDATE','PLAYER_LOGIN','UNIT_SPELLCAST_SUCCEEDED'}) do frame:RegisterEvent(e) end
frame:SetScript('OnEvent',function(_,event,id,name,channel,sender)
 if not GL.db then return end
 if event=='CHAT_MSG_ADDON' then B.ReceiveWeapons(id,name,channel,sender);return end
 if event=='UNIT_SPELLCAST_SUCCEEDED' then B.RecordOwnCast(id,channel);return end
 if event=='PLAYER_LOGIN' or event=='PLAYER_ENTERING_WORLD' then if C_ChatInfo then C_ChatInfo.RegisterAddonMessagePrefix(B.weaponPrefix) end end
 if event=='GROUP_ROSTER_UPDATE' then B.weaponPeers={};B.weaponSentAt=nil;return end
 if event=='COMBAT_LOG_EVENT_UNFILTERED' then local _,kind,_,src,_,_,_,dst,_,_,_,spell=CombatLogGetCurrentEventInfo();B.ConfirmBuff(kind,src,dst,spell);return end
 if event=='PLAYER_REGEN_DISABLED' then if GetTime()-lastCombatCheck>=30 then B.Snapshot('Kampfbeginn');lastCombatCheck=GetTime() end;return end
 if event=='ENCOUNTER_START' then B.Snapshot('Bossbeginn: '..tostring(name or id));return end
 if event=='PLAYER_ENTERING_WORLD' and GL.db.buffPanelVisible and not panel and not (GL.Soulstone and GL.Soulstone.window) and not InCombatLockdown() then GL.ToggleBuffs() end
 B.Refresh()
end)
frame:SetScript('OnUpdate',function(_,dt) elapsed=elapsed+dt;if elapsed<2 then return end;elapsed=0;if GL.db then B.Refresh();B.FlushAnnouncements();B.BroadcastWeapons();B.RefreshCheckWindows() end end)
local old=GL.CaptureStarted
function GL.CaptureStarted(...) if old then old(...) end;B.Snapshot('Aufzeichnung gestartet') end
