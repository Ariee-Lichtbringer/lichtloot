(()=>{
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 async function call(context,action,values={}){const response=await fetch(context.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,api:undefined,action,...values})});const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Die Anfrage konnte nicht verarbeitet werden.');return result;}
 const itemDetails=fetch('armor-item-details.json?v=20260912-1').then(r=>{if(!r.ok)throw Error('Itemdetails nicht verfügbar');return r.json();});itemDetails.catch(()=>{});
 const fallback='https://wow.zamimg.com/images/wow/icons/medium/inv_misc_questionmark.jpg';
 let tip;
 function hideTip(){tip?.remove();tip=null;}
 function icon(record){const image=el('img');image.width=30;image.height=30;image.alt='';image.src=fallback;image.className='armor-item-icon';itemDetails.then(data=>{image.src=window.GuildLootItems?.iconUrl(data[record.itemId]||record)||fallback;}).catch(()=>{});image.onerror=()=>{if(image.src!==fallback)image.src=fallback;};return image;}
 function decorate(anchor,record,click=true){
  anchor.classList.add('armor-item');anchor.append(icon(record),el('span',record.name));
  let hovering=false;
  const show=async()=>{hovering=true;hideTip();let item;try{item=(await itemDetails)[record.itemId];}catch{}if(!hovering||!anchor.isConnected)return;
   tip=el('div');tip.className='armor-tooltip';tip.setAttribute('role','tooltip');tip.append(el('strong',item?.name||record.name));
   for(const line of String(item?.tooltip||'Itemdetails derzeit nicht verfügbar.').split(/\||\n/).map(x=>x.trim()).filter(Boolean)){if(line===item?.name)continue;const p=el('div',line);if(/^(Anlegen:|Benutzen:|\(\d+\) Set:|Set:)/.test(line))p.style.color='#1eff00';tip.append(p);}
   tip.append(el('small',click?'Antippen oder klicken: vollständige Itemkarte':'Klicken: Rüstungsteil auswählen'));document.body.append(tip);
   const box=anchor.getBoundingClientRect(),rect=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,box.right+12))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,box.top))+'px';
  };
  anchor.addEventListener('mouseenter',show);anchor.addEventListener('focus',show);const hide=()=>{hovering=false;hideTip();};anchor.addEventListener('mouseleave',hide);anchor.addEventListener('blur',hide);
  if(click)anchor.addEventListener('click',async event=>{event.preventDefault();event.stopPropagation();hide();let item;try{item=(await itemDetails)[record.itemId];}catch{}window.GuildLootItems?.open(item||{...record,tooltip:'Itemdetails derzeit nicht verfügbar.'},anchor);});
  return anchor;
 }
 function itemButton(record){const b=el('button');b.type='button';return decorate(b,record);}
 function itemPicker(select,items,onchange){
  const host=el('div');host.className='armor-picker';const toggle=el('button');toggle.type='button';toggle.setAttribute('role','combobox');toggle.setAttribute('aria-label','Rüstungsteil');toggle.setAttribute('aria-haspopup','listbox');toggle.setAttribute('aria-expanded','false');
  const list=el('div');list.className='armor-options';list.setAttribute('role','listbox');list.setAttribute('aria-label','Rüstungsteile');list.id='armor-options-'+Math.random().toString(36).slice(2);toggle.setAttribute('aria-controls',list.id);list.hidden=true;host.append(toggle,list);select.hidden=true;
  const close=()=>{list.hidden=true;toggle.setAttribute('aria-expanded','false');hideTip();};
  toggle.onclick=()=>{if(select.disabled)return;if(!list.hidden){close();return;}list.hidden=false;toggle.setAttribute('aria-expanded','true');list.querySelector('[aria-selected="true"]')?.focus();};
  toggle.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();toggle.click();}};
  list.addEventListener('mousedown',e=>e.preventDefault());
  host.addEventListener('focusout',e=>{if(host.contains(e.relatedTarget))return;setTimeout(()=>{if(!host.contains(document.activeElement))close();},0);});
  host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();toggle.focus();}if(e.target===toggle)return;const options=[...list.children],index=options.indexOf(document.activeElement);let next=index;if(e.key==='ArrowDown')next=(index+1)%options.length;else if(e.key==='ArrowUp')next=(index-1+options.length)%options.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=options.length-1;else return;e.preventDefault();options[next]?.focus();});
  function refresh(){close();toggle.replaceChildren();const item=items.find(i=>i.itemId===select.value);if(item)toggle.append(icon(item),el('span',item.name),el('span','▾'));list.replaceChildren();for(const option of [...select.options]){const record=items.find(i=>i.itemId===option.value);if(!record)continue;const button=decorate(el('button'),record,false);button.type='button';button.setAttribute('role','option');button.setAttribute('aria-selected',String(select.value===record.itemId));button.onclick=()=>{if(select.disabled)return;select.value=record.itemId;close();onchange();toggle.focus();};list.append(button);}}
  return {host,refresh};
 }

 const style=el('style');style.textContent=`
 .armor-request-panel{background:#0b1629;border:1px solid #28435b;border-radius:14px;padding:22px;margin-top:16px;color:#ecf4ff}
 .armor-request-panel h3{margin:0 0 14px;color:#5fe5da}.armor-request-panel h4{margin:16px 0 8px}
 .armor-request-panel select,.armor-request-panel input[type=number]{background:#111f34;color:#ecf4ff;border:1px solid #42617b;border-radius:7px;padding:9px;font:inherit}
 .armor-request-panel select{min-width:100px;max-width:100%}.armor-request-panel select[aria-label="Rüstungsteil"]{min-width:min(300px,100%)}
 .armor-request-panel label{border-bottom:1px solid #243448}.armor-request-panel label span{min-width:220px;font-size:14px}
 .armor-request-panel input[type=checkbox]{accent-color:#26d7c4;width:18px!important;height:18px}
 .armor-request-panel input:disabled{opacity:.45}.armor-request-panel small{color:#a3b6cc}
 .armor-request-panel button.primary{background:#137c75;border:1px solid #2fd6c6;border-radius:8px;color:white;padding:12px 20px;font:inherit;font-weight:700;cursor:pointer}
 .armor-request-panel button:disabled{opacity:.65;cursor:default}.armor-request-panel [role=status]{color:#73e4ce;margin-top:16px}

 .armor-item{display:inline-flex;gap:10px;align-items:center;background:transparent;color:#e7c4ff;border:0;text-align:left;font:inherit;cursor:pointer;padding:4px}.armor-item span{min-width:0!important}.armor-item-icon{width:30px;height:30px;flex-shrink:0;border:1px solid #665979;border-radius:4px}.armor-request-panel label{border:0}.armor-material-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #243448}.armor-material-row .armor-item{min-width:260px}.armor-picker{position:relative;min-width:300px;max-width:100%}.armor-picker [role=combobox]{display:flex;align-items:center;gap:12px;width:100%;padding:7px 12px;border:1px solid #42617b;border-radius:7px;background:#111f34;color:#ecf4ff;font:inherit;text-align:left;cursor:pointer}.armor-options{position:absolute;top:100%;left:0;right:0;max-height:330px;overflow:auto;z-index:40;background:#0b1629;border:1px solid #42617b;border-radius:8px;padding:6px;box-shadow:0 10px 30px #0008}.armor-options .armor-item{display:flex;width:100%;padding:8px}.armor-options [aria-selected=true],.armor-options button:hover,.armor-options button:focus{background:#21445a;outline:1px solid #45cbbc}.armor-tooltip{position:fixed;z-index:100100;pointer-events:none;width:min(380px,calc(100vw - 32px));max-height:70vh;overflow:hidden;background:#08090bf5;border:1px solid #85858b;color:#eee;padding:16px;border-radius:5px;box-shadow:0 12px 35px #000b;font-size:14px;line-height:1.4}.armor-tooltip strong{display:block;color:#c653ff;font-size:17px;margin-bottom:12px}.armor-tooltip small{display:block;color:#acb0b8;margin-top:12px}.armor-picker [hidden]{display:none}
 .armor-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.armor-request-panel button.armor-discord-disabled{background:#2a3648;border-color:#42617b;color:#8fa2b8;opacity:.55;cursor:not-allowed}
 .armor-my-requests{margin-top:22px;border-top:1px solid #243448;padding-top:14px}.armor-my-requests h4{margin:0 0 10px}.armor-my-requests table{width:100%;border-collapse:collapse;font-size:14px}.armor-my-requests th,.armor-my-requests td{padding:8px 6px;border-bottom:1px solid #243448;text-align:left;vertical-align:top}.armor-my-requests th{color:#a3b6cc;font-weight:600}.armor-my-requests small{display:block;margin-top:8px}.armor-status{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}.armor-status-pending{background:#4a3a12;color:#fbbf24}.armor-status-approved{background:#123f2a;color:#4ade80}.armor-status-rejected{background:#4a1d1d;color:#f87171}
 `;document.head.append(style);
 window.GuildLootArmor={async open(root,context){
  try{const selected=JSON.parse(document.getElementById('myLichtlootCharSelect')?.value||'null');if(selected?.name){context.character=selected.name;context.server=selected.server||'';}}catch{}
  const identity=JSON.stringify(context);if(root._identity===identity)return;root._identity=identity;
  const alive=()=>root.isConnected&&root._identity===identity;
  root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p','Setdaten werden geladen …'));
  try{
   const data=await call(context,'getArmorRequestCatalog');if(!alive())return;
   root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p',`${data.character.name} – ${data.character.server} · ${data.character.className}`));
   if(!data.configured){root.append(el('p','Die Gildenleitung muss zuerst unter Layout → Discordchannel den Channel für Rüstungsteile einstellen.'));return;}
   const tier=el('select'),select=el('select'),details=el('div'),status=el('p');status.setAttribute('role','status');
   tier.setAttribute('aria-label','Rüstungsset');select.setAttribute('aria-label','Rüstungsteil');
   const tiers=(Array.isArray(data.tiers)&&data.tiers.length?data.tiers:['T3','T2,5']).filter(value=>data.items.some(item=>item.tier===value));
   tiers.forEach(value=>tier.add(new Option(value,value)));
   const fields=el('div');fields.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin:16px 0';const picker=itemPicker(select,data.items,()=>{picker.refresh();render();});fields.append(tier,select,picker.host);root.append(fields,details,status);
   const mine=el('section');mine.className='armor-my-requests';root.append(mine);
   const statusLabel=value=>value==='approved'?'freigegeben':value==='rejected'?'abgelehnt':'offen';
   const loadMine=async()=>{
    mine.replaceChildren(el('h4','Meine Gildenbankanträge'),el('p','Anträge werden geladen …'));
    try{
     const list=await call(context,'getMyArmorRequests');if(!alive())return;
     mine.replaceChildren(el('h4','Meine Gildenbankanträge'));
     if(!list.entries?.length){mine.append(el('p','Noch keine Anträge gestellt.'));return;}
     const table=el('table'),head=el('tr');['Status','Antrag','Aus der Gildenbank','Datum'].forEach(text=>head.append(el('th',text)));table.append(head);
     for(const entry of list.entries){
      const row=el('tr'),state=el('td'),badge=el('span',statusLabel(entry.status));badge.className='armor-status armor-status-'+entry.status;state.append(badge);
      if(entry.reviewNote)state.append(el('br'),el('small','Notiz: '+entry.reviewNote));
      const what=el('td');what.append(el('strong',entry.itemName||''),el('br'),el('small',`${entry.characterName||''} · ${entry.tier||''}`));
      const materials=el('td'),list_=el('ul');list_.style.cssText='margin:0;padding-left:18px';for(const material of entry.materials||[])list_.append(el('li',`${material.quantity} × ${material.name}`));materials.append(list_);
      row.append(state,what,materials,el('td',entry.createdAt?new Date(entry.createdAt).toLocaleString('de-DE'):''));table.append(row);
     }
     mine.append(table,el('small','Die Gildenleitung gibt Anträge unter „Gildenbankanträge“ frei. Freigegebene Materialien werden anschließend aus der Gildenbank ausgegeben.'));
    }catch(error){if(alive())mine.replaceChildren(el('h4','Meine Gildenbankanträge'),el('p',error.message));}
   };
   loadMine();
   function render(){
    status.textContent='';details.replaceChildren();const item=data.items.find(item=>item.itemId===select.value);if(!item)return;
    const heading=el('h4');heading.append(itemButton(item));details.append(heading);
    const token=item.tokenId?item.requirements.find(r=>r.itemId===item.tokenId):null;if(token){const tokenLine=el('div','Passendes Token: ');tokenLine.append(itemButton(token));details.append(tokenLine);}
    details.append(el('p',item.tokenId?'Markiere, was du aus der Gildenbank benötigst. Die Mengen zeigen den vollständigen Bedarf und können reduziert werden.':'Markiere, was du aus der Gildenbank benötigst, und trage die gewünschte Menge ein.'));
    const rows=[];
    for(const material of item.requirements){
     const row=el('div');row.className='armor-material-row';
     const check=el('input');check.type='checkbox';check.style.width='auto';check.setAttribute('aria-label',material.name+' aus der Gildenbank beantragen');
     const amount=el('input');amount.type='number';amount.min='1';amount.max=String(material.quantity);amount.value=String(material.quantity);amount.step='1';amount.style.width='80px';amount.disabled=true;amount.setAttribute('aria-label','Menge: '+material.name);
     check.onchange=()=>amount.disabled=!check.checked;
     row.append(check,itemButton(material),amount,el('small',`von ${material.quantity}`));details.append(row);rows.push({check,amount,material});
    }
    if(item.prerequisite)details.append(el('small','Voraussetzung: '+item.prerequisite+'.'));
    if(item.reputation)details.append(el('small',`Ruf: ${item.reputation.faction} – ${item.reputation.standing}.`));
    const actions=el('div');actions.className='armor-actions';
    const button=el('button','Beantragen');button.className='primary';button.type='button';
    const discordButton=el('button','In Discord anfragen');discordButton.className='primary armor-discord-disabled';discordButton.type='button';discordButton.disabled=true;discordButton.title='Die Discord-Anfrage ist deaktiviert. Anträge laufen über „Beantragen“ und werden von der Gildenleitung unter Gildenbankanträge freigegeben.';
    actions.append(button,discordButton);details.append(actions);
    const note=el('small','Die Gildenleitung sieht deinen Antrag unter „Gildenbankanträge“ und gibt ihn dort frei.');note.style.cssText='display:block;margin-top:8px';details.append(note);
    button.onclick=async()=>{
     const materials=rows.filter(r=>r.check.checked).map(r=>({itemId:r.material.itemId,quantity:Number(r.amount.value)}));
     if(!materials.length){status.textContent='Bitte mindestens ein benötigtes Material auswählen.';return;}
     if(rows.some(r=>r.check.checked&&!r.amount.reportValidity()))return;
     button.disabled=true;tier.disabled=true;select.disabled=true;rows.forEach(r=>{r.check.disabled=true;r.amount.disabled=true;});status.textContent='Antrag wird gespeichert …';
     try{
      const result=await call(context,'submitArmorRequest',{itemId:item.itemId,materials,discord:false});if(!alive())return;
      status.textContent=result.duplicate?'Dieser Antrag wurde bereits gespeichert und wartet auf die Freigabe.':'Antrag gespeichert. Die Gildenleitung gibt ihn unter „Gildenbankanträge“ frei.';
      button.textContent='Antrag gespeichert';
      loadMine();
     }catch(error){status.textContent=error.message;button.disabled=false;rows.forEach(r=>{r.check.disabled=false;r.amount.disabled=!r.check.checked;});}
     finally{tier.disabled=false;select.disabled=false;}
    };
   }
   function fill(){select.replaceChildren();data.items.filter(item=>item.tier===tier.value).forEach(item=>select.add(new Option(item.name,item.itemId)));picker.refresh();render();}
   tier.onchange=fill;select.onchange=render;fill();
  }catch(error){if(alive()){root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p',error.message));root._identity=null;}}
 }};
})();
