local addonName,GH=...
-- Eigener Zauberbalken im GuildHeal-Stil: ersetzt den Blizzard-Balken, frei verschiebbar (UI bearbeiten oder Ziehen am Balken außerhalb des Kampfes).
local bar,blizzardHidden
local function db() return GH.DB() end
local function hideBlizzard(hide)
 local blizz=PlayerCastingBarFrame or CastingBarFrame;if not blizz then return end
 if hide and not blizzardHidden then blizz:UnregisterAllEvents();blizz:Hide();blizzardHidden=true
 elseif not hide and blizzardHidden then
  for _,e in ipairs({'UNIT_SPELLCAST_START','UNIT_SPELLCAST_STOP','UNIT_SPELLCAST_FAILED','UNIT_SPELLCAST_INTERRUPTED','UNIT_SPELLCAST_DELAYED','UNIT_SPELLCAST_CHANNEL_START','UNIT_SPELLCAST_CHANNEL_UPDATE','UNIT_SPELLCAST_CHANNEL_STOP','UNIT_SPELLCAST_INTERRUPTIBLE','UNIT_SPELLCAST_NOT_INTERRUPTIBLE','PLAYER_ENTERING_WORLD'}) do pcall(blizz.RegisterEvent,blizz,e) end
  blizzardHidden=false
 end
end
local function build()
 if bar then return end
 bar=CreateFrame('Frame','GuildHealCastBar',UIParent);bar:SetSize(240,22);bar:SetFrameStrata('HIGH');bar:SetMovable(true);bar:SetClampedToScreen(true);bar:EnableMouse(false)
 bar.bg=bar:CreateTexture(nil,'BACKGROUND');bar.bg:SetAllPoints()
 bar.border=bar:CreateTexture(nil,'BACKGROUND',nil,-1);bar.border:SetPoint('TOPLEFT',-1,1);bar.border:SetPoint('BOTTOMRIGHT',1,-1);bar.border:SetColorTexture(.35,.5,.6,.9)
 bar.icon=bar:CreateTexture(nil,'ARTWORK');bar.icon:SetPoint('TOPLEFT',1,-1);bar.icon:SetPoint('BOTTOMLEFT',1,1);bar.icon:SetWidth(20);bar.icon:SetTexCoord(.08,.92,.08,.92)
 bar.status=CreateFrame('StatusBar',nil,bar);bar.status:SetPoint('TOPLEFT',22,-1);bar.status:SetPoint('BOTTOMRIGHT',-1,1);bar.status:SetMinMaxValues(0,1)
 bar.status.bg=bar.status:CreateTexture(nil,'BACKGROUND');bar.status.bg:SetAllPoints();bar.status.bg:SetColorTexture(0,0,0,.35)
 bar.name=bar.status:CreateFontString(nil,'OVERLAY');bar.name:SetFont(STANDARD_TEXT_FONT,11,'OUTLINE');bar.name:SetPoint('LEFT',6,0);bar.name:SetPoint('RIGHT',-44,0);bar.name:SetJustifyH('LEFT');bar.name:SetWordWrap(false)
 bar.time=bar.status:CreateFontString(nil,'OVERLAY');bar.time:SetFont(STANDARD_TEXT_FONT,11,'OUTLINE');bar.time:SetPoint('RIGHT',-6,0)
 bar.handle=CreateFrame('Frame',nil,bar);bar.handle:SetAllPoints();bar.handle:EnableMouse(true);bar.handle:RegisterForDrag('LeftButton');bar.handle:SetFrameLevel(bar:GetFrameLevel()+5)
 bar.handle:SetScript('OnDragStart',function() if not InCombatLockdown() then bar:StartMoving() end end)
 bar.handle:SetScript('OnDragStop',function() bar:StopMovingOrSizing();local point,_,_,x,y=bar:GetPoint();db().castbarPosition={point=point,x=x,y=y} end)
 bar.handle:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Zauberbalken');GameTooltip:AddLine('Mit gedrückter linker Maustaste ziehen verschiebt den Balken (außerhalb des Kampfes).',1,1,1,true);GameTooltip:Show() end);bar.handle:SetScript('OnLeave',function() GameTooltip:Hide() end)
 bar:SetScript('OnUpdate',function(self,dt)
  if self.preview then return end
  if not self.casting then return end
  local now=GetTime()*1000
  local progress=self.channel and (self.endTime-now)/(self.endTime-self.startTime) or (now-self.startTime)/(self.endTime-self.startTime)
  if progress>=1 or progress<0 then if not self.channel and progress>=1 then self.casting=false;self.fade=.5 end;progress=math.max(0,math.min(1,progress)) end
  self.status:SetValue(progress);self.time:SetText(string.format('%.1f',math.max(0,(self.endTime-now)/1000)))
 end)
 bar:HookScript('OnUpdate',function(self,dt) if self.fade then self.fade=self.fade-dt;self:SetAlpha(math.max(0,self.fade/.5));if self.fade<=0 then self.fade=nil;self:Hide();self:SetAlpha(1) end end end)
 bar:Hide()
