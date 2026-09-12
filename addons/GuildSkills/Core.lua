local addonName,GL=...
-- GuildSkills: eigenständige Berufsübersicht aus GuildLoot Era. Läuft komplett lokal ohne Website-Anbindung.
GL.Standalone='GuildSkills'
local classTokens={Krieger='WARRIOR',Paladin='PALADIN',['Jäger']='HUNTER',Schurke='ROGUE',Priester='PRIEST',Schamane='SHAMAN',Magier='MAGE',Hexenmeister='WARLOCK',Hexer='WARLOCK',Druide='DRUID'}
function GL.CharacterIdentity(p)
 if not p then return nil,'' end
 local name,realm=UnitFullName('player');realm=realm and realm~='' and realm or GetRealmName()
 local same=function(a,b) return tostring(a or ''):lower()==tostring(b or ''):lower() end
 if same(p.player,name) and same(p.realm,realm) then local _,token=UnitClass('player');return token,'' end
 local record=GL.db and GL.db.professionCharacters
 if record then for _,r in pairs(record) do if same(r.player,p.player) and same(r.realm,p.realm) and r.classToken then return r.classToken,'' end end end
 return nil,''
end
SLASH_GUILDSKILLS1='/gskills';SLASH_GUILDSKILLS2='/guildskills'
SlashCmdList.GUILDSKILLS=function(msg)
 if not GL.db then print('GuildSkills ist deaktiviert, weil GuildLoot Era aktiv ist.');return end
 msg=tostring(msg or ''):lower():gsub('^%s+',''):gsub('%s+$','')
 if msg=='symbol' or msg=='button' then local shown=GL.ToggleProfessionShortcut();print('|cff79e6c5GuildSkills:|r Berufe-Symbol '..(shown and 'eingeblendet.' or 'ausgeblendet. Mit /gskills symbol wieder einblenden.'))
 else GL.ShowProfessions() end
end
local function addonLoaded(name)
 if C_AddOns and C_AddOns.IsAddOnLoaded then return C_AddOns.IsAddOnLoaded(name) end
 if IsAddOnLoaded then return IsAddOnLoaded(name) end
 return false
end
local frame=CreateFrame('Frame');frame:RegisterEvent('ADDON_LOADED');frame:RegisterEvent('PLAYER_LOGIN')
frame:SetScript('OnEvent',function(self,event,name)
 if event=='ADDON_LOADED' then
  if name~=addonName then return end
  self:UnregisterEvent('ADDON_LOADED')
  if addonLoaded('GuildLootEra') then
   GL.disabled=true
   print('|cffffcc40GuildSkills:|r GuildLoot Era ist aktiv und enthält die Berufsübersicht bereits. GuildSkills bleibt deaktiviert.')
   return
  end
  GuildSkillsDB=GuildSkillsDB or {schema=1}
  if GuildSkillsDB.schema~=1 then print('GuildSkills: Unbekanntes Speicherformat. Addon bitte aktualisieren.');return end
  GL.db=GuildSkillsDB
 elseif event=='PLAYER_LOGIN' then
  if not GL.db then return end
  -- Klasse des eigenen Charakters für die Charakterauswahl merken.
  local record=GL.db.professionCharacters;local player,realm=UnitFullName('player');realm=realm and realm~='' and realm or GetRealmName()
  if record then for _,r in pairs(record) do if tostring(r.player):lower()==tostring(player):lower() and tostring(r.realm):lower()==tostring(realm):lower() then local _,token=UnitClass('player');r.classToken=token end end end
  local s=GL.db.professionShortcuts and GL.db.professionShortcuts[UnitGUID('player') or 'player']
  if not s or s.shown==nil then GL.db.professionShortcuts=GL.db.professionShortcuts or {};GL.db.professionShortcuts[UnitGUID('player') or 'player']={shown=true};if GL.InitializeProfessionShortcut then GL.InitializeProfessionShortcut() end end
  print('|cff79e6c5GuildSkills:|r geladen. /gskills öffnet die Berufsübersicht, /gskills symbol blendet das Symbol ein oder aus.')
 end
end)

-- Fenstergröße der Berufsübersicht (– / + / 1:1 im Fenster), 50 % bis 130 %.
function GL.ProfessionWindowScale() local db=GL.db or {};return math.max(.5,math.min(1.3,tonumber(db.professionWindowScale) or 1)) end
function GL.SetProfessionWindowScale(value) if GL.db then GL.db.professionWindowScale=math.max(.5,math.min(1.3,tonumber(value) or 1)) end end
