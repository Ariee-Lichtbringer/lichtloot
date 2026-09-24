-- Run with a Lua 5.1+ runtime; mocks the observable WoW API only.
local handler
function CreateFrame() return {RegisterEvent=function() end,SetScript=function(_,_,f) handler=f end} end
SlashCmdList={}
function GetBuildInfo() return '1.60.1','69977' end
function GetLocale() return 'deDE' end
function GetInstanceInfo() return 'Hyjal','raid',1,'',20,0,0,123 end
function GetNumLootItems() return 2 end
function GetLootSlotLink() return '|Hitem:240123::::::::|h[Neuer Fund]|h' end
function GetLootSlotInfo() return 1,'Neuer Fund' end
function GetLootSourceInfo(slot) return 1,'Creature-0-1-2-3-400-ABC',slot end
function UnitGUID() return 'Creature-0-1-2-3-400-ABC' end
function UnitName() return 'Testgegner' end
function time() return 1790246400 end
local cached=false
C_Item={GetItemInfo=function() if cached then return 'Neuer Fund',GetLootSlotLink(),4,80,60,'Rüstung','Stoff',1,'INVTYPE_HEAD',12345,0,4,1 end end,RequestLoadItemDataByID=function() end}
assert(loadfile('addons/GuildLootForever/Core.lua'))('GuildLootForever')
handler(nil,'ADDON_LOADED','GuildLootForever')
handler(nil,'LOOT_OPENED')
assert(#GuildLootForeverDB.events==1)
handler(nil,'LOOT_OPENED');assert(#GuildLootForeverDB.events==1)
cached=true;handler(nil,'GET_ITEM_INFO_RECEIVED',240123,true);assert(#GuildLootForeverDB.events==2)
handler(nil,'LOOT_OPENED');assert(#GuildLootForeverDB.events==2)
SlashCmdList.GUILDLOOTFOREVER('stop');handler(nil,'LOOT_OPENED');assert(#GuildLootForeverDB.events==2)
SlashCmdList.GUILDLOOTFOREVER('start')
local old=GetBuildInfo;function GetBuildInfo() return '1.15.9','12345' end
handler(nil,'LOOT_OPENED');assert(#GuildLootForeverDB.events==2)
local record=GuildLootForeverDB.events[2]:sub(6):gsub('..',function(h)return string.char(tonumber(h,16))end)
assert(record:find('"quantity":3',1,true));assert(record:find('"itemLevel":80',1,true));assert(not record:find('raidId',1,true))
print('Lua capture tests passed: unknown item, asynchronous cache, dedup, aggregate quantity, pause, Era rejection')
