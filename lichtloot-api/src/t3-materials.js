/* Classic Era T3 exchange requirements, checked against individual quests. */
(()=>{
 const known=new Set(["22490", "22491", "22488", "22495", "22493", "22494", "22489", "22492", "23064", "22438", "22439", "22436", "22443", "22441", "22442", "22437", "22440", "23067", "22498", "22499", "22496", "22503", "22501", "22502", "22497", "22500", "23062", "22428", "22429", "22425", "22424", "22426", "22431", "22427", "22430", "23066", "22514", "22515", "22512", "22519", "22517", "22518", "22513", "22516", "23061", "22478", "22479", "22476", "22483", "22481", "22482", "22477", "22480", "23060", "22467", "22464", "22471", "22469", "22470", "22465", "22468", "23065", "22506", "22507", "22504", "22511", "22509", "22510", "22505", "22508", "23063", "22418", "22419", "22416", "22423", "22421", "22422", "22417", "22420", "23059", "22466", "22362", "22368", "22355", "22371", "22354", "22372", "22359", "22357", "22364", "22360", "22358", "22361", "22351", "22349", "22369", "22350", "22353", "22352", "22363", "22367", "22366", "22356", "22365", "22370"]);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;};
 function requirementsFor(data,itemId){const id=String(itemId);if(data.items[id])return [{itemId:id,...data.items[id]}];return Object.entries(data.items).filter(([,entry])=>entry.requirements?.some(r=>String(r.itemId)===id&&r.name.startsWith('Entweiht'))).map(([itemId,entry])=>({itemId,...entry}));}
 let pending;
 function catalog(){if(!pending)pending=fetch('/data/t3-materials.json?v=20260907-quest-1').then(r=>{if(!r.ok)throw Error('Materialdaten konnten nicht geladen werden.');return r.json();}).catch(e=>{pending=null;throw e;});return pending;}
 function materialList(entry){const list=el('ul');for(const material of entry.requirements||[]){const row=el('li');row.append(el('strong',`${material.quantity} × `),el('span',material.name));list.append(row);}if(entry.gold)list.append(el('li',`${entry.gold} Gold`));return list;}
 function questCard(entry){
  const quest=el('details','','t3-quest');quest.append(el('summary','Quest in GuildLoot ansehen'));
  const content=el('div','','t3-quest-content');content.append(el('p','Naxxramas · T3-Umtauschquest','item-search-origin'),el('h4',entry.name));
  content.append(el('h5','Questgeber und Abgabe'),el('p',entry.questgiver?.name||'Questgeber nicht hinterlegt'),el('p',entry.location||''),el('h5','Voraussetzungen'),el('p',`Stufe ${entry.minimumLevel} · Vorquest „Echo des Krieges“ abgeschlossen.`));
  content.append(el('h5','Deine Aufgabe'),el('p',`Sammle die folgenden Gegenstände und bringe sie zu ${entry.questgiver?.name||'deinem Questgeber'}, um ${entry.name} zu erhalten.`),materialList(entry),el('h5','Belohnung'),el('p',`1 × ${entry.name}`,'t3-quest-reward'));
  const prerequisite=el('details');prerequisite.append(el('summary','Vorquest: Echo des Krieges'),el('p','Nimm die Quest bei Kommandant Eligor Morgenbringer an der Kapelle des hoffnungsvollen Lichts an. Besiege in Naxxramas die folgenden Gegner und kehre anschließend zurück:'));
  const kills=el('ul');['8 Hauptmänner der Todesritter','3 Giftpirscher','5 lebende Monstrositäten','5 Steinhautgargoyles'].forEach(t=>kills.append(el('li',t)));prerequisite.append(kills);const link=el('a','Quelle zur Vorquest ↗');link.href='https://www.wowhead.com/classic/de/quest=9033/echo-des-krieges';link.target='_blank';link.rel='noopener noreferrer';prerequisite.append(link);content.append(prerequisite,el('p','Questübersicht in eigenen Worten. Der Fortschritt im Spiel wird hier nicht automatisch erfasst.','item-search-origin'));quest.append(content);return quest;
 }
 function render(body,entry){
  body.replaceChildren();body.append(el('h4',entry.name));
  if(entry.directDrop){body.append(el('p','Dieser T3-Ring droppt direkt bei Kel’Thuzad. Es werden kein Token und keine Umtauschmaterialien benötigt.'));}
  else{
   const list=el('ul');for(const material of entry.requirements){const row=el('li'),quantity=el('strong',`${material.quantity} × `),link=el('a',material.name);link.href=`https://www.wowhead.com/classic/de/item=${material.itemId}`;link.target='_blank';link.rel='noopener noreferrer';row.append(quantity,link);list.append(row);}if(entry.gold)list.append(el('li',`${entry.gold} Gold zusätzlich`));body.append(list);
   body.append(el('p','Voraussetzung: die T3-Umtauschquests über „Echo des Krieges“ freischalten. Die Liste zeigt den vollständigen Bedarf; vorhandene Materialien werden noch nicht abgezogen.','item-search-origin'));
  }
  if(!entry.directDrop)body.append(questCard(entry));
  const source=el('a',entry.directDrop?'Dropquelle auf WoWhead ↗':'Umtauschquest auf WoWhead ↗');source.href=entry.source;source.target='_blank';source.rel='noopener noreferrer';body.append(source,el('p','WoW Classic Era · Phase 6 · geprüft am 07.09.2026','item-search-origin'));
 }
 async function mount(parent,item){
  const id=String(item.itemId||item.ItemID||item.id||'');if(!known.has(id))return;
  const box=el('section','','t3-materials');box.append(el('h3','T3: Benötigte Materialien'));const body=el('div','Materialbedarf wird geladen …');box.append(body);parent.append(box);
  try{const data=await catalog();if(!box.isConnected)return;const options=requirementsFor(data,id);if(options.length===1)render(body,options[0]);else{body.replaceChildren();const choose=el('select');choose.setAttribute('aria-label','T3-Setteil für dieses Token');choose.append(new Option('Gewünschtes T3-Setteil wählen',''));options.forEach((entry,i)=>choose.append(new Option(entry.name,String(i))));const result=el('div');body.append(el('p','Die zusätzlichen Materialien hängen vom gewünschten Setteil ab.'),choose,result);choose.onchange=()=>{result.replaceChildren();if(choose.value!=='')render(result,options[Number(choose.value)]);};}}catch(error){body.textContent=error.message;}
 }
 window.GuildLootT3={requirementsFor,questCard,mount};
})();
