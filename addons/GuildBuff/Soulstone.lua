local _,GL=...
local S={};GL.Soulstone=S
local ranks={{item=16896,spell=20757},{item=16895,spell=20756},{item=16893,spell=20755},{item=16892,spell=20752},{item=5232,spell=693}}
local auraIds={[20707]=true,[20762]=true,[20763]=true,[20764]=true,[20765]=true}
local function spellName(id)
 if GetSpellInfo then return GetSpellInfo(id) end
 local v=C_Spell and C_Spell.GetSpellInfo(id);return v and v.name
end
function S.Rank()
 local known,available
 for _,rank in ipairs(ranks) do
  if not known and IsSpellKnown and IsSpellKnown(rank.spell) then known=rank end
  local count=GetItemCount and GetItemCount(rank.item) or C_Item and C_Item.GetItemCount and C_Item.GetItemCount(rank.item) or 0
  if not available and count>0 then available=rank end
 end
 return available,known
end
function S.Holders(rows)
 local holders={}
 for _,row in ipairs(rows or {}) do
  if row.readable then for _,a in ipairs(row.auras or {}) do if auraIds[a.id] then
   holders[#holders+1]={name=row.player..(row.realm and row.realm~='' and '-'..row.realm or ''),remaining=a.remaining};break
  end end end
 end
 table.sort(holders,function(a,b)return a.name<b.name end);return holders
end
local function timer(seconds)
 return seconds and string.format('%d:%02d',math.floor(math.max(0,seconds)/60),math.floor(math.max(0,seconds)%60)) or '?'
end
local function text(parent,value,x,y,width)
 local f=parent:CreateFontString(nil,'OVERLAY','GameFontNormal');f:SetPoint('TOPLEFT',x,y);f:SetWidth(width);f:SetJustifyH('LEFT');f:SetText(value);return f
end
function S.Refresh()
 local f=S.window;if not f or not f:IsShown() then return end
 local available,known=S.Rank();local selected=available or known
 if not InCombatLockdown() then
  f.cast:SetAttribute('type1',available and 'item' or nil);f.cast:SetAttribute('item1',available and 'item:'..available.item or nil);f.cast:SetAttribute('unit1','target')
  f.cast:SetAttribute('type2',known and 'spell' or nil);f.cast:SetAttribute('spell2',known and spellName(known.spell) or nil)
 end
 f.item=selected and selected.item
 local start,duration=0,0
 if available then
  if GetItemCooldown then start,duration=GetItemCooldown(available.item)
  elseif C_Container and C_Container.GetItemCooldown then start,duration=C_Container.GetItemCooldown(available.item) end
 end
 local cooldown=math.max(0,(start or 0)+(duration or 0)-GetTime())
 local targetName,targetRealm=UnitFullName('target')
 local valid=targetName and UnitIsFriend('player','target') and not UnitIsDeadOrGhost('target')
 f.status:SetText(not known and not available and 'Seelenstein noch nicht erlernt' or not available and 'Kein SS in der Tasche\nRechtsklick: herstellen' or cooldown>0 and ('Abklingzeit: '..timer(cooldown)) or valid and ('Bereit für '..targetName..(targetRealm and targetRealm~='' and '-'..targetRealm or '')) or 'Lebendes freundliches Ziel wählen')
 f.border:SetColorTexture(not available and 1 or .2,cooldown>0 and .5 or available and .8 or .1,.1,1)
 local lines={};for _,holder in ipairs(S.Holders(GL.Buffs.Roster())) do lines[#lines+1]=holder.name..' · '..timer(holder.remaining) end
 f.holders:SetText(#lines>0 and table.concat(lines,'\n') or 'Kein aktiver SS bei sichtbaren Spielern erkannt.')
end
function S.Toggle()
 if InCombatLockdown() then print('GuildBuff: SS-Leiste außerhalb des Kampfes öffnen/schließen.');return end
 if S.window then S.window:SetShown(not S.window:IsShown());GL.db.buffPanelVisible=S.window:IsShown();S.Refresh();return end
 local f=CreateFrame('Frame','GuildBuffSoulstonePanel',UIParent,'BackdropTemplate');S.window=f
 f:SetSize(350,250);f:SetPoint('CENTER');f:SetFrameStrata('MEDIUM');f:SetClampedToScreen(true);f:SetMovable(true);f:EnableMouse(true);f:RegisterForDrag('LeftButton')
 f:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});f:SetBackdropColor(.025,.055,.08,.94)
 f:SetScript('OnDragStart',function() if not InCombatLockdown() then f:StartMoving() end end);f:SetScript('OnDragStop',function() f:StopMovingOrSizing();local p,_,rp,x,y=f:GetPoint();GL.db.soulstonePosition={p,rp,x,y} end)
 local pos=GL.db.soulstonePosition;if pos then f:ClearAllPoints();f:SetPoint(pos[1],UIParent,pos[2],pos[3],pos[4]) end
 text(f,'GuildBuff · Seelenstein (SS)',12,-12,300)
 local close=CreateFrame('Button',nil,f,'UIPanelButtonTemplate');close:SetSize(22,22);close:SetPoint('TOPRIGHT',-6,-6);close:SetText('×');close:SetScript('OnClick',S.Toggle)
 local b=CreateFrame('Button',nil,f,'SecureActionButtonTemplate');f.cast=b;b:SetPoint('TOPLEFT',14,-44);b:SetSize(40,40);b:RegisterForClicks('AnyUp','AnyDown')
 f.border=b:CreateTexture(nil,'BACKGROUND');f.border:SetAllPoints();local icon=b:CreateTexture(nil,'ARTWORK');icon:SetPoint('TOPLEFT',2,-2);icon:SetPoint('BOTTOMRIGHT',-2,2);icon:SetTexture('Interface\\Icons\\Spell_Shadow_SoulGem')
 b:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');if f.item then GameTooltip:SetHyperlink('item:'..f.item) else GameTooltip:SetText('Seelenstein') end;GameTooltip:AddLine('Linksklick: SS auf dein aktuelles Ziel anwenden.\nRechtsklick: SS herstellen (Seelensplitter nötig).',1,1,1,true);GameTooltip:Show() end);b:SetScript('OnLeave',function() GameTooltip:Hide() end)
 f.status=text(f,'',64,-48,274)
 text(f,'Aktive Seelensteine · Restzeit',12,-100,320);f.holders=text(f,'',12,-122,326);f.holders:SetHeight(90)
 local report=CreateFrame('Button',nil,f,'UIPanelButtonTemplate');report:SetSize(150,24);report:SetPoint('BOTTOMLEFT',12,10);report:SetText('Raid-Buffcheck');report:SetScript('OnClick',function() GL.Buffs.ShowReport() end)
 text(f,'?: Laufzeit unbekannt',174,-220,170)
 GL.db.buffPanelVisible=true;S.Refresh()
end
local elapsed=0;local frame=CreateFrame('Frame');frame:SetScript('OnUpdate',function(_,dt) elapsed=elapsed+dt;if elapsed>=1 then elapsed=0;if GL.db then S.Refresh() end end end)
