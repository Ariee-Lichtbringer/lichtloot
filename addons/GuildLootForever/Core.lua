local addon = ...
local db
local function say(message) print('|cffffcc00GuildLoot Forever:|r '..message) end
local function quote(s)
  return '"'..tostring(s):gsub('[%z\1-\31\\"]', function(c)
    return string.format('\\u%04x', string.byte(c))
  end)..'"'
end
local function hex(s) return (s:gsub('.', function(c) return string.format('%02x',string.byte(c)) end)) end
local pending={}
local function emit(o)
  local getInfo=(C_Item and C_Item.GetItemInfo) or GetItemInfo
  local values=getInfo and {getInfo(o.link)} or {}
  local metadata={locale=GetLocale()}
  local keys={[3]='quality',[4]='itemLevel',[5]='requiredLevel',[6]='itemType',[7]='itemSubType',[9]='equipLoc',[10]='iconId',[12]='classId',[13]='subclassId'}
  local fields={}
  for index,key in pairs(keys) do
    local v=values[index]
    if type(v)=='number' or type(v)=='string' then metadata[key]=v end
  end
  for key,value in pairs(metadata) do
    fields[#fields+1]=quote(key)..':'..(type(value)=='number' and tostring(value) or quote(value))
  end
  table.sort(fields)
  local meta='{'..table.concat(fields,',')..'}'
  local key=o.build..':'..o.guid..':'..o.itemId
  local signature=tostring(o.quantity)..meta
  if db.seen[key]==signature then return end
  if #db.events>=20000 then error('Speicher voll. Erst exportieren, dann /gfl clear CONFIRM verwenden.') end
  local json='{"version":1,"game":"forever","sourceGuid":'..quote(o.guid)..',"itemId":'..o.itemId..',"quantity":'..o.quantity..',"itemName":'..quote(values[1] or o.name)..',"itemLink":'..quote(o.link)..',"sourceName":'..quote(o.sourceName)..',"zoneName":'..quote(o.zone)..',"instanceId":'..o.instance..',"clientBuild":'..quote(o.build)..',"metadata":'..meta..',"observedAt":'..o.at..'}'
  table.insert(db.events,'GFL1:'..hex(json));db.seen[key]=signature
  if not values[1] then
    pending[o.itemId]=pending[o.itemId] or {};pending[o.itemId][key]=o
    if C_Item and C_Item.RequestLoadItemDataByID then C_Item.RequestLoadItemDataByID(o.itemId) end
  end
  say(o.name..' erfasst. /reload speichert für den Upload.')
end
local function capture()
  if not db or db.paused then return end
  local version,build=GetBuildInfo()
  if not version:match('^1%.60%.') then error('Dieser Client ist nicht als Forever 1.60 erkannt. Erfassung gestoppt.') end
  if not GetLootSourceInfo or not GetLootSlotLink or not GetLootSlotInfo then error('Loot-API fehlt in diesem Client.') end
  local zone,_,_,_,_,_,_,instance=GetInstanceInfo()
  local observations={}
  for slot=1,GetNumLootItems() do
    local link=GetLootSlotLink(slot)
    if link then
      local itemId=tonumber(link:match('item:(%d+)'))
      local _,name=GetLootSlotInfo(slot)
      local sources={GetLootSourceInfo(slot)}
      if itemId and name then
        for i=1,(sources[1] or 0) do
          local guid,quantity=sources[i*2],sources[i*2+1]
          if type(guid)=='string' and (guid:match('^Creature%-') or guid:match('^Vehicle%-') or guid:match('^GameObject%-')) and type(quantity)=='number' and quantity>0 then
            local key=guid..':'..itemId
            if not observations[key] then
              local sourceName=''
              if UnitGUID('target')==guid then sourceName=UnitName('target') or '' end
              observations[key]={guid=guid,itemId=itemId,name=name,link=link,quantity=0,sourceName=sourceName,zone=zone or GetZoneText() or '',instance=instance or 0,build=version..'.'..build,at=time()}
            end
            observations[key].quantity=observations[key].quantity+quantity
          end
        end
      end
    end
  end
  for _,o in pairs(observations) do emit(o) end
end
local exportFrame
local function export()
  if not exportFrame then
    exportFrame=CreateFrame('Frame',nil,UIParent,'BasicFrameTemplateWithInset')
    exportFrame:SetSize(660,420);exportFrame:SetPoint('CENTER');exportFrame.TitleText:SetText('Forever Loot – Export kopieren')
    local scroll=CreateFrame('ScrollFrame',nil,exportFrame,'UIPanelScrollFrameTemplate')
    scroll:SetPoint('TOPLEFT',16,-36);scroll:SetPoint('BOTTOMRIGHT',-34,16)
    local edit=CreateFrame('EditBox',nil,scroll);edit:SetMultiLine(true);edit:SetFontObject(ChatFontNormal);edit:SetWidth(590);edit:SetAutoFocus(false)
    edit:SetScript('OnEscapePressed',function() exportFrame:Hide() end)
    scroll:SetScrollChild(edit);exportFrame.edit=edit
  end
  exportFrame:Show();exportFrame.edit:SetText(table.concat(db.events,'\n'));exportFrame.edit:SetFocus();exportFrame.edit:HighlightText()
end
SLASH_GUILDLOOTFOREVER1='/gfl'
SlashCmdList.GUILDLOOTFOREVER=function(message)
  if not db then return end
  local command,arg=message:match('^(%S+)%s*(.-)$')
  if command=='start' then db.paused=false;say('Itemerfassung aktiv; keine Raid-ID erforderlich.')
  elseif command=='stop' then db.paused=true;say('Itemerfassung pausiert; Protokoll bleibt gespeichert.')
  elseif command=='export' then export()
  elseif command=='clear' and arg=='CONFIRM' then db.events={};db.seen={};say('Lokales Protokoll geleert. Bereits hochgeladene Daten bleiben erhalten.')
  else say((db.paused and 'Pausiert' or 'Aktiv')..' · '..#db.events..' Einträge. /gfl start · /gfl stop · /gfl export · /reload. Leeren nach gesichertem Upload: /gfl clear CONFIRM') end
end
local frame=CreateFrame('Frame')
frame:RegisterEvent('ADDON_LOADED');frame:RegisterEvent('LOOT_OPENED');frame:RegisterEvent('GET_ITEM_INFO_RECEIVED')
frame:SetScript('OnEvent',function(_,event,name,success)
  if event=='ADDON_LOADED' and name==addon then
    GuildLootForeverDB=GuildLootForeverDB or {events={},seen={}}
    db=GuildLootForeverDB;db.events=db.events or {};db.seen=db.seen or {}
    say('Automatische Itemerfassung bereit. /gfl zeigt den Status.')
  elseif event=='GET_ITEM_INFO_RECEIVED' and success and pending[name] then
    local entries=pending[name];pending[name]=nil
    for _,o in pairs(entries) do local ok,err=pcall(emit,o);if not ok then say('Itemdaten: '..tostring(err)) end end
  elseif event=='LOOT_OPENED' then
    local ok,err=pcall(capture)
    if not ok then say('Erfassung nicht möglich: '..tostring(err)) end
  end
end)
