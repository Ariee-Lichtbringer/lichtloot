(function(){
'use strict';
const host=document.getElementById('guildlootParticipantRaidExport');
if(!host)return;
GuildLootPrioDownload.mount(host,{
 api:APPS_SCRIPT_URL,guild:currentGuildSlug(),requirePublished:true,
 async extendExport(result,get){
  if(result.warnings.length)throw Error(result.warnings.join(' '));
  const char=typeof lichtlootSelectedCharacter!=='undefined'?lichtlootSelectedCharacter:null;
  const pin=typeof getStoredLichtLootPlayerPin==='function'?getStoredLichtLootPlayerPin():'';
  if(!char?.name||!pin)throw Error('Für den persönlichen Gesamtexport bitte mit Spieler-PIN anmelden und einen Charakter auswählen.');
  const identity={name:char.name,server:char.server||''};
  const full=await GuildLootPersonalExport.collect({guild:currentGuildSlug(),identity,pin,result,get});
  if(lichtlootSelectedCharacter?.name!==identity.name||(lichtlootSelectedCharacter?.server||'')!==identity.server)throw Error('Charakter wurde während des Exports gewechselt. Bitte erneut exportieren.');
  return full;
 },
 getRaid(){
  if(!currentPublishedMode||!currentRaidId)throw Error('Bitte zuerst einen Raid mit veröffentlichter Prioliste öffnen.');
  return {raid:RAID_NAME,raidId:currentRaidId,raidName:RAID_NAME.toUpperCase(),raidDate:currentRaidDate};
 }
});
})();
