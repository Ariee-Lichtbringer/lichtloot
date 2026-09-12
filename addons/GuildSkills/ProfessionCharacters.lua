local _,GL=...
local function norm(s) return tostring(s or ''):lower():gsub('%s','') end
function GL.ProfessionPlayerIdentity()
 local player,realm=UnitFullName('player');return player,realm and realm~='' and realm or GetRealmName()
end
local function key(player,realm) return norm(player)..'\031'..norm(realm) end
local function currentRecord()
 if not GL.db then return end
 GL.db.professionCharacters=GL.db.professionCharacters or {}
 local player,realm=GL.ProfessionPlayerIdentity();local id=key(player,realm)
 local r=GL.db.professionCharacters[id] or {player=player,realm=realm,snapshot={schema=1,observedAt=GetServerTime(),professions={},skills={}}}
 GL.db.professionCharacters[id]=r;return r
end
function GL.CaptureProfessionSkills()
 local record=currentRecord();if not record then return end
 local old={};for _,p in ipairs(record.snapshot.professions) do old[p.id]=p end
 local profs,skills={},{};local collapsed=false
 for i=1,GetNumSkillLines() do
  local name,header,expanded,rank,_,_,maxRank=GetSkillLineInfo(i)
  if header and not expanded then collapsed=true end
  if not header and name and maxRank and maxRank>0 then
   skills[#skills+1]={name=name,rank=rank,maxRank=maxRank}
   for _,t in ipairs(GL.ProfessionDatabaseTypes) do
    if name==GetSpellInfo(t[2]) then
     local p=old[t[1]] or {id=t[1],recipes={},scannedAt=0};p.name=name;p.rank=rank;p.maxRank=maxRank;profs[#profs+1]=p;break
    end
   end
  end
 end
 if #skills==0 then return end
 if collapsed then
  local found={};for _,p in ipairs(profs) do found[p.id]=true end
  for id,p in pairs(old) do if not found[id] then profs[#profs+1]=p end end
  local names={};for _,v in ipairs(skills) do names[v.name]=true end
  for _,v in ipairs(record.snapshot.skills or {}) do if not names[v.name] then skills[#skills+1]=v end end
 end
 record.snapshot.professions=profs;record.snapshot.skills=skills;record.snapshot.observedAt=GetServerTime()
end
function GL.CaptureProfessionRecipes(kind)
 GL.CaptureProfessionSkills();local record=currentRecord();if not record then return end
 local name=kind=='trade' and GetTradeSkillLine() or GetCraftDisplaySkillLine()
 local profession;for _,p in ipairs(record.snapshot.professions) do if p.name==name then profession=p;break end end
 if not profession then return end
 local rows,seen={},{}
 local count=kind=='trade' and GetNumTradeSkills() or GetNumCrafts()
 for i=1,count do
  local title,typ
  if kind=='trade' then title,typ=GetTradeSkillInfo(i) else local sub;title,sub,typ=GetCraftInfo(i) end
  if title and typ~='header' and typ~='subheader' then
   local link=kind=='trade' and GetTradeSkillItemLink(i) or (GetCraftItemLink and GetCraftItemLink(i))
   local itemId=link and tonumber(link:match('item:(%d+)')) or 0
   local spellId=link and tonumber(link:match('enchant:(%d+)') or link:match('spell:(%d+)')) or 0
   if spellId==0 then
    for id,data in pairs(GL.ProfessionRecipes) do
     if data[1]==profession.id and GetSpellInfo(id)==title and (itemId==0 or data[3]==itemId) then spellId=id;break end
    end
   end
   local id=spellId~=0 and spellId or title..':'..itemId
   if not seen[id] then seen[id]=true;rows[#rows+1]={spellId=spellId,itemId=itemId,name=title} end
  end
 end
 -- Known spell checks supplement recipes hidden by collapsed native headers.
 for id,data in pairs(GL.ProfessionRecipes) do
  if data[1]==profession.id and not seen[id] and IsPlayerSpell and IsPlayerSpell(id) then
   seen[id]=true;rows[#rows+1]={spellId=id,itemId=data[3],name=GetSpellInfo(id) or data[5]}
  end
 end
 if #rows==0 then return end
 -- Keep previously observed recipes if the native list is currently filtered/collapsed.
 for _,r in ipairs(profession.recipes or {}) do local id=r.spellId~=0 and r.spellId or r.name..':'..r.itemId;if not seen[id] then rows[#rows+1]=r end end
 table.sort(rows,function(a,b) return a.name<b.name end)
 profession.recipes=rows;profession.scannedAt=GetServerTime();record.snapshot.observedAt=profession.scannedAt
end
function GL.ProfessionCharacterList()
 local player,realm=GL.ProfessionPlayerIdentity();local result={{player=player,realm=realm,current=true}};local seen={[key(player,realm)]=true}
 local guild=GL.db.guildProfiles and GL.db.guildProfiles[GL.db.selectedGuild]
 for _,p in pairs(guild and guild.personal or {}) do local id=key(p.player,p.realm);if not seen[id] then result[#result+1]={player=p.player,realm=p.realm};seen[id]=true end end
 table.sort(result,function(a,b) if a.current~=b.current then return a.current==true end;return a.player..a.realm<b.player..b.realm end)
 return result
end
function GL.GetProfessionCharacter(player,realm)
 local found=GL.db.professionCharacters and GL.db.professionCharacters[key(player,realm)]
 local guild=GL.db.guildProfiles and GL.db.guildProfiles[GL.db.selectedGuild]
 for _,r in ipairs(guild and guild.activeRaids and guild.activeRaids.professionCharacters or {}) do
  if key(r.player,r.realm)==key(player,realm) and r.snapshot and (not found or r.snapshot.observedAt>found.snapshot.observedAt) then found=r end
 end
 return found and found.snapshot
end
function GL.QueueProfessionExport()
    error('Die charübergreifende Speicherung auf GuildLoot ist nur mit GuildLoot Era und GuildLoot Sync verfügbar.')
 GL.CaptureProfessionSkills()
 local p=GL.MyProfile();local r=currentRecord()
 if not p or not r then error('Bitte den aktuell gespielten Charakter zuerst in GuildLoot Sync verbinden.') end
 -- The queue owns a snapshot copy.
 local function clone(v) if type(v)~='table' then return v end;local t={};for k,x in pairs(v) do t[k]=clone(x) end;return t end
 GL.db.outgoingRequests=GL.db.outgoingRequests or {};GL.db.outgoingReceipts=GL.db.outgoingReceipts or {}
 for _,q in pairs(GL.db.outgoingRequests) do
  if q.kind=='professions' and q.guild==GL.db.selectedGuild and key(q.player,q.realm)==key(p.player,p.realm) and not GL.db.outgoingReceipts[q.id] then
   q.payload={snapshot=clone(r.snapshot)};q.createdAt=GetServerTime();return
  end
 end
 local total=0
 for id,q in pairs(GL.db.outgoingRequests) do
  if q.kind=='professions' and GL.db.outgoingReceipts[id] and GL.db.outgoingReceipts[id].state~='unknown' then GL.db.outgoingRequests[id]=nil;GL.db.outgoingReceipts[id]=nil else total=total+1 end
 end
 if total>=30 then error('Zu viele offene Aufträge. Bitte zuerst synchronisieren.') end
 GL.db.outgoingCounter=(GL.db.outgoingCounter or 0)+1
 local id=UnitGUID('player')..'-professions-'..GetServerTime()..'-'..GL.db.outgoingCounter
 GL.db.outgoingRequests[id]={id=id,guild=GL.db.selectedGuild,player=p.player,realm=p.realm,raidId='professions',kind='professions',createdAt=GetServerTime(),payload={snapshot=clone(r.snapshot)}}
end
local f=CreateFrame('Frame');for _,event in ipairs({'PLAYER_LOGIN','SKILL_LINES_CHANGED','TRADE_SKILL_SHOW','TRADE_SKILL_UPDATE','CRAFT_SHOW','CRAFT_UPDATE'}) do f:RegisterEvent(event) end
local pending=false;local scanKind
f:SetScript('OnEvent',function(_,event)
 if event:match('^TRADE') then scanKind='trade' elseif event:match('^CRAFT') then scanKind='craft' end
 if pending then return end;pending=true
 C_Timer.After(.5,function() pending=false;if not GL.db then return end;GL.CaptureProfessionSkills();if scanKind then local k=scanKind;scanKind=nil;GL.CaptureProfessionRecipes(k) end end)
end)
