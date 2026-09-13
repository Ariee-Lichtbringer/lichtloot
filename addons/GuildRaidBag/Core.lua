local addonName,GL=...
-- GuildRaidBag: eigenständiger Raidcheck aus GuildLoot Era. Läuft komplett lokal ohne Website-Anbindung.
GL.Standalone='GuildRaidBag'
function GL.GuildName(key) return key or '' end
GL.GearSlots={1,2,3,15,5,4,19,9,10,6,7,8,11,12,13,14,16,17,18}
function GL.GearItemID(value)
    local text=tostring(value or '')
    return tonumber(text:match('item:(%d+)') or text:match('^%s*(%d+)%s*$'))
end
function GL.CurrentGear()
    local out={};for _,slot in ipairs(GL.GearSlots) do out[slot]=GetInventoryItemLink('player',slot) end;return out
end
function GL.GearStore()
    GL.db.gearCharacters=GL.db.gearCharacters or {}
    local key=UnitGUID('player');if not key then error('Charakter ist noch nicht geladen.') end
    local store=GL.db.gearCharacters[key]
    if not store then store={sets={}};GL.db.gearCharacters[key]=store end
    if not store.draft then store.draft=GL.CurrentGear() end
    return store
end
function GL.GearSetNames()
    local names={};for name in pairs(GL.GearStore().sets) do names[#names+1]=name end;table.sort(names);return names
end
local function addonLoaded(name)
    -- Geladen oder zum Laden vorgesehen: WoW lädt Addons alphabetisch, dieses Addon also vor GuildLootEra. IsAddOnLoaded allein
    -- war deshalb beim ADDON_LOADED immer falsch, und das Addon lief parallel zu GuildLoot Era (doppelte Meldungen im Raidchat).
    if C_AddOns and C_AddOns.IsAddOnLoaded and C_AddOns.IsAddOnLoaded(name) then return true end
    if IsAddOnLoaded and IsAddOnLoaded(name) then return true end
    local loadable,state
    if C_AddOns and C_AddOns.GetAddOnInfo then local _,_,_,l=C_AddOns.GetAddOnInfo(name);loadable=l elseif GetAddOnInfo then local _,_,_,l=GetAddOnInfo(name);loadable=l end
    if C_AddOns and C_AddOns.GetAddOnEnableState then state=C_AddOns.GetAddOnEnableState(name,UnitName('player')) elseif GetAddOnEnableState then state=GetAddOnEnableState(UnitName('player'),name) end
    return loadable==true and (tonumber(state) or 0)>0
end
local frame=CreateFrame('Frame');frame:RegisterEvent('ADDON_LOADED')
frame:SetScript('OnEvent',function(self,event,name)
    if name~=addonName then return end
    self:UnregisterEvent('ADDON_LOADED')
    if addonLoaded('GuildLootEra') then
        GL.disabled=true
        print('|cffffcc40GuildRaidBag:|r GuildLoot Era ist aktiv und enthält den Raidcheck bereits. GuildRaidBag bleibt deaktiviert.')
        return
    end
    GuildRaidBagDB=GuildRaidBagDB or {schema=1}
    if GuildRaidBagDB.schema~=1 then print('GuildRaidBag: Unbekanntes Speicherformat. Addon bitte aktualisieren.');return end
    GL.db=GuildRaidBagDB
end)
