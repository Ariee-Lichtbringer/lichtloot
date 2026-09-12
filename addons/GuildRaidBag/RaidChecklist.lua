local _,GL=...
local C={};GL.RaidChecklist=C
C.raids={{'mc','Molten Core'},{'bwl','Blackwing Lair'},{'ony','Onyxia'},{'zg','Zul’Gurub'},{'aq20','AQ20'},{'aq40','AQ40'},{'naxx','Naxxramas'}}
C.categories={{'consumable','Verbrauchsmaterial'},{'frost','Frostresi-Gear'},{'nature','Naturresi-Gear'},{'gear','Ausrüstung'}}
local function norm(v)return tostring(v or ''):gsub('Ä','ä'):gsub('Ö','ö'):gsub('Ü','ü'):lower():gsub('%s','')end
local function safe(v)return tostring(v or ''):gsub('|','||')end
function C.Store()
 GL.db.raidChecklists=GL.db.raidChecklists or {};local id=UnitGUID('player');if not id then return nil end
 GL.db.raidChecklists[id]=GL.db.raidChecklists[id] or {lists={},reminded={},reminders=true}
 local s=GL.db.raidChecklists[id];s.lists=s.lists or {};s.reminded=s.reminded or {};return s
end
function C.RaidKind(raid,data)
 for _,r in ipairs(data and data.rows or {}) do if r.id==raid.id or r.raidId==raid.id then
  local kind=norm(r.kind or r.raidType);for _,pair in ipairs(C.raids) do if pair[1]==kind then return kind end end
 end end
 local name=norm(raid.name)
 for _,pair in ipairs(C.raids) do if name:find(pair[1],1,true) or name:find(norm(pair[2]),1,true) then return pair[1] end end
 if name:find('geschmolzenerkern',1,true) then return 'mc' end
 if name:find('pechschwingen',1,true) then return 'bwl' end
 if name:find('zulgurub',1,true) or name:find("zul'gurub",1,true) then return 'zg' end
