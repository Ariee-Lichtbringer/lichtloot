local _,GL=...
-- Berufsfenster aus GuildLoot Era (UI.lua, Berufsblock), eigenständig ohne Website-Anbindung.
do
 local iconPath='Interface\\Icons\\Trade_BlackSmithing'
 local frame,launcher,search,summary,detail,rows,buttons,kind
 local chosen,action,reagents,recipeIcon,scanTooltip
 local database,dbButtons,viewed,remoteProfession,characterButton,exportButton,remoteButtons
 local refreshing=false
 local dbHeader,skillHeader,skillButtons,searchLabel
 local dbExpanded,skillExpanded=true,false
 local guideActive=false
 local actionY=782
 local borrowed={}
 local quantityControls
 local offset=0
 local spellIds={2259,2018,7411,4036,2108,3908,2575,2366,8613,2550,3273,7620,2842}
 local function setting()
  GL.db.professionShortcuts=GL.db.professionShortcuts or {}
  local key=UnitGUID('player') or 'player';GL.db.professionShortcuts[key]=GL.db.professionShortcuts[key] or {}
  return GL.db.professionShortcuts[key]
 end
 local function text(parent,value,x,y,w)
  local t=parent:CreateFontString(nil,'OVERLAY','GameFontHighlight');t:SetPoint('TOPLEFT',x,y);t:SetWidth(w);t:SetJustifyH('LEFT');t:SetText(value);return t
 end
 local function button(parent,value,x,y,w,secure)
  local b=CreateFrame('Button',nil,parent,secure and 'SecureActionButtonTemplate' or nil);b:SetPoint('TOPLEFT',x,y);b:SetSize(w,30)
  local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.08,.17,.21,1);b.background=bg
  b.label=text(b,value,8,-8,w-16);b:SetHighlightTexture('Interface\\Buttons\\ButtonHilight-Square');return b
 end
 local function closeGuide()
  guideActive=false;GL.HideProfessionGuide()
  if searchLabel then searchLabel:Show();search:Show();summary:Show();detail:Show() end
 end
 local function recipes()
  local result={};local query=string.lower(search:GetText() or '')
  if database then return GL.GetProfessionDatabaseEntries(database,query) end
  if remoteProfession then
   local bySpell={};for _,r in ipairs(GL.GetProfessionDatabaseEntries(remoteProfession.id,'')) do bySpell[r.spellId]=r end
   for _,known in ipairs(remoteProfession.recipes or {}) do
    local r=bySpell[known.spellId] or {spellId=known.spellId,itemId=known.itemId,name=known.name,reagents={},skill=0}
    r.kind='snapshot';r.index=known.spellId~=0 and known.spellId or known.name;r.name=known.name
    if query=='' or string.find(string.lower(r.name),query,1,true) then result[#result+1]=r end
   end
   table.sort(result,function(a,b) return a.name<b.name end);return result
  end
  local count=kind=='trade' and GetNumTradeSkills and GetNumTradeSkills() or kind=='craft' and GetNumCrafts and GetNumCrafts() or 0
  for i=1,count do
   local name,typ,available
   if kind=='trade' then name,typ,available=GetTradeSkillInfo(i)
   else local sub;name,sub,typ,available=GetCraftInfo(i) end
   if name and typ~='header' and typ~='subheader' then
    local materials={};local reagentData={};local n=kind=='trade' and GetTradeSkillNumReagents(i) or GetCraftNumReagents(i)
    for j=1,n do
     local rn,texture,need,have
     if kind=='trade' then rn,texture,need,have=GetTradeSkillReagentInfo(i,j) else rn,texture,need,have=GetCraftReagentInfo(i,j) end
     reagentData[#reagentData+1]={name=rn or '?',texture=texture,need=need or 0,have=have or 0}
     materials[#materials+1]=(rn or '?')..': '..(have or 0)..' / '..(need or 0)
    end
    local description=table.concat(materials,'\n')
    if query=='' or string.find(string.lower(name..' '..description),query,1,true) then result[#result+1]={index=i,name=name,available=available or 0,details=description,reagents=reagentData,kind=kind} end
   end
  end
  return result
 end
 local function restoreButtons()
  if quantityControls then quantityControls:Hide() end
  if InCombatLockdown() then return end
  for b,state in pairs(borrowed) do
   b:Hide();b:SetParent(state.parent);b:ClearAllPoints();for _,point in ipairs(state.points) do b:SetPoint(unpack(point)) end;b:SetSize(state.w,state.h);b:Show()
  end
  borrowed={}
 end
 local function hideNative()
  if not frame or not frame:IsShown() or InCombatLockdown() then return end
  local native=kind=='craft' and CraftFrame or kind=='trade' and TradeSkillFrame
  if native and native:IsShown() then
   local handler=native:GetScript('OnHide');native:SetScript('OnHide',nil);HideUIPanel(native);native:SetScript('OnHide',handler)
  end
 end
 local function selectRecipe(r)
  chosen=r
  if quantityControls then quantityControls:Select(r) end
  if not r then detail:SetText('Rezept auswählen.');recipeIcon:Hide();for _,b in ipairs(reagents) do b:Hide() end;restoreButtons();return end
  if r.kind=='database' or r.kind=='snapshot' then
   restoreButtons();recipeIcon:SetTexture(r.texture);recipeIcon:Show()
   detail:SetText(r.name..'\n\nBenötigte Berufsfertigkeit: '..r.skill..(r.kind=='snapshot' and ('\nBekannt: '..viewed.player..'\nStand: '..date('%d.%m.%Y %H:%M',remoteProfession.scannedAt)) or '\nDatenbank · auch unbekannte Rezepte')..'\nShift + Linksklick: Link in den Chat')
   for i,b in ipairs(reagents) do
    local mat=r.reagents[i];b:SetShown(mat~=nil);b.itemId=mat and mat.itemId or nil
    if mat then b.icon:SetTexture(mat.texture or 'Interface\\Icons\\INV_Misc_QuestionMark');b.label:SetText(mat.name..'\n'..(r.kind=='snapshot' and ('Benötigt: '..mat.need) or (mat.have..' / '..mat.need)));b.label:SetTextColor(.9,.85,.65) end
   end
   return
  end
  if InCombatLockdown() then return end
  -- The native selection routine also refreshes the borrowed Create button.
  -- SelectTradeSkill/SelectCraft alone leave its enabled state on the old recipe,
  -- because Blizzard's normal update handler skips the hidden profession frame.
  if kind=='craft' then
   if CraftFrame_SetSelection then CraftFrame_SetSelection(r.index) else SelectCraft(r.index) end
  else
   if TradeSkillFrame_SetSelection then TradeSkillFrame_SetSelection(r.index) else SelectTradeSkill(r.index) end
  end
  local description=kind=='craft' and GetCraftDescription and GetCraftDescription(r.index) or ''
  local texture=kind=='craft' and GetCraftIcon and GetCraftIcon(r.index) or kind=='trade' and GetTradeSkillIcon and GetTradeSkillIcon(r.index)
  recipeIcon:SetTexture(texture);recipeIcon:Show()
  if kind=='trade' and scanTooltip then
   scanTooltip:ClearLines();scanTooltip:SetOwner(frame,'ANCHOR_NONE');scanTooltip:SetTradeSkillItem(r.index)
   local lines={};for i=2,scanTooltip:NumLines() do local t=_G['GuildSkillsScanTextLeft'..i];local value=t and t:GetText();if value and value~='' then lines[#lines+1]=value end end
   description=table.concat(lines,'\n');scanTooltip:Hide()
  end
  detail:SetText(r.name..'\n\n'..(description~='' and description or 'Werte und Wirkung: Maus über das Rezept.'))
  for i,b in ipairs(reagents) do
   local mat=r.reagents[i];b:SetShown(mat~=nil)
   b.itemId=nil;if mat then b.icon:SetTexture(mat.texture);b.label:SetText(mat.name..'\n'..mat.have..' / '..mat.need);b.label:SetTextColor(mat.have>=mat.need and .7 or 1,mat.have>=mat.need and 1 or .35,.4) end
  end
  local original=kind=='craft' and CraftCreateButton or TradeSkillCreateButton
  restoreButtons()
  if original then
   local points={};for i=1,original:GetNumPoints() do points[#points+1]={original:GetPoint(i)} end
   borrowed[original]={parent=original:GetParent(),points=points,w=original:GetWidth(),h=original:GetHeight()}
   original:SetParent(frame);original:ClearAllPoints();original:SetPoint('TOPLEFT',frame,'TOPLEFT',430,-actionY);original:SetSize(305,30);original:Show()
   if quantityControls then quantityControls:ShowFor(r,actionY) end
  end
 end
 local function refresh()
  if refreshing then return end
  if not frame or not frame:IsShown() then return end
  if guideActive then
   searchLabel:Hide();search:Hide();summary:Hide();detail:Hide();recipeIcon:Hide()
   for _,b in ipairs(rows) do b:Hide() end;for _,b in ipairs(reagents) do b:Hide() end
   return
  end
  refreshing=true
  local entries=recipes();if chosen then local updated;for _,r in ipairs(entries) do if r.index==chosen.index and r.kind==chosen.kind and r.name==chosen.name then updated=r;break end end;selectRecipe(updated) end
  offset=math.min(offset,math.max(0,#entries-9))
  for i,b in ipairs(rows) do
   local r=entries[offset+i];b:SetShown(r~=nil)
   if r then b.background:SetColorTexture(database and .36 or .08,database and .17 or .17,database and .035 or .21,1);b.icon:SetTexture(r.texture or (r.kind=='craft' and GetCraftIcon and GetCraftIcon(r.index)) or (r.kind=='trade' and GetTradeSkillIcon and GetTradeSkillIcon(r.index)) or 'Interface\\Icons\\INV_Misc_QuestionMark');b.label:SetText(r.name..(database and ('  · '..r.skill) or (remoteProfession and '  · bekannt' or ('  ('..r.available..')'))));b:SetScript('OnClick',function(_,which) if which=='LeftButton' and IsShiftKeyDown() then search:ClearFocus();GL.InsertProfessionRecipeLink(r);return end;if not InCombatLockdown() then refreshing=true;selectRecipe(r);refreshing=false end end);b:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');if r.kind=='database' or r.kind=='snapshot' then local link=GL.ProfessionRecipeLink(r);if link:find('|H',1,true) or link:match('^item:') then GameTooltip:SetHyperlink(link) else GameTooltip:SetText(r.name) end elseif r.kind=='craft' then GameTooltip:SetCraftSpell(r.index) else GameTooltip:SetTradeSkillItem(r.index) end;GameTooltip:Show() end);b:SetScript('OnLeave',function() GameTooltip:Hide() end) end
  end
  if database then summary:SetText(#entries..' Rezepte · Datenbank · Shift + Linksklick: Chatlink · Mausrad: blättern');if #entries==0 and search:GetText()=='' then detail:SetText('Dieser Sammelberuf hat keine herstellbaren Rezepte.') end
  elseif remoteProfession then summary:SetText(#entries..' bekannte Rezepte · '..viewed.player..' · Shift + Linksklick: Chatlink')
  else summary:SetText(kind and (#entries..' Rezepte · Klammer: herstellbare Menge · Mausrad: blättern') or 'Öffne oben einen Beruf, um seine Rezepte einzulesen.') end
  refreshing=false
 end
 local function layoutSections()
  if InCombatLockdown() then return end
  local function at(w,x,y) w:ClearAllPoints();w:SetPoint('TOPLEFT',x,-y) end
  local y=206;at(dbHeader,18,y);dbHeader.label:SetText((dbExpanded and '[-] ' or '[+] ')..'Berufe Datenbank');y=y+32
  for i,b in ipairs(dbButtons) do b:SetShown(dbExpanded);at(b,18+((i-1)%4)*183,y+math.floor((i-1)/4)*30) end
  if dbExpanded then y=y+120 end
  y=y+6;at(skillHeader,18,y);skillHeader.label:SetText((skillExpanded and '[-] ' or '[+] ')..'Berufe skillen');y=y+32
  for i,b in ipairs(skillButtons) do b:SetShown(skillExpanded);at(b,18+((i-1)%4)*183,y+math.floor((i-1)/4)*30) end
  if skillExpanded then y=y+90 end
  y=y+14;GL.LayoutProfessionGuide(y);at(searchLabel,24,y);at(search,24,y+22);at(summary,18,y+59)
  for i,b in ipairs(rows) do at(b,18,y+85+(i-1)*32) end
  at(detail,474,y+91);at(recipeIcon,430,y+91)
  for i,b in ipairs(reagents) do at(b,430+((i-1)%2)*156,y+224+math.floor((i-1)/2)*45) end
  actionY=y+477;frame:SetHeight(actionY+51);frame:SetScale(math.min(1,(UIParent:GetHeight()-40)/(actionY+51)))
  for b in pairs(borrowed) do b:ClearAllPoints();b:SetPoint('TOPLEFT',frame,'TOPLEFT',430,-actionY) end
  if quantityControls and chosen then quantityControls:ShowFor(chosen,actionY) end
 end
 local function updateCharacterButtons()
  local choices=GL.ProfessionCharacterList();local valid
  for _,c in ipairs(choices) do if viewed and c.player==viewed.player and c.realm==viewed.realm then valid=c;break end end
  viewed=valid or choices[1]
  local token=GL.CharacterIdentity(viewed);characterButton.icon:SetTexture(token and ('Interface\\Icons\\ClassIcon_'..token) or 'Interface\\Icons\\INV_Misc_QuestionMark')
  characterButton.label:SetText('Charakter: '..viewed.player..' – '..viewed.realm..'  >')
  local snapshot=GL.GetProfessionCharacter(viewed.player,viewed.realm)
  for _,b in ipairs(buttons) do if not viewed.current then b:Hide() end end
  for i,b in ipairs(remoteButtons) do
   local p=not viewed.current and snapshot and snapshot.professions[i]
   b:SetShown(p and true or false)
   if p then
    local icon;for _,t in ipairs(GL.ProfessionDatabaseTypes) do if t[1]==p.id then icon=select(3,GetSpellInfo(t[2]));break end end
    b.icon:SetTexture(icon);b.label:SetText(p.name..'  '..p.rank..' / '..p.maxRank)
    b:SetScript('OnClick',function()
     if InCombatLockdown() then return end
     closeGuide();restoreButtons();database=nil;kind=nil;chosen=nil;remoteProfession=p;offset=0;search:SetText('');selectRecipe(nil);refresh()
     if not p.scannedAt or p.scannedAt==0 then detail:SetText('Rezepte noch nicht eingelesen. Diesen Charakter in WoW spielen und den Beruf einmal öffnen, danach Berufe synchronisieren.') end
    end)
   end
  end
  exportButton:SetShown(false)
  if not viewed.current and not snapshot then detail:SetText('Für '..viewed.player..' wurden noch keine Berufe übertragen. Mit diesem Charakter Berufe öffnen und synchronisieren.') end
 end
 function GL.ShowProfessions()
  if not frame then
   if InCombatLockdown() then print('GuildSkills: Berufsübersicht bitte nach dem Kampf öffnen.');return end
   frame=CreateFrame('Frame','GuildSkillsWindow',UIParent,'BasicFrameTemplateWithInset');frame:SetSize(760,833);frame:SetScale(math.min(1,(UIParent:GetHeight()-40)/833));frame:SetPoint('CENTER');frame:SetFrameStrata('DIALOG');frame:SetClampedToScreen(true);frame:SetMovable(true);frame:EnableMouse(true);frame:RegisterForDrag('LeftButton');frame:SetScript('OnDragStart',frame.StartMoving);frame:SetScript('OnDragStop',frame.StopMovingOrSizing);frame.TitleText:SetText('GuildSkills · Berufe')
   buttons={};rows={};dbButtons={};remoteButtons={}
   characterButton=button(frame,'Charakter',18,-36,440)
   characterButton.icon=characterButton:CreateTexture(nil,'ARTWORK');characterButton.icon:SetPoint('TOPLEFT',4,-3);characterButton.icon:SetSize(24,24)
   characterButton.label:ClearAllPoints();characterButton.label:SetPoint('TOPLEFT',36,-8);characterButton.label:SetWidth(395)
   text(frame,'Meine Berufe',18,-76,724):SetTextColor(.65,.83,1)
   characterButton:SetScript('OnClick',function()
    if InCombatLockdown() then return end
    local choices=GL.ProfessionCharacterList();local index=1
    for i,c in ipairs(choices) do if viewed and c.player==viewed.player and c.realm==viewed.realm then index=i;break end end
    if kind=='trade' and CloseTradeSkill then CloseTradeSkill() elseif kind=='craft' and CloseCraft then CloseCraft() end
    closeGuide();viewed=choices[index%#choices+1];kind=nil;chosen=nil;database=nil;remoteProfession=nil;offset=0;search:SetText('');selectRecipe(nil);GL.ShowProfessions()
   end)
   exportButton=button(frame,'Berufe synchronisieren',470,-36,264);exportButton:Hide()
   if GL.GateSyncButton then GL.GateSyncButton(exportButton,'Berufe synchronisieren') end
   exportButton:SetScript('OnClick',function()
    local ok,err=pcall(GL.QueueProfessionExport)
    summary:SetText(ok and 'Gespeichert. gespeichert.' or tostring(err))
   end)
   for i=1,12 do
    local b=button(frame,'',18+((i-1)%3)*244,-100-math.floor((i-1)/3)*34,236,true);b:RegisterForClicks('AnyUp','AnyDown');buttons[i]=b
    b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',4,-3);b.icon:SetSize(24,24);b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',36,-8);b.label:SetWidth(194)
    b:SetScript('PreClick',function() if not InCombatLockdown() then closeGuide();database=nil;remoteProfession=nil;chosen=nil;offset=0;search:SetText('') end end)
   end
   for i=1,12 do
    local b=button(frame,'',18+((i-1)%3)*244,-100-math.floor((i-1)/3)*34,236);remoteButtons[i]=b
    b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',4,-3);b.icon:SetSize(24,24)
    b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',36,-8);b.label:SetWidth(194);b:Hide()
   end
   dbHeader=button(frame,'Berufe Datenbank',18,-206,724);dbHeader.background:SetColorTexture(.16,.10,.03,1);dbHeader.label:SetTextColor(1,.55,.15)
   dbHeader:SetScript('OnClick',function() if InCombatLockdown() then return end;dbExpanded=not dbExpanded;layoutSections() end)
   for i,prof in ipairs(GL.ProfessionDatabaseTypes) do
    local id,spell=prof[1],prof[2]
    local name,_,icon=GetSpellInfo(spell)
    local b=button(frame,name or prof[3],18+((i-1)%4)*183,-229-math.floor((i-1)/4)*30,176)
    b:SetHeight(27);b.background:SetColorTexture(.36,.17,.035,1)
    b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',4,-3);b.icon:SetSize(22,22);b.icon:SetTexture(icon)
    b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',32,-7);b.label:SetWidth(139);b.label:SetFontObject('GameFontHighlightSmall');b.label:SetWordWrap(false)
    b:SetScript('OnClick',function()
     if InCombatLockdown() then return end
     closeGuide();restoreButtons()
     if kind=='trade' and CloseTradeSkill then CloseTradeSkill() elseif kind=='craft' and CloseCraft then CloseCraft() end
     kind=nil;chosen=nil;remoteProfession=nil;database=id;offset=0;search:SetText('');selectRecipe(nil);refresh()
    end)
    dbButtons[i]=b
   end
   skillHeader=button(frame,'Berufe skillen',18,-365,724);skillHeader.background:SetColorTexture(.18,.16,.025,1);skillHeader.label:SetTextColor(1,.86,.25)
   skillHeader:SetScript('OnClick',function() if InCombatLockdown() then return end;skillExpanded=not skillExpanded;layoutSections() end)
   skillButtons={}
   for _,prof in ipairs(GL.ProfessionDatabaseTypes) do
    if prof[1]~=13 then
     local id,spell=prof[1],prof[2];local name,_,icon=GetSpellInfo(spell)
     local b=button(frame,name or prof[3],18,0,176);b:SetHeight(27);b.background:SetColorTexture(.58,.45,.035,1)
     b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',4,-3);b.icon:SetSize(22,22);b.icon:SetTexture(icon)
     b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',32,-7);b.label:SetWidth(139);b.label:SetFontObject('GameFontHighlightSmall');b.label:SetWordWrap(false)
     b:SetScript('OnClick',function()
      local rank=1;local snapshot=viewed and GL.GetProfessionCharacter(viewed.player,viewed.realm)
      for _,p in ipairs(snapshot and snapshot.professions or {}) do if p.id==id then rank=p.rank;break end end
      if InCombatLockdown() then return end
      restoreButtons()
      if kind=='trade' and CloseTradeSkill then CloseTradeSkill() elseif kind=='craft' and CloseCraft then CloseCraft() end
      kind=nil;chosen=nil;database=nil;remoteProfession=nil;guideActive=true
      GL.ShowProfessionGuide(id,rank,frame);layoutSections();refresh()
     end)
     skillButtons[#skillButtons+1]=b
    end
   end
   search=CreateFrame('EditBox',nil,frame,'InputBoxTemplate');search:SetPoint('TOPLEFT',24,-387);search:SetSize(710,28);search:SetAutoFocus(false);search:SetMaxLetters(100);search:SetScript('OnTextChanged',function() offset=0;detail:SetText('Rezept auswählen, um die Zutaten zu sehen.');refresh() end);search:SetScript('OnEscapePressed',search.ClearFocus)
   searchLabel=text(frame,'Rezept oder Zutat suchen',24,-369,710)
   summary=text(frame,'',18,-424,724);detail=text(frame,'Rezept auswählen, um die Zutaten zu sehen.',430,-456,310);detail:SetHeight(122);detail:SetJustifyV('TOP');detail:ClearAllPoints();detail:SetPoint('TOPLEFT',474,-456);detail:SetWidth(262)
   recipeIcon=frame:CreateTexture(nil,'ARTWORK');recipeIcon:SetPoint('TOPLEFT',430,-456);recipeIcon:SetSize(36,36)
   quantityControls=GL.CreateProfessionQuantity(frame)
   scanTooltip=CreateFrame('GameTooltip','GuildSkillsScan',UIParent,'GameTooltipTemplate')
   reagents={};for i=1,8 do local b=button(frame,'',430+((i-1)%2)*156,-589-math.floor((i-1)/2)*45,150);b:SetHeight(42);b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',2,-3);b.icon:SetSize(30,30);b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',36,-3);b.label:SetWidth(111);b.label:SetHeight(38);b:SetScript('OnEnter',function(self) if self.itemId then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetHyperlink('item:'..self.itemId);GameTooltip:Show() end end);b:SetScript('OnLeave',function() GameTooltip:Hide() end);b:Hide();reagents[i]=b end
   for i=1,9 do rows[i]=button(frame,'',18,-450-(i-1)*32,395);local b=rows[i];b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetPoint('TOPLEFT',4,-3);b.icon:SetSize(24,24);b.label:ClearAllPoints();b.label:SetPoint('TOPLEFT',36,-8);b.label:SetWidth(351);b.label:SetHeight(18);b.label:SetWordWrap(false);rows[i]:EnableMouseWheel(true);rows[i]:SetScript('OnMouseWheel',function(_,d) offset=math.max(0,offset-d*3);refresh() end) end
   frame:SetScript('OnHide',function() closeGuide();search:ClearFocus();restoreButtons();if kind=='trade' and CloseTradeSkill then CloseTradeSkill() elseif kind=='craft' and CloseCraft then CloseCraft() end;kind=nil;chosen=nil;database=nil;remoteProfession=nil end)
   local events=CreateFrame('Frame');for _,e in ipairs({'TRADE_SKILL_SHOW','TRADE_SKILL_UPDATE','CRAFT_SHOW','CRAFT_UPDATE','TRADE_SKILL_CLOSE','CRAFT_CLOSE','GET_ITEM_INFO_RECEIVED','BAG_UPDATE_DELAYED'}) do events:RegisterEvent(e) end
   local itemRefreshPending=false
   events:SetScript('OnEvent',function(_,e)
    if e=='GET_ITEM_INFO_RECEIVED' or e=='BAG_UPDATE_DELAYED' then
     if database and frame:IsShown() and not itemRefreshPending then
      itemRefreshPending=true;C_Timer.After(.2,function() itemRefreshPending=false;refresh() end)
     end
     return
    end
    if (database or guideActive or (viewed and not viewed.current)) and (e=='TRADE_SKILL_UPDATE' or e=='CRAFT_UPDATE') then return end
    if e=='TRADE_SKILL_SHOW' or e=='CRAFT_SHOW' then closeGuide();viewed=nil;remoteProfession=nil;GL.ShowProfessions() end
    if e=='TRADE_SKILL_CLOSE' or e=='CRAFT_CLOSE' then chosen=nil;restoreButtons();kind=nil;selectRecipe(nil)
    elseif e:match('^TRADE') then database=nil; if kind~='trade' then chosen=nil;restoreButtons() end;kind='trade' else database=nil;if kind~='craft' then chosen=nil;restoreButtons() end;kind='craft' end
    refresh();if C_Timer then C_Timer.After(0,hideNative) else hideNative() end
   end)
  end
  if not InCombatLockdown() then
   local skills={};for i=1,GetNumSkillLines() do local n,h,_,rank,_,_,max=GetSkillLineInfo(i);if not h then skills[n]={rank=rank,max=max} end end
   local n=0
   for _,id in ipairs(spellIds) do
    local name=GetSpellInfo(id);local skill=name and skills[name]
    if skill then n=n+1;local b=buttons[n];b.label:SetText(name..'  '..skill.rank..' / '..skill.max);local _,_,icon=GetSpellInfo(id);b.icon:SetTexture(icon);b:SetAttribute('type','spell');b:SetAttribute('spell',name);b:Show() end
   end
   for i=n+1,#buttons do buttons[i]:Hide() end
  end
  frame:Show();GL.CaptureProfessionSkills();updateCharacterButtons();layoutSections();refresh()
 end
 function GL.InitializeProfessionShortcut()
  if launcher or not GL.db then return end
  local s=setting();launcher=CreateFrame('Button',nil,UIParent);launcher:SetSize(36,36);launcher:SetFrameStrata('HIGH');launcher:SetClampedToScreen(true);launcher:SetMovable(true);launcher:EnableMouse(true);launcher:RegisterForDrag('LeftButton')
  local texture=launcher:CreateTexture(nil,'ARTWORK');texture:SetAllPoints();texture:SetTexture(iconPath)
  launcher:SetPoint('CENTER',UIParent,'CENTER',s.x or 22,s.y or 0)
  launcher:SetScript('OnDragStart',launcher.StartMoving);launcher:SetScript('OnDragStop',function(self) self:StopMovingOrSizing();local x,y=self:GetCenter();local px,py=UIParent:GetCenter();local p=setting();p.x=x-px;p.y=y-py end)
  launcher:SetScript('OnClick',GL.ShowProfessions)
  launcher:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetText('Berufe · Klicken zum Öffnen, ziehen zum Verschieben');GameTooltip:Show() end);launcher:SetScript('OnLeave',function() GameTooltip:Hide() end)
  launcher:SetShown(s.shown==true)
 end
 function GL.ToggleProfessionShortcut()
  GL.InitializeProfessionShortcut();local s=setting();if s.x==nil and s.y==nil then launcher:ClearAllPoints();launcher:SetPoint('CENTER',UIParent,'CENTER',22,0)end;s.shown=not launcher:IsShown();launcher:SetShown(s.shown);return s.shown
 end
 local login=CreateFrame('Frame');login:RegisterEvent('PLAYER_LOGIN');login:SetScript('OnEvent',function() GL.InitializeProfessionShortcut() end)
end
