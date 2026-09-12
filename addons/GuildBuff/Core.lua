local addonName,GL=...
-- GuildBuff: eigenständiger Raid-Buffcheck aus GuildLoot Era. Läuft komplett lokal ohne Website-Anbindung.
GL.Standalone='GuildBuff'
function GL.Active() return nil end
function GL.InInstance() return false end
-- Persönliche Darstellungseinstellungen (je Charakter), entspricht dem Einstellungsfenster aus GuildLoot Era.
local W={};GL.Whispers=W
local backgrounds={{key='blue',name='Dunkelblau',r=.025,g=.045,b=.065},{key='charcoal',name='Anthrazit',r=.035,g=.035,b=.035},{key='warm',name='Warmes Dunkel',r=.09,g=.055,b=.035}}
local sounds={{key='whisper',name='Whisper',id=3081},{key='click',name='Klick',id=856},{key='off',name='Aus'}}
local function chardb() GuildBuffCharDB=GuildBuffCharDB or {};return GuildBuffCharDB end
function W.Preferences()
 local db=chardb();db.buffPreferences=db.buffPreferences or {};local cfg=db.buffPreferences
 local style=backgrounds[1];local sound=sounds[2]
 for _,v in ipairs(backgrounds) do if v.key==cfg.backgroundStyle then style=v end end
 for _,v in ipairs(sounds) do if v.key==cfg.reminderSound then sound=v end end
 cfg.alpha=math.max(0,math.min(1,tonumber(cfg.alpha) or .96));cfg.backgroundStyle=style.key;cfg.reminderSound=sound.key
 return style,sound,cfg
end
function W.ApplyPreferences() if GL.Buffs and GL.Buffs.ApplyAppearance then GL.Buffs.ApplyAppearance() end end
function W.SetPreference(key,value)
 local _,_,cfg=W.Preferences()
 if key=='alpha' then cfg.alpha=math.max(0,math.min(1,tonumber(value) or .96));cfg.compactAlpha=cfg.alpha
 elseif key=='orientation' and (value=='horizontal' or value=='vertical') then cfg.orientation=value
 elseif key=='backgroundStyle' then for _,v in ipairs(backgrounds) do if v.key==value then cfg.backgroundStyle=value end end
 elseif key=='reminderSound' then for _,v in ipairs(sounds) do if v.key==value then cfg.reminderSound=value end end end
 W.ApplyPreferences();if key=='orientation' and GL.Buffs then GL.Buffs.Refresh() end
end
function W.ResetPreferences()
 local _,_,cfg=W.Preferences();cfg.alpha=.96;cfg.backgroundStyle='blue';cfg.reminderSound='click';cfg.compactAlpha=nil;cfg.orientation='horizontal';W.ApplyPreferences()
end
function GL.PlayReminderSound() local _,sound=W.Preferences();if sound.id and PlaySound then PlaySound(sound.id,'SFX') end end
local function label(parent,text,x,y,width)
 local t=parent:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');t:SetPoint('TOPLEFT',x,y);t:SetWidth(width);t:SetJustifyH('LEFT');t:SetText(text);return t
end
local function button(parent,text,x,y,width,fn)
 local b=CreateFrame('Button',nil,parent);b:SetPoint('TOPLEFT',x,y);b:SetSize(width,26)
 local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.20,.26,.9)
 b.label=label(b,text,6,-7,width-12);b:SetScript('OnClick',fn);return b
end
local settingsPanel
function W.ToggleSettings(_,owner)
 if not settingsPanel then
  local p=CreateFrame('Frame',nil,UIParent);settingsPanel=p
  p:SetSize(400,370);p:SetPoint('CENTER');p:SetFrameStrata('DIALOG');p:EnableMouse(true)
  local bg=p:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.025,.035,.05,1)
  label(p,'GuildBuff · Persönliche Einstellungen',14,-14,340)
  button(p,'×',364,-7,26,function() p:Hide() end)
  label(p,'Buff-Erinnerungston',14,-50,360)
  local soundButtons,styleButtons,orientationButtons={},{},{}
  local opacityText=label(p,'',14,-204,340)
  local function refresh()
   local style,sound,cfg=W.Preferences()
   for key,b in pairs(soundButtons) do b.label:SetTextColor(key==sound.key and 1 or .8,key==sound.key and .82 or .86,key==sound.key and .2 or .9) end
   for key,b in pairs(orientationButtons) do b.label:SetTextColor(key==(cfg.orientation or 'horizontal') and 1 or .8,key==(cfg.orientation or 'horizontal') and .82 or .86,key==(cfg.orientation or 'horizontal') and .2 or .9) end
   for key,b in pairs(styleButtons) do b.label:SetTextColor(key==style.key and 1 or .8,key==style.key and .82 or .86,key==style.key and .2 or .9) end
   opacityText:SetText('Hintergrund-Deckkraft: '..math.floor(cfg.alpha*100+.5)..'%')
  end
  for i,v in ipairs(sounds) do local key=v.key;soundButtons[key]=button(p,v.name,14+(i-1)*94,-72,88,function() W.SetPreference('reminderSound',key);refresh() end) end
  button(p,'Test',302,-72,82,function() GL.PlayReminderSound() end)
  label(p,'Nutzt die WoW-Lautstärke für Soundeffekte.',14,-108,370)
  label(p,'Hintergrund',14,-140,360)
  for i,v in ipairs(backgrounds) do local key=v.key;styleButtons[key]=button(p,v.name,14+(i-1)*124,-162,118,function() W.SetPreference('backgroundStyle',key);refresh() end) end
  button(p,'−',14,-228,44,function() local _,_,cfg=W.Preferences();W.SetPreference('alpha',cfg.alpha-.1);refresh() end)
  button(p,'+',64,-228,44,function() local _,_,cfg=W.Preferences();W.SetPreference('alpha',cfg.alpha+.1);refresh() end)
  label(p,'0% durchsichtig · 100% deckend',124,-236,260)
  orientationButtons.horizontal=button(p,'Icons: horizontal',14,-270,180,function() W.SetPreference('orientation','horizontal');refresh() end)
  orientationButtons.vertical=button(p,'Icons: vertikal',204,-270,180,function() W.SetPreference('orientation','vertical');refresh() end)
  button(p,'Standard',14,-313,110,function() W.ResetPreferences();refresh() end)
  button(p,'Fertig',274,-313,110,function() p:Hide() end)
  label(p,'Wird automatisch für diesen Charakter gespeichert.',14,-350,376)
  p.refresh=refresh;p:SetClampedToScreen(true);p:SetScript('OnShow',refresh);p:Hide()
 end
 if settingsPanel:IsShown() then settingsPanel:Hide() else settingsPanel:ClearAllPoints();settingsPanel:SetPoint('CENTER',owner or UIParent,'CENTER');settingsPanel.refresh();settingsPanel:Show() end
