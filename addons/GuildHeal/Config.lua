local addonName,GH=...
-- Einstellungsfenster: Klickzauber je Klasse, Größe und Anzeige. Bewusst klein gehalten.
local window,picker
local rows,checks,sliders={},{},{}
local function label(parent,text,x,y,w,font)
 local t=parent:CreateFontString(nil,'OVERLAY',font or 'GameFontHighlightSmall');t:SetPoint('TOPLEFT',x,y);t:SetWidth(w);t:SetJustifyH('LEFT');t:SetText(text);return t
end
local function button(parent,text,x,y,w,fn,h)
 local b=CreateFrame('Button',nil,parent);b:SetPoint('TOPLEFT',x,y);b:SetSize(w,h or 24)
 local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.22,.26,1);b.bg=bg
 b.text=b:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');b.text:SetPoint('LEFT',6,0);b.text:SetPoint('RIGHT',-6,0);b.text:SetJustifyH('CENTER');b.text:SetText(text)
 b:SetScript('OnClick',fn);b:SetScript('OnEnter',function() bg:SetColorTexture(.2,.32,.34,1) end);b:SetScript('OnLeave',function() bg:SetColorTexture(.12,.22,.26,1) end);return b
end
local function check(parent,text,x,y,key,tip,onChange)
 local c=CreateFrame('CheckButton',nil,parent,'UICheckButtonTemplate');c:SetPoint('TOPLEFT',x,y);c:SetSize(24,24)
 local t=label(parent,text,x+26,y-6,220);t:SetTextColor(.9,.94,1)
 c:SetScript('OnClick',function(self) GH.DB()[key]=self:GetChecked() and true or false;if onChange then onChange() else GH.ApplyLayout() end end)
 c:SetScript('OnEnter',function(self) if tip then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetText(text);GameTooltip:AddLine(tip,1,1,1,true);GameTooltip:Show() end end);c:SetScript('OnLeave',function() GameTooltip:Hide() end)
 checks[key]=c;return c
end
local function slider(parent,text,x,y,key,min,max,step,fmt)
 local name='GuildHealSlider'..key
 local s=CreateFrame('Slider',name,parent,'OptionsSliderTemplate');s:SetPoint('TOPLEFT',x,y);s:SetWidth(200);s:SetMinMaxValues(min,max);s:SetValueStep(step);if s.SetObeyStepOnDrag then s:SetObeyStepOnDrag(true) end
 s.Low=s.Low or _G[name..'Low'];s.High=s.High or _G[name..'High'];s.Text=s.Text or _G[name..'Text']
 if s.Low then s.Low:SetText(tostring(min)) end;if s.High then s.High:SetText(tostring(max)) end;if s.Text then s.Text:SetText(text) end
 s:SetScript('OnValueChanged',function(self,value) value=math.floor(value/step+.5)*step;if self.Text then self.Text:SetText(text..': '..(fmt and fmt(value) or value)) end;if not self.loading and GH.DB()[key]~=value then GH.DB()[key]=value;GH.ApplyLayout() end end)
 s:SetScript('OnMouseUp',function() GH.ApplyLayout() end)
 sliders[key]={frame=s,text=text,fmt=fmt};return s
end

