(()=>{
 'use strict';
 let generation=0;
 const api='https://lichtloot-production.up.railway.app/api/apps-script';
 function identity(){const select=document.getElementById('myLichtlootCharSelect');try{return JSON.parse(select?.value||'{}');}catch{return {};}}
 function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 function install(){
  const select=document.getElementById('myLichtlootCharSelect');if(!select||document.getElementById('characterProfessionPanel'))return;
  const panel=element('section');panel.id='characterProfessionPanel';panel.className='character-overview-card';
  const header=element('div');header.className='character-overview-head';header.append(element('strong','Berufe & Fertigkeiten'));
  const button=element('button','Gespeicherten Stand laden');button.type='button';button.className='small-btn';header.append(button);
  const content=element('div','Berufe einmal mit dem Charakter in WoW öffnen. Danach im Addon „Berufe synchronisieren“ klicken, /reload eingeben und GuildLoot Sync ausführen.');
  panel.append(header,content);
  const parent=document.querySelector('[data-mein-lichtloot-section="chars"]')||select.parentElement;
  parent.append(panel);
  function reset(){generation++;button.disabled=false;content.replaceChildren(element('p','Charakter auswählen und gespeicherten Berufsstand laden.'));}
  select.addEventListener('change',reset);document.getElementById('myPriosPin')?.addEventListener('input',reset);
  const original=window.selectLichtLootCharacter;
  if(typeof original==='function')window.selectLichtLootCharacter=function(...args){const result=original.apply(this,args);reset();return result;};
  button.onclick=async()=>{
   const selected=identity(),pin=document.getElementById('myPriosPin')?.value.trim();
   if(!pin||!selected.name){content.replaceChildren(element('p','Bitte zuerst anmelden und einen Charakter auswählen.'));return;}
   const request=++generation;button.disabled=true;content.replaceChildren(element('p','Berufe werden geladen …'));
   try{
    const guild=typeof CURRENT_GUILD_SLUG==='string'?CURRENT_GUILD_SLUG:new URLSearchParams(location.search).get('guild')||'lichtloot';
    const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'getCharacterProfessions',guild,pin}),cache:'no-store'});
    const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Berufe konnten nicht geladen werden.');
    if(request!==generation)return;
    const record=result.characters.find(c=>c.player===selected.name&&c.realm===selected.server),snapshot=record?.snapshot;
    content.replaceChildren();
    if(!snapshot){content.append(element('p','Noch kein Berufsstand für diesen Charakter übertragen. Den Charakter in WoW spielen, seine Berufe öffnen und im Addon „Berufe synchronisieren“ wählen.'));return;}
    content.append(element('p',`${selected.name} · Stand ${new Date(snapshot.observedAt*1000).toLocaleString('de-DE')}`));
    for(const profession of snapshot.professions){
     const details=element('details');const summary=element('summary',`${profession.name} ${profession.rank} / ${profession.maxRank} · ${profession.recipes.length} bekannte Rezepte`);details.append(summary);
     if(!profession.scannedAt)details.append(element('p','Rezepte noch nicht in WoW eingelesen.'));
     else {
      details.append(element('p','Rezepte eingelesen: '+new Date(profession.scannedAt*1000).toLocaleString('de-DE')));
      const search=element('input');search.type='search';search.placeholder='Bekanntes Rezept suchen';search.setAttribute('aria-label',`${profession.name}: Rezept suchen`);
      const list=element('ul');list.style.cssText='max-height:260px;overflow:auto;padding-left:22px';
      function render(){list.replaceChildren();for(const recipe of profession.recipes.filter(r=>r.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))){const li=element('li');if(recipe.spellId){const a=element('a',recipe.name);a.href=`https://www.wowhead.com/classic/spell=${recipe.spellId}`;a.target='_blank';a.rel='noopener noreferrer';li.append(a);}else li.textContent=recipe.name;list.append(li);}}
      search.oninput=render;render();details.append(search,list);
     }
     content.append(details);
    }
    const skills=element('details');skills.append(element('summary','Weitere Fertigkeiten'));const list=element('ul');for(const s of snapshot.skills)list.append(element('li',`${s.name} ${s.rank} / ${s.maxRank}`));skills.append(list);content.append(skills);
   }catch(error){if(request===generation)content.replaceChildren(element('p',error.message));}
   finally{if(request===generation)button.disabled=false;}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
