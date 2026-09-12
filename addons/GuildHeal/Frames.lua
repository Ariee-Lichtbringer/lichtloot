local addonName,GH=...
-- Heilerframes: SecureGroupHeader mit SecureUnitButtons, Klickzauber über Attribute, Anzeige über Events.
local anchor,header,driver
local buttons,byUnit={},{}
local pendingAttributes,pendingLayout=false,false
local BAR='Interface\\TargetingFrame\\UI-StatusBar'

local function unitOf(button) return button:GetAttribute('unit') end

-- Sichtbare Werte eines Buttons aktualisieren (in Kämpfen erlaubt: Texte, Farben, Alpha, Texturen).
local function updateHealth(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local hp,max=UnitHealth(unit),UnitHealthMax(unit);if max<=0 then max=1 end
 button.health:SetMinMaxValues(0,max);button.health:SetValue(hp)
 local db=GH.DB()
 if UnitIsDeadOrGhost(unit) then button.deficit:SetText(UnitIsGhost(unit) and 'Geist' or 'Tot');button.health:SetValue(0)
 elseif not UnitIsConnected(unit) then button.deficit:SetText('Offline')
 else local missing=max-hp;button.deficit:SetText(missing>0 and ('-'..GH.Short(missing)) or '') end
 if db.showIncoming and UnitGetIncomingHeals then
  local incoming=UnitGetIncomingHeals(unit) or 0
  if incoming>0 and hp<max then
   local width=button.health:GetWidth();local start=width*hp/max;local extra=math.min(width-start,width*incoming/max)
   button.incoming:ClearAllPoints();button.incoming:SetPoint('TOPLEFT',button.health,'TOPLEFT',start,0);button.incoming:SetPoint('BOTTOMLEFT',button.health,'BOTTOMLEFT',start,0);button.incoming:SetWidth(math.max(1,extra));button.incoming:Show()
  else button.incoming:Hide() end
 else button.incoming:Hide() end
end
local function updatePower(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 if not GH.DB().showMana then button.power:Hide();return end
 local max=UnitPowerMax(unit);button.power:SetMinMaxValues(0,max>0 and max or 1);button.power:SetValue(UnitPower(unit));button.power:SetStatusBarColor(GH.PowerColor(unit));button.power:Show()
end
local function updateName(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local name=UnitName(unit) or '?';button.name:SetText(name)
 local r,g,b=GH.ClassColor(unit)
 if GH.DB().classColors then button.health:SetStatusBarColor(r,g,b);button.name:SetTextColor(1,1,1) else button.health:SetStatusBarColor(.2,.75,.3);button.name:SetTextColor(r,g,b) end
end
local function debuffAt(unit,i)
 if UnitDebuff then return UnitDebuff(unit,i) end
 local a=C_UnitAuras and C_UnitAuras.GetDebuffDataByIndex and C_UnitAuras.GetDebuffDataByIndex(unit,i)
 if a then return a.name,a.icon,a.applications,a.dispelName end
end
local function updateDebuffs(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local db=GH.DB();local dispel=GH.DISPEL[GH.PlayerClass()] or {}
 local shown,color
 if db.showDebuffs then
  local fallback
  for i=1,40 do
   local name,icon,count,kind=debuffAt(unit,i);if not name then break end
   if kind and dispel[kind] then shown={icon=icon,count=count};color=GH.DEBUFF_COLORS[kind];break end
   if not fallback and icon then fallback={icon=icon,count=count} end
  end
  shown=shown or fallback
 end
 if shown then button.debuff:SetTexture(shown.icon);button.debuff:Show();button.debuffCount:SetText((shown.count or 0)>1 and shown.count or '') else button.debuff:Hide();button.debuffCount:SetText('') end
 if color then button.border:SetColorTexture(color[1],color[2],color[3],.9);button.border:Show();button.borderKind='debuff'
 elseif button.borderKind=='debuff' then button.border:Hide();button.borderKind=nil end
end
local function updateThreat(button)
 local unit=unitOf(button);if not unit or not UnitThreatSituation then return end
 local status=UnitThreatSituation(unit)
 if status and status>=2 then button.aggro:Show() else button.aggro:Hide() end
end
local function updateTarget(button)
 local unit=unitOf(button);if not unit then return end
 if UnitIsUnit(unit,'target') then button.target:Show() else button.target:Hide() end
end
local function updateRange(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local inRange
 if UnitIsUnit(unit,'player') then inRange=true
 else
  local spell=button.rangeSpell
  if spell then local r=IsSpellInRange(spell,unit);if r==1 then inRange=true elseif r==0 then inRange=false end end
  if inRange==nil then local ok,checked=UnitInRange(unit);if checked then inRange=ok else inRange=true end end
 end
 button:SetAlpha(inRange and 1 or GH.DB().fadeRange)
end
local function updateAll(button) updateName(button);updateHealth(button);updatePower(button);updateDebuffs(button);updateThreat(button);updateTarget(button);updateRange(button) end

-- Grafik eines neuen Buttons aufbauen (aus initialConfigFunction über CallMethod).
local function styleButton(button)
 local db=GH.DB()
 button:SetSize(db.width,db.height)
 button.bg=button:CreateTexture(nil,'BACKGROUND');button.bg:SetAllPoints();button.bg:SetColorTexture(.05,.07,.1,.92)
 button.border=button:CreateTexture(nil,'BACKGROUND',nil,-1);button.border:SetPoint('TOPLEFT',-2,2);button.border:SetPoint('BOTTOMRIGHT',2,-2);button.border:SetColorTexture(1,1,1,.8);button.border:Hide()
 button.health=CreateFrame('StatusBar',nil,button);button.health:SetStatusBarTexture(BAR);button.health:SetPoint('TOPLEFT',1,-1);button.health:SetPoint('BOTTOMRIGHT',-1,db.showMana and 4 or 1)
 local hbg=button.health:CreateTexture(nil,'BACKGROUND');hbg:SetAllPoints();hbg:SetColorTexture(.15,.1,.1,.8)
 button.incoming=button.health:CreateTexture(nil,'ARTWORK',nil,1);button.incoming:SetColorTexture(.4,.9,.5,.45);button.incoming:Hide()
 button.power=CreateFrame('StatusBar',nil,button);button.power:SetStatusBarTexture(BAR);button.power:SetPoint('BOTTOMLEFT',1,1);button.power:SetPoint('BOTTOMRIGHT',-1,1);button.power:SetHeight(3)
 button.name=button.health:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');button.name:SetPoint('TOPLEFT',4,-3);button.name:SetPoint('RIGHT',-24,0);button.name:SetJustifyH('LEFT');button.name:SetWordWrap(false)
 button.deficit=button.health:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');button.deficit:SetPoint('BOTTOMRIGHT',-3,2);button.deficit:SetTextColor(1,.85,.4)
 button.debuff=button:CreateTexture(nil,'OVERLAY');button.debuff:SetSize(14,14);button.debuff:SetPoint('TOPRIGHT',-3,-3);button.debuff:Hide()
 button.debuffCount=button:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');button.debuffCount:SetPoint('CENTER',button.debuff,'BOTTOMRIGHT',-2,2)
 button.target=button:CreateTexture(nil,'OVERLAY');button.target:SetPoint('TOPLEFT',0,0);button.target:SetPoint('BOTTOMRIGHT',0,0);button.target:SetColorTexture(1,1,1,.18);button.target:Hide()
 button.aggro=button:CreateTexture(nil,'BACKGROUND',nil,-2);button.aggro:SetPoint('TOPLEFT',-3,3);button.aggro:SetPoint('BOTTOMRIGHT',3,-3);button.aggro:SetColorTexture(1,.15,.15,.9);button.aggro:Hide()
 button:SetScript('OnEnter',function(self) local unit=unitOf(self);if unit then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetUnit(unit);GameTooltip:Show() end end)
 button:SetScript('OnLeave',function() GameTooltip:Hide() end)
 button:SetScript('OnAttributeChanged',function(self,name) if name=='unit' then GH.RefreshUnitMap();updateAll(self) end end)
 button.styled=true
end
function GH.RefreshUnitMap()
 wipe(byUnit)
 for _,button in ipairs(buttons) do local unit=unitOf(button);if unit and button:IsShown() then byUnit[unit]=byUnit[unit] or {};table.insert(byUnit[unit],button) end end
end

-- Klickzauber als Attribute setzen (nur außerhalb des Kampfes möglich).
local function bindingAttributes()
 local attrs={};local bindings=GH.Bindings();local rangeSpell
 for _,b in ipairs(GH.BINDINGS) do
  local id=GH.BindingId(b);local value=bindings[id];local prefix=b.mod
  local typeKey,spellKey=prefix..'type'..b.key,prefix..'spell'..b.key
  if value=='target' then attrs[typeKey]='target';attrs[spellKey]=nil
  elseif value=='menu' then attrs[typeKey]='togglemenu';attrs[spellKey]=nil
  elseif value=='focus' then attrs[typeKey]='focus';attrs[spellKey]=nil
  elseif type(value)=='number' and GH.Known(value) then attrs[typeKey]='spell';attrs[spellKey]=GH.SpellName(value);if not rangeSpell and prefix=='' then rangeSpell=attrs[spellKey] end
  elseif type(value)=='string' and value~='' and GetSpellInfo(value) then attrs[typeKey]='spell';attrs[spellKey]=value;if not rangeSpell and prefix=='' then rangeSpell=value end
  else attrs[typeKey]=nil;attrs[spellKey]=nil end
 end
 return attrs,rangeSpell
end
local function configFunction(attrs)
 local db=GH.DB();local lines={('self:SetWidth(%d);self:SetHeight(%d)'):format(db.width,db.height)}
 for k,v in pairs(attrs) do lines[#lines+1]=('self:SetAttribute(%q,%q)'):format(k,v) end
 lines[#lines+1]="self:GetParent():CallMethod('InitButton',self:GetName())"
 return table.concat(lines,'\n')
end
function GH.ApplyBindings()
 if not header then return end
 if InCombatLockdown() then pendingAttributes=true;return end
 local attrs,rangeSpell=bindingAttributes()
 header:SetAttribute('initialConfigFunction',configFunction(attrs))
 local clicks=GH.DB().castOnDown and 'AnyDown' or 'AnyUp'
 for _,button in ipairs(buttons) do
  for _,b in ipairs(GH.BINDINGS) do local p=b.mod;button:SetAttribute(p..'type'..b.key,nil);button:SetAttribute(p..'spell'..b.key,nil) end
  for k,v in pairs(attrs) do button:SetAttribute(k,v) end
  button:RegisterForClicks(clicks);button.rangeSpell=rangeSpell
 end
 header.rangeSpell=rangeSpell
 if GH.ConfigRefresh then GH.ConfigRefresh() end
end

-- Layout (Größe, Richtung, Position) anwenden; nur außerhalb des Kampfes.
function GH.ApplyLayout()
 if not header then return end
 if InCombatLockdown() then pendingLayout=true;return end
 local db=GH.DB()
 anchor:SetScale(db.scale or 1)
 anchor:ClearAllPoints()
 if db.position then anchor:SetPoint(db.position.point or 'CENTER',UIParent,db.position.point or 'CENTER',db.position.x or 0,db.position.y or 0) else anchor:SetPoint('CENTER',UIParent,'CENTER',0,-220) end
 header:ClearAllPoints()
 if db.horizontal then
  header:SetAttribute('point','TOP');header:SetAttribute('xOffset',0);header:SetAttribute('yOffset',-3)
  header:SetAttribute('columnAnchorPoint','LEFT');header:SetAttribute('columnSpacing',4)
  header:SetPoint('TOPLEFT',anchor,'BOTTOMLEFT',0,-2)
 else
  header:SetAttribute('point','LEFT');header:SetAttribute('xOffset',3);header:SetAttribute('yOffset',0)
  header:SetAttribute('columnAnchorPoint','TOP');header:SetAttribute('columnSpacing',4)
  header:SetPoint('TOPLEFT',anchor,'BOTTOMLEFT',0,-2)
 end
 header:SetAttribute('unitsPerColumn',5);header:SetAttribute('maxColumns',8)
 header:SetAttribute('showSolo',not db.hideSolo)
 for _,button in ipairs(buttons) do
  button:SetSize(db.width,db.height)
  button.health:SetPoint('BOTTOMRIGHT',-1,db.showMana and 4 or 1)
  updateAll(button)
 end
 GH.ApplyBindings()
 anchor:EnableMouse(not db.locked);anchor.label:SetShown(not db.locked);anchor.bg:SetShown(not db.locked)
 anchor:SetSize(db.locked and 1 or math.max(120,db.width),db.locked and 1 or 16)
end

local function onEvent(_,event,unit,...)
 if event=='PLAYER_REGEN_ENABLED' then
  if pendingLayout then pendingLayout=false;GH.ApplyLayout() elseif pendingAttributes then pendingAttributes=false;GH.ApplyBindings() end
  return
 end
 if event=='PLAYER_TARGET_CHANGED' then for _,button in ipairs(buttons) do updateTarget(button) end;return end
 if event=='GROUP_ROSTER_UPDATE' or event=='PLAYER_ENTERING_WORLD' then GH.RefreshUnitMap();for _,button in ipairs(buttons) do updateAll(button) end;return end
 if event=='SPELLS_CHANGED' or event=='LEARNED_SPELL_IN_TAB' then GH.ApplyBindings();return end
 local list=unit and byUnit[unit];if not list then return end
 for _,button in ipairs(list) do
  if event=='UNIT_HEALTH' or event=='UNIT_MAXHEALTH' or event=='UNIT_HEAL_PREDICTION' or event=='UNIT_CONNECTION' then updateHealth(button)
  elseif event=='UNIT_POWER_UPDATE' or event=='UNIT_MAXPOWER' or event=='UNIT_DISPLAYPOWER' or event=='UNIT_POWER_FREQUENT' then updatePower(button)
  elseif event=='UNIT_AURA' then updateDebuffs(button)
  elseif event=='UNIT_THREAT_SITUATION_UPDATE' then updateThreat(button)
  elseif event=='UNIT_NAME_UPDATE' then updateName(button) end
 end
end

function GH.Initialize()
 if header then return end
 local db=GH.DB()
 anchor=CreateFrame('Frame','GuildHealAnchor',UIParent);anchor:SetSize(120,16);anchor:SetMovable(true);anchor:SetClampedToScreen(true);anchor:RegisterForDrag('LeftButton');anchor:SetFrameStrata('LOW')
 anchor.bg=anchor:CreateTexture(nil,'BACKGROUND');anchor.bg:SetAllPoints();anchor.bg:SetColorTexture(.16,.6,.55,.85)
 anchor.label=anchor:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');anchor.label:SetPoint('CENTER');anchor.label:SetText('GuildHeal · ziehen, /gheal lock sperrt')
 anchor:SetScript('OnDragStart',function(self) if not GH.DB().locked then self:StartMoving() end end)
 anchor:SetScript('OnDragStop',function(self) self:StopMovingOrSizing();local point,_,_,x,y=self:GetPoint();GH.DB().position={point=point,x=x,y=y} end)
 header=CreateFrame('Frame','GuildHealHeader',anchor,'SecureGroupHeaderTemplate')
 header:SetAttribute('template','SecureUnitButtonTemplate')
 header:SetAttribute('showRaid',true);header:SetAttribute('showParty',true);header:SetAttribute('showPlayer',true);header:SetAttribute('showSolo',true)
 header:SetAttribute('groupBy','GROUP');header:SetAttribute('groupingOrder','1,2,3,4,5,6,7,8');header:SetAttribute('sortMethod','INDEX')
 function header:InitButton(name)
  local button=_G[name];if not button or button.styled then return end
  styleButton(button);table.insert(buttons,button)
  button:RegisterForClicks(GH.DB().castOnDown and 'AnyDown' or 'AnyUp');button.rangeSpell=header.rangeSpell
  GH.RefreshUnitMap();updateAll(button)
 end
 header:SetAttribute('initialConfigFunction',configFunction(select(1,bindingAttributes())))
 driver=CreateFrame('Frame')
 for _,e in ipairs({'UNIT_HEALTH','UNIT_MAXHEALTH','UNIT_POWER_UPDATE','UNIT_MAXPOWER','UNIT_DISPLAYPOWER','UNIT_AURA','UNIT_CONNECTION','UNIT_NAME_UPDATE','PLAYER_TARGET_CHANGED','GROUP_ROSTER_UPDATE','PLAYER_ENTERING_WORLD','PLAYER_REGEN_ENABLED','SPELLS_CHANGED','LEARNED_SPELL_IN_TAB'}) do pcall(driver.RegisterEvent,driver,e) end
 pcall(driver.RegisterEvent,driver,'UNIT_HEAL_PREDICTION');pcall(driver.RegisterEvent,driver,'UNIT_THREAT_SITUATION_UPDATE')
 driver:SetScript('OnEvent',onEvent)
 local elapsed=0
 driver:SetScript('OnUpdate',function(_,dt) elapsed=elapsed+dt;if elapsed<.3 then return end;elapsed=0;for _,button in ipairs(buttons) do if button:IsShown() then updateRange(button);if UnitThreatSituation then updateThreat(button) end end end end)
 header:Show();GH.ApplyLayout()
end
local login=CreateFrame('Frame');login:RegisterEvent('PLAYER_LOGIN');login:SetScript('OnEvent',function() GH.Initialize();GH.Print('geladen. /gheal öffnet die Einstellungen, /gheal hilfe zeigt die Befehle.') end)
