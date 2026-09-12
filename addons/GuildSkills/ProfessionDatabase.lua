local _,GL=...
GL.ProfessionDatabaseTypes={
 {4,2259,'Alchimie'},{2,2018,'Schmiedekunst'},{10,7411,'Verzauberkunst'},
 {9,4036,'Ingenieurskunst'},{3,2108,'Lederverarbeitung'},{8,3908,'Schneiderei'},
 {7,2575,'Bergbau'},{5,2366,'Kräuterkunde'},{12,8613,'Kürschnerei'},
 {6,2550,'Kochkunst'},{1,3273,'Erste Hilfe'},{11,7620,'Angeln'},{13,2842,'Gifte'},
}
function GL.ProfessionRecipeLink(r)
 if r.kind=='database' or r.kind=='snapshot' then
  if not r.spellId or r.spellId==0 then return r.itemId and r.itemId>0 and ('|cffffffff|Hitem:'..r.itemId..'|h['..r.name..']|h|r') or r.name end
  return (GetSpellLink and GetSpellLink(r.spellId)) or ('|cff71d5ff|Hspell:'..r.spellId..'|h['..r.name..']|h|r')
 elseif r.kind=='craft' then
  return GetCraftItemLink and GetCraftItemLink(r.index)
 else
  return (GetTradeSkillRecipeLink and GetTradeSkillRecipeLink(r.index)) or (GetTradeSkillItemLink and GetTradeSkillItemLink(r.index))
 end
end
function GL.InsertProfessionRecipeLink(r)
 local link=GL.ProfessionRecipeLink(r)
 if not link then print('GuildSkills: Rezeptlink noch nicht verfügbar. Bitte erneut versuchen.');return end
 if ChatEdit_InsertLink and ChatEdit_InsertLink(link) then return end
 local box=ChatEdit_ChooseBoxForSend and ChatEdit_ChooseBoxForSend()
 if box and ChatEdit_ActivateChat then ChatEdit_ActivateChat(box);box:Insert(link) end
end
function GL.GetProfessionDatabaseEntries(profession,query)
 local result={};query=string.lower(query or '')
 for spellId,data in pairs(GL.ProfessionRecipes or {}) do
  if data[1]==profession then
   local name,rank,texture=GetSpellInfo(spellId)
   if data[3]>0 then
    local _,_,_,_,_,_,_,_,_,itemIcon=GetItemInfo(data[3])
    if itemIcon then texture=itemIcon else
     for _,p in ipairs(GL.ProfessionDatabaseTypes) do if p[1]==profession then local _,_,professionIcon=GetSpellInfo(p[2]);texture=professionIcon;break end end
    end
   end
   name=name or data[5]
   if rank and rank~='' then name=name..' ('..rank..')' end
   local materials,terms={},{}
   for _,mat in ipairs(data[4]) do
    local itemName,itemLink,_,_,_,_,_,_,_,icon=GetItemInfo(mat[1])
    local have=GetItemCount and GetItemCount(mat[1]) or 0
    local label=itemName or ('Gegenstand '..mat[1])
    materials[#materials+1]={name=label,texture=icon,need=mat[2],have=have,itemId=mat[1],link=itemLink}
    terms[#terms+1]=label
   end
   if query=='' or string.find(string.lower(name..' '..table.concat(terms,' ')..' '..spellId),query,1,true) then
    result[#result+1]={kind='database',index=spellId,spellId=spellId,name=name,texture=texture,
     skill=data[2],itemId=data[3],reagents=materials}
   end
  end
 end
 table.sort(result,function(a,b) if a.skill~=b.skill then return a.skill<b.skill end;if a.name~=b.name then return a.name<b.name end;return a.spellId<b.spellId end)
 return result
end