end
-- Startsymbol und Slash-Befehle
local launcher
local function createLauncher()
 if launcher or not GL.db then return end
 local b=CreateFrame('Button','GuildBuffLauncher',UIParent);launcher=b
 b:SetSize(36,36);b:SetFrameStrata('MEDIUM');b:SetMovable(true);b:SetClampedToScreen(true);b:EnableMouse(true);b:RegisterForDrag('LeftButton')
 local p=GL.db.launcherPosition
 if p and p.point and tonumber(p.x) and tonumber(p.y) then b:SetPoint(p.point,UIParent,p.relativePoint or p.point,p.x,p.y) else b:SetPoint('CENTER',UIParent,'CENTER',110,0) end
 local icon=b:CreateTexture(nil,'ARTWORK');icon:SetAllPoints();icon:SetTexture('Interface\\AddOns\\GuildBuff\\Media\\GuildBuff')
 b:SetHighlightTexture('Interface\\Buttons\\ButtonHilight-Square','ADD')
 b:SetScript('OnDragStart',function(self) self.dragging=true;self:StartMoving() end)
 b:SetScript('OnDragStop',function(self) self:StopMovingOrSizing();local point,_,relativePoint,x,y=self:GetPoint();GL.db.launcherPosition={point=point,relativePoint=relativePoint,x=x,y=y};self.suppressClick=true;self.dragging=false end)
 b:SetScript('OnMouseDown',function(self) self.suppressClick=false end)
 b:SetScript('OnClick',function(self) if self.dragging or self.suppressClick then self.suppressClick=false;return end;GL.ToggleBuffs() end)
 b:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('GuildBuff');GameTooltip:AddLine('Klicken: Buffleiste öffnen/schließen · Ziehen: verschieben · /gbuff',1,1,1);GameTooltip:Show() end)
 b:SetScript('OnLeave',function() GameTooltip:Hide() end)
 b:SetShown(GL.db.launcherShown~=false)
end
function GL.ToggleLauncher()
 createLauncher();if not launcher then return end
 GL.db.launcherShown=not launcher:IsShown();launcher:SetShown(GL.db.launcherShown)
 print('|cff79e6c5GuildBuff:|r Startsymbol '..(GL.db.launcherShown and 'eingeblendet.' or 'ausgeblendet. Mit /gbuff symbol wieder einblenden.'))
end
SLASH_GUILDBUFF1='/gbuff';SLASH_GUILDBUFF2='/guildbuff'
SlashCmdList.GUILDBUFF=function(msg)
 if not GL.db then print('GuildBuff ist deaktiviert, weil GuildLoot Era aktiv ist.');return end
 msg=tostring(msg or ''):lower():gsub('^%s+',''):gsub('%s+$','')
 if msg=='symbol' or msg=='button' then GL.ToggleLauncher() elseif msg=='plan' and GL.RaidBuffAssignments then GL.RaidBuffAssignments.Open() else GL.ToggleBuffs() end
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
   print('|cffffcc40GuildBuff:|r GuildLoot Era ist aktiv und enthält den Buffcheck bereits. GuildBuff bleibt deaktiviert.')
   return
  end
  GuildBuffDB=GuildBuffDB or {schema=1}
  if GuildBuffDB.schema~=1 then print('GuildBuff: Unbekanntes Speicherformat. Addon bitte aktualisieren.');return end
  GL.db=GuildBuffDB;chardb()
 elseif event=='PLAYER_LOGIN' then
  if GL.db then createLauncher();print('|cff79e6c5GuildBuff:|r geladen. /gbuff öffnet die Buffleiste, /gbuff plan die Buffeinteilung.') end
 end
end)
