(function(){
 'use strict';
 const prefix='guildlootAdminEntry_';
 function consume(storage,slug,now=Date.now()){
  try{
   const key=prefix+slug,raw=storage.getItem(key);storage.removeItem(key);
   if(!raw)return '';
   const value=JSON.parse(raw);
   if(value.slug!==slug||typeof value.code!=='string'||!value.code||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+120000)return '';
   return value.code;
  }catch{return '';}
 }
 async function open(slug,button){
  const guild=(overview.guilds||[]).find(g=>g.slug===slug);
  if(!guild||!code()){setStatus('Bitte zuerst als Plattform-Admin anmelden.','bad');return;}
  // Open synchronously to preserve the browser's user-gesture popup allowance.
  const child=window.open('about:blank','_blank');
  if(!child){setStatus('Bitte neue Tabs für diese Seite erlauben und erneut klicken.','bad');return;}
  child.opener=null;
  child.document.title='Gildenleitung wird geöffnet';
  const note=child.document.createElement('p');note.textContent='Gildenleitung von '+guild.name+' wird geöffnet …';child.document.body.append(note);
  button.disabled=true;
  try{
   const result=await api('platformOpenGuildLeadership',{slug});
   if(child.closed)throw Error('Der neue Tab wurde geschlossen.');
   if(result.guild?.slug!==slug||typeof result.leadershipCode!=='string'||!result.leadershipCode)throw Error('Gilden-Zugang konnte nicht geladen werden.');
   child.sessionStorage.setItem(prefix+slug,JSON.stringify({slug,code:result.leadershipCode,expiresAt:Date.now()+120000}));
   const url=new URL('gildenleitung.html',window.location.href);url.search='';url.hash='';url.searchParams.set('guild',slug);
   child.location.replace(url.href);
   setStatus('Gildenleitung von '+guild.name+' im neuen Tab geöffnet.','good');
  }catch(error){
   if(!child.closed)child.close();
   setStatus(error.message||'Gildenleitung konnte nicht geöffnet werden.','bad');
  }finally{button.disabled=false;}
 }
 window.GuildLootAdminEntry={consume,open};
 document.addEventListener('click',function(event){
  const button=event.target.closest?.('[data-guild-leadership]');
  if(button&&!button.disabled)open(button.dataset.guildLeadership,button);
 });
})();
