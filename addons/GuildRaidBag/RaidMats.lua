local _,GL=...
local C=GL.RaidChecklist
local M={};GL.RaidMats=M
M.items={{17029,'Heilige Kerze'},{17028,'Heilige Kerze (niedriger Rang)'},{17026,'Wilder Dornwurz'},{17021,'Wilde Beeren'},{17020,'Arkanes Pulver'},{21177,'Symbol der Könige'},{17033,'Symbol der Offenbarung'},{17031,'Rune der Teleportation'},{17032,'Rune der Portale'},{13810,'Gesegnete Sonnenfrucht (Argentumdämmerung)'},{13813,'Gesegneter Sonnenfruchtsaft (Argentumdämmerung)'},{13724,'Angereicherter Manakeks (Argentumdämmerung)'},{19301,'Alterac Manakeks (Alteractal)'}}
function M.Store()
 local s=C.Store();if not s then return end
 s.mats=s.mats or {enabled=true,targets={}};s.mats.targets=s.mats.targets or {};return s.mats
end
function M.Set(id,value)
 local n=tonumber(value);if not n or n%1~=0 or n<0 or n>999 then return false end
 M.Store().targets[id]=n;if M.RefreshSummary then M.RefreshSummary()end;return true
end
local function say(message)M.message=message;if M.status then M.status:SetText(message)end end
function M.Stop(message)
 M.running=false;M.pending=nil
 if message then say(message);print('|cff79e6c5GuildRaidBag Mats:|r '..message)end
end
local function merchantInfo(i)
 if C_MerchantFrame and C_MerchantFrame.GetItemInfo then
  local v=C_MerchantFrame.GetItemInfo(i);if v then return v.price,v.stackCount,v.numAvailable,v.isPurchasable,v.hasExtendedCost end
 elseif GetMerchantItemInfo then
  local _,_,price,quantity,available,purchasable,_,extended=GetMerchantItemInfo(i)
  return price,quantity,available,purchasable,extended
 end
end
function M.Step(dt)
 if not M.running then return end
 local s=M.Store();if not s or s.enabled==false then M.Stop();return end
 local counts,readable=C.Inventory();if not readable then M.Stop('Taschen konnten nicht geprüft werden.');return end
 if M.pending then
  local p=M.pending;p.age=p.age+dt;local got=(counts[p.id]or 0)-p.before
  if got>=p.quantity then M.bought=M.bought+p.quantity;M.pending=nil
  elseif p.age>=3 then
   if got>0 then M.bought=M.bought+got;M.pending=nil else M.Stop('Nachkauf gestoppt: Kauf nicht bestätigt. Bitte Taschen und Gold prüfen.');return end
  else return end
 end
 for _,item in ipairs(M.items)do
  local id=item[1];local target=tonumber(s.targets[id])or 0;local missing=target-(counts[id]or 0)
  if missing>0 then for i=1,GetMerchantNumItems()do
   if GL.GearItemID(GetMerchantItemLink(i))==id then
    local price,bundle,available,purchasable,extended=merchantInfo(i)
    if price and bundle and bundle>0 and purchasable and not extended and available~=0 then
     local max=GetMerchantItemMaxStack(i)or bundle
     local amount=math.min(missing,max,available and available>=0 and available or missing)
     if price>0 then amount=math.min(amount,math.floor(GetMoney()*bundle/price))end
     -- Merchant quantities are item counts; buy only complete vendor bundles.
     amount=math.floor(amount/bundle)*bundle
     if amount>0 then
      -- Mehrere Stapel in einem Schritt kaufen (z. B. 100 Stück = 5 × 20), Bestätigung über die Taschen abwarten.
      local total,left,guard=0,missing,0
      while left>0 and guard<25 do
       local chunk=math.min(amount,left);chunk=math.floor(chunk/bundle)*bundle;if chunk<=0 then break end
       if price>0 and (GetMoney()-total/bundle*price)<chunk/bundle*price then break end
       BuyMerchantItem(i,chunk);total=total+chunk;left=left-chunk;guard=guard+1
      end
      if total>0 then M.pending={id=id,before=counts[id]or 0,quantity=total,age=0};return end
     end
    end
   end
  end end
 end
 local missing=false
 for _,item in ipairs(M.items)do if (counts[item[1]]or 0)<(tonumber(s.targets[item[1]])or 0)then missing=true end end
 M.Stop(M.bought>0 and ('Nachgekauft: '..M.bought..' Reagenzien.'..(missing and ' Nicht alle Soll-Mengen konnten aufgefüllt werden.'or ''))or nil)
