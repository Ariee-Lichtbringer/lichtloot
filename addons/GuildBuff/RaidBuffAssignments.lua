local _,GL=...
local R={prefix='GLBuffPlan1',plan={},revision=0,queue={},pending={}};GL.RaidBuffAssignments=R
R.families={
 {key='fort',class='PRIEST',name='Ausdauer',ids={21564,21562}},
 {key='spirit',class='PRIEST',name='Willenskraft',ids={27681}},
 {key='shadow',class='PRIEST',name='Schattenschutz',ids={27683}},
 {key='int',class='MAGE',name='Intelligenz',ids={23028}},
 {key='mark',class='DRUID',name='Mal der Wildnis',ids={21850,21849}},
 {key='wisdom',class='PALADIN',name='Weisheit',ids={25918,25894}},
 {key='might',class='PALADIN',name='Macht',ids={25916,25782}},
 {key='kings',class='PALADIN',name='Könige',ids={25898}},
 {key='salvation',class='PALADIN',name='Rettung',ids={25895}},
 {key='sanctuary',class='PALADIN',name='Refugium',ids={25899}},
 {key='light',class='PALADIN',name='Licht',ids={25917,25890}},
}
R.classes={'Krieger','Paladin','Jäger','Schurke','Priester','Schamane','Magier','Hexer','Druide'}
local families,bySpell={},{}
for _,f in ipairs(R.families) do families[f.key]=f;for _,id in ipairs(f.ids) do bySpell[id]=f.key end end
local function copy(t) local out={};for k,v in pairs(t or {}) do out[k]=type(v)=='table' and copy(v) or v end;return out end
local function canonical(name)
 name=tostring(name or ''):lower()
 if not name:find('-',1,true) then name=name..'-'..(GetNormalizedRealmName and GetNormalizedRealmName() or GetRealmName():gsub('%s','')):lower() end
 return name
