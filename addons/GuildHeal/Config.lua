local addonName,GH=...
-- Einstellungsfenster mit drei Reitern: Klickzauber (mit Ketten), Mausüber-Tasten, Anzeige.
local window,picker,chainEditor
local pages,rows,keyRows,checks,sliders={},{},{},{},{}
local KEY_ROWS=10
local capture
local function label(parent,text,x,y,w,font)
 local t=parent:CreateFontString(nil,'OVERLAY',font or 'GameFontHighlightSmall');t:SetPoint('TOPLEFT',x,y);t:SetWidth(w);t:SetJustifyH('LEFT');t:SetText(text);return t
end
local function button(parent,text,x,y,w,fn,h)
 local b=CreateFrame('Button',nil,parent);b:SetPoint('TOPLEFT',x,y);b:SetSize(w,h or 24)
 local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.12,.22,.26,1);b.bg=bg
 b.text=b:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');b.text:SetPoint('LEFT',6,0);b.text:SetPoint('RIGHT',-6,0);b.text:SetJustifyH('CENTER');b.text:SetText(text)
 b:SetScript('OnClick',fn);b:SetScript('OnEnter',function() bg:SetColorTexture(.2,.32,.34,1) end);b:SetScript('OnLeave',function() bg:SetColorTexture(.12,.22,.26,1) end);return b
end
local function spellSlot(parent,x,y,w,onClick,onDrag)
 local b=button(parent,'',x,y,w,onClick,26);b.text:SetJustifyH('LEFT');b.text:SetPoint('LEFT',30,0)
 b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetSize(20,20);b.icon:SetPoint('LEFT',5,0)
 b:SetScript('OnReceiveDrag',onDrag);return b
end
local function showValue(slot,value)
 slot.text:SetText(GH.BindingText(value))
 local icon=GH.SpellIconOf(value)
 slot.icon:SetTexture(icon);slot.icon:SetShown(icon~=nil)
 if value==nil then slot.text:SetTextColor(.5,.6,.7) elseif (type(value)=='number' and not GH.Known(value)) or (type(value)=='string' and value~='target' and value~='menu' and not GH.ValidSpell(value)) then slot.text:SetTextColor(1,.5,.4) else slot.text:SetTextColor(1,1,1) end
end
local function check(parent,text,x,y,key,tip,onChange)
 local c=CreateFrame('CheckButton',nil,parent,'UICheckButtonTemplate');c:SetPoint('TOPLEFT',x,y);c:SetSize(24,24)
 local t=label(parent,text,x+26,y-6,230);t:SetTextColor(.9,.94,1)
 c:SetScript('OnClick',function(self) GH.DB()[key]=self:GetChecked() and true or false;if onChange then onChange() else GH.ApplyLayout() end end)
 c:SetScript('OnEnter',function(self) if tip then GameTooltip:SetOwner(self,'ANCHOR_RIGHT');GameTooltip:SetText(text);GameTooltip:AddLine(tip,1,1,1,true);GameTooltip:Show() end end);c:SetScript('OnLeave',function() GameTooltip:Hide() end)
 checks[key]=c;return c
end
local function slider(parent,text,x,y,key,min,max,step,fmt)
 local name='GuildHealSlider'..key
 local s=CreateFrame('Slider',name,parent,'OptionsSliderTemplate');s:SetPoint('TOPLEFT',x,y);s:SetWidth(200);s:SetMinMaxValues(min,max);s:SetValueStep(step);if s.SetObeyStepOnDrag then s:SetObeyStepOnDrag(true) end
 s.Low=s.Low or _G[name..'Low'];s.High=s.High or _G[name..'High'];s.Text=s.Text or _G[name..'Text']
 if s.Low then s.Low:SetText(tostring(min)) end;if s.High then s.High:SetText(tostring(max)) end
 s:SetScript('OnValueChanged',function(self,value) value=math.floor(value/step+.5)*step;if self.Text then self.Text:SetText(text..': '..(fmt and fmt(value) or value)) end;if not self.loading and GH.DB()[key]~=value then GH.DB()[key]=value;GH.ApplyLayout() end end)
 sliders[key]={frame=s,text=text,fmt=fmt};return s
end

