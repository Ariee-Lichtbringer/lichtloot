local addonName,GH=...
-- Heilerframes: SecureGroupHeader mit SecureUnitButtons. Klick- und Tastenzauber laufen über Attribute
-- und sichere Enter/Leave-Handler; die Anzeige (Leben, Mana, Auren, Aggro, Reichweite) über Events.
local anchor,header,driver,cdBar,extras
local extraButtons={tanks={}}
local buttons,byUnit,aggro={},{},{}
local pendingAttributes,pendingLayout=false,false
local BAR='Interface\\TargetingFrame\\UI-StatusBar'
local AURA_SLOTS=6
local DEBUFF_SLOTS=4
-- Einheiten-Events werden nicht sofort verarbeitet, sondern je Feld bis zum nächsten Frame gesammelt:
-- im Raid kommen UNIT_HEALTH/UNIT_AURA für dieselbe Einheit mehrfach je Frame, gezeichnet wird ohnehin erst danach.
local pending,pendingCount={},0
local function mark(button,flag)
 if not button.dirty then button.dirty=true;pendingCount=pendingCount+1;pending[pendingCount]=button end
 button[flag]=true
end
local byGuid={}
local glowActive=false   -- irgendein Boss-/Überheilungs-Leuchten sichtbar (sonst keine Alpha-Schleife je Frame)
local cdDirty=false      -- Cooldown-Leiste neu zeichnen (SPELL_UPDATE_COOLDOWN feuert bei jedem Zauber mehrfach)

local function unitOf(button) return button:GetAttribute('unit') end
local function auraAt(unit,i,filter)
 if UnitAura then return UnitAura(unit,i,filter) end
 local a=C_UnitAuras and C_UnitAuras.GetAuraDataByIndex and C_UnitAuras.GetAuraDataByIndex(unit,i,filter)
 if a then return a.name,a.icon,a.applications,a.dispelName,a.duration,a.expirationTime,a.sourceUnit end
end
local function debuffAt(unit,i)
 if UnitDebuff then return UnitDebuff(unit,i) end
 local a=C_UnitAuras and C_UnitAuras.GetDebuffDataByIndex and C_UnitAuras.GetDebuffDataByIndex(unit,i)
 if a then return a.name,a.icon,a.applications,a.dispelName end
end