end
function R.Roster()
 local out={};if not IsInRaid() then return out end
 for i=1,40 do
  local name,rank,group,_,_,class=GetRaidRosterInfo(i);local guid=UnitGUID('raid'..i)
  if name and guid then out[#out+1]={name=name,rank=rank or 0,group=group,class=class,guid=guid,unit='raid'..i} end
 end
 return out
end
function R.Member(sender)
 for _,m in ipairs(R.Roster()) do if m.guid==sender or canonical(m.name)==canonical(sender) then return m end end
end
function R.CanEdit(sender)
 local m=R.Member(sender or UnitGUID('player'));return m and m.rank>=1 or false
end
function R.Session()
 for _,m in ipairs(R.Roster()) do if m.rank==2 then return m.guid end end
end
local function rosterFingerprint()
 local guids={};for _,m in ipairs(R.Roster()) do guids[#guids+1]=m.guid end;table.sort(guids);return table.concat(guids,',')
end
function R.SaveCache()
 GuildBuffCharDB=GuildBuffCharDB or {}
 if R.session and R.revision>0 then
  GuildBuffCharDB.raidBuffPlan={session=R.session,roster=rosterFingerprint(),at=GetServerTime(),plan=copy(R.plan),revision=R.revision,author=R.author}
 else GuildBuffCharDB.raidBuffPlan=nil end
end
function R.UpdateSession()
 local session=R.Session()
 if session~=R.session then
  local old=R.session
  R.session=session;R.plan={};R.revision=0;R.author=nil;R.pending={};R.queue={};R.draft=nil;R.lastRequest=nil
  local cache=GuildBuffCharDB and GuildBuffCharDB.raidBuffPlan
  if not old and session and type(cache)=='table' and cache.session==session and cache.roster==rosterFingerprint() and type(cache.at)=='number' and GetServerTime()-cache.at>=0 and GetServerTime()-cache.at<7200 and type(cache.revision)=='number' and cache.revision>0 and type(cache.author)=='string' and R.CanEdit(cache.author) and type(cache.plan)=='table' and R.Validate(cache.plan) then
   R.plan=copy(cache.plan);R.revision=cache.revision;R.author=cache.author
  end
  R.SaveCache()
 elseif session and R.revision>0 then
  local members={};for _,m in ipairs(R.Roster()) do members[m.guid]=true end
  for guid in pairs(R.plan) do if not members[guid] then R.plan[guid]=nil end end
  R.SaveCache()
 elseif not session then GuildBuffCharDB=GuildBuffCharDB or {};GuildBuffCharDB.raidBuffPlan=nil end
 return session
end
function R.MaskHas(mask,index) return math.floor((mask or 0)/2^(index-1))%2==1 end
function R.Groups(guid,id)
 local out={};local rows=R.plan[guid] or {};local key=id and bySpell[id]
 for family,mask in pairs(rows) do if not id or family==key then for i=1,9 do if R.MaskHas(mask,i) then out[i]=true end end end end
 return out
end
function R.AssignedSpell(guid,index,options)
 for _,spell in ipairs(options) do if R.MaskHas((R.plan[guid] or {})[bySpell[spell.id]],index) then return spell end end
end
function R.Validate(plan)
 local members={};for _,m in ipairs(R.Roster()) do members[m.guid]=m end
 local rows=0
 for guid,assignments in pairs(plan) do
  local m=members[guid];if not m or type(assignments)~='table' then return false end
  local paladinTargets={}
  for key,mask in pairs(assignments) do
   rows=rows+1;local family=families[key]
   if rows>240 or not family or family.class~=m.class or type(mask)~='number' or mask%1~=0 or mask<0 or mask>(m.class=='PALADIN' and 511 or 255) then return false end
   if m.class=='PALADIN' then for i=1,9 do if R.MaskHas(mask,i) then if paladinTargets[i] then return false end;paladinTargets[i]=true end end end
  end
 end
 return true
end
function R.Encode(plan,revision)
 local rows={tostring(revision),R.session};local guids={};for guid in pairs(plan) do guids[#guids+1]=guid end;table.sort(guids)
 for _,guid in ipairs(guids) do for _,f in ipairs(R.families) do local mask=plan[guid][f.key];if mask and mask>0 then rows[#rows+1]=guid..','..f.key..','..mask end end end
 return table.concat(rows,';')
end
function R.Decode(payload)
 local fields={};for part in (payload..';'):gmatch('(.-);') do fields[#fields+1]=part end
 local revision=tonumber(fields[1]);if not revision or revision%1~=0 or revision<1 or fields[2]~=R.session then return end
 local plan={}
 for i=3,#fields do
  local guid,key,mask=fields[i]:match('^([%w%-]+),([%a]+),(%d+)$');if not guid or not families[key] then return end
  plan[guid]=plan[guid] or {};if plan[guid][key] then return end;plan[guid][key]=tonumber(mask)
 end
 if not R.Validate(plan) then return end
 return plan,revision
end
local function activate(plan,revision,author)
 R.plan=plan;R.revision=revision;R.author=author;R.SaveCache()
 if not R.dirty then R.draft=copy(plan);R.draftRevision=revision end
 if GL.db then GL.db.buffSelections=GL.db.buffSelections or {};local guid=UnitGUID('player');GL.db.buffSelections[guid]=GL.db.buffSelections[guid] or {};GL.db.buffSelections[guid].mode='raid' end
 if GL.Buffs then GL.Buffs.Refresh() end
 if R.RefreshEditor then R.RefreshEditor() end
end
function R.QueuePlan(plan,revision)
 if not C_ChatInfo or not C_ChatInfo.SendAddonMessage then return false,'Addon-Kommunikation nicht verfügbar.' end
 local payload=R.Encode(plan,revision);if #payload>12000 then return false,'Einteilung ist zu groß.' end
 R.sequence=(R.sequence or 0)+1;R.nonce=R.nonce or math.random(1,999999);local id=GetServerTime()..'-'..R.nonce..'-'..R.sequence;local total=math.ceil(#payload/180)
 if #R.queue+total>80 then return false,'Übertragung läuft noch. Bitte kurz warten.' end
 for i=1,total do R.queue[#R.queue+1]={text=id..'|'..i..'|'..total..'|'..payload:sub((i-1)*180+1,i*180),tries=0,session=R.session,requiresOfficer=true} end
 return true
end
function R.Publish(plan)
 R.UpdateSession()
 if not R.CanEdit() then return false,'Nur Schlachtzugsleiter und Assistenten dürfen ändern.' end
 if InCombatLockdown() then return false,'Einteilung bitte außerhalb des Kampfes übernehmen.' end
 if not R.Validate(plan) then return false,'Raid oder Zuweisungen haben sich geändert. Übersicht neu laden.' end
 local revision=math.max(R.revision+1,GetServerTime()*1000+(R.sequence or 0)+1)
 local ok,err=R.QueuePlan(plan,revision);if not ok then return false,err end
 activate(copy(plan),revision,UnitGUID('player'));return true
end
function R.Request()
 if not R.UpdateSession() or not C_ChatInfo or not C_ChatInfo.SendAddonMessage then return end
 local now=GetTime();if R.lastRequest and now-R.lastRequest<10 then return end
 R.lastRequest=now;R.queue[#R.queue+1]={text='Q',tries=0,session=R.session}
end
function R.Receive(prefix,text,channel,sender)
 if prefix~=R.prefix or channel~='RAID' or type(text)~='string' or #text>255 or not R.UpdateSession() then return end
 local m=R.Member(sender);if not m then return end
 if text=='Q' then
  if R.CanEdit() and R.revision>0 and (not R.lastReply or GetTime()-R.lastReply>5) then R.lastReply=GetTime();R.QueuePlan(R.plan,R.revision) end
  return
 end
 if not R.CanEdit(sender) then R.pending[m.guid]=nil;return end
 local id,part,total,data=text:match('^([%d%-]+)|(%d+)|(%d+)|(.*)$');part=tonumber(part);total=tonumber(total)
 if not id or #id>35 or not part or not total or total<1 or total>67 or part<1 or part>total or #data>180 then return end
 local pending=R.pending[m.guid]
 if not pending or pending.id~=id or GetTime()-pending.at>40 then pending={id=id,total=total,parts={},at=GetTime()};R.pending[m.guid]=pending end
 if pending.total~=total or (pending.parts[part] and pending.parts[part]~=data) then R.pending[m.guid]=nil;return end
 pending.parts[part]=data
 for i=1,total do if not pending.parts[i] then return end end
 R.pending[m.guid]=nil;local plan,revision=R.Decode(table.concat(pending.parts))
 if plan and (revision>R.revision or revision==R.revision and m.guid>(R.author or '')) then activate(plan,revision,m.guid) end
end
function R.Pump()
 local item=R.queue[1];if not item then return end
 if item.session~=R.Session() or item.requiresOfficer and not R.CanEdit() then table.remove(R.queue,1);return end
 local ok,result=pcall(C_ChatInfo.SendAddonMessage,R.prefix,item.text,'RAID')
 if ok and (result==nil or result==true or result==0 or Enum and Enum.SendAddonMessageResult and result==Enum.SendAddonMessageResult.Success) then table.remove(R.queue,1)
 else item.tries=item.tries+1;if item.tries>=3 then R.queue={};R.deliveryError='Übertragung fehlgeschlagen. Bitte erneut übernehmen.';if R.RefreshEditor then R.RefreshEditor() end end end
end
local frame=CreateFrame('Frame');local elapsed=0
for _,event in ipairs({'PLAYER_LOGIN','GROUP_ROSTER_UPDATE','CHAT_MSG_ADDON'}) do frame:RegisterEvent(event) end
frame:SetScript('OnEvent',function(_,event,...)
 if event=='CHAT_MSG_ADDON' then R.Receive(...)
 else if C_ChatInfo then C_ChatInfo.RegisterAddonMessagePrefix(R.prefix) end;R.UpdateSession();R.Request();if R.RefreshEditor then R.RefreshEditor() end end
end)
frame:SetScript('OnUpdate',function(_,dt) elapsed=elapsed+dt;if elapsed>=.25 then elapsed=0;local hadQueue=#R.queue>0;R.Pump();if hadQueue and #R.queue==0 and R.RefreshEditor then R.RefreshEditor() end end end)
local editor,body,rows,mode,status,headings=nil,nil,{},'group',nil,{}
local function label(parent,text,x,y,width)
 local f=parent:CreateFontString(nil,'OVERLAY','GameFontNormal');f:SetPoint('TOPLEFT',x,y);f:SetWidth(width);f:SetJustifyH('LEFT');f:SetText(text);return f
end
local function button(parent,text,x,y,width,fn)
 local b=CreateFrame('Button',nil,parent);b:SetSize(width,26);b:SetPoint('TOPLEFT',x,y)
 local bg=b:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.08,.17,.21,1)
 b.text=label(b,text,6,-6,width-12);b:SetScript('OnClick',fn);return b
end
function R.SetDraft(guid,family,index,enabled)
 if not R.CanEdit() or InCombatLockdown() then return false end
 local m=R.Member(guid);local f=families[family]
 if not m or not f or m.class~=f.class or index<1 or index>(m.class=='PALADIN' and 9 or 8) then return false end
 R.draft=R.draft or copy(R.plan);local row=R.draft[guid] or {};R.draft[guid]=row
 if enabled and m.class=='PALADIN' then for key,mask in pairs(row) do if R.MaskHas(mask,index) then row[key]=mask-2^(index-1) end end end
 local mask=row[family] or 0;local old=R.MaskHas(mask,index)
 if old~=enabled then row[family]=mask+(enabled and 1 or -1)*2^(index-1) end
 R.dirty=true;return true
end
function R.RefreshEditor()
 if not editor or not editor:IsShown() then return end
 local allowed=R.CanEdit() and not InCombatLockdown()
 editor.save:SetEnabled(allowed);editor.clear:SetEnabled(allowed)
 local text=R.deliveryError or (#R.queue>0 and 'Einteilung wird übertragen …') or (R.dirty and 'Ungespeichert: mit „Im Raid übernehmen“ verteilen.') or (R.revision>0 and 'Einteilung aktiv · Empfänger benötigen GuildBuff oder GuildLoot 0.22.0 oder neuer.') or 'Nur erlernte Buffs zuweisen und mit „Im Raid übernehmen“ verteilen.'
 if not IsInRaid() then text='Du bist nicht in einem Schlachtzug.'
 elseif not R.CanEdit() then text='Nur ansehen: Änderungen nur mit Raidleitung oder Assistentenrecht (A).'
 elseif InCombatLockdown() then text='Im Kampf nur ansehen. Änderungen nach dem Kampf möglich.'
 elseif R.draftRevision and R.draftRevision~=R.revision then text='Neuere Einteilung empfangen. Bitte „Neu laden“ wählen.' end
 status:SetText(text)
 for i,h in ipairs(headings) do h:SetText(mode=='paladin' and R.classes[i] or (i<=8 and 'Gr. '..i or '')) end
 local list={};local roster=R.Roster();table.sort(roster,function(a,b) return a.name<b.name end)
 for _,m in ipairs(roster) do for _,f in ipairs(R.families) do if f.class==m.class and ((mode=='paladin')==(m.class=='PALADIN')) then list[#list+1]={member=m,family=f} end end end
 for _,row in ipairs(rows) do row:Hide() end
 for i,entry in ipairs(list) do
  local row=rows[i]
  if not row then
   row=CreateFrame('Frame',nil,body);row:SetSize(915,32);row:SetPoint('TOPLEFT',0,-(i-1)*34)
   local bg=row:CreateTexture(nil,'BACKGROUND');bg:SetAllPoints();bg:SetColorTexture(.07,.12,.16,i%2==0 and .9 or .5)
   row.name=label(row,'',5,-8,142);row.spell=label(row,'',180,-8,132)
   row.icon=row:CreateTexture(nil,'ARTWORK');row.icon:SetSize(24,24);row.icon:SetPoint('TOPLEFT',150,-4)
   row.checks={}
   for target=1,9 do
    local targetIndex=target;local check=CreateFrame('CheckButton',nil,row,'UICheckButtonTemplate');check:SetSize(26,26);check:SetPoint('TOPLEFT',320+(target-1)*65,-3)
    check:SetScript('OnClick',function(self) R.SetDraft(row.guid,row.family,targetIndex,self:GetChecked()==true);R.RefreshEditor() end);row.checks[target]=check
   end
   rows[i]=row
  end
  row.guid=entry.member.guid;row.family=entry.family.key;row.name:SetText(entry.member.name);row.spell:SetText(entry.family.name)
  row.icon:SetTexture((GetSpellTexture and GetSpellTexture(entry.family.ids[1])) or 'Interface\\Icons\\INV_Misc_QuestionMark')
  local mask=((R.draft or R.plan)[row.guid] or {})[row.family] or 0
  for target,check in ipairs(row.checks) do check:SetShown(mode=='paladin' or target<=8);check:SetChecked(R.MaskHas(mask,target));check:SetEnabled(allowed) end
  row:Show()
 end
 body:SetHeight(math.max(360,#list*34))
end
function R.Open()
 R.UpdateSession();R.draft=copy(R.plan);R.draftRevision=R.revision;R.dirty=false;R.deliveryError=nil
 if not editor then
  editor=CreateFrame('Frame','GuildBuffRaidAssignments',UIParent,'BackdropTemplate');editor:SetSize(970,560);editor:SetPoint('CENTER');editor:SetFrameStrata('DIALOG');editor:SetClampedToScreen(true);editor:EnableMouse(true);editor:SetMovable(true)
  local width=tonumber(UIParent:GetWidth()) or 1010;local height=tonumber(UIParent:GetHeight()) or 600;editor:SetScale(math.min(1,(width-30)/970,(height-30)/560))
  editor:SetBackdrop({bgFile='Interface\\Buttons\\WHITE8X8'});editor:SetBackdropColor(.025,.04,.06,.98)
  local title=CreateFrame('Frame',nil,editor);title:SetPoint('TOPLEFT');title:SetPoint('TOPRIGHT',-115,0);title:SetHeight(35);title:EnableMouse(true);title:RegisterForDrag('LeftButton')
  label(title,'Buffeinteilung Raid manuell',14,-12,700);title:SetScript('OnDragStart',function() editor:StartMoving() end);title:SetScript('OnDragStop',function() editor:StopMovingOrSizing() end)
  button(editor,'Schließen',852,-7,100,function() editor:Hide() end)
  button(editor,'Gruppenbuffs',14,-43,150,function() mode='group';R.RefreshEditor() end)
  button(editor,'Paladinsegen',172,-43,150,function() mode='paladin';R.RefreshEditor() end)
  label(editor,'Spieler',20,-84,140);label(editor,'Buff',195,-84,130)
  for i=1,9 do headings[i]=label(editor,'',334+(i-1)*65,-84,64) end
  local scroll=CreateFrame('ScrollFrame',nil,editor,'UIPanelScrollFrameTemplate');scroll:SetPoint('TOPLEFT',14,-108);scroll:SetSize(930,365)
  body=CreateFrame('Frame',nil,scroll);body:SetSize(925,365);scroll:SetScrollChild(body)
  status=label(editor,'',14,-483,935)
  editor.clear=button(editor,'Einteilung leeren',14,-517,160,function() if R.CanEdit() and not InCombatLockdown() then R.draft={};R.dirty=true;R.RefreshEditor() end end)
  button(editor,'Neu laden',182,-517,130,function() R.draft=copy(R.plan);R.draftRevision=R.revision;R.dirty=false;R.Request();R.RefreshEditor() end)
  editor.save=button(editor,'Im Raid übernehmen',748,-517,204,function()
   if R.draftRevision~=R.revision then status:SetText('Neuere Einteilung vorhanden. Bitte zuerst neu laden.');return end
   local ok,err=R.Publish(R.draft or {});if ok then R.draftRevision=R.revision;R.dirty=false;R.deliveryError=nil;R.RefreshEditor() else status:SetText(err) end
  end)
 end
 editor:Show();R.RefreshEditor()
end
frame:RegisterEvent('PLAYER_REGEN_ENABLED');frame:RegisterEvent('PLAYER_REGEN_DISABLED')

function R.ChangeOwnBlessing(index,spellID)
 if InCombatLockdown()then return false,'Segen bitte außerhalb des Kampfes wechseln.' end
 if not R.CanEdit()then return false,'Die Raid-Zuweisung kann nur die Raidleitung oder ein Assistent ändern.' end
 if R.dirty then return false,'Bitte offene Änderungen in der Raidübersicht zuerst übernehmen oder neu laden.' end
 R.UpdateSession();local guid=UnitGUID('player');local member=R.Member(guid);local family=bySpell[spellID]
 if not member or member.class~='PALADIN' or not family or families[family].class~='PALADIN' or not index or index%1~=0 or index<1 or index>9 or not IsSpellKnown(spellID)then return false,'Ungültige Segenszuweisung.' end
 local plan=copy(R.plan);local row=plan[guid] or {};plan[guid]=row
 for key,mask in pairs(row)do if R.MaskHas(mask,index)then row[key]=mask-2^(index-1)end end
 row[family]=(row[family]or 0)+2^(index-1)
 return R.Publish(plan)
end