end
local function applyStyle()
 local d=db();local r,g,b=GH.Color('bg');bar.bg:SetColorTexture(r,g,b,.95)
 bar.status:SetStatusBarTexture(GH.BarTexture());bar.status:SetStatusBarColor(GH.Color('castbar'))
 bar:SetSize(d.castbarWidth or 240,d.castbarHeight or 22);bar.icon:SetWidth((d.castbarHeight or 22)-2)
 bar.name:SetFont(STANDARD_TEXT_FONT,math.max(9,(d.castbarHeight or 22)-11),'OUTLINE');bar.time:SetFont(STANDARD_TEXT_FONT,math.max(9,(d.castbarHeight or 22)-11),'OUTLINE')
 bar:ClearAllPoints();local p=d.castbarPosition
 if p and p.point then bar:SetPoint(p.point,UIParent,p.point,p.x or 0,p.y or 0) else bar:SetPoint('CENTER',UIParent,'CENTER',0,-170) end
 bar.handle:EnableMouse(not d.locked)
end
local function startCast(channel)
 local name,_,texture,startTime,endTime,_,_,notInterruptible
 if channel then name,_,texture,startTime,endTime,_,notInterruptible=UnitChannelInfo('player') else name,_,texture,startTime,endTime,_,_,notInterruptible=UnitCastingInfo('player') end
 if not name then return end
 bar.casting=true;bar.channel=channel;bar.startTime=startTime;bar.endTime=endTime;bar.fade=nil;bar:SetAlpha(1)
 bar.icon:SetTexture(texture);bar.name:SetText(name);bar.status:SetStatusBarColor(GH.Color('castbar'));bar:Show()
end
local function stopCast(interrupted)
 if not bar.casting then return end
 bar.casting=false
 if interrupted then bar.status:SetValue(1);bar.status:SetStatusBarColor(1,.2,.2);bar.name:SetText('Unterbrochen');bar.time:SetText('') end
 bar.fade=interrupted and .8 or .3
end
function GH.CastBarPreview(show)
 if not bar then return end
 if show then bar.preview=true;bar.casting=false;bar.fade=nil;bar:SetAlpha(1);bar.icon:SetTexture('Interface\\Icons\\Spell_Holy_Heal');bar.name:SetText('Zauberbalken · hier ziehen');bar.time:SetText('1.5');bar.status:SetValue(.6);bar.status:SetStatusBarColor(GH.Color('castbar'));bar:Show()
 else bar.preview=nil;if not bar.casting then bar:Hide() end end
end
function GH.ApplyCastBar()
 local d=db();build()
 -- Aus, wenn der Zauberbalken abgewählt ist oder GuildHeal ausgeblendet wurde (Haken in der GuildLoot-Seitenleiste, /gheal):
 -- dann bekommt Blizzard seinen Balken zurück.
 if d.castbar==false or d.hidden then hideBlizzard(false);GH.CastBarPreview(false);bar.casting=false;bar.fade=nil;bar:Hide();return end
 hideBlizzard(true);applyStyle()
 GH.CastBarPreview(not d.locked)
end
function GH.ResetCastBarPosition() db().castbarPosition=nil;GH.ApplyCastBar() end
local frame=CreateFrame('Frame')
for _,e in ipairs({'UNIT_SPELLCAST_START','UNIT_SPELLCAST_STOP','UNIT_SPELLCAST_FAILED','UNIT_SPELLCAST_INTERRUPTED','UNIT_SPELLCAST_DELAYED','UNIT_SPELLCAST_CHANNEL_START','UNIT_SPELLCAST_CHANNEL_UPDATE','UNIT_SPELLCAST_CHANNEL_STOP'}) do if frame.RegisterUnitEvent then frame:RegisterUnitEvent(e,'player') else frame:RegisterEvent(e) end end
frame:RegisterEvent('PLAYER_LOGIN')
frame:SetScript('OnEvent',function(_,event,unit)
 if event=='PLAYER_LOGIN' then GH.ApplyCastBar();return end
 if unit~='player' or not bar or db().castbar==false then return end
 if event=='UNIT_SPELLCAST_START' then startCast(false)
 elseif event=='UNIT_SPELLCAST_CHANNEL_START' then startCast(true)
 elseif event=='UNIT_SPELLCAST_DELAYED' or event=='UNIT_SPELLCAST_CHANNEL_UPDATE' then local ch=event=='UNIT_SPELLCAST_CHANNEL_UPDATE';local _,_,_,s,e=ch and UnitChannelInfo('player') or UnitCastingInfo('player');if s and e then bar.startTime=s;bar.endTime=e end
 elseif event=='UNIT_SPELLCAST_INTERRUPTED' or event=='UNIT_SPELLCAST_FAILED' then stopCast(event=='UNIT_SPELLCAST_INTERRUPTED')
 elseif event=='UNIT_SPELLCAST_STOP' or event=='UNIT_SPELLCAST_CHANNEL_STOP' then stopCast(false) end
end)