end
function C.Events(now)
 local result={};local name,realm=UnitFullName('player');realm=realm and realm~='' and realm or GetRealmName()
 for guild,profile in pairs(GL.db.guildProfiles or {}) do
  for _,p in pairs(profile.personal or {}) do if norm(p.player)==norm(name) and norm(p.realm)==norm(realm) then
   for _,r in ipairs(p.calendar or {}) do if tonumber(r.startsAt) and r.startsAt>now and r.id then
    result[#result+1]={key='event:'..guild..':'..r.id,id=r.id,guild=guild,name=r.name,startsAt=r.startsAt,date=r.date,clock=r.clock,base=C.RaidKind(r,profile.activeRaids),exportedAt=p.exportedAt}
   end end
  end end
 end
 table.sort(result,function(a,b)if a.startsAt==b.startsAt then return a.key<b.key end;return a.startsAt<b.startsAt end);return result
end
function C.List(key,base,edit)
 local s=C.Store();if not s then return {} end
 local list=s.lists[key]
 if not list and edit then
  list={};for _,entry in ipairs(s.lists[base] or {}) do local copy={};for k,v in pairs(entry)do copy[k]=v end;list[#list+1]=copy end;s.lists[key]=list
 end
 return list or s.lists[base] or {}
end
function C.Add(key,base,id,quantity,category)
 id=tonumber(id);quantity=tonumber(quantity)
 if not id or id%1~=0 or id<1 or id>1000000 then error('Bitte ein Item aus der Tasche hineinziehen oder eine gültige Item-ID eintragen.') end
 if not quantity or quantity%1~=0 or quantity<1 or quantity>999 then error('Bitte eine Menge von 1 bis 999 eintragen.') end
 local valid=false;for _,v in ipairs(C.categories) do if category==v[1] then valid=true end end;if not valid then error('Kategorie fehlt.') end
 local list=C.List(key,base,true)
 for _,e in ipairs(list) do if e.id==id and e.category==category then e.quantity=quantity;return end end
 if #list>=100 then error('Maximal 100 Einträge pro Checkliste.') end
 list[#list+1]={id=id,quantity=quantity,category=category}
 if C_Item and C_Item.RequestLoadItemDataByID then C_Item.RequestLoadItemDataByID(id) end
end
function C.AddSet(key,base,set,category)
 local counts={}
 for slot,item in pairs(set or {}) do if slot~=4 and slot~=19 then local id=GL.GearItemID(item);if id then counts[id]=(counts[id] or 0)+1 end end end
 local n=0;for _ in pairs(counts)do n=n+1 end;if n==0 then error('Das Ausrüstungsset ist leer.') end
 local list=C.List(key,base);local extra=0
 for id in pairs(counts)do local found=false;for _,entry in ipairs(list)do if entry.id==id and entry.category==category then found=true end end;if not found then extra=extra+1 end end
 if #list+extra>100 then error('Das Set überschreitet die Grenze von 100 Einträgen.') end
 for id,count in pairs(counts)do C.Add(key,base,id,count,category)end
end
function C.Inventory()
 local counts={};local bagAPI=C_Container or {};local size=bagAPI.GetContainerNumSlots or GetContainerNumSlots;local info=bagAPI.GetContainerItemInfo or GetContainerItemInfo;local itemID=bagAPI.GetContainerItemID or GetContainerItemID
 local readable=size~=nil and info~=nil and GetInventoryItemLink~=nil
 local function add(id,n)if id then counts[id]=(counts[id] or 0)+(n or 1)end end
 if size and info then for bag=0,(NUM_BAG_SLOTS or 4) do for slot=1,(size(bag) or 0)do
  if bagAPI.GetContainerItemInfo then local v=info(bag,slot);if v then add(v.itemID or itemID and itemID(bag,slot),v.stackCount)end
  else local _,count,_,_,_,_,link=info(bag,slot);add(itemID and itemID(bag,slot) or GL.GearItemID(link),count)end
 end end end
 if GetInventoryItemLink then for slot=1,19 do add(GL.GearItemID(GetInventoryItemLink('player',slot)),1)end end
 return counts,readable
end
function C.Check(key,base)
 local counts,readable=C.Inventory();local rows={};local total=0
 for _,entry in ipairs(C.List(key,base))do
  local have=counts[entry.id] or 0;local missing=readable and math.max(0,entry.quantity-have) or nil
  rows[#rows+1]={entry=entry,have=have,missing=missing};if missing and missing>0 then total=total+1 end
 end
 return rows,total,readable
end
function C.Reminders(now)
 local s=C.Store();if not s or s.reminders==false then return {} end
 local result={}
 for key,at in pairs(s.reminded)do if type(at)~='number' or at<now-7*86400 then s.reminded[key]=nil end end
 for _,e in ipairs(C.Events(now))do
  local key=e.key..':'..e.startsAt
  if e.startsAt-now<=1800 and not s.reminded[key] then
   s.reminded[key]=e.startsAt;result[#result+1]=e
  end
 end
 return result
end
function C.CaptureBank()
 if not C.bankOpen or not C.Store() then return false end
 local api=C_Container or {};local size=api.GetContainerNumSlots or GetContainerNumSlots;local info=api.GetContainerItemInfo or GetContainerItemInfo;local ids=api.GetContainerItemID or GetContainerItemID
 if not size or not info then return false end
 local counts={};local bags={-1};for bag=5,4+(NUM_BANKBAGSLOTS or 7)do bags[#bags+1]=bag end
 for _,bag in ipairs(bags)do for slot=1,(size(bag) or 0)do
  local id,n
  if api.GetContainerItemInfo then local item=info(bag,slot);if item then id=item.itemID or ids and ids(bag,slot);n=item.stackCount end
  else local _,count,_,_,_,_,link=info(bag,slot);id=ids and ids(bag,slot) or GL.GearItemID(link);n=count end
  if id then counts[id]=(counts[id] or 0)+(n or 1);if C_Item and C_Item.RequestLoadItemDataByID then C_Item.RequestLoadItemDataByID(id)end end
 end end
 C.Store().bank={counts=counts,at=GetServerTime()};return true
end
function C.GearChoices()
 local counts=C.Inventory();local bank=C.Store().bank;local ids={};for id in pairs(counts)do ids[id]=true end;for id in pairs(bank and bank.counts or {})do ids[id]=true end
 local result={};local fn=GetItemInfoInstant or C_Item and C_Item.GetItemInfoInstant
 for id in pairs(ids)do
  local _,_,_,equip,icon,classID;if fn then _,_,_,equip,icon,classID=fn(id)end
  if classID==2 or classID==4 or (equip and equip~='' and equip~='INVTYPE_BAG')then
   result[#result+1]={id=id,group='gear',icon=icon,name='Item #'..id}
  end
 end
 return result
end
local window,selected,category,page=nil,nil,'consumable',0
local catalogPage,catalogGroup,query=0,'all',''
local popup
function C.SelectedTarget()return selected end
local function label(parent,value,x,y,width)
 local f=parent:CreateFontString(nil,'OVERLAY','GameFontHighlight');f:SetPoint('TOPLEFT',x,y);f:SetWidth(width);f:SetJustifyH('LEFT');f:SetText(value);return f
end
local function button(parent,value,x,y,width,fn)
 local b=CreateFrame('Button',nil,parent);b:SetPoint('TOPLEFT',x,y);b:SetSize(width,28)
 local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();if value=='×' then bg:SetColorTexture(.65,.10,.12,.96) else bg:SetColorTexture(.12,.20,.26,.96) end
 b.label=label(b,value,8,-7,width-16);b:SetScript('OnClick',fn);return b
end
local function itemInfo(id)
 local fn=GetItemInfo or C_Item and C_Item.GetItemInfo
 local data=GL.RaidcheckItemsByID and GL.RaidcheckItemsByID[id] or GL.ClassicItemsByID and GL.ClassicItemsByID[id]
 if fn then local name,_,_,_,_,_,_,_,_,icon=fn(id);if name then return name,icon end end
 return data and data.name or ('Item #'..id),data and data.icon
end
function C.Report()
 local store=C.Store();if not store then return end
 local target=selected or store.selection or {key='naxx',label='Naxxramas · Standardliste'}
 local rows,missing,readable=C.Check(target.key,target.base)
 print('|cff79e6c5GuildRaidBag:|r '..safe(target.label))
 if #rows==0 then print('Die Checkliste ist leer. Mit Linksklick auf den Koffer oder /glcheck auswählen und befüllen.');return end
 print(readable and (missing==0 and 'Alles dabei.' or missing..' Einträge fehlen.')or 'Taschen derzeit nicht prüfbar.')
 for _,row in ipairs(rows)do
  local name=itemInfo(row.entry.id);local bank=store.bank and store.bank.counts[row.entry.id]or 0
  local state=not readable and 'Bestand unbekannt' or 'Dabei: '..row.have..' / '..row.entry.quantity..(row.missing==0 and ' · vollständig' or ' · fehlen: '..row.missing)
  local color=not readable and '|cffffcc40' or row.missing==0 and '|cff66ff66' or '|cffff7777'
  print(color..safe(name)..'|r — '..state..(store.bank and (' · auf Bank: '..bank)or ' · Bank unbekannt'))
 end
 if store.bank then print('Bankstand: '..date('%d.%m. %H:%M',store.bank.at)..' · Bankitems zählen nicht als dabei.')end
end
local function tooltip(self,id)
 GameTooltip:SetOwner(self,'ANCHOR_RIGHT')
 local data=GL.RaidcheckItemsByID and GL.RaidcheckItemsByID[id] or GL.ClassicItemsByID and GL.ClassicItemsByID[id]
 local fn=GetItemInfo or C_Item and C_Item.GetItemInfo
 if fn and fn(id) then GameTooltip:SetHyperlink('item:'..id)
 else GameTooltip:SetText(itemInfo(id));if data and data.tooltip then GameTooltip:AddLine(data.tooltip,1,1,1,true)end end
 GameTooltip:Show()
end
local function menu(owner,choices)
 if not popup then
  local p=CreateFrame('Frame',nil,window);popup=p;p:SetFrameStrata('FULLSCREEN_DIALOG');p:SetClampedToScreen(true);p:EnableMouse(true);p.rows={}
  local bg=p:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.025,.045,.065,1)
  function p:Refresh()for i,b in ipairs(self.rows)do local v=self.choices[self.offset+i];b:SetShown(v~=nil);b.choice=v;if v then b.label:SetText(v.label)end end end
  for i=1,12 do p.rows[i]=button(p,'',4,-4-(i-1)*29,422,function(self)if self.choice then local v=self.choice;p:Hide();v.fn()end end)end
  p:EnableMouseWheel(true);p:SetScript('OnMouseWheel',function(self,delta)self.offset=math.max(0,math.min(math.max(0,#self.choices-12),self.offset-delta));self:Refresh()end)
  p.close=button(p,'Schließen · Mausrad: weitere Einträge',4,0,422,function()p:Hide()end)
 end
 local p=popup;p.choices=choices;p.offset=0;p:SetSize(430,math.min(12,#choices)*29+36);p:ClearAllPoints();p:SetPoint('TOPLEFT',owner,'BOTTOMLEFT',0,-2);p.close:ClearAllPoints();p.close:SetPoint('TOPLEFT',4,-4-math.min(12,#choices)*29);p:Refresh();p:Show()
end
local catalogCache={}
function C.CatalogChoices(group,search)
 search=norm(search)
 local key=group..':'..search
 if group~='gear' and catalogCache[key]then return catalogCache[key]end
 local source,result,seen={},{},{}
 local function add(entry)if not seen[entry.id]then source[#source+1]=entry;seen[entry.id]=true end end
 for _,entry in ipairs(GL.RaidcheckItems or {})do add(entry)end
 if group=='all' or group=='gear' then
  for _,entry in ipairs(GL.ClassicItems or {})do add(entry)end
  for _,entry in ipairs(C.GearChoices())do add(entry)end
 end
 for _,entry in ipairs(source)do
  entry.searchKey=entry.searchKey or norm(entry.name)..' '..norm(entry.aliases)
  local matches=tonumber(search) and tostring(entry.id)==search or not tonumber(search) and (search=='' or entry.searchKey:find(search,1,true))
  if matches and (group=='all' or group=='gear' and (entry.group=='gear' or entry.category=='gear')or entry.group==group)then
   result[#result+1]=entry
  end
 end
 table.sort(result,function(a,b)if a.name==b.name then return a.id<b.id end;return a.name<b.name end)
 -- Keep only the most recent search, rather than retaining every typed prefix.
 if group~='gear' then catalogCache={[key]=result}end
 return result
end
function C.Refresh()
 if not window or not window:IsShown()or not selected then return end
 local rows,missing,readable=C.Check(selected.key,selected.base);local store=C.Store();local bank=store.bank
 page=math.max(0,math.min(page,math.max(0,#rows-9)))
 window.title:SetText(selected.label);store.selection={key=selected.key,base=selected.base,label=selected.label}
 window.saved:SetText(selected.base and (store.lists[selected.key] and 'Eigene Terminliste · automatisch gespeichert' or 'Verwendet die Standardliste · Änderungen gelten nur hier')or 'Standardliste · automatisch für diesen Charakter gespeichert')
 window.summary:SetText(#rows==0 and 'Wähle links Gegenstände für deine Checkliste.' or not readable and 'Taschen derzeit nicht prüfbar.' or missing==0 and 'Alles dabei.' or missing..' Einträge fehlen in deinen Taschen.')
 for i,row in ipairs(window.rows)do local data=rows[page+i];row:SetShown(data~=nil)
  if data then row.index=page+i;row.itemID=data.entry.id;row.entryCategory=data.entry.category;row.targetQuantity=data.entry.quantity;local identity=selected.key..':'..row.itemID..':'..row.entryCategory
   if row.quantity.identity~=identity then row.quantity.identity=identity;row.quantity.dirty=false;row.quantity:ClearFocus()end
   if not row.quantity.dirty then row.quantity:SetText(tostring(data.entry.quantity))end
   local name,icon=itemInfo(row.itemID);row.icon:SetTexture(icon or 'Interface\\Icons\\INV_Misc_QuestionMark');row.name:SetText(safe(name));local n=bank and bank.counts[row.itemID]or 0
   row.state:SetText('Dabei: '..data.have..' / '..data.entry.quantity..' · Bank: '..(bank and n or '?')..(data.missing==0 and ' · OK' or ''))
   row.state:SetTextColor(data.missing==0 and .3 or 1,data.missing==0 and 1 or .5,.3)
  end
 end
 window.page:SetText((#rows>0 and page+1 or 0)..'–'..math.min(page+9,#rows)..' / '..#rows)
 if window.listScroll then window.listScroll.syncing=true;window.listScroll:SetMinMaxValues(0,math.max(0,#rows-9));window.listScroll:SetValue(page);window.listScroll.syncing=false end
 local choices=C.CatalogChoices(catalogGroup,query);catalogPage=math.max(0,math.min(catalogPage,math.max(0,#choices-9)))
 local counts=C.Inventory()
 for i,row in ipairs(window.catalog)do local item=choices[catalogPage+i];row:SetShown(item~=nil);row.item=item
  if item then local name,icon=itemInfo(item.id);row.icon:SetTexture(icon or item.icon or 'Interface\\Icons\\INV_Misc_QuestionMark');row.name:SetText(safe(name or item.name));row.state:SetText('Tasche / angelegt: '..(counts[item.id]or 0)..(catalogGroup=='gear' and (' · Bank: '..(bank and bank.counts[item.id]or 0))or ''))end
 end
 window.catalogPage:SetText((#choices>0 and catalogPage+1 or 0)..'–'..math.min(catalogPage+9,#choices)..' / '..#choices..' Items')
 if window.catalogScroll then window.catalogScroll.syncing=true;window.catalogScroll:SetMinMaxValues(0,math.max(0,#choices-9));window.catalogScroll:SetValue(catalogPage);window.catalogScroll.syncing=false end
 if GL.RaidMats and GL.RaidMats.RefreshSummary then GL.RaidMats.RefreshSummary()end
 if window.deposit then local busy=GL.RaidBank and GL.RaidBank.job;window.deposit:SetEnabled(C.bankOpen==true and not busy)end
 if window.withdraw then local busy=GL.RaidBank and GL.RaidBank.job;window.withdraw:SetEnabled(C.bankOpen==true or busy~=nil);window.withdraw.label:SetText(busy and 'Transfer stoppen' or 'Von Bank auffüllen');if GL.RaidBank and GL.RaidBank.targetKey==selected.key and GL.RaidBank.message then window.summary:SetText(GL.RaidBank.message)end end
 window.bank:SetText(bank and ('Bankstand: '..date('%d.%m. %H:%M',bank.at)..' · Bankitems zählen nicht als dabei.')or 'Bank unbekannt: einmal am Bankier öffnen, um Ausrüstung einzulesen.')
 window.reminders:SetChecked(store.reminders~=false)
end
-- Scale the fixed two-column layout so every control remains visible.
function C.ClampWindowScale(value,width,height)
 local maximum=math.max(.1,math.min(1.5,(width-30)/940,(height-30)/860))
 local minimum=math.min(.45,maximum)
 local n=tonumber(value);if not n or n~=n then n=math.min(1,maximum)end
 return math.max(minimum,math.min(maximum,n))
end
function C.SetupWindowResize(f)
 local grip=CreateFrame('Button',nil,f);f.resizeGrip=grip;grip:SetSize(24,24);grip:SetPoint('BOTTOMRIGHT',-2,2)
 grip:SetNormalTexture('Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up');grip:SetHighlightTexture('Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Highlight');grip:SetPushedTexture('Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Down')
 local drag
 local function apply(value)
  local scale=C.ClampWindowScale(value,UIParent:GetWidth(),UIParent:GetHeight())
  f:SetScale(scale)
  if drag then f:ClearAllPoints();f:SetPoint('TOPLEFT',UIParent,'BOTTOMLEFT',drag.left/scale,drag.top/scale)end
  return scale
 end
 local function finish()
  if not drag then return end
  C.Store().windowScale=f:GetScale();drag=nil;grip:SetScript('OnUpdate',nil)
 end
 grip:SetScript('OnMouseDown',function(_,which)
  if which=='RightButton' then finish();C.Store().windowScale=nil;apply(nil);return end
  if which~='LeftButton' then return end
  f:StopMovingOrSizing();if popup then popup:Hide()end
  local unit=UIParent:GetEffectiveScale();local x,y=GetCursorPosition();local scale=f:GetScale()
  drag={x=x/unit,y=y/unit,scale=scale,left=f:GetLeft()*scale,top=f:GetTop()*scale}
  grip:SetScript('OnUpdate',function()
   if IsMouseButtonDown and not IsMouseButtonDown('LeftButton')then finish();return end
   local x,y=GetCursorPosition();local unit=UIParent:GetEffectiveScale()
   local delta=((x/unit-drag.x)*940+(drag.y-y/unit)*860)/(940*940+860*860)
   apply(drag.scale+delta)
  end)
 end)
 grip:SetScript('OnMouseUp',finish);f:HookScript('OnHide',finish)
 grip:SetScript('OnEnter',function(self)GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Fenstergröße ändern');GameTooltip:AddLine('Linke Maustaste halten und ziehen. Die Größe wird für diesen Charakter gespeichert. Rechtsklick: Standardgröße.',1,1,1,true);GameTooltip:Show()end)
 grip:SetScript('OnLeave',function()GameTooltip:Hide()end)
 f:HookScript('OnShow',function()apply(C.Store().windowScale)end)
 apply(C.Store().windowScale)
end
function C.Open(event)
 if not GL.db or not C.Store()then return end
 event=event or C.pendingEvent;C.pendingEvent=nil
 if event then selected={key=event.key,base=event.base,label=event.name..' · '..event.date..' '..event.clock};page=0 end
 selected=selected or C.Store().selection or {key='naxx',label='Naxxramas · Standardliste'}
 if not window then
  local f=CreateFrame('Frame','GuildRaidBagWindow',UIParent);window=f;C.window=f;f:SetSize(940,860);f:SetPoint('CENTER');f:SetFrameStrata('DIALOG');f:SetClampedToScreen(true);f:EnableMouse(true);f:SetMovable(true)
  local bg=f:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.025,.045,.065,.96)
  local heading=label(f,'GuildRaidBag · Raidcheck',18,-16,820);heading:SetTextColor(.45,.9,.78)
  local drag=CreateFrame('Frame',nil,f);drag:SetPoint('TOPLEFT',0,0);drag:SetSize(880,44);drag:EnableMouse(true);drag:RegisterForDrag('LeftButton');drag:SetScript('OnDragStart',function()f:StartMoving()end);drag:SetScript('OnDragStop',function()f:StopMovingOrSizing()end)
  button(f,'×',890,-10,32,function()f:Hide()end);f:SetScript('OnHide',function()if popup then popup:Hide()end end)
  f.title=label(f,'',18,-54,610);f.saved=label(f,'',18,-80,850);f.saved:SetFontObject(GameFontHighlightSmall)
  button(f,'Raid / Termin auswählen',666,-47,256,function(self)
   local choices={};for _,r in ipairs(C.raids)do local v={key=r[1],label=r[2]..' · Standardliste'};choices[#choices+1]={label=v.label,fn=function()selected=v;page=0;C.Refresh()end}end
   for _,e in ipairs(C.Events(GetServerTime()))do local event=e;choices[#choices+1]={label=e.name..' · '..e.date..' '..e.clock..' · '..GL.GuildName(e.guild),fn=function()C.Open(event)end}end;menu(self,choices)
  end)
  local function run(fn)local ok,err=pcall(fn);if ok then C.Refresh()else f.summary:SetText(tostring(err):gsub('^.-:%d+: ',''))end end
  button(f,'Alle Gegenstände ▾',18,-112,368,function(self)
   local choices={};for _,g in ipairs({{'all','Alle Gegenstände'},{'raid','Raid-Zubehör'},{'flask','Fläschchen'},{'elixir','Elixiere'},{'potion','Tränke'},{'protection','Schutztränke'},{'food','Bufffood / Essen'},{'weapon','Öle, Waffensteine und Gifte'},{'scroll','Schriftrollen'},{'misc','Sonstiges'},{'gear','Ausrüstung: Taschen und Bank'}})do local id,name=g[1],g[2];choices[#choices+1]={label=name,fn=function()catalogGroup=id;catalogPage=0;self.label:SetText(name..' ▾');C.Refresh()end}end;menu(self,choices)
  end)
  local search=CreateFrame('EditBox',nil,f,'InputBoxTemplate');search:SetPoint('TOPLEFT',24,-153);search:SetSize(356,26);search:SetAutoFocus(false);search:SetMaxLetters(80);search:SetScript('OnTextChanged',function(self)query=self:GetText();catalogPage=0;C.Refresh()end);search:SetScript('OnEscapePressed',function(self)self:ClearFocus()end)
  label(f,'Suchen · Name oder Item-ID',24,-140,355):SetFontObject(GameFontHighlightSmall)
  label(f,'Meine Checkliste',410,-112,320):SetTextColor(1,.82,.2)
  f.summary=label(f,'',410,-144,510);f.summary:SetFontObject(GameFontHighlightSmall)
  f.catalog={};f.rows={}
  local quantity=CreateFrame('EditBox',nil,f,'InputBoxTemplate');quantity:SetPoint('TOPLEFT',110,-574);quantity:SetSize(52,26);quantity:SetAutoFocus(false);quantity:SetNumeric(true);quantity:SetMaxLetters(3);quantity:SetText('1');label(f,'Soll-Menge',18,-581,92)
  local cat=button(f,'Verbrauchsmaterial ▾',180,-572,206,function(self)local choices={};for _,v in ipairs(C.categories)do local id,name=v[1],v[2];choices[#choices+1]={label=name,fn=function()category=id;self.label:SetText(name..' ▾')end}end;menu(self,choices)end)
  for i=1,9 do
   local row=CreateFrame('Button',nil,f);f.catalog[i]=row;row:SetPoint('TOPLEFT',18,-193-(i-1)*37);row:SetSize(368,34)
   local bg=row:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.20,.26,.85)
   row.icon=row:CreateTexture(nil,'ARTWORK');row.icon:SetPoint('LEFT',3,0);row.icon:SetSize(28,28);row.name=label(row,'',38,-2,323);row.name:SetFontObject(GameFontHighlightSmall);row.state=label(row,'',38,-18,323);row.state:SetFontObject(GameFontHighlightSmall)
   row:SetScript('OnClick',function(self)run(function()C.Add(selected.key,selected.base,self.item.id,quantity:GetText(),(self.item.category=='gear' or self.item.group=='gear') and (category=='consumable'and 'gear'or category)or 'consumable')end)end)
   row:SetScript('OnEnter',function(self)if self.item then tooltip(self,self.item.id)end end);row:SetScript('OnLeave',function()GameTooltip:Hide()end)
   local r=CreateFrame('Frame',nil,f);f.rows[i]=r;r:SetPoint('TOPLEFT',410,-193-(i-1)*37);r:SetSize(512,34);r:EnableMouse(true)
   r.icon=r:CreateTexture(nil,'ARTWORK');r.icon:SetPoint('LEFT',0,0);r.icon:SetSize(28,28);r.name=label(r,'',36,-2,315);r.name:SetFontObject(GameFontHighlightSmall);r.state=label(r,'',36,-18,315);r.state:SetFontObject(GameFontHighlightSmall)
   r.quantity=CreateFrame('EditBox',nil,r,'InputBoxTemplate');r.quantity:SetPoint('TOPLEFT',393,-4);r.quantity:SetSize(42,26);r.quantity:SetAutoFocus(false);r.quantity:SetNumeric(true);r.quantity:SetMaxLetters(3)
   r.quantity:SetScript('OnTextChanged',function(self,userInput)
    if not userInput then return end;self.dirty=true;local n=tonumber(self:GetText())
    if n and n%1==0 and n>=1 and n<=999 then run(function()C.Add(selected.key,selected.base,r.itemID,n,r.entryCategory)end)end
   end)
   r.quantity:SetScript('OnEditFocusLost',function(self)self.dirty=false;C.Refresh()end)
   r.quantity:SetScript('OnEnterPressed',function(self)self:ClearFocus();self.dirty=false;C.Refresh()end)
   r.quantity:SetScript('OnEscapePressed',function(self)self:ClearFocus();self.dirty=false;C.Refresh()end)
   r.quantity:SetScript('OnEnter',function(self)GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Soll-Menge · 1 bis 999');GameTooltip:AddLine('Wird automatisch gespeichert.',1,1,1);GameTooltip:Show()end)
   r.quantity:SetScript('OnLeave',function()GameTooltip:Hide()end)
   local function adjust(delta)r.quantity.dirty=false;r.quantity:ClearFocus();run(function()C.Add(selected.key,selected.base,r.itemID,math.max(1,math.min(999,r.targetQuantity+delta)),r.entryCategory)end)end
   r.minus=button(r,'-',356,-3,28,function()adjust(-1)end)
   r.plus=button(r,'+',444,-3,28,function()adjust(1)end)
   button(r,'×',478,-3,32,function()table.remove(C.List(selected.key,selected.base,true),r.index);C.Refresh()end)
   r:SetScript('OnEnter',function(self)tooltip(self,self.itemID)end);r:SetScript('OnLeave',function()GameTooltip:Hide()end)
  end
  button(f,'<',18,-533,36,function()catalogPage=catalogPage-1;C.Refresh()end);f.catalogPage=label(f,'',64,-540,260);button(f,'>',350,-533,36,function()catalogPage=catalogPage+1;C.Refresh()end)
  button(f,'<',410,-533,36,function()page=page-1;C.Refresh()end);f.page=label(f,'',456,-540,160);button(f,'>',630,-533,36,function()page=page+1;C.Refresh()end)
  f.withdraw=button(f,'Von Bank auffüllen',700,-533,222,function()if GL.RaidBank then GL.RaidBank.Start(selected)end end)
  f.withdraw:SetScript('OnEnter',function(self)GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Fehlende Mengen von der Bank holen');GameTooltip:AddLine('Bank öffnen und klicken. Nur fehlende Mengen dieser Checkliste werden eingepackt; vorhandene und angelegte Items zählen mit.',1,1,1,true);GameTooltip:Show()end)
  f.withdraw:SetScript('OnLeave',function()GameTooltip:Hide()end)
  f.deposit=button(f,'Zur Bank zurücklegen',700,-565,222,function()if GL.RaidBank then GL.RaidBank.Start(selected,true)end end)
  f.deposit:SetScript('OnEnter',function(self)GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('Nach dem Raid zurücklegen');GameTooltip:AddLine('Alle Gegenstände dieser Checkliste aus den Taschen auf die geöffnete Bank legen. Angelegte Ausrüstung bleibt angelegt.',1,1,1,true);GameTooltip:Show()end)
  f.deposit:SetScript('OnLeave',function()GameTooltip:Hide()end)
  button(f,'Gespeichertes Resi-Set / Ausrüstung ▾',410,-604,512,function(self)
   local choices={};local function add(name,get)choices[#choices+1]={label=name,fn=function()run(function()C.AddSet(selected.key,selected.base,get(),category=='consumable'and 'gear'or category)end)end}end
   add('Aktuell angelegte Ausrüstung',GL.CurrentGear);for _,n in ipairs(GL.GearSetNames())do local name=n;add(name,function()return GL.GearStore().sets[name]end)end;menu(self,choices)
  end)
  local entry=CreateFrame('EditBox',nil,f,'InputBoxTemplate');entry:SetPoint('TOPLEFT',24,-615);entry:SetSize(260,24);entry:SetAutoFocus(false);entry:SetMaxLetters(1000)
  label(f,'Eigenes Item: hineinziehen oder ID/Link',18,-603,368):SetFontObject(GameFontHighlightSmall)
  local function drag()local kind,id=GetCursorInfo();if kind=='item'then entry:SetText(tostring(id));ClearCursor()end end
  entry:SetScript('OnReceiveDrag',drag);entry:SetScript('OnMouseUp',drag);entry:SetScript('OnEscapePressed',function(self)self:ClearFocus()end)
  button(f,'Hinzufügen',294,-613,92,function()run(function()C.Add(selected.key,selected.base,GL.GearItemID(entry:GetText()),quantity:GetText(),category);entry:SetText('');entry:ClearFocus()end)end)
  local function scroll(parent,x,change)
   local slider=CreateFrame('Slider',nil,parent,'UIPanelScrollBarTemplate');slider:SetPoint('TOPLEFT',x,-206);slider:SetSize(16,299);slider:SetMinMaxValues(0,0);slider:SetValueStep(1);slider:SetObeyStepOnDrag(true)
   slider:SetScript('OnValueChanged',function(self,v)if not self.syncing then change(math.floor(v+.5));C.Refresh()end end);return slider
  end
  f.catalogScroll=scroll(f,390,function(v)catalogPage=v end)
  f.listScroll=scroll(f,923,function(v)page=v end)
  for _,row in ipairs(f.catalog)do row:EnableMouseWheel(true);row:SetScript('OnMouseWheel',function(_,delta)catalogPage=math.max(0,catalogPage-delta*3);C.Refresh()end)end
  for _,row in ipairs(f.rows)do row:EnableMouseWheel(true);row:SetScript('OnMouseWheel',function(_,delta)page=math.max(0,page-delta*3);C.Refresh()end)end
  f.bank=label(f,'',410,-642,512);f.bank:SetFontObject(GameFontHighlightSmall)
  f.reminders=CreateFrame('CheckButton',nil,f,'UICheckButtonTemplate');f.reminders:SetPoint('TOPLEFT',410,-669);f.reminders:SetSize(24,24);label(f.reminders,'30 Minuten vor meinen Raid-Anmeldungen erinnern',28,-5,480):SetFontObject(GameFontHighlightSmall);f.reminders:SetScript('OnClick',function(self)C.Store().reminders=self:GetChecked()==true end)
  label(f,'Menge wählen, dann Item anklicken · /grb',18,-651,368):SetFontObject(GameFontHighlightSmall)
  button(f,'Mats',18,-685,160,function()if GL.RaidMats then GL.RaidMats.Open(f)end end)
  label(f,'Termin-Erinnerungen benötigen GuildLoot Era mit Sync',410,-703,512):SetFontObject(GameFontHighlightSmall)
 end
 if not window.resizeGrip then C.SetupWindowResize(window)end
 if GL.RaidMats and GL.RaidMats.CreateSummary then GL.RaidMats.CreateSummary(window)end
 window:Show();C.Refresh()
end
SLASH_GUILDRAIDBAG1='/grb';SLASH_GUILDRAIDBAG2='/raidbag';SlashCmdList.GUILDRAIDBAG=function()C.Open()end
local frame=CreateFrame('Frame');local elapsed=0
for _,e in ipairs({'BANKFRAME_OPENED','BANKFRAME_CLOSED','PLAYER_LOGIN','BAG_UPDATE_DELAYED','PLAYER_EQUIPMENT_CHANGED','GET_ITEM_INFO_RECEIVED'})do frame:RegisterEvent(e)end
frame:SetScript('OnEvent',function(_,event)if GL.db then if event=='PLAYER_LOGIN' then C.CreateLauncher() end;if event=='BANKFRAME_OPENED' then C.bankOpen=true;C.CaptureBank() elseif event=='BANKFRAME_CLOSED' then C.bankOpen=false elseif event=='BAG_UPDATE_DELAYED' and C.bankOpen then C.CaptureBank() end;C.Refresh()end end)
frame:SetScript('OnUpdate',function(_,delta)
 elapsed=elapsed+delta;if elapsed<15 then return end;elapsed=0;if not GL.db then return end
 for _,e in ipairs(C.Reminders(GetServerTime()))do
  C.pendingEvent=C.pendingEvent or e
  print('|cffffcc40GuildRaidBag:|r Denk daran, deine Raidcheckliste zu kontrollieren: '..safe(e.name)..' um '..safe(e.clock)..'. Mit /grb öffnen.')
  if RaidNotice_AddMessage and RaidWarningFrame and ChatTypeInfo then RaidNotice_AddMessage(RaidWarningFrame,'Denk daran, deine Raidcheckliste zu kontrollieren!',ChatTypeInfo.SYSTEM)end
 end
end)

-- A local shortcut: no companion connection is required to check your bags.
function C.CreateLauncher()
 if C.launcher or not C.Store() then return end
 local b=CreateFrame('Button','GuildRaidBagButton',UIParent);C.launcher=b
 b:SetSize(36,36);b:SetFrameStrata('MEDIUM');b:SetMovable(true);b:SetClampedToScreen(true);b:EnableMouse(true);b:RegisterForDrag('LeftButton')
 local p=C.Store().buttonPosition
 if p and p.point and p.relativePoint and tonumber(p.x) and tonumber(p.y) then b:SetPoint(p.point,UIParent,p.relativePoint,p.x,p.y) else b:SetPoint('CENTER',UIParent,'CENTER',66,0) end
 local icon=b:CreateTexture(nil,'ARTWORK');icon:SetAllPoints();icon:SetTexture('Interface\\AddOns\\GuildRaidBag\\Media\\GuildRaidBag')
 b:SetHighlightTexture('Interface\\Buttons\\ButtonHilight-Square','ADD')
 b:SetScript('OnDragStart',function(self)self.dragging=true;self:StartMoving()end)
 b:SetScript('OnDragStop',function(self)
  self:StopMovingOrSizing();local point,_,relativePoint,x,y=self:GetPoint()
  C.Store().buttonPosition={point=point,relativePoint=relativePoint,x=x,y=y};self.suppressClick=true;self.dragging=false
 end)
 b:SetScript('OnMouseDown',function(self)self.suppressClick=false end)
 b:RegisterForClicks('LeftButtonUp','RightButtonUp')
 b:SetScript('OnClick',function(self,which)
  if self.dragging or self.suppressClick then self.suppressClick=false;return end
  if which=='RightButton' then C.Report();return end
  if window and window:IsShown() then window:Hide() else C.Open() end
 end)
 b:SetScript('OnEnter',function(self)GameTooltip:SetOwner(self,'ANCHOR_TOP');GameTooltip:SetText('GuildRaidBag');GameTooltip:AddLine('Linksklick: öffnen · Rechtsklick: prüfen · Ziehen: verschieben',1,1,1);GameTooltip:Show()end)
 b:SetScript('OnLeave',function()GameTooltip:Hide()end)
 b:SetShown(C.Store().launcherShown~=false)
end

function C.ToggleLauncher()
 C.CreateLauncher();if not C.launcher then return false end
 if not C.Store().buttonPosition then C.launcher:ClearAllPoints();C.launcher:SetPoint('CENTER',UIParent,'CENTER',66,0)end
 local shown=not C.launcher:IsShown();C.Store().launcherShown=shown;C.launcher:SetShown(shown);return shown
end
