/* WoW Classic Era AQ40 exchanges; provenance is retained in the data catalog. */
(()=>{
 const known=new Set([20926,20927,20928,20929,20930,20931,20932,20933,21232,21237,21242,21244,21268,21269,21272,21273,21275,21329,21330,21331,21332,21333,21334,21335,21336,21337,21338,21343,21344,21345,21346,21347,21348,21349,21350,21351,21352,21353,21354,21355,21356,21357,21359,21360,21361,21362,21364,21365,21366,21367,21368,21370,21372,21373,21374,21375,21376,21387,21388,21389,21390,21391].map(String));
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const classes={1:'Krieger',2:'Paladin',4:'Jäger',8:'Schurke',16:'Priester',64:'Schamane',128:'Magier',256:'Hexenmeister',1024:'Druide'};
 function requirementsFor(data,itemId){
  const id=String(itemId);
  if(data.items[id])return [{itemId:id,...data.items[id]}];
  return Object.entries(data.items).filter(([,entry])=>String(entry.tokenId)===id).map(([itemId,entry])=>({itemId,...entry}));
 }
 let pending;
 function catalog(){
  if(!pending)pending=fetch('/data/aq40-materials.json?v=20260907-1').then(r=>{if(!r.ok)throw Error('AQ40-Materialdaten konnten nicht geladen werden.');return r.json();}).catch(e=>{pending=null;throw e;});
  return pending;
 }
 function materialList(entry){
  const list=el('ul');
  for(const material of entry.requirements){const row=el('li');row.append(el('strong',`${material.quantity} × `),el('span',material.name));list.append(row);}
  return list;
 }
 function render(body,entry){
  body.replaceChildren();body.append(el('h4',entry.name),materialList(entry));
  const reputation=entry.reputation?`${entry.reputation.faction}: ${entry.reputation.standing}`:'Keine Rufvoraussetzung';
  body.append(el('p',`Benötigt: Stufe ${entry.minimumLevel} · ${reputation}`));
  const quest=el('details','','t3-quest');quest.append(el('summary','Quest in GuildLoot ansehen'));
  const content=el('div','','t3-quest-content');
  content.append(el('p',entry.kind==='set'?'AQ40 · T2,5-Umtauschquest':'AQ40 · Imperiale Qiraji-Umtauschquest','item-search-origin'),el('h4',entry.name),el('h5','Questgeber und Abgabe'),el('p',entry.questgiver.name),el('p',entry.location),el('h5','Voraussetzungen'),el('p',`Stufe ${entry.minimumLevel} · ${reputation}${classes[entry.classMask]?` · ${classes[entry.classMask]}`:''}`),el('h5','Deine Aufgabe'),el('p',`Sammle die aufgeführten Materialien und gib sie bei ${entry.questgiver.name} ab. Als Belohnung erhältst du ${entry.name}.`),materialList(entry),el('h5','Belohnung'),el('p',`1 × ${entry.name}`,'t3-quest-reward'));
  if(entry.kind==='weapon')content.append(el('p','Pro Abgabe wählst du eine Belohnung. Benötigt wird Elementiumerz, kein Elementiumbarren.'));
  content.append(el('p','Questübersicht in eigenen Worten. Dein Questfortschritt und dein Ruf im Spiel werden hier nicht automatisch erfasst.','item-search-origin'));
  quest.append(content);body.append(quest,el('p','Der vollständige Materialbedarf wird angezeigt; vorhandene Materialien werden noch nicht abgezogen.','item-search-origin'),el('p','WoW Classic Era · AQ40 · geprüft am 07.09.2026','item-search-origin'));
 }
 async function mount(parent,item){
  const id=String(item.itemId||item.ItemID||item.id||'');if(!known.has(id))return;
  const box=el('section','','t3-materials aq40-materials');box.append(el('h3','AQ40: Benötigte Materialien'));const body=el('div','Materialbedarf wird geladen …');box.append(body);parent.append(box);
  try{
   const data=await catalog();if(!box.isConnected)return;
   const options=requirementsFor(data,id);
   if(options.length===1)render(body,options[0]);
   else if(options.length){
    body.replaceChildren();const select=el('select');select.setAttribute('aria-label','AQ40-Belohnung für dieses Token');
    select.append(new Option('Gewünschte Belohnung wählen',''));
    options.forEach((entry,i)=>select.append(new Option(`${classes[entry.classMask]?classes[entry.classMask]+' · ':''}${entry.name}`,String(i))));
    const result=el('div');body.append(el('p','Wähle die gewünschte Belohnung, um ihre Materialien und Quest zu sehen.'),select,result);
    select.onchange=()=>{result.replaceChildren();if(select.value!=='')render(result,options[Number(select.value)]);};
   }else body.textContent='Für dieses Token sind noch keine Questdaten hinterlegt.';
  }catch(error){body.textContent=error.message;}
 }
 window.GuildLootAQ40={requirementsFor,mount};
})();
