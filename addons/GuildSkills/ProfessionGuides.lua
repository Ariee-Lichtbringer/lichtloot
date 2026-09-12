local _,GL=...
local ids={alchemy=4,blacksmithing=2,enchanting=10,engineering=9,leatherworking=3,tailoring=8,cooking=6,['first-aid']=1,herbalism=5,mining=7,skinning=12,fishing=11}
local panel,body,scroll,skill,selected,currentLabel
local widgets,expanded={},{}
local notesOpen,materialsOpen=false,false
local function level(value) return math.max(1,math.min(300,math.floor(tonumber(value) or 1))) end
function GL.ProfessionGuideSteps(profession,value)
 local rows={};for _,s in ipairs(profession.steps) do if s.to>level(value) then rows[#rows+1]=s end end;return rows
end
function GL.ProfessionGuideMaterials(steps)
 local available,needed={},{}
 for _,step in ipairs(steps) do
  for _,m in ipairs(step.materials or {}) do
   local key=m.type..':'..m.id;local used=math.min(available[key] or 0,m.quantity);available[key]=(available[key] or 0)-used
   if m.quantity>used then
    if not needed[key] then needed[key]={type=m.type,id=m.id,name=m.name,icon=m.icon,quantity=0} end
    needed[key].quantity=needed[key].quantity+m.quantity-used
   end
  end
  if step.recipe and step.recipe.type=='item' then local key='item:'..step.recipe.id;available[key]=(available[key] or 0)+(step.crafts or 0) end
 end
 local rows={};for _,m in pairs(needed) do rows[#rows+1]=m end;table.sort(rows,function(a,b) return a.name<b.name end);return rows
end
local function render(reset)
 if not selected then return end
 local previous=scroll:GetVerticalScroll() or 0
 for _,w in ipairs(widgets) do w:Hide() end;local used,y=0,0
 local function row(value,record,toggle,tint)
  used=used+1;local w=widgets[used]
  if not w then
   w=CreateFrame('Button',nil,body);w.label=w:CreateFontString(nil,'OVERLAY','GameFontHighlight');w.label:SetJustifyH('LEFT');w.label:SetJustifyV('TOP');w.label:SetWordWrap(true)
   w.icon=w:CreateTexture(nil,'ARTWORK');w.icon:SetPoint('TOPLEFT',8,-5);w.icon:SetSize(24,24)
   w.background=w:CreateTexture(nil,'BACKGROUND');w.background:SetAllPoints();widgets[used]=w
  end
  w:ClearAllPoints();w:SetPoint('TOPLEFT',0,-y);w:SetWidth(682);w.label:ClearAllPoints();w.label:SetPoint('TOPLEFT',record and 40 or 8,-5);w.label:SetWidth(record and 632 or 664);w.label:SetText(value);w.label:SetTextColor(unpack(tint or {.88,.91,.95}))
  w.icon:SetShown(record~=nil);if record then w.icon:SetTexture('Interface\\Icons\\'..(record.icon or 'INV_Misc_QuestionMark')) end
  w.background:SetColorTexture(.08,.13,.20,toggle and 1 or .35)
  local h=math.max(record and 36 or 26,w.label:GetStringHeight()+12);w:SetHeight(h);w:Show();y=y+h+4
  w:SetScript('OnClick',function(_,which)
   if record and which=='LeftButton' and IsShiftKeyDown() then
    skill:ClearFocus();GL.InsertProfessionRecipeLink({kind='snapshot',spellId=record.type=='spell' and record.id or 0,itemId=record.type=='item' and record.id or 0,name=record.name})
   elseif which=='LeftButton' and toggle then toggle();render(false) end
  end)
  w:SetScript('OnEnter',function(self) if record then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetHyperlink(record.type..':'..record.id);GameTooltip:Show() end end)
  w:SetScript('OnLeave',function() GameTooltip:Hide() end)
 end
 row(selected.name..' · Skillguide 1–300',nil,nil,{1,.82,.35})
 row(selected.intro)
 row('Materialmengen sind Richtwerte für den ganzen Abschnitt. Shift + Linksklick: Rezept oder Material in den Chat.')
 row((notesOpen and '[-] ' or '[+] ')..'Ausbildung und Vorbereitung',nil,function() notesOpen=not notesOpen end,{1,.82,.35})
 if notesOpen then for _,n in ipairs(selected.notes or {}) do row('Ab '..n.skill..': '..n.text) end end
 local steps=GL.ProfessionGuideSteps(selected,skill:GetText())
 row((materialsOpen and '[-] ' or '[+] ')..'Materialplan für die angezeigten Abschnitte',nil,function() materialsOpen=not materialsOpen end,{1,.82,.35})
 if materialsOpen then for _,m in ipairs(GL.ProfessionGuideMaterials(steps)) do row(m.quantity..' × '..m.name,m) end end
 if #steps==0 then row('Keine weiteren Schritte ab diesem Skill. Mit „Alle Schritte“ den vollständigen Guide anzeigen.') end
 for _,s in ipairs(steps) do
  local key=s['from']..':'..s.to
  row((expanded[key] and '[-] ' or '[+] ')..s['from']..'–'..s.to..' · '..(s.recipe and s.recipe.name or s.title),s.recipe,function() expanded[key]=not expanded[key] end,{1,.82,.35})
  if expanded[key] then
   if s.crafts then row('Planmenge: '..s.crafts..' Herstellungsversuche.') end
   if s.text then row(s.text) end
   for _,m in ipairs(s.materials or {}) do row(m.quantity..' × '..m.name,m) end
  end
 end
 body:SetHeight(math.max(y,1));scroll:SetVerticalScroll(reset and 0 or math.min(previous,math.max(0,y-scroll:GetHeight())))
end
function GL.LayoutProfessionGuide(y)
 if not panel then return end
 panel:ClearAllPoints();panel:SetPoint('TOPLEFT',18,-y);panel:SetPoint('BOTTOMRIGHT',-18,18)
end
function GL.HideProfessionGuide() if panel then skill:ClearFocus();panel:Hide();GameTooltip:Hide() end end
function GL.ShowProfessionGuide(professionId,currentSkill,parent)
 if not parent then return end
 if not panel then
  panel=CreateFrame('Frame','GuildSkillsProfessionGuide',parent);panel:SetSize(724,430)
  currentLabel=panel:CreateFontString(nil,'OVERLAY','GameFontHighlight');currentLabel:SetPoint('TOPLEFT',4,-6)
  local label=panel:CreateFontString(nil,'OVERLAY','GameFontHighlight');label:SetPoint('TOPLEFT',220,-6);label:SetText('Ab Skill:')
  skill=CreateFrame('EditBox',nil,panel,'InputBoxTemplate');skill:SetSize(58,24);skill:SetPoint('TOPLEFT',286,0);skill:SetAutoFocus(false);skill:SetNumeric(true);skill:SetMaxLetters(3);skill:SetText('1')
  local function filter() skill:ClearFocus();skill:SetText(tostring(level(skill:GetText())));render(true) end
  skill:SetScript('OnEnterPressed',filter);skill:SetScript('OnEscapePressed',skill.ClearFocus)
  local apply=CreateFrame('Button',nil,panel,'UIPanelButtonTemplate');apply:SetSize(116,26);apply:SetPoint('TOPLEFT',355,0);apply:SetText('Anzeigen');apply:SetScript('OnClick',filter)
  local all=CreateFrame('Button',nil,panel,'UIPanelButtonTemplate');all:SetSize(140,26);all:SetPoint('TOPLEFT',480,0);all:SetText('Alle Schritte');all:SetScript('OnClick',function() skill:SetText('1');filter() end)
  scroll=CreateFrame('ScrollFrame',nil,panel,'UIPanelScrollFrameTemplate');scroll:SetPoint('TOPLEFT',0,-38);scroll:SetPoint('BOTTOMRIGHT',-26,0)
  body=CreateFrame('Frame',nil,scroll);body:SetSize(692,1);scroll:SetScrollChild(body)
 end
 selected=GL.ProfessionGuides[1];for _,p in ipairs(GL.ProfessionGuides) do if ids[p.id]==professionId then selected=p;break end end
 currentLabel:SetText('Charakter-Skill: '..level(currentSkill)..' / 300')
 expanded={};for i=1,math.min(2,#selected.steps) do local s=selected.steps[i];expanded[s['from']..':'..s.to]=true end
 notesOpen=false;materialsOpen=false;skill:SetText('1');panel:Show();render(true)
end