local function closePicker() if picker then picker:Hide() end end
local function openPicker(row)
 if not picker then
  picker=CreateFrame('Frame',nil,window);picker:SetSize(250,332);picker:SetFrameStrata('DIALOG');picker:EnableMouse(true)
  local bg=picker:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.04,.07,.1,.98)
  local border=picker:CreateTexture(nil,'BORDER');border:SetPoint('TOPLEFT',-1,1);border:SetPoint('BOTTOMRIGHT',1,-1);border:SetColorTexture(.35,.5,.6,.9);border:SetDrawLayer('BORDER',-1)
  picker.search=CreateFrame('EditBox',nil,picker,'InputBoxTemplate');picker.search:SetPoint('TOPLEFT',12,-8);picker.search:SetSize(226,20);picker.search:SetAutoFocus(false);picker.search:SetMaxLetters(30)
  picker.search:SetScript('OnTextChanged',function() picker.offset=0;picker:Refresh() end);picker.search:SetScript('OnEscapePressed',closePicker)
  picker.hint=label(picker,'Suchen oder Zauber aus dem Zauberbuch hierher ziehen',8,-30,236);picker.hint:SetTextColor(.6,.7,.8)
  picker.items={}
  for i=1,13 do
   local b=CreateFrame('Button',nil,picker);b:SetPoint('TOPLEFT',6,-44-(i-1)*22);b:SetSize(238,21)
   local hl=b:CreateTexture(nil,'HIGHLIGHT');hl:SetAllPoints();hl:SetColorTexture(.2,.32,.34,.7)
   b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetSize(18,18);b.icon:SetPoint('LEFT',2,0)
   b.text=b:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');b.text:SetPoint('LEFT',24,0);b.text:SetPoint('RIGHT',-2,0);b.text:SetJustifyH('LEFT')
   b:SetScript('OnClick',function(self) if self.value~=nil or self.clear then GH.SetBinding(picker.row.id,self.clear and nil or self.value);closePicker() end end)
   picker.items[i]=b
  end
  picker:EnableMouseWheel(true);picker:SetScript('OnMouseWheel',function(_,delta) picker.offset=math.max(0,(picker.offset or 0)-delta*3);picker:Refresh() end)
  function picker:Refresh()
   local query=(self.search:GetText() or ''):lower()
   local list={{clear=true,text='– leer –'},{value='target',text='Ziel anvisieren'},{value='menu',text='Einheitenmenü'}}
   for _,s in ipairs(GH.SpellbookSpells()) do if query=='' or s.name:lower():find(query,1,true) then list[#list+1]={value=s.name,text=s.name,icon=s.icon} end end
   local offset=math.min(self.offset or 0,math.max(0,#list-13));self.offset=offset
   for i,b in ipairs(self.items) do
    local entry=list[offset+i]
    if entry then b.value=entry.value;b.clear=entry.clear;b.text:SetText(entry.text);b.icon:SetTexture(entry.icon);b.icon:SetShown(entry.icon~=nil);b:Show() else b.value=nil;b.clear=nil;b:Hide() end
   end
  end
 end
 picker.row=row;picker.offset=0;picker.search:SetText('');picker:ClearAllPoints();picker:SetPoint('TOPLEFT',row.button,'TOPRIGHT',6,0);picker:Refresh();picker:Show();picker.search:SetFocus()
end

-- Zauber vom Cursor (Zauberbuch) auf eine Belegung ziehen.
local function acceptCursor(row)
 local kind,_,_,spellId=GetCursorInfo()
 if kind=='spell' then
  local name=spellId and GetSpellInfo(spellId);ClearCursor()
  if name then GH.SetBinding(row.id,name);return true end
 end
 return false
end

function GH.ConfigRefresh()
 if not window or not window:IsShown() then return end
 local db=GH.DB();local bindings=GH.Bindings()
 for _,row in ipairs(rows) do
  local value=bindings[row.id];row.button.text:SetText(GH.BindingText(value))
  local icon=type(value)=='number' and GH.SpellIcon(value) or (type(value)=='string' and GetSpellInfo(value) and select(3,GetSpellInfo(value)))
  row.icon:SetTexture(icon);row.icon:SetShown(icon~=nil)
  if value==nil then row.button.text:SetTextColor(.5,.6,.7) elseif type(value)=='number' and not GH.Known(value) then row.button.text:SetTextColor(1,.5,.4) else row.button.text:SetTextColor(1,1,1) end
 end
 for key,c in pairs(checks) do c:SetChecked(db[key]==true) end
 for key,s in pairs(sliders) do s.frame.loading=true;s.frame:SetValue(db[key]);if s.frame.Text then s.frame.Text:SetText(s.text..': '..(s.fmt and s.fmt(db[key]) or db[key])) end;s.frame.loading=false end
 local classLabel=UnitClass('player');window.classText:SetText('Klickzauber für '..(classLabel or 'deine Klasse')..' · Klick auf eine Belegung wählt einen Zauber, Ziehen aus dem Zauberbuch geht auch.')
end

local function build()
 window=CreateFrame('Frame','GuildHealConfig',UIParent);window:SetSize(640,520);window:SetPoint('CENTER');window:SetMovable(true);window:EnableMouse(true);window:SetClampedToScreen(true);window:SetFrameStrata('HIGH')
 window:RegisterForDrag('LeftButton');window:SetScript('OnDragStart',window.StartMoving);window:SetScript('OnDragStop',window.StopMovingOrSizing)
 local bg=window:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.05,.08,.11,.97)
 local border=window:CreateTexture(nil,'BORDER');border:SetPoint('TOPLEFT',-1,1);border:SetPoint('BOTTOMRIGHT',1,-1);border:SetColorTexture(.35,.5,.6,.8);border:SetDrawLayer('BORDER',-1)
 local logo=window:CreateTexture(nil,'ARTWORK');logo:SetSize(30,30);logo:SetPoint('TOPLEFT',12,-10);logo:SetTexture(GH.MEDIA..'GuildHeal')
 local title=label(window,'GuildHeal · Einstellungen',50,-14,400,'GameFontNormalLarge');title:SetTextColor(1,.8,.25)
 label(window,'Version '..GH.VERSION..' · /gheal lock sperrt die Frames, /gheal reset setzt die Position zurück.',50,-36,560):SetTextColor(.6,.7,.8)
 local close=button(window,'×',608,-10,22,function() window:Hide() end,22)
 window.classText=label(window,'',14,-62,610);window.classText:SetTextColor(.85,.92,1)
 for i,b in ipairs(GH.BINDINGS) do
  local y=-86-(i-1)*34
  label(window,b.label,14,y-7,120)
  local row={id=GH.BindingId(b)}
  row.button=button(window,'',136,y,214,function(self) if not acceptCursor(row) then openPicker(row) end end,26)
  row.button.text:SetJustifyH('LEFT');row.button.text:SetPoint('LEFT',30,0)
  row.icon=row.button:CreateTexture(nil,'ARTWORK');row.icon:SetSize(20,20);row.icon:SetPoint('LEFT',5,0)
  row.button:SetScript('OnReceiveDrag',function() acceptCursor(row) end)
  rows[i]=row
 end
 button(window,'Standard meiner Klasse',14,-400,160,function() GH.ResetBindings();GH.Print('Klickzauber auf die Vorgabe deiner Klasse gesetzt.') end)
 button(window,'Alle leeren',180,-400,90,function() for _,b in ipairs(GH.BINDINGS) do GH.SetBinding(GH.BindingId(b),nil) end end)
 label(window,'Tipp: Ohne Modifikator gilt Links = Hauptheilung, Rechts = große Heilung, Mitte = HoT. Strg entfernt Debuffs.',14,-432,340):SetTextColor(.6,.7,.8)
 label(window,'Darstellung',380,-86,240,'GameFontNormal')
 check(window,'Gruppen nebeneinander',380,-104,'horizontal','Aus: Gruppen untereinander.')
 check(window,'Manabalken anzeigen',380,-128,'showMana')
 check(window,'Debuffs anzeigen',380,-152,'showDebuffs','Entfernbare Debuffs färben den Rahmen: Blau Magie, Lila Fluch, Grün Gift, Braun Krankheit.')
 check(window,'Eingehende Heilung',380,-176,'showIncoming','Zeigt angekündigte Heilung anderer Heiler im Balken, sofern der Client sie meldet.')
 check(window,'Klassenfarben im Balken',380,-200,'classColors')
 check(window,'Zauber beim Drücken auslösen',380,-224,'castOnDown','Zaubert schon beim Drücken der Maustaste statt beim Loslassen.',function() GH.ApplyBindings() end)
 check(window,'Ohne Gruppe ausblenden',380,-248,'hideSolo','Zeigt die Frames nur in Gruppe oder Raid.')
 check(window,'Frames sperren',380,-272,'locked','Gesperrt: kein Anker sichtbar, nichts verschiebbar.')
 slider(window,'Breite',392,-322,'width',60,140,2)
 slider(window,'Höhe',392,-366,'height',24,64,2)
 slider(window,'Skalierung',392,-410,'scale',.6,1.6,.05,function(v) return string.format('%.0f%%',v*100) end)
 button(window,'Position zurücksetzen',380,-456,150,function() GH.DB().position=nil;GH.ApplyLayout() end)
 button(window,'Schließen',540,-456,84,function() window:Hide() end)
 window:SetScript('OnHide',closePicker)
 table.insert(UISpecialFrames,'GuildHealConfig')
end
function GH.ToggleConfig()
 if not window then build() end
 if window:IsShown() then window:Hide() else window:Show();GH.ConfigRefresh() end
end