local function updateHealth(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local hp,max=UnitHealth(unit),UnitHealthMax(unit);if max<=0 then max=1 end
 button.health:SetMinMaxValues(0,max);button.health:SetValue(hp)
 local db=GH.DB();local incoming=0
 if db.showIncoming then incoming=(UnitGetIncomingHeals and UnitGetIncomingHeals(unit) or 0);if incoming<=0 then incoming=GH.AddonIncoming(unit) end end
 if UnitIsDeadOrGhost(unit) then button.deficit:SetText(UnitIsGhost(unit) and 'Geist' or 'Tot');button.deficit:SetTextColor(1,.5,.5);button.health:SetValue(0)
 elseif not UnitIsConnected(unit) then button.deficit:SetText('Offline');button.deficit:SetTextColor(.7,.7,.7)
 else
  local missing=max-hp;local over=hp+incoming-max
  if incoming>0 and over>0 then button.deficit:SetText('+'..GH.Short(over));button.deficit:SetTextColor(1,.55,.15)
  else
   local mode=db.healthText or 'missing';local text=''
   if mode=='missing' then text=missing>0 and ('-'..GH.Short(missing)) or ''
   elseif mode=='percent' then text=string.format('%d%%',math.floor(hp/max*100+.5))
   elseif mode=='current' then text=GH.Short(hp)..'/'..GH.Short(max)
   elseif mode=='both' then text=(missing>0 and ('-'..GH.Short(missing)..' ') or '')..string.format('%d%%',math.floor(hp/max*100+.5)) end
   button.deficit:SetText(text);button.deficit:SetTextColor(GH.Color('text'))
  end
 end
 if db.healthGradient and not button.debuffTint then
  local pct=hp/max;local r=pct<.5 and 1 or (1-pct)*2;local g=pct>.5 and 1 or pct*2
  button.health:SetStatusBarColor(r*.9,g*.8,.1);local cr,cg,cb=GH.ClassColor(unit);button.name:SetTextColor(cr,cg,cb)
 end
 if incoming>0 and hp<max then
  local width=button.health:GetWidth();local start=width*hp/max;local extra=math.min(width-start,width*incoming/max)
  button.incoming:ClearAllPoints();button.incoming:SetPoint('TOPLEFT',button.health,'TOPLEFT',start,0);button.incoming:SetPoint('BOTTOMLEFT',button.health,'BOTTOMLEFT',start,0);button.incoming:SetWidth(math.max(1,extra));button.incoming:Show()
 else button.incoming:Hide() end
end
local function updatePower(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local db=GH.DB()
 if db.showMana then local max=UnitPowerMax(unit);button.power:SetMinMaxValues(0,max>0 and max or 1);button.power:SetValue(UnitPower(unit));button.power:SetStatusBarColor(GH.PowerColor(unit));button.power:Show() else button.power:Hide() end
 -- Mana-Warnung für andere Heiler: unter der Schwelle erscheint MANA, einmal mit Ton.
 local warn=false
 if db.healerManaWarn and not UnitIsUnit(unit,'player') and UnitPowerType(unit)==0 then
  local _,class=UnitClass(unit);local max=UnitPowerMax(unit)
  if class and GH.HEALER_CLASSES[class] and max>0 and not UnitIsDeadOrGhost(unit) then
   local pct=UnitPower(unit)/max*100
   if pct<(db.healerManaThreshold or 20) then warn=true elseif pct>(db.healerManaThreshold or 20)+10 then button.manaWarned=nil end
  end
 end
 if warn then button.manaWarn:Show();if not button.manaWarned then button.manaWarned=true;if db.healerManaSound and PlaySound then PlaySound(8959,'Master') end end else button.manaWarn:Hide() end
end
local function updateName(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 button.name:SetText(UnitName(unit) or '?')
 local r,g,b=GH.ClassColor(unit)
 if button.debuffTint then button.name:SetTextColor(1,1,1);return end
 if GH.DB().healthGradient then button.name:SetTextColor(r,g,b)
 elseif GH.DB().classColors then button.health:SetStatusBarColor(r,g,b);button.name:SetTextColor(GH.Color('name')) else button.health:SetStatusBarColor(GH.Color('bar'));button.name:SetTextColor(r,g,b) end
end
local function debuffFull(unit,i)
 if UnitDebuff then local name,icon,count,kind,duration,expires=UnitDebuff(unit,i);return name,icon,count,kind,duration,expires end
 local a=C_UnitAuras and C_UnitAuras.GetDebuffDataByIndex and C_UnitAuras.GetDebuffDataByIndex(unit,i)
 if a then return a.name,a.icon,a.applications,a.dispelName,a.duration,a.expirationTime end
end
-- Namenslisten (Boss-Debuffs, ignorierte Debuffs, beobachtete Auren, fehlende Buffs) werden gecacht:
-- UNIT_AURA feuert im Raid sehr oft, der Aufbau über GetSpellInfo je Ereignis und Feld kostete spürbar Leistung.
local auraSets,auraSetsAt,auraSetsGen
GH.auraGeneration=0
function GH.InvalidateAuraSets() GH.auraGeneration=(GH.auraGeneration or 0)+1 end
local function currentAuraSets()
 local db=GH.DB();local now=GetTime()
 if auraSets and auraSetsGen==GH.auraGeneration and now-(auraSetsAt or 0)<10 then return auraSets end
 local bossSet={};for _,n in ipairs(GH.BossDebuffs()) do bossSet[n]=true end
 local ignored={};for _,n in ipairs(GH.IgnoredDebuffs()) do ignored[n]=true end
 local tracked=db.showAuras and GH.TrackedAuras() or {}
 local wanted={};for i,name in ipairs(tracked) do wanted[name]=i end
 local watch={};if db.missingBuffWatch then for _,name in ipairs(GH.MissingBuffs()) do watch[name]=GH.BuffAliases(name) end end
 auraSets={bossSet=bossSet,ignored=ignored,tracked=tracked,wanted=wanted,watch=watch,hasBoss=next(bossSet)~=nil,hasWatch=next(watch)~=nil,hasWanted=next(wanted)~=nil or next(watch)~=nil}
 auraSetsAt=now;auraSetsGen=GH.auraGeneration;return auraSets
end
-- Auren und Debuffs in einem Durchlauf: UNIT_AURA feuert im Raid sehr oft. Je Ereignis ein Scan der schädlichen
-- Auren (Debuff-Symbole, Boss-Debuffs, verfolgte Schutz-Debuffs) und nur bei beobachteten Auren ein Scan der
-- nützlichen, mit wiederverwendeten Tabellen. Symbolplätze werden nicht mehr je Aufruf neu verankert (GH.LayoutAuraSlots).
local debuffList,foundList,foundByName,present={},{},{},{}
local function byDebuff(a,b) if a.curable~=b.curable then return a.curable end;return (a.expires or 0)<(b.expires or 0) end
local function byOrder(a,b) return a.order<b.order end
local function updateAuraState(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local db=GH.DB();local dispel=GH.DISPEL[GH.PlayerClass()] or {}
 local sets=currentAuraSets();local bossSet,ignored,wanted,watch=sets.bossSet,sets.ignored,sets.wanted,sets.watch
 local showDebuffs,ownOnly=db.showDebuffs,db.auraOwnOnly
 wipe(debuffList);wipe(foundList);wipe(foundByName);wipe(present)
 local boss,firstName,firstKind
 if showDebuffs or sets.hasBoss or sets.hasWanted then
  for i=1,40 do
   local name,icon,count,kind,duration,expires=debuffFull(unit,i);if not name then break end
   if not boss and bossSet[name] then boss=name;button.bossIcon:SetTexture(icon) end
   if showDebuffs and not ignored[name] then
    local curable=kind and dispel[kind] or false
    if curable or not db.debuffOnlyDispellable then debuffList[#debuffList+1]={icon=icon,count=count,expires=expires,curable=curable} end
    if curable and not firstName then firstName,firstKind=name,kind end
   end
   local order=wanted[name]
   if order and not foundByName[name] then local a={order=order,icon=icon,count=count,expires=expires};foundByName[name]=a;foundList[#foundList+1]=a end
  end
  if #debuffList>1 then table.sort(debuffList,byDebuff) end
 end
 if sets.hasWanted then
  for i=1,40 do
   local name,icon,count,_,duration,expires,source=auraAt(unit,i,'HELPFUL');if not name then break end
   present[name]=true
   local order=wanted[name]
   if order and (not ownOnly or source=='player' or source==nil) and not foundByName[name] then local a={order=order,icon=icon,count=count,expires=expires};foundByName[name]=a;foundList[#foundList+1]=a end
  end
  if #foundList>1 then table.sort(foundList,byOrder) end
 end
 -- Debuff-Symbole (bis zu debuffMax) mit Restzeit und Stapeln
 local maxIcons=math.max(1,math.min(DEBUFF_SLOTS,db.debuffMax or 1))
 for i=1,DEBUFF_SLOTS do
  local slot=button.debuffs[i];local d=debuffList[i]
  if d and i<=maxIcons then slot.icon:SetTexture(d.icon);slot.expires=d.expires;slot.count:SetText(db.debuffStacks and (d.count or 0)>1 and d.count or '');slot:Show() else slot.expires=nil;slot:Hide() end
 end
 -- Ton bei neuem entfernbaren Debuff (einmal je Spieler und Debuff)
 if firstName then
  if button.debuffWarned~=firstName then button.debuffWarned=firstName;if db.debuffSound and PlaySound then PlaySound(8959,'Master') end end
 else button.debuffWarned=nil end
 if boss then
  button.bossIcon:Show();button.bossGlow:Show();glowActive=true
  if button.bossWarned~=boss then button.bossWarned=boss;if db.bossDebuffSound and PlaySound then PlaySound(8959,'Master') end end
 else button.bossIcon:Hide();button.bossGlow:Hide();button.bossWarned=nil end
 -- Entfernbarer Debuff: wahlweise das ganze Feld in der Typfarbe einfärben oder nur den Rahmen.
 local r,g,b;if firstKind then r,g,b=GH.DebuffColor(firstKind) end
 if r then
  if db.debuffFill then button.health:SetStatusBarColor(r,g,b);button.debuffTint=true;button.border:Hide();button.borderKind=nil
  else button.border:SetColorTexture(r,g,b,.9);button.border:Show();button.borderKind='debuff' end
 else
  if button.borderKind=='debuff' then button.border:Hide();button.borderKind=nil end
  if button.debuffTint then button.debuffTint=nil;updateName(button) end
 end
 -- Verfolgte Auren (eigene HoTs/Schilde, Schutz-Debuffs) mit Restzeit.
 local maxAuras=math.max(1,math.min(AURA_SLOTS,db.auraMax or 4))
 for i=1,AURA_SLOTS do
  local slot=button.auras[i];local a=foundList[i]
  if a and i<=maxAuras then slot.icon:SetTexture(a.icon);slot.expires=a.expires;slot.count:SetText((a.count or 0)>1 and a.count or '');slot:Show() else slot.expires=nil;slot:Hide() end
 end
 -- Buffwatch: fehlt ein beobachteter Buff, erscheint sein Symbol rot markiert am rechten Rand.
 local missing
 if sets.hasWatch and not UnitIsDeadOrGhost(unit) and UnitIsConnected(unit) then
  for name,aliases in pairs(watch) do local has=false;for alias in pairs(aliases) do if present[alias] then has=true;break end end;if not has then missing=name;break end end
 end
 if missing then
  if button.missingShown~=missing then local _,_,icon=GetSpellInfo(missing);button.missingBuff.icon:SetTexture(icon);button.missingShown=missing end
  button.missingBuff:Show()
  if button.missingWarned~=missing then button.missingWarned=missing;if db.missingBuffSound and PlaySound then PlaySound(8959,'Master') end end
 else button.missingBuff:Hide();button.missingWarned=nil end
 GH.UpdateAuraTimers(button)
end
function GH.LayoutAuraSlots(button)
 local size=GH.DB().auraSize or 12
 for i=1,AURA_SLOTS do local slot=button.auras[i];slot:SetSize(size,size);slot:ClearAllPoints();slot:SetPoint('BOTTOMLEFT',3+(i-1)*(size+2),2) end
end
local function timerText(slot,now)
 local left=slot.expires and slot.expires>0 and slot.expires-now or nil
 if left then slot.time:SetText(left>=60 and string.format('%dm',math.floor(left/60)) or string.format('%d',math.max(0,math.ceil(left))));slot.time:SetTextColor(1,left<5 and .4 or 1,left<5 and .3 or 1) else slot.time:SetText('') end
end
function GH.UpdateAuraTimers(button)
 local now=GetTime();local db=GH.DB()
 for i=1,AURA_SLOTS do local slot=button.auras[i];if slot:IsShown() then timerText(slot,now) end end
 for i=1,DEBUFF_SLOTS do local slot=button.debuffs[i];if slot:IsShown() then if db.debuffTimer then timerText(slot,now) else slot.time:SetText('') end end end
end
-- Bedrohung: Blizzard-Bedrohungs-API (Status 2/3 = hat Aggro, hohe Prozent gegen mein Ziel = Warnung),
-- dazu die Zielsuche als Ersatz, falls der Client keine Bedrohungsdaten liefert.
local function updateThreat(button)
 local unit=unitOf(button);if not unit or not UnitExists(unit) then return end
 local level=0
 if GH.DB().aggroBorder then
  if UnitThreatSituation then local status=UnitThreatSituation(unit);if status and status>=2 then level=2 elseif status==1 then level=1 end end
  if level<2 and UnitDetailedThreatSituation and UnitExists('target') and UnitCanAttack('player','target') then
   local tanking,status,pct=UnitDetailedThreatSituation(unit,'target')
   if tanking or (status and status>=2) then level=2 elseif pct and pct>=80 then level=math.max(level,1) end
   button.threatPct=pct
  else button.threatPct=nil end
  if level<2 then local guid=UnitGUID(unit);if guid and aggro[guid] then level=2 end end
 end
 if button.threatLevel==level then return end;button.threatLevel=level
 if level==2 then button.aggro:SetColorTexture(1,.12,.12,1);button.aggro:Show()
 elseif level==1 then button.aggro:SetColorTexture(1,.65,.1,1);button.aggro:Show()
 else button.aggro:Hide() end
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
  local spell=header.rangeSpell
  if spell then local r=IsSpellInRange(spell,unit);if r==1 then inRange=true elseif r==0 then inRange=false end end
  if inRange==nil then local ok,checked=UnitInRange(unit);if checked then inRange=ok else inRange=true end end
 end
 local alpha=inRange and 1 or GH.DB().fadeRange
 if button.rangeAlpha~=alpha then button.rangeAlpha=alpha;button:SetAlpha(alpha) end
end
local function updateAll(button) updateName(button);updateHealth(button);updatePower(button);updateAuraState(button);updateThreat(button);updateTarget(button);updateRange(button) end
-- Gesammelte Einheiten-Events eines Frames abarbeiten (je Feld höchstens einmal je Art).
local function flush()
 if pendingCount==0 then return end
 local n=pendingCount;pendingCount=0
 for i=1,n do
  local button=pending[i];pending[i]=nil;button.dirty=nil
  if button:IsShown() then
   if button.dName then updateName(button) end
   if button.dHealth then updateHealth(button) end
   if button.dPower then updatePower(button) end
   if button.dAura then updateAuraState(button) end
   if button.dThreat then updateThreat(button) end
  end
  button.dName,button.dHealth,button.dPower,button.dAura,button.dThreat=nil,nil,nil,nil,nil
 end
end
function GH.LayoutDebuffSlots(button)
 local size=GH.DB().debuffSize or 14
 for i=1,DEBUFF_SLOTS do local slot=button.debuffs[i];slot:SetSize(size,size);slot:ClearAllPoints();slot:SetPoint('TOPRIGHT',-3-(i-1)*(size+2),-3) end
end
function GH.ApplyColors(button)
 local db=GH.DB()
 local r,g,b=GH.Color('bg');button.bg:SetColorTexture(r,g,b,db.bgAlpha or .92)
 local br,bg_,bb,ba=GH.Color('border');button.frameBorder:SetColorTexture(br,bg_,bb,ba or 0)
 if button.incoming then local ir,ig,ib=GH.Color('incoming');button.incoming:SetColorTexture(ir,ig,ib,.45) end
end
function GH.RefreshHealthByGuid(guid)
 local list=guid and byGuid[guid];if not list then return end
 for _,button in ipairs(list) do mark(button,'dHealth') end
end
function GH.RefreshAll() GH.InvalidateAuraSets();for _,button in ipairs(buttons) do updateAll(button) end;GH.RefreshCooldownBar() end

-- Notfall: der Spieler mit den wenigsten Lebenspunkten (in Reichweite, unter der Schwelle) pulsiert gelb, optional mit Ton.
local emergencyButton,emergencyPulse,lastEmergencySound=nil,0,0
local function scanEmergency(dt)
 local db=GH.DB();local best,bestPct
 if db.emergency then
  for _,button in ipairs(buttons) do
   local unit=unitOf(button)
   if unit and button:IsShown() and UnitExists(unit) and not UnitIsDeadOrGhost(unit) and UnitIsConnected(unit) and button:GetAlpha()>=1 then
    local max=UnitHealthMax(unit);local pct=max>0 and UnitHealth(unit)/max*100 or 100
    if pct<(db.emergencyThreshold or 50) and (not bestPct or pct<bestPct) then best,bestPct=button,pct end
   end
  end
 end
 if best~=emergencyButton then
  if emergencyButton then emergencyButton.emergency:Hide() end
  emergencyButton=best
  if best and db.emergencySound and GetTime()-lastEmergencySound>3 then lastEmergencySound=GetTime();if PlaySound then PlaySound(8959,'Master') end end
 end
 if emergencyButton then emergencyButton.emergency:Show() end
end
-- Überheilungs-Warnung: läuft ein eigener Zauber auf einen Spieler und würde mehr als die Schwelle davon verpuffen,
-- blinkt das Feld rot. Abbrechen muss der Spieler selbst (Escape oder /stopcasting), automatisch erlaubt WoW das nicht.
local overhealWarned={}
local function scanOverheal()
 local db=GH.DB()
 for _,button in ipairs(buttons) do
  local unit=unitOf(button);local warn=false
  if db.overhealWarn and unit and button:IsShown() and UnitExists(unit) and not UnitIsDeadOrGhost(unit) then
   local own=(UnitGetIncomingHeals and UnitGetIncomingHeals(unit,'player') or 0);if own<=0 then own=GH.OwnCast(unit) end
   if own>0 and not (db.overhealSkipTanks and GH.IsTank(unit)) then
    local hp,max=UnitHealth(unit),UnitHealthMax(unit);local total=(UnitGetIncomingHeals and UnitGetIncomingHeals(unit) or 0);if total<=0 then total=GH.AddonIncoming(unit,true)+own end
    local wasted=hp+total-max
    if wasted>0 and wasted/own*100>=(db.overhealThreshold or 40) then warn=true end
   end
  end
  if warn then
   button.overheal:Show();button.overhealGlow:Show();glowActive=true
   if not overhealWarned[button] then overhealWarned[button]=true;if db.overhealSound and PlaySound then PlaySound(8960,'Master') end end
  else button.overheal:Hide();button.overhealGlow:Hide();overhealWarned[button]=nil end
 end
end
-- Aggro ohne Bedrohungs-API: Ziele feindlicher Einheiten (eigenes Ziel, Ziel des Ziels, Fokus, Ziele der Gruppe) einsammeln.
local function scanAggro()
 wipe(aggro)
 local candidates={'target','targettarget','focus','mouseover','pettarget'}
 for _,button in ipairs(buttons) do local unit=unitOf(button);if unit and button:IsShown() then candidates[#candidates+1]=unit..'target' end end
 for _,enemy in ipairs(candidates) do
  if UnitExists(enemy) and UnitCanAttack('player',enemy) and not UnitIsDeadOrGhost(enemy) then
   local victim=enemy..'target'
   if UnitExists(victim) and not UnitCanAttack('player',victim) then local guid=UnitGUID(victim);if guid then aggro[guid]=true end end
  end
 end
end

-- Grafik eines neuen Buttons (aus initialConfigFunction über CallMethod).
local function styleButton(button)
 local db=GH.DB()
 button:SetSize(db.width,db.height)
 button.bg=button:CreateTexture(nil,'BACKGROUND');button.bg:SetAllPoints()
 button.frameBorder=button:CreateTexture(nil,'BACKGROUND',nil,-3);button.frameBorder:SetPoint('TOPLEFT',-1,1);button.frameBorder:SetPoint('BOTTOMRIGHT',1,-1)
 GH.ApplyColors(button)
 button.border=button:CreateTexture(nil,'BACKGROUND',nil,-1);button.border:SetPoint('TOPLEFT',-2,2);button.border:SetPoint('BOTTOMRIGHT',2,-2);button.border:SetColorTexture(1,1,1,.8);button.border:Hide()
 button.aggro=button:CreateTexture(nil,'BACKGROUND',nil,-2);button.aggro:SetPoint('TOPLEFT',-3,3);button.aggro:SetPoint('BOTTOMRIGHT',3,-3);button.aggro:SetColorTexture(1,.12,.12,1);button.aggro:Hide()
 button.health=CreateFrame('StatusBar',nil,button);button.health:SetStatusBarTexture(GH.BarTexture());button.health:SetPoint('TOPLEFT',1,-1);button.health:SetPoint('BOTTOMRIGHT',-1,db.showMana and 4 or 1)
 local hbg=button.health:CreateTexture(nil,'BACKGROUND');hbg:SetAllPoints();hbg:SetColorTexture(.15,.1,.1,.8)
 button.incoming=button.health:CreateTexture(nil,'ARTWORK',nil,1);button.incoming:SetColorTexture(.4,.9,.5,.45);button.incoming:Hide()
 button.power=CreateFrame('StatusBar',nil,button);button.power:SetStatusBarTexture(GH.BarTexture());button.power:SetPoint('BOTTOMLEFT',1,1);button.power:SetPoint('BOTTOMRIGHT',-1,1);button.power:SetHeight(3)
 button.name=button.health:CreateFontString(nil,'OVERLAY');button.name:SetFont(STANDARD_TEXT_FONT,db.fontSize or 11,'OUTLINE');button.name:SetPoint('TOPLEFT',4,-3);button.name:SetPoint('RIGHT',-22,0);button.name:SetJustifyH('LEFT');button.name:SetWordWrap(false)
 button.deficit=button.health:CreateFontString(nil,'OVERLAY');button.deficit:SetFont(STANDARD_TEXT_FONT,math.max(8,(db.fontSize or 11)-1),'OUTLINE');button.deficit:SetPoint('BOTTOMRIGHT',-3,2);button.deficit:SetTextColor(1,.85,.4)
 button.debuff=button:CreateTexture(nil,'OVERLAY');button.debuff:SetSize(14,14);button.debuff:SetPoint('TOPRIGHT',-3,-3);button.debuff:Hide()
 button.debuffCount=button:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');button.debuffCount:SetPoint('CENTER',button.debuff,'BOTTOMRIGHT',-2,2)
 button.debuffs={}
 for i=1,DEBUFF_SLOTS do
  local slot=CreateFrame('Frame',nil,button.health);slot:SetFrameLevel(button.health:GetFrameLevel()+3)
  slot.icon=slot:CreateTexture(nil,'ARTWORK');slot.icon:SetAllPoints();slot.icon:SetTexCoord(.08,.92,.08,.92)
  slot.time=slot:CreateFontString(nil,'OVERLAY');slot.time:SetFont(STANDARD_TEXT_FONT,9,'OUTLINE');slot.time:SetPoint('TOP',slot,'BOTTOM',0,1)
  slot.count=slot:CreateFontString(nil,'OVERLAY');slot.count:SetFont(STANDARD_TEXT_FONT,8,'OUTLINE');slot.count:SetPoint('BOTTOMRIGHT',2,-1)
  slot:Hide();button.debuffs[i]=slot
 end
 GH.LayoutDebuffSlots(button)
 button.missingBuff=CreateFrame('Frame',nil,button.health);button.missingBuff:SetSize(12,12);button.missingBuff:SetPoint('RIGHT',-3,0);button.missingBuff:SetFrameLevel(button.health:GetFrameLevel()+3)
 button.missingBuff.icon=button.missingBuff:CreateTexture(nil,'ARTWORK');button.missingBuff.icon:SetAllPoints();button.missingBuff.icon:SetTexCoord(.08,.92,.08,.92);button.missingBuff.icon:SetDesaturated(true)
 local mark=button.missingBuff:CreateTexture(nil,'OVERLAY');mark:SetPoint('TOPLEFT',-1,1);mark:SetPoint('BOTTOMRIGHT',1,-1);mark:SetColorTexture(1,.2,.2,.35)
 button.missingBuff:Hide()
 button.target=button:CreateTexture(nil,'OVERLAY');button.target:SetAllPoints();button.target:SetColorTexture(1,1,1,.18);button.target:Hide()
 button.overheal=button.health:CreateFontString(nil,'OVERLAY');button.overheal:SetFont(STANDARD_TEXT_FONT,11,'OUTLINE');button.overheal:SetPoint('CENTER',0,-2);button.overheal:SetTextColor(1,.25,.2);button.overheal:SetText('ÜBERHEILUNG');button.overheal:Hide()
 button.overhealGlow=button:CreateTexture(nil,'OVERLAY',nil,3);button.overhealGlow:SetPoint('TOPLEFT',-3,3);button.overhealGlow:SetPoint('BOTTOMRIGHT',3,-3);button.overhealGlow:SetColorTexture(1,.2,.15,.45);button.overhealGlow:Hide()
 button.manaWarn=button.health:CreateFontString(nil,'OVERLAY');button.manaWarn:SetFont(STANDARD_TEXT_FONT,10,'OUTLINE');button.manaWarn:SetPoint('BOTTOMLEFT',3,2);button.manaWarn:SetTextColor(.35,.65,1);button.manaWarn:SetText('MANA');button.manaWarn:Hide()
 button.bossIcon=button:CreateTexture(nil,'OVERLAY',nil,4);button.bossIcon:SetSize(22,22);button.bossIcon:SetPoint('CENTER',0,0);button.bossIcon:SetTexCoord(.08,.92,.08,.92);button.bossIcon:Hide()
 button.bossGlow=button:CreateTexture(nil,'OVERLAY',nil,3);button.bossGlow:SetPoint('TOPLEFT',-3,3);button.bossGlow:SetPoint('BOTTOMRIGHT',3,-3);button.bossGlow:SetColorTexture(1,.1,.6,.45);button.bossGlow:Hide()
 button.emergency=button:CreateTexture(nil,'OVERLAY',nil,2);button.emergency:SetPoint('TOPLEFT',-3,3);button.emergency:SetPoint('BOTTOMRIGHT',3,-3);button.emergency:SetColorTexture(1,.9,.2,.5);button.emergency:Hide()
 button.auras={}
 for i=1,AURA_SLOTS do
  local slot=CreateFrame('Frame',nil,button.health);slot:SetSize(12,12);slot:SetPoint('BOTTOMLEFT',3+(i-1)*14,2);slot:SetFrameLevel(button.health:GetFrameLevel()+2)
  slot.icon=slot:CreateTexture(nil,'ARTWORK');slot.icon:SetAllPoints();slot.icon:SetTexCoord(.08,.92,.08,.92)
  slot.time=slot:CreateFontString(nil,'OVERLAY');slot.time:SetFont(STANDARD_TEXT_FONT,9,'OUTLINE');slot.time:SetPoint('BOTTOM',slot,'TOP',0,-1)
  slot.count=slot:CreateFontString(nil,'OVERLAY');slot.count:SetFont(STANDARD_TEXT_FONT,8,'OUTLINE');slot.count:SetPoint('BOTTOMRIGHT',2,-1)
  slot:Hide();button.auras[i]=slot
 end
 GH.LayoutAuraSlots(button)
 -- Klick auf den Namen: anvisieren (links). Rechtsklick öffnet bewusst kein Einheitenmenü (Blizzard-Popup), sondern tut nichts.
 local nameZone=CreateFrame('Button',button:GetName()..'Name',button,'SecureUnitButtonTemplate,SecureHandlerEnterLeaveTemplate')
 nameZone:SetPoint('TOPLEFT',0,0);nameZone:SetPoint('RIGHT',-22,0);nameZone:SetHeight(14);nameZone:SetFrameLevel(button:GetFrameLevel()+5)
 nameZone:SetAttribute('useparent-unit',true);nameZone:SetAttribute('gh-owner',true);nameZone:SetAttribute('type1','target');nameZone:RegisterForClicks('LeftButtonUp')
 nameZone:HookScript('OnEnter',function(self) button.nameHover:Show();if not GH.DB().showTooltips then if GameTooltip:IsOwned(self) or GameTooltip:IsOwned(button) then GameTooltip:Hide() end;return end;local unit=unitOf(button);if unit then GameTooltip:SetOwner(button,'ANCHOR_RIGHT');GameTooltip:SetUnit(unit);GameTooltip:AddLine('Klick: anvisieren',.7,.85,1);GameTooltip:Show() end end)
 nameZone:HookScript('OnLeave',function() button.nameHover:Hide();GameTooltip:Hide() end)
 button.nameZone=nameZone
 button.nameHover=button.health:CreateTexture(nil,'OVERLAY');button.nameHover:SetPoint('TOPLEFT',0,0);button.nameHover:SetPoint('RIGHT',-22,0);button.nameHover:SetHeight(14);button.nameHover:SetColorTexture(1,1,1,.14);button.nameHover:Hide()
 button:HookScript('OnEnter',function(self) if not GH.DB().showTooltips then if GameTooltip:IsOwned(self) then GameTooltip:Hide() end;return end;local unit=unitOf(self);if unit then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetUnit(unit);if self.threatPct then GameTooltip:AddLine(string.format('Bedrohung gegen dein Ziel: %d%%',self.threatPct),1,.7,.3) end;GameTooltip:Show() end end)
 button:HookScript('OnLeave',function() GameTooltip:Hide() end)
 button:SetScript('OnAttributeChanged',function(self,name) if name=='unit' then GH.RefreshUnitMap();updateAll(self) end end)
 button.styled=true
end
function GH.RefreshUnitMap()
 wipe(byUnit);wipe(byGuid)
 for _,button in ipairs(buttons) do
  local unit=unitOf(button)
  if unit and button:IsShown() then
   byUnit[unit]=byUnit[unit] or {};table.insert(byUnit[unit],button)
   local guid=UnitGUID(unit);if guid then byGuid[guid]=byGuid[guid] or {};table.insert(byGuid[guid],button) end
  end
 end
 if GH.InvalidateTanks then GH.InvalidateTanks() end
end

-- Attribute für Klick- und Tastenzauber. Ketten werden als Makro gesetzt; das Ziel trägt der Enter-Handler ein.
local function actionAttributes(suffix,value,chain,attrs,macros,star,mod)
 -- Attributname: [*|modifikator-]type<suffix>, z. B. shift-type1 oder *type-ghw3.
 local p=star and '*' or (mod or '')
 if value=='target' then attrs[p..'type'..suffix]='target'
 elseif value=='menu' then return nil -- Einheitenmenü wird nicht mehr unterstützt (öffnete das Blizzard-Popup)
 elseif value=='focus' then attrs[p..'type'..suffix]='focus'
 elseif value=='assist' then attrs[p..'type'..suffix]='assist'
 elseif value=='stopcasting' then attrs[p..'type'..suffix]='macro';attrs[p..'macrotext'..suffix]='/stopcasting'
 elseif type(value)=='string' and value:sub(1,6)=='macro:' then attrs[p..'type'..suffix]='macro';attrs[p..'macro'..suffix]=value:sub(7)
 elseif type(value)=='string' and value:sub(1,5)=='item:' then attrs[p..'type'..suffix]='item';attrs[p..'item'..suffix]=value:sub(6)
 else
  local name=type(value)=='number' and (GH.Known(value) and GH.SpellName(value)) or (type(value)=='string' and GH.ValidSpell(value) and value)
  if not name then return nil end
  if (chain and (chain.trinket13 or chain.trinket14 or (chain.spells and #chain.spells>0))) or GH.DB().targetOnHeal then
   local pre={};chain=chain or {}
   if chain.trinket13 then pre[#pre+1]='/use 13' end;if chain.trinket14 then pre[#pre+1]='/use 14' end
   for _,extra in ipairs(chain.spells or {}) do if GH.ValidSpell(extra) then pre[#pre+1]='/cast '..extra end end
   local key=(mod or '')..suffix
   attrs[p..'type'..suffix]='macro';attrs['gh-pre-'..key]=table.concat(pre,'\n')..'\n';attrs['gh-main-'..key]=name;macros[#macros+1]={suffix=suffix,star=p,key=key}
  else attrs[p..'type'..suffix]='spell';attrs[p..'spell'..suffix]=name end
  return name
 end
end
local function bindingAttributes()
 local attrs,macros,keys={},{},{};local bindings=GH.Bindings();local rangeSpell
 local store=GH.ClassStore();local chains=store.chains or {}
 for i,b in ipairs(GH.BINDINGS) do
  local id=GH.BindingId(b);local value=bindings[id]
  if value~=nil then
   if b.wheel then
    -- Mausrad: Tastenbindung beim Betreten des Feldes auf eine virtuelle Taste; '*' ignoriert den Modifikator beim Nachschlagen.
    local virtual='ghw'..i;local name=actionAttributes('-'..virtual,value,chains[id],attrs,macros,true)
    if name then keys[#keys+1]={key=GH.ModifierKeyPrefix(b.mod)..b.wheel,virtual=virtual} end
   else
    local name=actionAttributes(b.key,value,chains[id],attrs,macros,false,b.mod)
    if name and b.mod=='' and not rangeSpell and GH.ValidSpell(name) then rangeSpell=GH.BaseName(name) end
   end
  end
 end
 for i,entry in ipairs(GH.Keys()) do
  if entry.key and entry.value~=nil then
   local virtual='ghk'..i;local name=actionAttributes('-'..virtual,entry.value,chains['key'..i],attrs,macros,true)
   if name then keys[#keys+1]={key=entry.key,virtual=virtual} end
  end
 end
 return attrs,macros,keys,rangeSpell
end
local function enterSnippet(macros,keys)
 local lines={"local owner=self:GetAttribute('gh-owner') and self:GetParent() or self","local unit=owner:GetAttribute('unit') or 'mouseover'"}
 -- Option „Heilklick nimmt ins Ziel“: /target vor dem Zauber.
 local targetLine=GH.DB().targetOnHeal and "'/target [@'..unit..']\\n'.." or ''
 for _,m in ipairs(macros) do
  lines[#lines+1]=("owner:SetAttribute(%q,"..targetLine.."(owner:GetAttribute(%q) or '')..'/cast [@'..unit..',exists] '..(owner:GetAttribute(%q) or ''))"):format(m.star..'macrotext'..m.suffix,'gh-pre-'..m.key,'gh-main-'..m.key)
 end
 for _,k in ipairs(keys) do lines[#lines+1]=("self:SetBindingClick(true,%q,owner:GetName(),%q)"):format(k.key,k.virtual) end
 return table.concat(lines,'\n')
end
local function configFunction(attrs)
 local db=GH.DB();local lines={('self:SetWidth(%d);self:SetHeight(%d)'):format(db.width,db.height)}
 for k,v in pairs(attrs) do lines[#lines+1]=('self:SetAttribute(%q,%q)'):format(k,v) end
 lines[#lines+1]="self:GetParent():CallMethod('InitButton',self:GetName())"
 return table.concat(lines,'\n')
end
local currentAttributeKeys={}
function GH.ApplyBindings()
 if not header then return end
 if InCombatLockdown() then pendingAttributes=true;return end
 local attrs,macros,keys,rangeSpell=bindingAttributes()
 local snippet=enterSnippet(macros,keys);header.snippet=snippet
 header:SetAttribute('initialConfigFunction',configFunction(attrs))
 local clicks=GH.DB().castOnDown and 'AnyDown' or 'AnyUp'
 for _,button in ipairs(buttons) do
  for k in pairs(currentAttributeKeys) do button:SetAttribute(k,nil) end
  for k,v in pairs(attrs) do button:SetAttribute(k,v) end
  button:SetAttribute('_onenter',snippet);button:SetAttribute('_onleave','self:ClearBindings()')
  button.nameZone:SetAttribute('_onenter',snippet);button.nameZone:SetAttribute('_onleave','self:ClearBindings()')
  button:RegisterForClicks(clicks)
 end
 wipe(currentAttributeKeys);for k in pairs(attrs) do currentAttributeKeys[k]=true end;for _,m in ipairs(macros) do currentAttributeKeys[m.star..'macrotext'..m.suffix]=true end
 header.rangeSpell=rangeSpell
 GH.BuildCooldownBar()
 if GH.ConfigRefresh then GH.ConfigRefresh() end
end

-- Cooldown-Leiste: Zauber aus Belegungen, Tasten und Ketten sowie genutzte Schmuckstücke, sichtbar solange sie abklingen.
-- Bereit-Meldung: großer Text in der Bildschirmmitte, wenn ein beobachteter Zauber oder ein Schmuckstück wieder bereit ist.
local readyFrame
local function announceReady(text,icon)
 local db=GH.DB();if not db.cdReadyWarn then return end
 if not readyFrame then
  readyFrame=CreateFrame('Frame',nil,UIParent);readyFrame:SetSize(400,60);readyFrame:SetPoint('CENTER',UIParent,'CENTER',0,180);readyFrame:SetFrameStrata('HIGH')
  readyFrame.icon=readyFrame:CreateTexture(nil,'ARTWORK');readyFrame.icon:SetSize(36,36);readyFrame.icon:SetPoint('LEFT',40,0);readyFrame.icon:SetTexCoord(.08,.92,.08,.92)
  readyFrame.text=readyFrame:CreateFontString(nil,'OVERLAY');readyFrame.text:SetFont(STANDARD_TEXT_FONT,26,'OUTLINE');readyFrame.text:SetPoint('LEFT',readyFrame.icon,'RIGHT',12,0);readyFrame.text:SetTextColor(.4,1,.5)
  readyFrame:SetScript('OnUpdate',function(self,dt) self.left=(self.left or 0)-dt;if self.left<=0 then self:Hide() elseif self.left<.8 then self:SetAlpha(self.left/.8) else self:SetAlpha(1) end end)
 end
 readyFrame.text:SetText(text..' bereit');readyFrame.icon:SetTexture(icon);readyFrame.icon:SetShown(icon~=nil);readyFrame.left=2.5;readyFrame:SetAlpha(1);readyFrame:Show()
 if db.cdReadySound and PlaySound then PlaySound(8959,'Master') end
end
function GH.BuildCooldownBar()
 local db=GH.DB()
 if not cdBar then
  cdBar=CreateFrame('Frame','GuildHealCooldowns',UIParent);cdBar:SetSize(10,26);cdBar.items={};cdBar:SetMovable(true);cdBar:SetClampedToScreen(true)
  -- Griff zum Verschieben der Cooldown-Leiste (nur sichtbar, wenn die Frames nicht gesperrt sind).
  -- Im Bearbeitungsmodus liegt eine transparente Griff-Fläche über der Leiste (ohne Überschrift).
  cdBar.handle=CreateFrame('Frame',nil,cdBar);cdBar.handle:SetAllPoints();cdBar.handle:SetFrameLevel(cdBar:GetFrameLevel()+10);cdBar.handle:EnableMouse(true);cdBar.handle:RegisterForDrag('LeftButton')
  local hbg=cdBar.handle:CreateTexture(nil,'BACKGROUND');hbg:SetAllPoints();hbg:SetColorTexture(.16,.6,.55,.45)
  cdBar.handle:SetScript('OnDragStart',function() if not GH.DB().locked then cdBar:StartMoving() end end)
  cdBar.handle:SetScript('OnDragStop',function() cdBar:StopMovingOrSizing();local point,_,_,x,y=cdBar:GetPoint();GH.DB().cdPosition={point=point,x=x,y=y} end)
  cdBar.handle:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Abklingzeiten verschieben');GameTooltip:AddLine('Ziehen verschiebt die Leiste. Unter Anzeige lässt sie sich wieder an die Felder heften.',1,1,1,true);GameTooltip:Show() end);cdBar.handle:SetScript('OnLeave',function() GameTooltip:Hide() end)
 end
 cdBar:ClearAllPoints()
 if db.cdPosition then cdBar:SetPoint(db.cdPosition.point or 'CENTER',UIParent,db.cdPosition.point or 'CENTER',db.cdPosition.x or 0,db.cdPosition.y or 0) else cdBar:SetPoint('BOTTOMLEFT',extras or anchor,'TOPLEFT',0,4) end
 cdBar.handle:SetShown(not db.locked and db.showCooldowns~=false);cdBar:SetShown(not db.hidden)
 local size=db.cdSize or 26;cdBar:SetHeight(size)
 local seen,list={},{}
 local function addSpell(name) if type(name)=='string' and GH.ValidSpell(name) then name=GH.BaseName(name);if not seen[name] then seen[name]=true;list[#list+1]={spell=name} end end end
 local bindings=GH.Bindings();local store=GH.ClassStore();local chains=store.chains or {}
 local function addValue(v) if type(v)=='number' then addSpell(GH.SpellName(v)) elseif type(v)=='string' and not v:find('^macro:') and not v:find('^item:') then addSpell(v) end end
 for _,b in ipairs(GH.BINDINGS) do addValue(bindings[GH.BindingId(b)]) end
 for _,entry in ipairs(GH.Keys()) do addValue(entry.value) end
 local t13,t14=false,false
 for _,chain in pairs(chains) do for _,extra in ipairs(chain.spells or {}) do addSpell(extra) end;t13=t13 or chain.trinket13;t14=t14 or chain.trinket14 end
 -- Schmuckstücke: immer, wenn gewünscht und ein benutzbares Schmuckstück angelegt ist, sonst nur aus Ketten.
 local function usable(slot) local link=GetInventoryItemLink('player',slot);return link and GetItemSpell and GetItemSpell(link)~=nil end
 if t13 or (db.cdTrinkets and usable(13)) then list[#list+1]={slot=13} end
 if t14 or (db.cdTrinkets and usable(14)) then list[#list+1]={slot=14} end
 for i,entry in ipairs(list) do
  local item=cdBar.items[i]
  if not item then
   item=CreateFrame('Frame',nil,cdBar);item:SetSize(size,size)
   item.icon=item:CreateTexture(nil,'ARTWORK');item.icon:SetAllPoints();item.icon:SetTexCoord(.08,.92,.08,.92)
   item.cd=CreateFrame('Cooldown',nil,item,'CooldownFrameTemplate');item.cd:SetAllPoints();item.cd:SetDrawEdge(false);if item.cd.SetHideCountdownNumbers then item.cd:SetHideCountdownNumbers(true) end
   item.time=item:CreateFontString(nil,'OVERLAY');item.time:SetFont(STANDARD_TEXT_FONT,11,'OUTLINE');item.time:SetPoint('CENTER',0,0)
   item:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');if self.entry.spell then GameTooltip:SetText(self.entry.spell) else GameTooltip:SetInventoryItem('player',self.entry.slot) end;GameTooltip:Show() end);item:SetScript('OnLeave',function() GameTooltip:Hide() end)
   cdBar.items[i]=item
  end
  item.entry=entry;item:Hide();item:SetSize(size,size);item.time:SetFont(STANDARD_TEXT_FONT,math.max(9,math.floor(size*.42)),'OUTLINE');item.wasCooling=nil
  if entry.spell then item.icon:SetTexture(GH.SpellIconOf(entry.spell)) else item.icon:SetTexture(GetInventoryItemTexture('player',entry.slot) or 'Interface\\Icons\\INV_Misc_QuestionMark') end
 end
 for i=#list+1,#cdBar.items do cdBar.items[i]:Hide();cdBar.items[i].entry=nil end
 GH.RefreshCooldownBar()
end
function GH.RefreshCooldownBar()
 if not cdBar then return end
 local db=GH.DB()
 if not db.showCooldowns then for _,item in ipairs(cdBar.items) do item:Hide() end;cdBar.handle:Hide();return end
 local x=0;local now=GetTime();local size=db.cdSize or 26
 for _,item in ipairs(cdBar.items) do
  local e=item.entry
  if e then
   local start,duration,enabled
   if e.spell then start,duration,enabled=GetSpellCooldown(e.spell) else start,duration,enabled=GetInventoryItemCooldown('player',e.slot);if e.slot and not GetInventoryItemTexture('player',e.slot) then start=nil end end
   local cooling=start and start>0 and duration and duration>1.6 and enabled~=0 and (start+duration-now)>0
   if cooling then
    local left=start+duration-now
    item:ClearAllPoints();item:SetPoint('BOTTOMLEFT',x,0);x=x+size+2;item:Show()
    item.cd:SetCooldown(start,duration);item.time:SetText(left>=60 and string.format('%dm',math.ceil(left/60)) or string.format('%d',math.ceil(left)))
    item.wasCooling=true
   else
    item:Hide()
    if item.wasCooling then item.wasCooling=nil;announceReady(e.spell or (GetInventoryItemLink('player',e.slot) and (GetInventoryItemLink('player',e.slot):match('%[(.-)%]')) or 'Schmuckstück'),item.icon:GetTexture()) end
   end
  end
 end
 cdBar:SetWidth(math.max(db.locked and 10 or size*3+4,x))
end

-- Ziel- und Tankfelder: eigene SecureUnitButtons oberhalb des Griffs (Ziel, dann Tanks aus Rollen/Namen).
local function extraButton(name)
 local b=CreateFrame('Button',name,extras,'SecureUnitButtonTemplate,SecureHandlerEnterLeaveTemplate');b.extra=true
 styleButton(b);table.insert(buttons,b);RegisterUnitWatch(b)
 b:RegisterForClicks(GH.DB().castOnDown and 'AnyDown' or 'AnyUp');return b
end
local function tankUnits()
 local list,seen={},{}
 local function add(unit) local guid=UnitGUID(unit);if guid and not seen[guid] then seen[guid]=true;list[#list+1]=unit end end
 local n=GetNumGroupMembers();local prefix=IsInRaid() and 'raid' or 'party'
 for i=1,(IsInRaid() and n or n-1) do local unit=prefix..i;if UnitExists(unit) and GH.IsTank(unit) then add(unit) end end
 if not IsInRaid() and GH.IsTank('player') then add('player') end
 return list
end
function GH.BuildExtras()
 if not extras or InCombatLockdown() then pendingLayout=pendingLayout or InCombatLockdown();return end
 local db=GH.DB()
 if not extraButtons.target then extraButtons.target=extraButton('GuildHealTargetFrame');extraButtons.target:SetAttribute('unit','target') end
 local tanks=db.showTankFrames and tankUnits() or {}
 for i,unit in ipairs(tanks) do
  local b=extraButtons.tanks[i];if not b then b=extraButton('GuildHealTankFrame'..i);extraButtons.tanks[i]=b end
  b:SetAttribute('unit',unit)
 end
 for i=#tanks+1,#extraButtons.tanks do extraButtons.tanks[i]:SetAttribute('unit',nil) end
 if db.showTargetFrame then extraButtons.target:SetAttribute('unit','target') else extraButtons.target:SetAttribute('unit',nil) end
 local x=0;local w,h=math.floor(db.width*1.25),db.height
 local function place(b,shown) b:ClearAllPoints();b:SetSize(w,h);if shown then b:SetPoint('BOTTOMLEFT',extras,'BOTTOMLEFT',x,0);x=x+w+4 end end
 place(extraButtons.target,db.showTargetFrame)
 for i,b in ipairs(extraButtons.tanks) do place(b,i<=#tanks) end
 extras:SetSize(math.max(1,x),x>0 and h or 1)
 GH.RefreshUnitMap()
end
function GH.FramesShown() return not GH.DB().hidden end
function GH.ToggleFrames()
 local db=GH.DB();db.hidden=not db.hidden
 if InCombatLockdown() then pendingLayout=true;GH.Print('Ein-/Ausblenden wird nach dem Kampf übernommen.') else GH.ApplyLayout() end
 return not db.hidden
end
function GH.ApplyLayout()
 if not header then return end
 if InCombatLockdown() then pendingLayout=true;return end
 local db=GH.DB()
 anchor:SetShown(not db.hidden)
 anchor:SetScale(db.scale or 1)
 anchor:ClearAllPoints()
 if db.position then anchor:SetPoint(db.position.point or 'CENTER',UIParent,db.position.point or 'CENTER',db.position.x or 0,db.position.y or 0) else anchor:SetPoint('CENTER',UIParent,'CENTER',0,-220) end
 header:ClearAllPoints()
 -- Spieler untereinander (Spalten) oder nebeneinander (Reihen); Gruppen nebeneinander oder untereinander.
 local gap=db.spacing or 3
 if db.unitLayout=='horizontal' then header:SetAttribute('point','LEFT');header:SetAttribute('xOffset',gap);header:SetAttribute('yOffset',0)
 else header:SetAttribute('point','TOP');header:SetAttribute('xOffset',0);header:SetAttribute('yOffset',-gap) end
 header:SetAttribute('columnAnchorPoint',db.horizontal and 'LEFT' or 'TOP')
 header:SetAttribute('columnSpacing',gap+1);header:SetPoint('TOPLEFT',anchor,'BOTTOMLEFT',0,-2)
 header:SetAttribute('unitsPerColumn',5);header:SetAttribute('maxColumns',8);header:SetAttribute('showSolo',not db.hideSolo)
 -- Sortierung (nur außerhalb des Kampfes änderbar): Gruppen, Tanks zuerst (Rollen) oder Klassen.
 if db.sortMode=='role' then header:SetAttribute('groupBy','ROLE');header:SetAttribute('groupingOrder','MAINTANK,MAINASSIST,NONE')
 elseif db.sortMode=='class' then header:SetAttribute('groupBy','CLASS');header:SetAttribute('groupingOrder','WARRIOR,PALADIN,DRUID,PRIEST,SHAMAN,MAGE,WARLOCK,ROGUE,HUNTER')
 else header:SetAttribute('groupBy','GROUP');header:SetAttribute('groupingOrder','1,2,3,4,5,6,7,8') end
 -- Alte Anker aus einer vorherigen Anordnung entfernen, sonst bleiben Reihe und Spalte gleichzeitig verankert (Treppe).
 for _,button in ipairs(buttons) do if not button.extra then button:ClearAllPoints() end end
 header:Hide();header:Show()
 for _,button in ipairs(buttons) do
  if not button.extra then button:SetSize(db.width,db.height) end;button.health:SetPoint('BOTTOMRIGHT',-1,db.showMana and 4 or 1)
  button.health:SetStatusBarTexture(GH.BarTexture());button.power:SetStatusBarTexture(GH.BarTexture());GH.ApplyColors(button)
  button.name:SetFont(STANDARD_TEXT_FONT,db.fontSize or 11,'OUTLINE');button.deficit:SetFont(STANDARD_TEXT_FONT,math.max(8,(db.fontSize or 11)-1),'OUTLINE');GH.LayoutDebuffSlots(button);GH.LayoutAuraSlots(button)
  button.nameZone:SetShown(db.nameClick~=false)
  updateAll(button)
 end
 GH.BuildExtras();GH.ApplyBindings();GH.BuildCooldownBar();if GH.ApplyCastBar then GH.ApplyCastBar() end
 anchor:EnableMouse(not db.locked);anchor.label:SetShown(not db.locked);anchor.bg:SetShown(not db.locked)
 anchor:SetSize(70,14);anchor.gear:SetAlpha(db.locked and .6 or 1)
end

local UNIT_FLAGS={UNIT_HEALTH='dHealth',UNIT_MAXHEALTH='dHealth',UNIT_HEAL_PREDICTION='dHealth',UNIT_CONNECTION='dHealth',
 UNIT_POWER_UPDATE='dPower',UNIT_MAXPOWER='dPower',UNIT_DISPLAYPOWER='dPower',UNIT_AURA='dAura',UNIT_THREAT_SITUATION_UPDATE='dThreat',UNIT_NAME_UPDATE='dName'}
local function onEvent(_,event,unit,...)
 if event=='PLAYER_REGEN_ENABLED' then
  if pendingLayout then pendingLayout=false;GH.ApplyLayout() elseif pendingAttributes then pendingAttributes=false;GH.ApplyBindings() end;return
 end
 if event=='PLAYER_TARGET_CHANGED' then for _,button in ipairs(buttons) do updateTarget(button) end;if extraButtons.target then GH.RefreshUnitMap();updateAll(extraButtons.target) end;return end
 if event=='GROUP_ROSTER_UPDATE' or event=='PLAYER_ENTERING_WORLD' then if not InCombatLockdown() then GH.BuildExtras() else pendingLayout=true end;GH.RefreshUnitMap();for _,button in ipairs(buttons) do updateAll(button) end;return end
 if event=='SPELLS_CHANGED' or event=='LEARNED_SPELL_IN_TAB' then GH.InvalidateSpellbook(true);GH.InvalidateAuraSets();GH.ApplyBindings();return end
 if event=='SPELL_UPDATE_COOLDOWN' or event=='BAG_UPDATE_COOLDOWN' or event=='PLAYER_EQUIPMENT_CHANGED' then if event=='PLAYER_EQUIPMENT_CHANGED' then GH.BuildCooldownBar() else cdDirty=true end;return end
 local list=unit and byUnit[unit];if not list then return end
 local flag=UNIT_FLAGS[event];if not flag then return end
 for _,button in ipairs(list) do mark(button,flag) end
end

function GH.Initialize()
 if header then return end
 -- Kleiner Griff zum Ziehen plus Zahnrad für die Einstellungen; der Griff verschwindet beim Sperren, das Zahnrad bleibt.
 anchor=CreateFrame('Frame','GuildHealAnchor',UIParent);anchor:SetSize(70,14);anchor:SetMovable(true);anchor:SetClampedToScreen(true);anchor:RegisterForDrag('LeftButton');anchor:SetFrameStrata('LOW')
 anchor.bg=anchor:CreateTexture(nil,'BACKGROUND');anchor.bg:SetAllPoints();anchor.bg:SetColorTexture(.16,.6,.55,.85)
 anchor.label=anchor:CreateFontString(nil,'OVERLAY');anchor.label:SetFont(STANDARD_TEXT_FONT,9,'OUTLINE');anchor.label:SetPoint('CENTER');anchor.label:SetText('GuildHeal')
 anchor:SetScript('OnDragStart',function(self) if not GH.DB().locked then self:StartMoving() end end)
 anchor:SetScript('OnDragStop',function(self) self:StopMovingOrSizing();local point,_,_,x,y=self:GetPoint();GH.DB().position={point=point,x=x,y=y} end)
 anchor:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('GuildHeal verschieben');GameTooltip:AddLine('Ziehen am Griff oder am Zahnrad verschiebt die Frames.',1,1,1,true);GameTooltip:Show() end);anchor:SetScript('OnLeave',function() GameTooltip:Hide() end)
 anchor.gear=CreateFrame('Button',nil,anchor);anchor.gear:SetSize(16,16);anchor.gear:SetPoint('LEFT',anchor,'RIGHT',3,0);anchor.gear:SetFrameStrata('LOW')
 local gearIcon=anchor.gear:CreateTexture(nil,'ARTWORK');gearIcon:SetAllPoints();gearIcon:SetTexture('Interface\\Icons\\Trade_Engineering');gearIcon:SetTexCoord(.08,.92,.08,.92)
 anchor.gear:SetHighlightTexture('Interface\\Buttons\\ButtonHilight-Square','ADD')
 anchor.gear:SetScript('OnClick',function() GH.ToggleConfig() end)
 -- Zahnrad mit gedrückter linker Maustaste ziehen verschiebt die Frames (außerhalb des Kampfes); Klick öffnet die Einstellungen.
 anchor.gear:RegisterForDrag('LeftButton')
 anchor.gear:SetScript('OnDragStart',function() if not InCombatLockdown() then GameTooltip:Hide();anchor:StartMoving() end end)
 anchor.gear:SetScript('OnDragStop',function() anchor:StopMovingOrSizing();local point,_,_,x,y=anchor:GetPoint();GH.DB().position={point=point,x=x,y=y} end)
 anchor.gear:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('GuildHeal · Einstellungen');GameTooltip:AddLine('Klick öffnet die Einstellungen (/gheal). Mit gedrückter linker Maustaste ziehen verschiebt die Frames.',1,1,1,true);GameTooltip:Show() end);anchor.gear:SetScript('OnLeave',function() GameTooltip:Hide() end)
 extras=CreateFrame('Frame','GuildHealExtras',anchor);extras:SetSize(1,1);extras:SetPoint('BOTTOMLEFT',anchor,'TOPLEFT',0,4)
 header=CreateFrame('Frame','GuildHealHeader',anchor,'SecureGroupHeaderTemplate')
 header:SetAttribute('template','SecureUnitButtonTemplate,SecureHandlerEnterLeaveTemplate')
 header:SetAttribute('showRaid',true);header:SetAttribute('showParty',true);header:SetAttribute('showPlayer',true);header:SetAttribute('showSolo',true)
 header:SetAttribute('groupBy','GROUP');header:SetAttribute('groupingOrder','1,2,3,4,5,6,7,8');header:SetAttribute('sortMethod','INDEX')
 function header:InitButton(name)
  local button=_G[name];if not button or button.styled then return end
  styleButton(button);table.insert(buttons,button)
  button:RegisterForClicks(GH.DB().castOnDown and 'AnyDown' or 'AnyUp')
  button:SetAttribute('_onenter',header.snippet);button:SetAttribute('_onleave','self:ClearBindings()')
  button.nameZone:SetAttribute('_onenter',header.snippet);button.nameZone:SetAttribute('_onleave','self:ClearBindings()')
  button.nameZone:SetShown(GH.DB().nameClick~=false)
  GH.RefreshUnitMap();updateAll(button)
 end
 local attrs,macros,keys=bindingAttributes();header.snippet=enterSnippet(macros,keys)
 header:SetAttribute('initialConfigFunction',configFunction(attrs))
 driver=CreateFrame('Frame')
 for _,e in ipairs({'UNIT_HEALTH','UNIT_MAXHEALTH','UNIT_POWER_UPDATE','UNIT_MAXPOWER','UNIT_DISPLAYPOWER','UNIT_AURA','UNIT_CONNECTION','UNIT_NAME_UPDATE','PLAYER_TARGET_CHANGED','GROUP_ROSTER_UPDATE','PLAYER_ENTERING_WORLD','PLAYER_REGEN_ENABLED','SPELLS_CHANGED','LEARNED_SPELL_IN_TAB','SPELL_UPDATE_COOLDOWN','BAG_UPDATE_COOLDOWN','PLAYER_EQUIPMENT_CHANGED','UNIT_HEAL_PREDICTION','UNIT_THREAT_SITUATION_UPDATE'}) do pcall(driver.RegisterEvent,driver,e) end
 driver:SetScript('OnEvent',onEvent)
 local fast,slow,scan,cdWait=0,0,0,0
 driver:SetScript('OnUpdate',function(_,dt)
  flush()
  fast=fast+dt;slow=slow+dt;scan=scan+dt;cdWait=cdWait-dt
  -- Notfall- und Überheilungsprüfung 10-mal pro Sekunde (vorher in jedem Frame über alle Felder); Animationen laufen weiter je Frame.
  if scan>=.1 then scanEmergency(scan);scanOverheal();scan=0 end
  if emergencyButton then emergencyPulse=emergencyPulse+dt*6;emergencyButton.emergency:SetAlpha(.35+.35*math.abs(math.sin(emergencyPulse))) end
  if glowActive then
   local now=GetTime();local bossAlpha=.25+.3*math.abs(math.sin(now*5));local overAlpha=.3+.3*math.abs(math.sin(now*8));local any=false
   for _,button in ipairs(buttons) do if button.bossGlow:IsShown() then button.bossGlow:SetAlpha(bossAlpha);any=true end;if button.overhealGlow:IsShown() then button.overhealGlow:SetAlpha(overAlpha);any=true end end
   glowActive=any
  end
  if fast>=.3 then fast=0;scanAggro();for _,button in ipairs(buttons) do if button:IsShown() then updateRange(button);updateThreat(button) end end end
  if slow>=.5 then slow=0;for _,button in ipairs(buttons) do if button:IsShown() then GH.UpdateAuraTimers(button) end end;cdDirty=true end
  -- Cooldown-Leiste höchstens 5-mal pro Sekunde neu zeichnen (SPELL_UPDATE_COOLDOWN kommt bei jedem Zauber mehrfach).
  if cdDirty and cdWait<=0 then cdDirty=false;cdWait=.2;GH.RefreshCooldownBar() end
 end)
 header:Show();GH.ApplyLayout()
end
local login=CreateFrame('Frame');login:RegisterEvent('PLAYER_LOGIN');login:SetScript('OnEvent',function() GH.Initialize();GH.Print('geladen. /gheal öffnet die Einstellungen, /gheal hilfe zeigt die Befehle.') end)
