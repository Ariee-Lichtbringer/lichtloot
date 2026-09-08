(function(){
'use strict';
const host=document.getElementById('guildlootParticipantRaidExport');
if(!host)return;
GuildLootPrioDownload.mount(host,{
 api:APPS_SCRIPT_URL,guild:currentGuildSlug(),requirePublished:true,
 getRaid(){
  if(!currentPublishedMode||!currentRaidId)throw Error('Bitte zuerst einen Raid mit veröffentlichter Prioliste öffnen.');
  return {raid:RAID_NAME,raidId:currentRaidId,raidName:RAID_NAME.toUpperCase(),raidDate:currentRaidDate};
 }
});
})();
