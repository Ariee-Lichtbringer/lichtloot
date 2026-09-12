local _,GL=...
local B={};GL.RaidBank=B
local C=GL.RaidChecklist
local function api(name)return C_Container and C_Container[name] or _G[name]end
local function info(bag,slot)
 local fn=api('GetContainerItemInfo');if not fn then return end
 if C_Container and C_Container.GetContainerItemInfo then return fn(bag,slot)end
 local texture,count,locked,quality,readable,lootable,link=fn(bag,slot)
 if link then return {itemID=GL.GearItemID(link),stackCount=count,isLocked=locked}end
end
local function countSlots(bag)local fn=api('GetContainerNumSlots');return fn and fn(bag) or 0 end
local function cursorBusy()return GetCursorInfo and GetCursorInfo()~=nil end
function B.Stop(message)
 B.job=nil;B.message=message or 'Bank-Auffüllen beendet.'
 if C.Refresh then C.Refresh()end
 print('|cff79e6c5GuildRaidBag:|r '..B.message)
end
local function bagsFor(bank)
 local bags={}
 if bank then bags[1]=-1;for b=5,4+(NUM_BANKBAGSLOTS or 7)do bags[#bags+1]=b end
 else for b=0,(NUM_BAG_SLOTS or 4)do bags[#bags+1]=b end end
 return bags
end
local function destination(id,deposit)
 local get=GetItemInfo or C_Item and C_Item.GetItemInfo
 local maximum=get and select(8,get(id));maximum=tonumber(maximum)or 1
 local locked=false
 for _,bag in ipairs(bagsFor(deposit))do for slot=1,countSlots(bag)do
  local v=info(bag,slot)
  if v and v.itemID==id and (v.stackCount or 1)<maximum then
   if not v.isLocked then return bag,slot,maximum-v.stackCount end;locked=true
  end
 end end
 local familyFn=GetItemFamily or C_Item and C_Item.GetItemFamily
 local family=familyFn and familyFn(id)or 0
 for _,bag in ipairs(bagsFor(deposit))do
  local free=api('GetContainerNumFreeSlots');local bagFamily=free and select(2,free(bag))or ((bag==0 or bag==-1)and 0 or nil)
  local compatible=bagFamily==0 or (bagFamily and bit and bit.band and bit.band(family or 0,bagFamily)~=0)
  if compatible then for slot=1,countSlots(bag)do if not info(bag,slot)then return bag,slot,maximum end end end
 end
 return nil,nil,nil,locked
end
local function source(id,deposit)
 local bags=bagsFor(not deposit)
 local locked=false
 for _,bag in ipairs(bags)do for slot=1,countSlots(bag)do
  local v=info(bag,slot)
  if v and v.itemID==id then if not v.isLocked then return bag,slot,v end;locked=true end
 end end
 return nil,nil,nil,locked
end
function B.Start(target,deposit)
 if B.job then B.Stop('Banktransfer abgebrochen.');return end
 B.targetKey=target and target.key
 if not C.bankOpen then B.Stop('Bitte zuerst deine Bank öffnen.');return end
 if InCombatLockdown and InCombatLockdown()then B.Stop('Im Kampf kann nicht aufgefüllt werden.');return end
 if cursorBusy()then B.Stop('Bitte zuerst den Gegenstand am Mauszeiger ablegen.');return end
 if not api('PickupContainerItem')or not api('SplitContainerItem')then B.Stop('Die Bank-Funktion ist in diesem Client nicht verfügbar.');return end
 local _,readable=C.Inventory();if not readable then B.Stop('Taschen sind derzeit nicht lesbar.');return end
 local quantities,order={},{}
 for _,entry in ipairs(C.List(target.key,target.base))do
  if not quantities[entry.id]then order[#order+1]=entry.id end
  -- The same item can appear in several categories; C.Check counts it in each.
  quantities[entry.id]=math.max(quantities[entry.id]or 0,entry.quantity)
 end
 if #order==0 then B.Stop('Die ausgewählte Checkliste ist leer.');return end
 B.job={deposit=deposit==true,key=target.key,quantities=quantities,order=order,moved=0,elapsed=0};B.message=deposit and 'Checklisten-Gegenstände werden eingelagert …' or 'Fehlende Gegenstände werden aus der Bank geholt …';C.Refresh();B.Pump(0)
end
function B.Step(delta)
 local job=B.job;if not job then return end
 if not C.bankOpen then B.Stop('Bank geschlossen – Banktransfer gestoppt.');return end
 if InCombatLockdown and InCombatLockdown()then B.Stop('Kampf begonnen – Banktransfer gestoppt.');return end
 local selected=C.SelectedTarget and C.SelectedTarget()
 if selected and selected.key~=job.key then B.Stop('Checkliste gewechselt – Banktransfer gestoppt.');return end
 if cursorBusy()then B.Stop('Gegenstand am Mauszeiger – Banktransfer gestoppt.');return end
 local counts,readable=C.Inventory();if not readable then B.Stop('Taschen sind derzeit nicht lesbar.');return end
 job.elapsed=job.elapsed+(delta or 0)
 if job.pending then
  local p=job.pending
  if (not job.deposit and (counts[p.id]or 0)<p.before+p.amount)or (job.deposit and (counts[p.id]or 0)>p.before-p.amount)then
   if job.elapsed>5 then B.Stop('Übertragung nicht bestätigt. Bitte Taschen prüfen und erneut starten.');end
   return
  end
  job.moved=job.moved+p.amount;job.pending=nil;job.elapsed=0
 end
 local missing,absent,full,locked=0,0,false,false
 for _,id in ipairs(job.order)do
  local need=math.max(0,job.quantities[id]-(counts[id]or 0))
  if job.deposit then
   need=0;for _,bag in ipairs(bagsFor(false))do for slot=1,countSlots(bag)do local v=info(bag,slot);if v and v.itemID==id then need=need+(v.stackCount or 1)end end end
  end
  if need>0 then
   missing=missing+need
   local sb,ss,item,sourceLocked=source(id,job.deposit)
   if not sb then if sourceLocked then locked=true else absent=absent+need end
   else
    local db,ds,space,destLocked=destination(id,job.deposit)
    if not db then if destLocked then locked=true else full=true end
    else
     local amount=math.min(need,item.stackCount or 1,space)
     job.pending={id=id,before=counts[id]or 0,amount=amount};job.elapsed=0
     local ok=pcall(function()
      if amount<(item.stackCount or 1)then api('SplitContainerItem')(sb,ss,amount)else api('PickupContainerItem')(sb,ss)end
      local kind,cursorID=GetCursorInfo()
      if kind~='item'or cursorID~=id then error('pickup failed')end
      api('PickupContainerItem')(db,ds)
      if cursorBusy()then error('placement failed')end
     end)
     if not ok then
      -- Only this synchronous operation owns the cursor. ClearCursor returns it.
      if cursorBusy()and ClearCursor then ClearCursor()end
      B.Stop('Gegenstand konnte nicht verschoben werden. Bitte Taschen prüfen.');return
     end
     B.message=job.deposit and 'Zurücklegen läuft …' or 'Bank-Auffüllen läuft …';return
    end
   end
  end
 end
 if locked then
  if job.elapsed>8 then B.Stop('Gegenstände bleiben gesperrt. Bitte später erneut versuchen.');end
  return
 end
 if job.deposit then
  if missing==0 then B.Stop(job.moved..' Gegenstände zurück auf die Bank gelegt. Angelegte Ausrüstung bleibt angelegt.')
  else B.Stop('Kein passender Bankplatz · '..job.moved..' eingelagert · '..missing..' noch in den Taschen.')end
  return
 end
 if missing==0 then B.Stop('Checkliste vollständig · '..job.moved..' Gegenstände aus der Bank geholt.')
 elseif full then B.Stop('Kein passender Taschenplatz · '..missing..' fehlen noch'..(absent>0 and (' ('..absent..' nicht auf der Bank).')or '.'))
 else B.Stop(job.moved..' Gegenstände geholt · '..absent..' fehlen auf der Bank.')end
end
-- Continue confirmed transfers in the same frame. Never issue a second
-- operation while the previous transfer is awaiting its inventory update.
function B.Pump(delta)
 for i=1,8 do
  local job=B.job;if not job then return end
  local pending=job.pending
  B.Step(i==1 and delta or 0)
  if not B.job or B.job.pending==pending then return end
 end
end
local frame=CreateFrame('Frame');B.frame=frame
local elapsed,refreshElapsed,wake=0,0,false
for _,event in ipairs({'BANKFRAME_CLOSED','PLAYER_REGEN_DISABLED','BAG_UPDATE_DELAYED','ITEM_LOCK_CHANGED'})do frame:RegisterEvent(event)end
frame:SetScript('OnEvent',function(_,event)
 if not B.job then return end
 if event=='BANKFRAME_CLOSED' or event=='PLAYER_REGEN_DISABLED' then
  B.Stop(event=='BANKFRAME_CLOSED'and 'Bank geschlossen – Banktransfer gestoppt.'or 'Kampf begonnen – Banktransfer gestoppt.')
 else wake=true end
end)
frame:SetScript('OnUpdate',function(_,dt)
 if not B.job then elapsed=0;refreshElapsed=0;wake=false;return end
 elapsed=elapsed+dt;refreshElapsed=refreshElapsed+dt
 if wake or elapsed>=.05 then
  local delta=elapsed;elapsed=0;wake=false;B.Pump(delta)
  if B.job and refreshElapsed>=.15 then refreshElapsed=0;C.Refresh()end
 end
end)
