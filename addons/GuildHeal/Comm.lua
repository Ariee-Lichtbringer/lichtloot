local addonName,GH=...
-- Heilvorhersage über LibHealComm-4.0: dieselbe Bibliothek wie VuhDo, HealBot und Grid in Classic.
-- Damit sieht GuildHeal die laufenden Heilungen aller Heiler mit einem dieser Addons, und umgekehrt.
local HealComm=LibStub and LibStub('LibHealComm-4.0',true)
GH.HealComm=HealComm
local WINDOW=3
local function flags() return HealComm and (HealComm.CASTED_HEALS or HealComm.ALL_HEALS) or 0 end
local function amount(guid,value) if not guid or not value then return 0 end;return value*(HealComm:GetHealModifier(guid) or 1) end
-- Gesamte angekündigte Heilung auf eine Einheit (optional ohne die eigene).
function GH.AddonIncoming(unit,excludeOwn)
 if not HealComm then return 0 end
 local guid=UnitGUID(unit);if not guid then return 0 end
 local value=excludeOwn and HealComm:GetOthersHealAmount(guid,flags(),GetTime()+WINDOW) or HealComm:GetHealAmount(guid,flags(),GetTime()+WINDOW)
 return amount(guid,value)
end
-- Eigene laufende Heilung auf eine Einheit.
function GH.OwnCast(unit)
 if not HealComm then return 0 end
 local guid=UnitGUID(unit);if not guid then return 0 end
 return amount(guid,HealComm:GetHealAmount(guid,flags(),GetTime()+WINDOW,UnitGUID('player')))
end
function GH.HealCommAvailable() return HealComm~=nil end
if HealComm then
 local listener={}
 local function changed(event,casterGUID,spellID,bitType,endTime,...)
  if not GH.RefreshHealthByGuid then return end
  for i=1,select('#',...) do local guid=select(i,...);if guid then GH.RefreshHealthByGuid(guid) end end
 end
 HealComm.RegisterCallback(listener,'HealComm_HealStarted',changed)
 HealComm.RegisterCallback(listener,'HealComm_HealUpdated',changed)
 HealComm.RegisterCallback(listener,'HealComm_HealDelayed',changed)
 HealComm.RegisterCallback(listener,'HealComm_HealStopped',changed)
 HealComm.RegisterCallback(listener,'HealComm_ModifierChanged',function(event,guid) if GH.RefreshHealthByGuid then GH.RefreshHealthByGuid(guid) end end)
end