end
function M.Open(parent)
 if not M.panel then
  local p=CreateFrame('Frame',nil,parent);M.panel=p;p:SetPoint('TOPLEFT',12,-45);p:SetPoint('BOTTOMRIGHT',-12,12);p:SetFrameLevel(parent:GetFrameLevel()+20);p:EnableMouse(true)
  local bg=p:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.025,.045,.065,1)
  local function label(text,x,y,w)local f=p:CreateFontString(nil,'OVERLAY','GameFontHighlight');f:SetPoint('TOPLEFT',x,y);f:SetWidth(w);f:SetJustifyH('LEFT');f:SetText(text);return f end
  label('Mats · Reagenzien automatisch nachkaufen',18,-16,760):SetTextColor(.45,.9,.78)
  local back=CreateFrame('Button',nil,p);back:SetPoint('TOPRIGHT',-12,-10);back:SetSize(90,28);local bg=back:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.20,.26,1);local text=back:CreateFontString(nil,'OVERLAY','GameFontHighlight');text:SetPoint('CENTER');text:SetText('Zurück');back:SetScript('OnClick',function()p:Hide()end)
  M.enabled=CreateFrame('CheckButton',nil,p,'UICheckButtonTemplate');M.enabled:SetPoint('TOPLEFT',18,-50);M.enabled:SetSize(24,24);label('Beim Händler automatisch auf Soll-Menge auffüllen',48,-55,780)
  M.enabled:SetScript('OnClick',function(self)M.Store().enabled=self:GetChecked()==true;if not M.Store().enabled then M.Stop()end end)
  label('Pro Charakter gespeichert · 0 = nicht kaufen · zählt nur den Vorrat in deinen Taschen',18,-90,860)
  label('Reagenz',18,-128,450);label('Soll-Menge',530,-128,110);label('Dabei',690,-128,110)
  M.rows={}
  for index,item in ipairs(M.items)do
   local id=item[1];local y=-157-(index-1)*40
   local icon=p:CreateTexture(nil,'ARTWORK');icon:SetPoint('TOPLEFT',18,y);icon:SetSize(28,28)
   local name=label(item[2],58,y-5,450)
   local edit=CreateFrame('EditBox',nil,p,'InputBoxTemplate');edit:SetPoint('TOPLEFT',535,y);edit:SetSize(88,26);edit:SetAutoFocus(false);edit:SetNumeric(true);edit:SetMaxLetters(3)
   local function save(self)if not M.Set(id,self:GetText())then self:SetText(tostring(M.Store().targets[id]or 0))end end
   edit:SetScript('OnTextChanged',function(self,user)if user then M.Set(id,self:GetText())end end)
   edit:SetScript('OnEditFocusLost',save);edit:SetScript('OnEnterPressed',function(self)save(self);self:ClearFocus()end);edit:SetScript('OnEscapePressed',function(self)self:ClearFocus()end)
   M.rows[#M.rows+1]={id=id,name=name,icon=icon,edit=edit,count=label('',690,y-5,110)}
  end
  local bottom=-157-#M.items*40-6
  M.status=label('',18,bottom,850)
  label('Kauft beim nächsten Öffnen eines Händlers, der diese Reagenzien verkauft.\nFehlendes Gold, volle Taschen oder begrenzter Vorrat können das Auffüllen begrenzen.',18,bottom-40,860)
 end
 local s=M.Store();M.enabled:SetChecked(s.enabled~=false);local counts=C.Inventory()
 for _,row in ipairs(M.rows)do row.edit:SetText(tostring(s.targets[row.id]or 0));row.count:SetText(tostring(counts[row.id]or 0));local name,_,_,_,_,_,_,_,_,icon=GetItemInfo(row.id);local data=GL.ClassicItemsByID and GL.ClassicItemsByID[row.id];row.icon:SetTexture(icon or data and data.icon or 'Interface\\Icons\\INV_Misc_QuestionMark');if name or data then row.name:SetText(name or data.name)end end
 M.status:SetText(M.message or 'Gewünschte Gesamtmenge je Reagenz eintragen.');M.panel:Show()
end
local frame=CreateFrame('Frame');frame:RegisterEvent('MERCHANT_SHOW');frame:RegisterEvent('MERCHANT_CLOSED');frame:RegisterEvent('UI_ERROR_MESSAGE');frame:RegisterEvent('BAG_UPDATE_DELAYED')
frame:SetScript('OnEvent',function(_,event,...)
 if event=='BAG_UPDATE_DELAYED' then
  if M.RefreshSummary then M.RefreshSummary()end
  if M.panel and M.panel:IsShown()then local counts=C.Inventory();for _,row in ipairs(M.rows)do row.count:SetText(tostring(counts[row.id]or 0))end end;return
 end
 if event=='MERCHANT_CLOSED' then M.Stop();return end
 if event=='UI_ERROR_MESSAGE' then
  -- Nur echte Kaufhindernisse stoppen (Gold, Taschen, Händler außer Reichweite), andere Meldungen ignorieren.
  local _,text=...;text=text or ''
  local blocking={ERR_NOT_ENOUGH_MONEY,ERR_INV_FULL,ERR_VENDOR_TOO_FAR,ERR_ITEM_MAX_COUNT,ERR_BAG_FULL}
  for _,msg in ipairs(blocking) do if msg and text==msg then if M.pending then M.Stop('Nachkauf gestoppt: '..text) end;return end end
  return
 end
 if not GL.db then return end;local s=M.Store();if not s or s.enabled==false then return end
 M.running=true;M.pending=nil;M.bought=0;M.elapsed=0
end)
frame:SetScript('OnUpdate',function(_,dt)
 if not M.running then return end;M.elapsed=(M.elapsed or 0)+dt;if M.elapsed<.35 then return end
 local elapsed=M.elapsed;M.elapsed=0;M.Step(elapsed)
end)

function M.RefreshSummary()
 if not M.summary then return end
 local entries={};local s=M.Store();if not s then return end
 for _,item in ipairs(M.items)do local n=tonumber(s.targets[item[1]])or 0;if n>0 then entries[#entries+1]={id=item[1],name=item[2],quantity=n}end end
 local p=M.summary;p.offset=math.max(0,math.min(p.offset or 0,math.max(0,#entries-3)))
 p.empty:SetShown(#entries==0);local counts=C.Inventory()
 for i,row in ipairs(p.rows)do local item=entries[p.offset+i];row:SetShown(item~=nil)
  if item then
   row.itemID=item.id
   local data=GL.ClassicItemsByID and GL.ClassicItemsByID[item.id]
   local name,_,_,_,_,_,_,_,_,icon=GetItemInfo(item.id)
   row.icon:SetTexture(icon or data and data.icon or 'Interface\\Icons\\INV_Misc_QuestionMark')
   row.name:SetText(name or data and data.name or item.name)
   row.quantity:SetText('Soll: '..item.quantity..' · Dabei: '..(counts[item.id]or 0))
  end
 end
 p.scroll.syncing=true;p.scroll:SetMinMaxValues(0,math.max(0,#entries-3));p.scroll:SetValue(p.offset);p.scroll.syncing=false
end
function M.CreateSummary(parent)
 if M.summary then return end
 local p=CreateFrame('Frame',nil,parent);M.summary=p;p:SetPoint('TOPLEFT',18,-719);p:SetSize(368,126);p.rows={};p.offset=0
 p.empty=p:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');p.empty:SetPoint('TOPLEFT',4,-8);p.empty:SetText('Noch keine Mats ausgewählt. Oben „Mats“ öffnen.')
 p.scroll=CreateFrame('Slider',nil,p,'UIPanelScrollBarTemplate');p.scroll:SetPoint('TOPRIGHT',-2,-16);p.scroll:SetSize(16,94);p.scroll:SetMinMaxValues(0,0);p.scroll:SetValueStep(1);p.scroll:SetObeyStepOnDrag(true)
 p.scroll:SetScript('OnValueChanged',function(self,v)if not self.syncing then p.offset=math.floor(v+.5);M.RefreshSummary()end end)
 p:EnableMouseWheel(true);p:SetScript('OnMouseWheel',function(_,delta)p.offset=p.offset-delta;M.RefreshSummary()end)
 for i=1,3 do
  local row=CreateFrame('Button',nil,p);p.rows[i]=row;row:SetPoint('TOPLEFT',0,-(i-1)*41);row:SetSize(340,39)
  local bg=row:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.20,.26,.85)
  row.icon=row:CreateTexture(nil,'ARTWORK');row.icon:SetPoint('LEFT',4,0);row.icon:SetSize(32,32)
  row.name=row:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');row.name:SetPoint('TOPLEFT',44,-3);row.name:SetWidth(290);row.name:SetJustifyH('LEFT')
  row.quantity=row:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');row.quantity:SetPoint('TOPLEFT',44,-21);row.quantity:SetWidth(290);row.quantity:SetJustifyH('LEFT');row.quantity:SetTextColor(.45,.9,.78)
  row:SetScript('OnClick',function()M.Open(parent)end)
  row:EnableMouseWheel(true);row:SetScript('OnMouseWheel',function(_,delta)p.offset=p.offset-delta;M.RefreshSummary()end)
  row:SetScript('OnEnter',function(self)if self.itemID then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetHyperlink('item:'..self.itemID);GameTooltip:Show()end end)
  row:SetScript('OnLeave',function()GameTooltip:Hide()end)
 end
 M.RefreshSummary()
end
