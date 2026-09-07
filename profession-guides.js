/* Classic Era profession reference; no account or inventory writes. */
(()=>{
 const catalog=[['alchemy','Alchemie','alchi alchemy tränke tranke'],['blacksmithing','Schmiedekunst','schmied schmieden blacksmithing'],['enchanting','Verzauberkunst','verzaubern vz enchanting'],['engineering','Ingenieurskunst','ingenieur ingi engineering'],['leatherworking','Lederverarbeitung','leder lederer leatherworking'],['tailoring','Schneiderei','schneider tailoring stoff'],['herbalism','Kräuterkunde','kraeuter kräuter herbalism'],['mining','Bergbau','mining erze erz'],['skinning','Kürschnerei','kuerschner kürschner skinning'],['cooking','Kochen','koch cooking essen'],['first-aid','Erste Hilfe','verband verbände verbaende first aid'],['fishing','Angeln','fishing fischen angel']];
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const clampSkill=value=>Math.max(1,Math.min(300,Math.floor(Number(value)||1)));
 const remainingSteps=(profession,skill)=>profession.steps.filter(step=>step.to>clampSkill(skill));
 function materialPlan(steps){
  const available=new Map(),needed=new Map();
  for(const step of steps){
   for(const material of step.materials||[]){
    const key=material.type+':'+material.id,used=Math.min(available.get(key)||0,material.quantity);
    available.set(key,(available.get(key)||0)-used);const amount=material.quantity-used;
    if(amount){const old=needed.get(key);needed.set(key,{...material,quantity:(old?.quantity||0)+amount});}
   }
   if(step.recipe?.type==='item'){const key='item:'+step.recipe.id;available.set(key,(available.get(key)||0)+step.crafts);}
  }
  return [...needed.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
 }
 let pending;
 function load(){if(!pending)pending=fetch('/data/profession-guides.json?v=20260907-1').then(r=>{if(!r.ok)throw Error('Der Berufe-Guide konnte nicht geladen werden.');return r.json();}).catch(e=>{pending=null;throw e;});return pending;}
 let dialog,select,skill,body,opener;
 function close(){dialog?.close();if(opener?.isConnected)opener.focus();}
 function materials(rows){const list=el('ul','','profession-materials');for(const r of rows){const li=el('li');li.append(el('strong',r.quantity.toLocaleString('de-DE')+' × '),el('span',r.name));list.append(li);}return list;}
 async function render(){
  const requested=select.value;body.replaceChildren(el('p','Guide wird geladen …'));
  try{
   const data=await load();if(select.value!==requested)return;
   const p=data.professions.find(p=>p.id===requested);if(!p)throw Error('Beruf nicht gefunden.');
   const steps=remainingSteps(p,skill.value);body.replaceChildren();
   body.append(el('h3',p.icon+' '+p.name),el('p',p.intro),el('p','Passender Partner: '+p.partner,'profession-muted'));
   body.append(el('p','Classic Era · 1–300 · Planweg ohne Rassenboni. Materialmengen sind Richtwerte; gelbe und grüne Rezepte können zusätzliche Versuche erfordern.','profession-notice'));
   if(!steps.length){body.append(el('p','Skill 300 erreicht – für diesen Guide sind keine weiteren Schritte nötig.'));return;}
   const notes=el('details','','profession-notes');notes.open=false;notes.append(el('summary','Ausbildung, Rezepte und wichtige Vorbereitungen'));
   const noteList=el('ul');for(const note of p.notes){const li=el('li');li.append(el('strong','Ab '+note.skill+': '),el('span',note.text));noteList.append(li);}notes.append(noteList);body.append(notes);
   if(p.kind==='craft'){
    const shop=el('details','','profession-notes');shop.append(el('summary','Materialplan für die angezeigten Abschnitte'));
    shop.append(el('p','Der bereits begonnene Abschnitt wird vollständig eingeplant. Zwischenprodukte aus früheren angezeigten Schritten werden verrechnet; dein Inventar wird nicht ausgelesen. Zusätzliche Versuche und die oben genannten Questmaterialien sind nicht eingerechnet.','profession-muted'),materials(materialPlan(steps)));body.append(shop);
   }else body.append(el('p','Kein fester Materialverbrauch: Benötigt werden passende Sammelziele und gegebenenfalls das Berufswerkzeug.','profession-muted'));
   const list=el('div','','profession-steps');
   for(const step of steps){
    const card=el('details','','profession-step');card.open=step===steps[0];
    card.append(el('summary',step.from+'–'+step.to+' · '+(step.recipe?.name||step.title)));
    if(step.recipe){card.append(el('p','Planmenge: '+step.crafts+' Herstellungsversuche'),materials(step.materials));if(steps.some(next=>(next.materials||[]).some(m=>m.type===step.recipe.type&&m.id===step.recipe.id)))card.append(el('p','Dieses Zwischenprodukt für spätere Schritte aufheben.','profession-muted'));}
    else card.append(el('p',step.text));
    list.append(card);
   }
   body.append(list);
   const source=el('details','','profession-notes');source.append(el('summary','Datenstand und Quellen'),el('p','Geprüft am '+data.checkedAt+'. Eigene Kurzfassung; Rezeptnamen und Zutaten mit Classic-Daten abgeglichen.'));
   const link=el('a','WoW-Professions: zugrunde liegender Skillguide');link.href=p.source;link.target='_blank';link.rel='noopener noreferrer';source.append(link);body.append(source);
  }catch(error){body.replaceChildren(el('p',error.message));const retry=el('button','Erneut versuchen');retry.type='button';retry.onclick=render;body.append(retry);}
 }
 function open(id){
  opener=document.activeElement;
  if(!dialog){
   dialog=el('dialog','','profession-dialog');dialog.setAttribute('aria-labelledby','professionGuideTitle');
   const header=el('header','','profession-head'),heading=el('h2','Berufe-Schnellguide');heading.id='professionGuideTitle';const button=el('button','✕');button.type='button';button.setAttribute('aria-label','Berufe-Guide schließen');button.onclick=close;header.append(heading,button);dialog.append(header);
   const controls=el('div','','profession-controls'),professionLabel=el('label','Beruf');select=el('select');select.setAttribute('aria-label','Beruf');for(const [key,name] of catalog)select.append(new Option(name,key));professionLabel.append(select);
   const skillLabel=el('label','Mein aktueller Skill');skill=el('input');skill.type='number';skill.min='1';skill.max='300';skill.value='1';skill.setAttribute('aria-label','Mein aktueller Skill');skillLabel.append(skill);controls.append(professionLabel,skillLabel);dialog.append(controls);body=el('div','','profession-body');body.setAttribute('aria-live','polite');dialog.append(body);
   select.onchange=render;skill.onchange=()=>{skill.value=String(clampSkill(skill.value));render();};dialog.addEventListener('cancel',event=>{event.preventDefault();close();});document.body.append(dialog);
  }
  if(id&&catalog.some(([key])=>key===id)){select.value=id;skill.value='1';}
  if(!dialog.open)dialog.showModal();render();select.focus();
 }
 window.GuildLootProfessions={open,catalog,clampSkill,remainingSteps,materialPlan};
})();
