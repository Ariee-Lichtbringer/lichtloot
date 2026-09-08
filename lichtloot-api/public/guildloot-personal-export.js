(function(){
'use strict';
// EU planning dates. Actual saved-instance reset times in WoW remain authoritative.
function planCalendar(now=Date.now()){
 const day=86400000,formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function atBerlin(y,m,d,h){let guess=Date.UTC(y,m,d,h);const wanted=guess;for(let i=0;i<2;i++){const p=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));guess+=wanted-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);}return Math.floor(guess/1000);}
 const local=Object.fromEntries(formatter.formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const first=Date.UTC(+local.year,+local.month-1,+local.day),events=[];
 for(let n=0;n<90;n++){
  const d=new Date(first+n*day),y=d.getUTCFullYear(),m=d.getUTCMonth(),date=d.toISOString().slice(0,10),dom=d.getUTCDate();
  const add=(kind,title,clock)=>events.push({kind,title,date,time:clock?'09:00':'',startsAt:atBerlin(y,m,dom,clock?9:0)});
  if(d.getUTCDay()===3)add('reset','MC / BWL / AQ40 / Naxx: Reset',true);
  if(((d-Date.UTC(2026,5,20))/day)%3===0)add('reset','ZG / AQ20: Reset',true);
  if(((d-Date.UTC(2026,5,21))/day)%5===0)add('reset','Onyxia: Reset',true);
  const friday=1+(5-new Date(Date.UTC(y,m,1)).getUTCDay()+7)%7,opening=friday+3;
  if(dom>=opening&&dom<opening+7)add('dmf',dom===opening?'Dunkelmond-Jahrmarkt beginnt':'Dunkelmond-Jahrmarkt geöffnet',false);
 }
 return events;
}
async function collect({guild,identity,pin,result,get}){
  const [points,history,display,requests]=await Promise.all([
   get('getP0Plus',{all:1,nocache:1,addon:1}),
   get('getPlayerPrioHistory',{char:identity.name,server:identity.server,pin,addon:1}),
   get('getPoReleaseDisplaySettings'),
   guild==='nachtloot'?get('getMyPoReleaseRequests',{character:identity.name,server:identity.server,pin,addon:1}):Promise.resolve({entries:[]})
  ]);
  if(!Array.isArray(points.entries)||!history.poReleases)throw Error('Persönliche Daten oder Punkte fehlen. Bitte erneut versuchen.');
  const catalogs={};
  await Promise.all([...new Set(points.entries.map(e=>e.raid))].map(async raid=>{
   const data=await get('getLootItems',{raid:raid.startsWith('zg-')?'zg':raid});
   if(!Array.isArray(data.items))throw Error('Itemliste fehlt: '+raid);
   catalogs[raid]=data.items.map(i=>({name:i.name,item_id:i.itemId||i.ItemID}));
  }));
  const bundle=GuildLootAllPoints.build({guild:guild,entries:points.entries,catalogs});
  const enc=encodeURIComponent,lines=[['GLME1',guild,identity.name,identity.server,Math.floor(Date.now()/1000)].map(enc).join(';')];
  const visible=Array.isArray(display.visibleRaids)?display.visibleRaids:['recruit','p1p3','mc','bwl','aq40','aq20','naxx','zg-mittwoch','zg-prime','zg-late'];
  const pending=new Set((requests.entries||[]).filter(r=>String(r.status).toLowerCase()==='pending').map(r=>r.requestType==='recruit'?'recruit':r.requestType==='p1p3'?'p1p3':r.raid));
  for(const key of visible){
   const approved=key==='recruit'?history.recruitStatusLifted:history.poReleases[key];
   lines.push(['R',key,approved?'approved':pending.has(key)?'pending':'open'].map(enc).join(';'));
  }
  if(result)lines.push('PRIOS;'+enc(result.text));
  lines.push('POINTS;'+enc(bundle.text));
  for(const row of (history.entries||[]).filter(r=>r.current===true&&String(r.player).toLocaleLowerCase()===identity.name.toLocaleLowerCase()&&String(r.server||'').toLocaleLowerCase()===identity.server.toLocaleLowerCase())){
   const parsed=Date.parse(row.prioCreatedAt||'');
   for(const [key,prio] of [['p1','P1'],['p2','P2'],['p3','P3'],['p0Item',String(row.p0Plus).toLowerCase()==='ja'?'P0+':'P0']]){
    if(row[key])lines.push(['H',row.raidName||row.raid, String(row.raidDate||'').slice(0,10),prio,row[key],Number.isFinite(parsed)?Math.floor(parsed/1000):''].map(enc).join(';'));
   }
  }
  if(!Array.isArray(history.addonCalendar))throw Error('Kalenderdaten fehlen. Bitte nach der Aktualisierung der Webseite erneut exportieren.');
  for(const event of history.addonCalendar)lines.push(['C',event.id,event.name,event.date,event.time,event.startsAt||'',event.hasPrio?'1':'0',event.needsPrio?'1':'0'].map(enc).join(';'));
  for(const event of planCalendar())lines.push(['E',event.kind,event.title,event.date,event.time,event.startsAt].map(enc).join(';'));
  return {text:lines.join('\n')};
}
globalThis.GuildLootPersonalExport={collect,planCalendar};
})();