-- Zauberauswahl: Liste aller Zauber des Zauberbuchs plus Aktionen; Ziel ist ein Callback.
local function closePicker() if picker then picker:Hide() end end
local function openPicker(anchorFrame,onPick,options)
 if not picker then
  picker=CreateFrame('Frame',nil,UIParent);picker:SetSize(250,332);picker:SetFrameStrata('TOOLTIP');picker:EnableMouse(true)
  local bg=picker:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.04,.07,.1,.98)
  local border=picker:CreateTexture(nil,'BORDER');border:SetPoint('TOPLEFT',-1,1);border:SetPoint('BOTTOMRIGHT',1,-1);border:SetColorTexture(.35,.5,.6,.9);border:SetDrawLayer('BORDER',-1)
  picker.search=CreateFrame('EditBox',nil,picker,'InputBoxTemplate');picker.search:SetPoint('TOPLEFT',12,-8);picker.search:SetSize(226,20);picker.search:SetAutoFocus(false);picker.search:SetMaxLetters(30)
  picker.search:SetScript('OnTextChanged',function() picker.offset=0;picker:Refresh() end);picker.search:SetScript('OnEscapePressed',closePicker)
  picker.hint=label(picker,'Suchen und klicken. Eingerückt: fester Rang. Mausrad blättert.',8,-30,236);picker.hint:SetTextColor(.6,.7,.8)
  picker.items={}
  for i=1,13 do
   local b=CreateFrame('Button',nil,picker);b:SetPoint('TOPLEFT',6,-44-(i-1)*22);b:SetSize(238,21)
   local hl=b:CreateTexture(nil,'HIGHLIGHT');hl:SetAllPoints();hl:SetColorTexture(.2,.32,.34,.7)
   b.icon=b:CreateTexture(nil,'ARTWORK');b.icon:SetSize(18,18);b.icon:SetPoint('LEFT',2,0)
   b.text=b:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');b.text:SetPoint('LEFT',24,0);b.text:SetPoint('RIGHT',-2,0);b.text:SetJustifyH('LEFT')
   b:SetScript('OnClick',function(self) if self.entry then picker.onPick(self.entry.clear and nil or self.entry.value);closePicker() end end)
   picker.items[i]=b
  end
  picker:EnableMouseWheel(true);picker:SetScript('OnMouseWheel',function(_,delta) picker.offset=math.max(0,(picker.offset or 0)-delta*3);picker:Refresh() end)
  function picker:Refresh()
   local query=(self.search:GetText() or ''):lower();local list={}
   if not self.options.spellsOnly then list={{clear=true,text='– leer –'},{value='target',text='Ziel anvisieren'},{value='menu',text='Einheitenmenü'},{value='stopcasting',text='Zauber abbrechen (/stopcasting)'}} else list={{clear=true,text='– leer –'}} end
   for _,s in ipairs(GH.SpellbookSpells()) do
    if query=='' or s.name:lower():find(query,1,true) then
     list[#list+1]={value=s.name,text=s.name..(#s.ranks>1 and '  (höchster Rang)' or ''),icon=s.icon}
     if #s.ranks>1 then for _,r in ipairs(s.ranks) do list[#list+1]={value=r.full,text='    '..s.name..' · '..r.rank,icon=s.icon} end end
    end
   end
   local offset=math.min(self.offset or 0,math.max(0,#list-13));self.offset=offset
   for i,b in ipairs(self.items) do local entry=list[offset+i];b.entry=entry;if entry then b.text:SetText(entry.text);b.icon:SetTexture(entry.icon);b.icon:SetShown(entry.icon~=nil);b:Show() else b:Hide() end end
  end
 end
 picker.onPick=onPick;picker.options=options or {};picker.offset=0;picker.search:SetText('');picker:ClearAllPoints();picker:SetPoint('TOPLEFT',anchorFrame,'TOPRIGHT',6,0);picker:Refresh();picker:Show();picker.search:SetFocus()
end
local function cursorSpell()
 local kind,_,_,spellId=GetCursorInfo()
 if kind=='spell' then local name=spellId and GetSpellInfo(spellId);ClearCursor();return name end
end

-- Kettenbearbeitung je Belegung: Schmuckstücke und bis zu zwei Zusatzzauber vor dem Hauptzauber.
local function openChainEditor(id,title)
 if not chainEditor then
  chainEditor=CreateFrame('Frame',nil,UIParent);chainEditor:SetSize(330,250);chainEditor:SetFrameStrata('DIALOG');chainEditor:EnableMouse(true);chainEditor:SetMovable(true);chainEditor:RegisterForDrag('LeftButton');chainEditor:SetScript('OnDragStart',chainEditor.StartMoving);chainEditor:SetScript('OnDragStop',chainEditor.StopMovingOrSizing)
  local bg=chainEditor:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.05,.08,.11,.98)
  local border=chainEditor:CreateTexture(nil,'BORDER');border:SetPoint('TOPLEFT',-1,1);border:SetPoint('BOTTOMRIGHT',1,-1);border:SetColorTexture(.35,.5,.6,.9);border:SetDrawLayer('BORDER',-1)
  chainEditor.title=label(chainEditor,'',12,-12,300,'GameFontNormal');chainEditor.title:SetTextColor(1,.8,.25)
  label(chainEditor,'Wird vor dem Hauptzauber ausgelöst. Zusatzzauber ohne globale Abklingzeit (z. B. Innerer Fokus, Naturschnelligkeit) und Schmuckstücke zünden nur, wenn sie bereit sind, sonst kommt nur der Hauptzauber.',12,-34,306):SetTextColor(.7,.8,.9)
  chainEditor.t13=CreateFrame('CheckButton',nil,chainEditor,'UICheckButtonTemplate');chainEditor.t13:SetPoint('TOPLEFT',10,-92);chainEditor.t13:SetSize(24,24);label(chainEditor,'Schmuckstück oben (Platz 13)',38,-98,260)
  chainEditor.t14=CreateFrame('CheckButton',nil,chainEditor,'UICheckButtonTemplate');chainEditor.t14:SetPoint('TOPLEFT',10,-118);chainEditor.t14:SetSize(24,24);label(chainEditor,'Schmuckstück unten (Platz 14)',38,-124,260)
  chainEditor.t13:SetScript('OnClick',function(self) GH.Chain(chainEditor.id).trinket13=self:GetChecked() and true or nil;GH.ApplyBindings() end)
  chainEditor.t14:SetScript('OnClick',function(self) GH.Chain(chainEditor.id).trinket14=self:GetChecked() and true or nil;GH.ApplyBindings() end)
  chainEditor.slots={}
  for i=1,2 do
   label(chainEditor,'Zusatzzauber '..i,12,-158-(i-1)*32,90)
   local slot;slot=spellSlot(chainEditor,104,-152-(i-1)*32,210,function()
    local dragged=cursorSpell();if dragged then GH.Chain(chainEditor.id).spells[i]=dragged;GH.ApplyBindings();chainEditor:Refresh();return end
    openPicker(slot,function(value) local chain=GH.Chain(chainEditor.id);if value==nil then table.remove(chain.spells,i) else chain.spells[i]=value end;GH.ApplyBindings();chainEditor:Refresh() end,{spellsOnly=true})
   end,function() local dragged=cursorSpell();if dragged then GH.Chain(chainEditor.id).spells[i]=dragged;GH.ApplyBindings();chainEditor:Refresh() end end)
   chainEditor.slots[i]=slot
  end
  button(chainEditor,'Kette leeren',12,-222,110,function() local chain=GH.Chain(chainEditor.id);chain.trinket13=nil;chain.trinket14=nil;chain.spells={};GH.ApplyBindings();chainEditor:Refresh() end,22)
  button(chainEditor,'Fertig',236,-222,82,function() chainEditor:Hide() end,22)
  function chainEditor:Refresh()
   local chain=GH.Chain(self.id);self.t13:SetChecked(chain.trinket13==true);self.t14:SetChecked(chain.trinket14==true)
   for i,slot in ipairs(self.slots) do showValue(slot,chain.spells[i]) end
  end
  chainEditor:SetScript('OnHide',function() closePicker();GH.ConfigRefresh() end)
 end
 chainEditor.id=id;chainEditor.title:SetText('Kette für '..title);chainEditor:ClearAllPoints();chainEditor:SetPoint('CENTER',window,'CENTER',0,0);chainEditor:Refresh();chainEditor:Show()
end

-- Tastenaufnahme: nächste Taste (mit Shift/Strg/Alt), Maustaste 3–5 oder Mausrad wird übernommen.
local MODIFIER_KEYS={LSHIFT=true,RSHIFT=true,LCTRL=true,RCTRL=true,LALT=true,RALT=true}
local function startCapture(index)
 if not capture then
  capture=CreateFrame('Frame',nil,UIParent);capture:SetAllPoints();capture:SetFrameStrata('FULLSCREEN_DIALOG');capture:EnableMouse(true);capture:EnableKeyboard(true);capture:EnableMouseWheel(true)
  local bg=capture:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(0,0,0,.55)
  local box=CreateFrame('Frame',nil,capture);box:SetSize(380,90);box:SetPoint('CENTER');local bbg=box:CreateTexture(nil,'BACKGROUND');bbg:SetAllPoints();bbg:SetColorTexture(.05,.08,.11,.98)
  local t=box:CreateFontString(nil,'OVERLAY','GameFontNormalLarge');t:SetPoint('TOP',0,-16);t:SetText('Taste drücken');t:SetTextColor(1,.8,.25)
  local h=box:CreateFontString(nil,'OVERLAY','GameFontHighlightSmall');h:SetPoint('TOP',0,-48);h:SetText('Auch mit Shift, Strg, Alt. Maustaste 4/5 und Mausrad gehen ebenfalls. Escape bricht ab.')
  local function finish(key) capture:Hide();if key then GH.SetKey(capture.index,key,nil);GH.ConfigRefresh() end end
  local function prefix() return (IsAltKeyDown() and 'ALT-' or '')..(IsControlKeyDown() and 'CTRL-' or '')..(IsShiftKeyDown() and 'SHIFT-' or '') end
  capture:SetScript('OnKeyDown',function(_,key) if key=='ESCAPE' then finish(nil) elseif not MODIFIER_KEYS[key] then finish(prefix()..key) end end)
  capture:SetScript('OnMouseDown',function(_,mouse) local map={MiddleButton='BUTTON3',Button4='BUTTON4',Button5='BUTTON5'};if map[mouse] then finish(prefix()..map[mouse]) end end)
  capture:SetScript('OnMouseWheel',function(_,delta) finish(prefix()..(delta>0 and 'MOUSEWHEELUP' or 'MOUSEWHEELDOWN')) end)
 end
 capture.index=index;capture:Show()
end
function GH.ConfigRefresh()
 if not window or not window:IsShown() then return end
 local db=GH.DB();local bindings=GH.Bindings();local store=GH.ClassStore()
 window.modifier=window.modifier or ''
 for i,m in ipairs(GH.MODIFIERS) do local b=window.modButtons[i];local on=m.mod==window.modifier;b.bg:SetColorTexture(on and .2 or .12,on and .45 or .22,on and .45 or .26,1);b.text:SetTextColor(on and 1 or .8,on and .9 or .85,on and .4 or .9) end
 for _,row in ipairs(rows) do
  row.id=window.modifier..row.buttonKey;local value=bindings[row.id]
  if not row.input:HasFocus() then row.input:SetText(GH.BindingInput(value));row.input.dirty=nil end
  local icon=GH.SpellIconOf(value);row.icon:SetTexture(icon);row.icon:SetShown(icon~=nil)
  local kind=value==nil and '' or GH.ACTIONS[value] and 'Aktion' or (type(value)=='string' and value:find('^macro:')) and 'Makro' or (type(value)=='string' and value:find('^item:')) and 'Gegenstand' or ((type(value)=='number' and GH.Known(value)) or (type(value)=='string' and GH.ValidSpell(value))) and 'Zauber' or 'unbekannt'
  row.kind:SetText(kind);row.kind:SetTextColor(kind=='unbekannt' and 1 or .6,kind=='unbekannt' and .5 or .75,kind=='unbekannt' and .4 or .85)
  local active=GH.ChainActive(row.id);row.chain.text:SetText(active and 'Kette ✓' or '+Kette');row.chain.text:SetTextColor(active and .4 or 1,1,active and .5 or 1)
 end
 local keys=GH.Keys()
 for i,row in ipairs(keyRows) do
  local entry=keys[i];local value=entry and entry.value
  row.key.text:SetText(entry and entry.key or 'Taste wählen');row.key.text:SetTextColor(entry and entry.key and 1 or .5,entry and entry.key and 1 or .6,entry and entry.key and 1 or .7)
  if not row.input:HasFocus() then row.input:SetText(GH.BindingInput(value));row.input.dirty=nil end
  local icon=GH.SpellIconOf(value);row.icon:SetTexture(icon);row.icon:SetShown(icon~=nil)
  local active=GH.ChainActive('key'..i);row.chain.text:SetText(active and 'Kette ✓' or '+Kette')
 end
 local editing=not db.locked;window.editButton.text:SetText(editing and 'UI bearbeiten: an' or 'UI bearbeiten: aus');window.editButton.bg:SetColorTexture(editing and .2 or .12,editing and .45 or .22,editing and .45 or .26,1);window.editButton.text:SetTextColor(editing and 1 or .85,editing and .9 or .9,editing and .4 or .95)
 for key,c in pairs(checks) do c:SetChecked(db[key]==true) end
 for key,s in pairs(sliders) do s.frame.loading=true;s.frame:SetValue(db[key]);if s.frame.Text then s.frame.Text:SetText(s.text..': '..(s.fmt and s.fmt(db[key]) or db[key])) end;s.frame.loading=false end
 local classLabel=UnitClass('player');window.classText:SetText('Belegung für '..(classLabel or 'deine Klasse')..(db.perCharacter and ' (nur '..(UnitName('player') or '')..')' or ' (alle Charaktere dieser Klasse)')..' · links den Modifikator wählen, rechts je Maustaste eintragen. Die Maus liegt dabei über dem Spielerfeld.')
 local auras=GH.TrackedAuras();window.auraList:SetText(#auras>0 and table.concat(auras,', ') or '– keine –')
 local boss=GH.BossDebuffs();window.bossList:SetText(#boss>0 and table.concat(boss,', ') or '– keine –')
 if window.tanksInput and not window.tanksInput:HasFocus() then window.tanksInput:SetText(db.tanks or '') end
 for _,b in ipairs(window.sortButtons or {}) do local on=(db.sortMode or 'group')==b.mode;b.bg:SetColorTexture(on and .2 or .12,on and .45 or .22,on and .45 or .26,1) end
 for _,b in ipairs(window.layoutButtons or {}) do local on=db[b.choiceKey]==b.choiceValue;b.bg:SetColorTexture(on and .2 or .12,on and .45 or .22,on and .45 or .26,1) end
 for _,sw in ipairs(window.swatches or {}) do local r,g,b,a=GH.Color(sw.key);sw.color:SetColorTexture(r,g,b,(sw.key=='border' and (a or 0)<.05) and .15 or 1) end
end

local function showPage(name)
 for key,page in pairs(pages) do page.frame:SetShown(key==name);page.tab.bg:SetColorTexture(key==name and .2 or .1,key==name and .45 or .18,key==name and .45 or .22,1) end
 closePicker()
end
local function build()
 window=CreateFrame('Frame','GuildHealConfig',UIParent);window:SetSize(680,660);window:SetPoint('CENTER');window:SetMovable(true);window:EnableMouse(true);window:SetClampedToScreen(true);window:SetFrameStrata('HIGH')
 window:RegisterForDrag('LeftButton');window:SetScript('OnDragStart',window.StartMoving);window:SetScript('OnDragStop',window.StopMovingOrSizing)
 local bg=window:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.05,.08,.11,.97)
 local border=window:CreateTexture(nil,'BORDER');border:SetPoint('TOPLEFT',-1,1);border:SetPoint('BOTTOMRIGHT',1,-1);border:SetColorTexture(.35,.5,.6,.8);border:SetDrawLayer('BORDER',-1)
 local logo=window:CreateTexture(nil,'ARTWORK');logo:SetSize(30,30);logo:SetPoint('TOPLEFT',12,-10);logo:SetTexture(GH.MEDIA..'GuildHeal')
 local title=label(window,'GuildHeal · Einstellungen',50,-14,400,'GameFontNormalLarge');title:SetTextColor(1,.8,.25)
 label(window,'Version '..GH.VERSION..' · „UI bearbeiten“ zeigt die Griffe zum Verschieben, /gheal reset setzt die Position zurück.',50,-36,400):SetTextColor(.6,.7,.8)
 button(window,'×',648,-10,22,function() window:Hide() end,22)
 window.editButton=button(window,'UI bearbeiten: aus',470,-10,170,function() GH.DB().locked=not GH.DB().locked;GH.ApplyLayout();GH.ConfigRefresh() end,22)
 window.editButton:SetScript('OnEnter',function(self) GameTooltip:SetOwner(self,'ANCHOR_BOTTOM');GameTooltip:SetText('UI bearbeiten');GameTooltip:AddLine('An: Griffe erscheinen über den Spielerfeldern und der Cooldown-Leiste, alles lässt sich ziehen. Aus: Griffe weg, Positionen fest.',1,1,1,true);GameTooltip:Show() end);window.editButton:SetScript('OnLeave',function() GameTooltip:Hide() end)
 window.classText=label(window,'',14,-58,650);window.classText:SetTextColor(.85,.92,1)
 local tabs={{'clicks','Klickzauber'},{'keys','Tasten'},{'design','Design'},{'display','Anzeige'},{'alerts','Warnungen'}}
 for i,t in ipairs(tabs) do
  local frame=CreateFrame('Frame',nil,window);frame:SetPoint('TOPLEFT',0,-118);frame:SetPoint('BOTTOMRIGHT',0,0);frame:Hide()
  local tab=button(window,t[2],14+(i-1)*132,-88,126,function() showPage(t[1]) end,24)
  pages[t[1]]={frame=frame,tab=tab}
 end
 -- Reiter 1: Modifikator links, Maustasten und Mausrad rechts (wie VuhDo).
 local p=pages.clicks.frame
 label(p,'Modifikationstaste',14,-4,200,'GameFontNormal')
 window.modButtons={}
 for i,m in ipairs(GH.MODIFIERS) do
  local b=button(p,m.label,14,-26-(i-1)*30,170,function() window.modifier=m.mod;GH.ConfigRefresh() end,26)
  window.modButtons[i]=b
 end
 label(p,'Maustaste',210,-4,300,'GameFontNormal')
 for i,b in ipairs(GH.BUTTONS) do
  local y=-26-(i-1)*46
  local row={buttonKey=b.key}
  label(p,b.label,210,y-2,200):SetTextColor(.7,.85,1)
  row.input=CreateFrame('EditBox',nil,p,'InputBoxTemplate');row.input:SetPoint('TOPLEFT',214,y-14);row.input:SetSize(280,22);row.input:SetAutoFocus(false);row.input:SetMaxLetters(120)
  row.input:SetScript('OnEnterPressed',function(self) GH.SetBinding(row.id,GH.ParseInput(self:GetText()));self:ClearFocus() end)
  row.input:SetScript('OnEscapePressed',function(self) self:ClearFocus();GH.ConfigRefresh() end)
  row.input:SetScript('OnEditFocusLost',function(self) if self.dirty then GH.SetBinding(row.id,GH.ParseInput(self:GetText()));self.dirty=nil end end)
  row.input:SetScript('OnTextChanged',function(self,user) if user then self.dirty=true end end)
  row.input:SetScript('OnReceiveDrag',function() local dragged=cursorSpell();if dragged then GH.SetBinding(row.id,dragged) end end)
  row.input:SetScript('OnMouseDown',function() local dragged=cursorSpell();if dragged then GH.SetBinding(row.id,dragged) end end)
  row.icon=p:CreateTexture(nil,'ARTWORK');row.icon:SetSize(20,20);row.icon:SetPoint('TOPLEFT',498,y-15)
  row.kind=label(p,'',522,y-19,60);row.kind:SetTextColor(.6,.75,.85)
  row.pick=button(p,'Liste',522,y-38,50,function(self) openPicker(self,function(value) GH.SetBinding(row.id,value) end) end,20)
  row.chain=button(p,'+Kette',578,y-38,70,function() openChainEditor(row.id,GH.BindingText(GH.Bindings()[row.id])..' ('..b.label..')') end,20)
  rows[i]=row
 end
 label(p,'Name eines Zaubers (auch mit Rang, z. B. Erneuerung(Rang 5)), Makros oder Gegenstands, oder target / focus / assist / menu / stopcasting. Enter übernimmt. Zauber aus dem Zauberbuch lassen sich auch ins Feld ziehen.',210,-350,440):SetTextColor(.6,.7,.8)
 button(p,'Standard meiner Klasse',14,-276,170,function() GH.ResetBindings();GH.Print('Klickzauber auf die Vorgabe deiner Klasse gesetzt.') end)
 button(p,'Alle leeren',14,-306,170,function() for _,b in ipairs(GH.BINDINGS) do GH.SetBinding(GH.BindingId(b),nil) end end)
 label(p,'Kette: Schmuckstücke und Zusatzzauber ohne globale Abklingzeit werden vor dem Hauptzauber ausgelöst, sobald sie bereit sind. Klick auf den Namen im Feld visiert immer an.',14,-340,180):SetTextColor(.6,.7,.8)
 -- Reiter: Tasten (Maus über einem Feld + Taste)
 p=pages.keys.frame
 label(p,'Liegt die Maus über einem Feld, zaubert die Taste auf diesen Spieler. Außerhalb der Felder behält die Taste ihre normale Funktion.',14,-4,640):SetTextColor(.7,.8,.9)
 for i=1,KEY_ROWS do
  local y=-40-(i-1)*33
  local row={}
  row.key=button(p,'Taste wählen',14,y,130,function() startCapture(i) end,26)
  row.input=CreateFrame('EditBox',nil,p,'InputBoxTemplate');row.input:SetPoint('TOPLEFT',156,y-2);row.input:SetSize(250,22);row.input:SetAutoFocus(false);row.input:SetMaxLetters(120)
  row.input:SetScript('OnEnterPressed',function(self) GH.SetKey(i,nil,GH.ParseInput(self:GetText()));self:ClearFocus() end)
  row.input:SetScript('OnEscapePressed',function(self) self:ClearFocus();GH.ConfigRefresh() end)
  row.input:SetScript('OnTextChanged',function(self,user) if user then self.dirty=true end end)
  row.input:SetScript('OnEditFocusLost',function(self) if self.dirty then GH.SetKey(i,nil,GH.ParseInput(self:GetText()));self.dirty=nil end end)
  row.input:SetScript('OnReceiveDrag',function() local dragged=cursorSpell();if dragged then GH.SetKey(i,nil,dragged) end end)
  row.input:SetScript('OnMouseDown',function() local dragged=cursorSpell();if dragged then GH.SetKey(i,nil,dragged) end end)
  row.icon=p:CreateTexture(nil,'ARTWORK');row.icon:SetSize(20,20);row.icon:SetPoint('TOPLEFT',410,y-3)
  row.pick=button(p,'Liste',436,y,50,function(self) openPicker(self,function(value) GH.SetKey(i,nil,value) end) end,26)
  row.chain=button(p,'+Kette',492,y,70,function() openChainEditor('key'..i,'Taste '..i) end,26)
  row.remove=button(p,'×',568,y,26,function() GH.RemoveKey(i);GH.ConfigRefresh() end,26)
  keyRows[i]=row
 end
 label(p,'Beispiel: F1 = Erneuerung, F2 = Blitzheilung, Maustaste 4 = Machtwort: Schild. Eintrag wie bei den Klickzaubern: Zauber mit Rang, Makro, Gegenstand oder target/menu/stopcasting.',14,-372,640):SetTextColor(.6,.7,.8)
 -- Reiter: Design (Anordnung, Größe, Balken, Schrift, Text)
 p=pages.design.frame
 label(p,'Anordnung',14,-4,300,'GameFontNormal')
 window.layoutButtons={}
 local function choice(x,y,w,text,key,value,onChange) local b=button(p,text,x,y,w,function() GH.DB()[key]=value;if onChange then onChange() else GH.ApplyLayout() end;GH.ConfigRefresh() end);b.choiceKey=key;b.choiceValue=value;table.insert(window.layoutButtons,b);return b end
 label(p,'Spieler einer Gruppe',14,-26,200)
 choice(14,-42,150,'untereinander','unitLayout','vertical');choice(170,-42,150,'nebeneinander','unitLayout','horizontal')
 label(p,'Gruppen',14,-74,200)
 choice(14,-90,150,'nebeneinander','horizontal',true);choice(170,-90,150,'untereinander','horizontal',false)
 label(p,'Text im Feld',14,-122,200)
 choice(14,-138,100,'fehlend',
  'healthText','missing',GH.RefreshAll);choice(118,-138,100,'Prozent','healthText','percent',GH.RefreshAll);choice(222,-138,100,'aktuell/max','healthText','current',GH.RefreshAll)
 choice(14,-166,100,'beides','healthText','both',GH.RefreshAll);choice(118,-166,100,'nichts','healthText','none',GH.RefreshAll)
 label(p,'Balkenstruktur',14,-198,200)
 local i=0;for _,key in ipairs({'blizzard','flat','raid','minimal'}) do choice(14+i*84,-214,80,GH.BAR_TEXTURES[key].label,'barTexture',key);i=i+1 end
 -- Farbakzente über den WoW-Farbwähler
 label(p,'Farben',14,-248,300,'GameFontNormal')
 window.swatches={}
 local function openColor(key)
  local r,g,b,a=GH.Color(key);local hasAlpha=key=='border'
  local function apply() local nr,ng,nb=ColorPickerFrame:GetColorRGB();local na=hasAlpha and (ColorPickerFrame.GetColorAlpha and ColorPickerFrame:GetColorAlpha() or (1-(OpacitySliderFrame and OpacitySliderFrame:GetValue() or 0))) or nil;GH.SetColor(key,nr,ng,nb,na);GH.ConfigRefresh() end
  local function cancel(prev) if prev then GH.SetColor(key,prev.r,prev.g,prev.b,hasAlpha and (prev.a or prev.opacity) or nil);GH.ConfigRefresh() end end
  if ColorPickerFrame.SetupColorPickerAndShow then
   ColorPickerFrame:SetupColorPickerAndShow({r=r,g=g,b=b,opacity=a or 1,hasOpacity=hasAlpha,swatchFunc=apply,opacityFunc=apply,cancelFunc=cancel})
  else
   ColorPickerFrame.func=apply;ColorPickerFrame.opacityFunc=apply;ColorPickerFrame.cancelFunc=cancel;ColorPickerFrame.hasOpacity=hasAlpha;ColorPickerFrame.opacity=1-(a or 1);ColorPickerFrame.previousValues={r=r,g=g,b=b,opacity=1-(a or 1)}
   ColorPickerFrame:SetColorRGB(r,g,b);ColorPickerFrame:Hide();ColorPickerFrame:Show()
  end
 end
 for idx,entry in ipairs(GH.COLOR_LABELS) do
  local y=-268-(idx-1)*26
  local sw=CreateFrame('Button',nil,p);sw:SetSize(22,18);sw:SetPoint('TOPLEFT',14,y);sw.key=entry[1]
  sw.color=sw:CreateTexture(nil,'ARTWORK');sw.color:SetPoint('TOPLEFT',1,-1);sw.color:SetPoint('BOTTOMRIGHT',-1,1)
  local frame=sw:CreateTexture(nil,'BACKGROUND');frame:SetAllPoints();frame:SetColorTexture(.8,.85,.9,1)
  sw:SetScript('OnClick',function(self) openColor(self.key) end)
  label(p,entry[2],42,y-3,280)
  table.insert(window.swatches,sw)
 end
 button(p,'Standardfarben',14,-428,130,function() GH.ResetColors();GH.ConfigRefresh() end,22)
 slider(p,'Breite',360,-24,'width',60,140,2)
 slider(p,'Höhe',360,-70,'height',24,64,2)
 slider(p,'Skalierung',360,-116,'scale',.6,1.6,.05,function(v) return string.format('%.0f%%',v*100) end)
 slider(p,'Abstand',360,-162,'spacing',0,10,1)
 slider(p,'Schriftgröße',360,-208,'fontSize',8,16,1)
 slider(p,'Hintergrund',360,-254,'bgAlpha',.2,1,.05,function(v) return string.format('%.0f%%',v*100) end)
 label(p,'Anordnung, Größe und Abstand wirken nur außerhalb des Kampfes; Text, Balken, Schrift und Farben sofort.',360,-300,300):SetTextColor(.6,.7,.8)
 -- Reiter: Anzeige (Funktionen, Sortierung, Zusatzfelder, Auren)
 p=pages.display.frame
 check(p,'Manabalken anzeigen',14,-28,'showMana')
 check(p,'Debuffs anzeigen',14,-52,'showDebuffs','Entfernbare Debuffs färben den Rahmen: Blau Magie, Lila Fluch, Grün Gift, Braun Krankheit.')
 check(p,'Eingehende Heilung und Überheilung',14,-76,'showIncoming','Angekündigte Heilung im Balken (LibHealComm, wie VuhDo); überschüssige Heilung als oranger Wert (+).')
 check(p,'HoTs und Schilde mit Restzeit',14,-100,'showAuras','Eigene verfolgte Auren erscheinen als kleine Symbole unten links im Feld.',function() GH.RefreshAll() end)
 check(p,'Abklingzeiten über den Feldern',14,-124,'showCooldowns','Zauber aus Belegungen und Ketten sowie Schmuckstücke, solange sie abklingen.',function() GH.RefreshCooldownBar() end)
 check(p,'Klassenfarben im Balken',14,-148,'classColors')
 check(p,'Balkenfarbe nach Lebenspunkten',14,-172,'healthGradient','Grün, Gelb, Rot je nach Prozent; der Name bleibt in Klassenfarbe.',function() GH.RefreshAll() end)
 check(p,'Klick auf den Namen visiert an',14,-196,'nameClick','Der Namensbereich oben im Feld: Linksklick Ziel, Rechtsklick Menü. Aus: das ganze Feld heilt.')
 check(p,'Heilklick nimmt den Spieler ins Ziel',14,-364,'targetOnHeal','An: jeder Heilzauber per Klick visiert den Spieler zusätzlich an. Aus: dein Ziel bleibt, nur der Name visiert an.',function() GH.ApplyBindings() end)
 check(p,'Zauber beim Drücken auslösen',14,-220,'castOnDown','Zaubert schon beim Drücken der Maustaste statt beim Loslassen.',function() GH.ApplyBindings() end)
 check(p,'Ohne Gruppe ausblenden',14,-244,'hideSolo','Zeigt die Frames nur in Gruppe oder Raid.')
 check(p,'Eigenes Feld für mein Ziel',14,-292,'showTargetFrame','Ein größeres Feld über dem Griff zeigt dein aktuelles Ziel.')
 check(p,'Eigene Felder für Tanks',14,-316,'showTankFrames','Haupttank und Hauptassistent im Schlachtzug sowie die Namen unter Warnungen → Tanks bekommen eigene Felder über dem Griff.')
 check(p,'Belegung nur für diesen Charakter',14,-340,'perCharacter','An: Klickzauber und Listen gelten nur für diesen Charakter (startet als Kopie der Klassenbelegung). Aus: für alle Charaktere dieser Klasse.',function() GH.ApplyBindings();GH.ConfigRefresh() end)
 label(p,'Sortierung (wirkt außerhalb des Kampfes)',320,-160,340,'GameFontNormal')
 window.sortButtons={}
 for i,entry in ipairs({{'group','Gruppen 1–8'},{'role','Tanks zuerst'},{'class','Klassen'}}) do
  window.sortButtons[i]=button(p,entry[2],320+(i-1)*112,-180,106,function() GH.DB().sortMode=entry[1];GH.ApplyLayout();GH.ConfigRefresh() end);window.sortButtons[i].mode=entry[1]
 end
 label(p,'Tanks zuerst nutzt die Rollen Haupttank/Hauptassistent des Schlachtzugs. Bitte vom Raidleiter setzen lassen.',320,-208,340):SetTextColor(.6,.7,.8)
 label(p,'Verfolgte Auren (HoTs, Schilde, Schutz-Debuffs)',320,-250,340,'GameFontNormal')
 window.auraList=label(p,'',320,-270,340);window.auraList:SetTextColor(.85,.92,1)
 local addAura;addAura=button(p,'Aura hinzufügen',320,-326,120,function() local dragged=cursorSpell();local function add(name) if not name then return end;local list={};for _,n in ipairs(GH.TrackedAuras()) do list[#list+1]=n end;for _,n in ipairs(list) do if n==name then return end end;list[#list+1]=name;GH.SetTrackedAuras(list);GH.ConfigRefresh() end;if dragged then add(dragged) else openPicker(addAura,add,{spellsOnly=true}) end end)
 button(p,'Letzte entfernen',446,-326,110,function() local list={};for _,n in ipairs(GH.TrackedAuras()) do list[#list+1]=n end;table.remove(list);GH.SetTrackedAuras(list);GH.ConfigRefresh() end)
 button(p,'Standard',562,-326,80,function() GH.ResetTrackedAuras();GH.ConfigRefresh() end)
 label(p,'Abklingzeiten',320,-366,340,'GameFontNormal')
 slider(p,'Symbolgröße',332,-402,'cdSize',18,48,2)
 check(p,'Bereit-Meldung auf dem Bildschirm',320,-432,'cdReadyWarn','Großer Text in der Bildschirmmitte, wenn ein belegter Zauber oder ein Schmuckstück wieder bereit ist.')
 check(p,'Ton bei bereit',320,-456,'cdReadySound')
 button(p,'Leiste wieder an die Felder heften',320,-486,240,function() GH.DB().cdPosition=nil;GH.ApplyLayout() end,22)
 button(p,'Position zurücksetzen',14,-400,150,function() GH.DB().position=nil;GH.ApplyLayout() end)
 -- Reiter: Warnungen (Notfall, Überheilung, Tanks, Mana, Boss-Debuffs)
 p=pages.alerts.frame
 label(p,'Notfall',14,-4,300,'GameFontNormal')
 check(p,'Notfall hervorheben',14,-22,'emergency','Der Spieler mit den wenigsten Lebenspunkten unter der Schwelle pulsiert gelb. WoW erlaubt kein automatisches Heilen, aber so siehst du sofort, wen du klicken musst.')
 check(p,'Ton bei neuem Notfall',14,-46,'emergencySound')
 slider(p,'Notfall-Schwelle',26,-92,'emergencyThreshold',20,90,5,function(v) return v..'%' end)
 label(p,'Aggro',14,-130,300,'GameFontNormal')
 check(p,'Aggro und Bedrohung markieren',14,-148,'aggroBorder','Rot: der Spieler hat Aggro. Orange: über 80 % Bedrohung gegen dein Ziel.')
 label(p,'Heiler-Mana',14,-186,300,'GameFontNormal')
 check(p,'Warnen, wenn ein Heiler wenig Mana hat',14,-204,'healerManaWarn','Priester, Druiden, Paladine und Schamanen unter der Schwelle zeigen MANA im Feld.',function() GH.RefreshAll() end)
 check(p,'Ton bei Mana-Warnung',14,-228,'healerManaSound')
 slider(p,'Mana-Schwelle',26,-274,'healerManaThreshold',5,50,5,function(v) return v..'%' end)
 label(p,'Überheilung',330,-4,300,'GameFontNormal')
 check(p,'Warnen, wenn mein Zauber verpufft',330,-22,'overhealWarn','Läuft dein Zauber auf einen Spieler und würde mehr als die Schwelle davon verpuffen, blinkt das Feld rot. Abbrechen: Escape oder die Aktion stopcasting auf einer Maustaste.')
 check(p,'Bei Tanks nicht warnen',330,-46,'overhealSkipTanks','Tanks: Haupttank/Hauptassistent im Schlachtzug oder Namen aus dem Feld unten.')
 check(p,'Ton bei Überheilung',330,-70,'overhealSound')
 slider(p,'Verpuffender Anteil',342,-116,'overhealThreshold',10,90,5,function(v) return v..'%' end)
 label(p,'Tanks (Namen, mit Komma)',330,-152,200)
 local tanks=CreateFrame('EditBox',nil,p,'InputBoxTemplate');tanks:SetPoint('TOPLEFT',334,-166);tanks:SetSize(300,22);tanks:SetAutoFocus(false);tanks:SetMaxLetters(300)
 tanks:SetScript('OnEnterPressed',function(self) GH.DB().tanks=self:GetText();self:ClearFocus();GH.ApplyLayout() end);tanks:SetScript('OnEditFocusLost',function(self) GH.DB().tanks=self:GetText();GH.ApplyLayout() end);tanks:SetScript('OnEscapePressed',function(self) self:ClearFocus() end)
 window.tanksInput=tanks
 label(p,'Boss-Debuffs (groß im Feld, mit Ton)',330,-204,320,'GameFontNormal')
 window.bossList=label(p,'',330,-224,320);window.bossList:SetTextColor(.85,.92,1)
 check(p,'Ton bei Boss-Debuff',330,-300,'bossDebuffSound')
 label(p,'Debuff-Name eintragen und Enter drücken:',330,-330,300)
 local bossInput=CreateFrame('EditBox',nil,p,'InputBoxTemplate');bossInput:SetPoint('TOPLEFT',334,-346);bossInput:SetSize(300,22);bossInput:SetAutoFocus(false);bossInput:SetMaxLetters(60)
 bossInput:SetScript('OnEnterPressed',function(self) local name=self:GetText():match('^%s*(.-)%s*$');if name~='' then local list={};for _,n in ipairs(GH.BossDebuffs()) do list[#list+1]=n end;for _,n in ipairs(list) do if n==name then name=nil;break end end;if name then list[#list+1]=name;GH.SetBossDebuffs(list) end end;self:SetText('');self:ClearFocus();GH.ConfigRefresh() end)
 bossInput:SetScript('OnEscapePressed',function(self) self:ClearFocus() end)
 button(p,'Letzten entfernen',330,-376,120,function() local list={};for _,n in ipairs(GH.BossDebuffs()) do list[#list+1]=n end;table.remove(list);GH.SetBossDebuffs(list);GH.ConfigRefresh() end)
 button(p,'Standard (MC, BWL, AQ40, Naxx)',456,-376,190,function() GH.ResetBossDebuffs();GH.ConfigRefresh() end)
 window:SetScript('OnHide',function() closePicker();if chainEditor then chainEditor:Hide() end end)
 table.insert(UISpecialFrames,'GuildHealConfig')
 showPage('clicks')
end
function GH.ToggleConfig()
 if not window then build() end
 if window:IsShown() then window:Hide() else window:Show();GH.ConfigRefresh() end
end
