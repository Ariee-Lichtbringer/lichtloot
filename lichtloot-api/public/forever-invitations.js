(()=>{
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
window.openForeverInvitations=async(raid,request)=>{
 const dialog=el('dialog');dialog.style.cssText='width:min(850px,94vw);max-height:90vh;overflow:auto;background:#0b1725;color:#eee;border:1px solid #bd9740;border-radius:14px;padding:24px';document.body.append(dialog);
 const close=el('button','Schließen');close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.append(el('h2','DC-Mitglieder benachrichtigen'),el('p',raid.title),close);const status=el('p','Mitglieder werden geladen …');status.setAttribute('role','status');dialog.append(status);dialog.showModal();
 try{
 const data=await request('list',{raidId:raid.id}),selected=new Map(),sent=new Map(data.deliveries.map(d=>[d.recipient_id,d]));
 const search=el('input');search.placeholder='Discord-Namen suchen …';search.setAttribute('aria-label','Discord-Namen suchen');
 const pick=el('select');pick.setAttribute('aria-label','Discord-Mitglied auswählen');pick.style.width='100%';
 const rolePick=el('select');rolePick.setAttribute('aria-label','Discord-Rolle auswählen');rolePick.style.width='100%';
 rolePick.append(new Option('Rolle auswählen …',''));
 for(const [source,label] of [['lichtloot','Lichtbringer'],['nachtloot','Nachtloot']]){
 const group=el('optgroup');group.label=label;
 for(const role of (data.roles||[]).filter(r=>r.source===source)){
 const matches=data.members.filter(m=>m.source===source&&(m.roles||[]).includes(role.id));
 const option=new Option(role.name+' · '+matches.length+' Mitglieder',source+':'+role.id);option.disabled=!matches.length;group.append(option);
 }rolePick.append(group);
 }
 const chips=el('div'),count=el('p');
 rolePick.onchange=()=>{const [source,id]=rolePick.value.split(':');let skipped=0;
 for(const m of data.members.filter(m=>m.source===source&&(m.roles||[]).includes(id))){
 const delivery=sent.get(m.id);
 if(delivery?.status==='sending'||(delivery?.status==='failed'&&!delivery?.message_id)){skipped++;continue;}
 if(selected.size>=500&&!selected.has(m.id)){skipped++;continue;}
 selected.set(m.id,m.name);
 }
 status.textContent='Rollenmitglieder zur Auswahl hinzugefügt.'+(skipped?' '+skipped+' wegen Versandstatus oder Empfängerlimit übersprungen.':'')+' Prüfe die Auswahl vor dem Senden.';
 rolePick.value='';update();
 };
 function options(){pick.replaceChildren(new Option('Mitglied auswählen …',''));for(const [key,name] of [['lichtloot','Lichtbringer'],['nachtloot','Nachtloot']]){const group=el('optgroup');group.label=name;for(const m of data.members.filter(m=>m.source===key&&(m.name+' '+m.username).toLowerCase().includes(search.value.toLowerCase()))){const o=new Option(m.name+' (@'+m.username+')'+(sent.get(m.id)?.message_id?' · vorhandene Nachricht aktualisieren':sent.has(m.id)?' · bereits vorgemerkt / prüfen':''),m.id);o.disabled=selected.has(m.id)||sent.get(m.id)?.status==='sending'||(sent.get(m.id)?.status==='failed'&&!sent.get(m.id)?.message_id);group.append(o);}pick.append(group);}}
 const send=el('button','Einladungen senden / aktualisieren');send.className='primary';send.disabled=true;
 function update(){chips.replaceChildren();for(const [id,name] of selected){const b=el('button',name+' ×');b.onclick=()=>{selected.delete(id);update();};chips.append(b);}count.textContent=selected.size+' Empfänger ausgewählt';send.disabled=!selected.size||!data.link;options();}
 pick.onchange=()=>{if(pick.value){const m=data.members.find(m=>m.id===pick.value);if(selected.size>=500){status.textContent='Maximal 500 Empfänger pro Versand.';return;}selected.set(m.id,m.name);update();}};search.oninput=options;options();
 const date=new Date(data.raid.startsAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'full',timeStyle:'short'});
 const message=el('textarea');message.rows=16;message.maxLength=2000;message.style.width='100%';message.setAttribute('aria-label','Einladungstext');
 message.value=`✨ Die Lichtbringer starten in WoW Forever – sei von Anfang an dabei!\n\nAm ${date} Uhr (deutsche Zeit) beginnt unser gemeinsames Abenteuer!\n\nUnser erster „Raid“ führt ins Startgebiet der Menschen: Wölfe bekämpfen, Kupfer zusammenkratzen und gemeinsam 10 Silber für die Gildengründung sammeln. Danach geht’s nach Sturmwind: unterschreiben, Gilde gründen und Geschichte schreiben. 😄\n\nFür die Gründung starten wir alle als Menschen. Danach steht euch die Rasse eurer Wahl offen. Ob alter Raidfreund oder neues Gesicht: Wir freuen uns auf euch!\n\n🔑 Du hast bereits einen LichtLoot- oder Nachtloot-Account?\nÜbernimm deinen Zugang mit deinem bisherigen Login-Code und lege anschließend deinen Forever-Charakter an:\nhttps://lichtloot.de/forever-import.html\n\n⚔️ Melde dich hier für unseren Gründungsabend an:\n${data.link||'Noch kein Discord-Anmelder veröffentlicht'}\n\nDie beiden Screenshots zeigen dir den Weg zur Accountübernahme.\n\nGroße Pläne, leere Taschen – und du mittendrin. Sei dabei, wenn die Lichtbringer geboren werden! 💛`;
 dialog.append(el('h3','Empfänger auswählen'),el('p','Wähle eine Rolle, um ihre Mitglieder hinzuzufügen, oder einzelne Discord-Namen. Mehrfach vorkommende Mitglieder werden nur einmal ausgewählt.'),rolePick,search,pick,chips,count,el('h3','Nachricht prüfen'),message,el('h3','Anhänge · beide Screenshots'));
 for(let i=1;i<=2;i++){const a=el('a'),img=el('img');a.href=img.src='images/forever-account-'+i+'.png';a.target='_blank';img.alt=i===1?'Forever-Gildenbereich':'Bestehenden Account übernehmen';img.style.cssText='width:45%;max-height:180px;object-fit:contain';a.append(img);dialog.append(a);}
 const deliveries=el('div'),refresh=el('button','Versandstatus aktualisieren');function show(rows){sent.clear();rows.forEach(d=>sent.set(d.recipient_id,d));options();deliveries.replaceChildren(...rows.map(d=>el('p',d.recipient_name+' · '+({pending:'Vorgemerkt',sending:'Versand läuft / Ergebnis noch nicht bestätigt',sent:'Gesendet',failed:'Nicht gesendet'}[d.status]||d.status)+(d.error?' · '+d.error:''))));}show(data.deliveries);
 refresh.onclick=async()=>{try{show((await request('list',{raidId:raid.id})).deliveries);}catch(e){status.textContent=e.message;}};
 send.onclick=async()=>{send.disabled=true;try{const result=await request('send',{raidId:raid.id,recipients:[...selected.keys()],message:message.value});status.textContent=result.message;selected.clear();update();await refresh.onclick();}catch(e){status.textContent=e.message;send.disabled=false;}};
 dialog.append(el('p','Es werden nur die ausgewählten Mitglieder per Direktnachricht angeschrieben. Vorhandene Einladungen werden aktualisiert, neue Empfänger bekommen eine Nachricht mit beiden Screenshots.'),send,refresh,deliveries);status.textContent=data.members.length?'Wähle Discord-Rollen oder einzelne Namen aus beiden Gilden aus.':'Noch keine Discord-Mitglieder synchronisiert. Bitte Bot-Verbindung prüfen.';update();
 }catch(e){status.textContent=e.message;}
};})();
