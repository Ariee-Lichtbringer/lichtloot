local _,GL=...
-- Keep Blizzard's protected CraftCreateButton untouched. Craft quantities are
-- a manual work counter; trade skills use the native repeat-count input.
function GL.CreateProfessionQuantity(parent)
 local f=CreateFrame('Frame',nil,parent);f:SetSize(305,62)
 local selected,amount,status= nil,1,nil
 local title=f:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');title:SetPoint('TOPLEFT',0,0);title:SetWidth(305);title:SetJustifyH('LEFT')
 local box=CreateFrame('EditBox',nil,f,'InputBoxTemplate');box:SetPoint('TOPLEFT',38,-22);box:SetSize(52,26);box:SetNumeric(true);box:SetAutoFocus(false);box:SetMaxLetters(3)
 local function maximum()
  if not selected then return 0 end
  local n=0
  if selected.kind=='trade' and GetTradeSkillInfo then n=select(3,GetTradeSkillInfo(selected.index))
  elseif selected.kind=='craft' and GetCraftInfo then n=select(4,GetCraftInfo(selected.index))end
  return math.max(0,math.floor(tonumber(n)or 0))
 end
 local function apply(n,keepCount)
  if not keepCount then status=nil end
  amount=math.max(1,math.min(999,math.floor(tonumber(n)or 1),(keepCount and 999 or math.max(1,maximum()))))
  box:SetNumber(amount)
  if selected and selected.kind=='trade' and TradeSkillInputBox then TradeSkillInputBox:SetNumber(amount)end
 end
 local function button(label,x,w,fn)
  local b=CreateFrame('Button',nil,f,'UIPanelButtonTemplate');b:SetPoint('TOPLEFT',x,-20);b:SetSize(w,28);b:SetText(label);b:SetScript('OnClick',fn);return b
 end
 button('−',0,28,function()apply(amount-1)end)
 button('+',96,28,function()apply(amount+1)end)
 local all=button('Alle erstellen',130,175,function()
  if not selected or InCombatLockdown() or maximum()<1 then return end
  apply(maximum());box:ClearFocus()
  if selected.kind=='trade' then
   -- Re-check the actual native selection immediately before crafting.
   if GetTradeSkillSelectionIndex and GetTradeSkillSelectionIndex()~=selected.index then return end
   DoTradeSkill(selected.index,amount)
  end
 end)
 box:SetScript('OnTextChanged',function(self,user)
  if user then
   local n=tonumber(self:GetText());if n then amount=math.max(1,math.min(999,math.floor(n),math.max(1,maximum())));if selected and selected.kind=='trade' and TradeSkillInputBox then TradeSkillInputBox:SetNumber(amount)end end
  end
 end)
 box:SetScript('OnEnterPressed',function(self)apply(self:GetNumber());self:ClearFocus()end)
 box:SetScript('OnEscapePressed',function(self)apply(amount);self:ClearFocus()end)
 box:SetScript('OnEditFocusLost',function()apply(amount,selected and selected.kind=='craft')end)
 function f:Select(r)
  if not r or (r.kind~='trade' and r.kind~='craft')then selected=nil;amount=1;self:Hide();return end
  if not selected or selected.kind~=r.kind or selected.index~=r.index or selected.name~=r.name then amount=1;status=nil end
  selected={kind=r.kind,index=r.index,name=r.name}
 end
 function f:ShowFor(r,y)
  if not selected or (r.kind~='trade' and r.kind~='craft')or InCombatLockdown()then self:Hide();return end
  self:ClearAllPoints();self:SetPoint('TOPLEFT',parent,'TOPLEFT',430,-y+68)
  title:SetText(status or (r.kind=='craft' and 'Anzahl vormerken · einzeln per „Verzaubern“' or 'Anzahl Herstellvorgänge'))
  all:SetText(r.kind=='craft' and 'Alle vormerken' or 'Alle erstellen');all:SetEnabled(maximum()>0)
  apply(amount,r.kind=='craft');self:Show()
 end
 f:RegisterEvent('UNIT_SPELLCAST_SUCCEEDED')
 f:SetScript('OnEvent',function(_,_,unit,_,spellID)
  if unit~='player' or not selected or selected.kind~='craft' or not f:IsShown()then return end
  local name=GetSpellInfo and GetSpellInfo(spellID)
  if name==selected.name then
   local remaining=math.max(0,amount-1);apply(math.max(1,remaining),true)
   status=remaining>0 and ('Noch '..remaining..' · erneut „Verzaubern“ klicken')or 'Vorgemerkte Menge fertig';title:SetText(status)
  end
 end)
 f:SetScript('OnHide',function()box:ClearFocus()end)
 f:Hide();return f
end
