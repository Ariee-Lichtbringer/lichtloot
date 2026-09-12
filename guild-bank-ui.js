/* Gildenbank auf Mein Lichtloot: Kategorien und Bankcharaktere links, Item-Raster mit Tooltips, Detail und Antrag rechts. */
(()=>{
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 async function call(context,action,values={}){const response=await fetch(context.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,api:undefined,action,...values})});const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Die Anfrage konnte nicht verarbeitet werden.');return result;}
 const fallback='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
 const iconUrl=item=>window.GuildLootItems?.iconUrl({icon:item.icon})||(item.icon?`https://wow.zamimg.com/images/wow/icons/large/${item.icon}.jpg`:fallback);
 const qualityColor={poor:'#9d9d9d',common:'#ffffff',uncommon:'#1eff00',rare:'#0070dd',epic:'#a335ee',legendary:'#ff8000'};
 const qualityLabel={poor:'Schlecht',common:'Gewöhnlich',uncommon:'Ungewöhnlich',rare:'Selten',epic:'Episch',legendary:'Legendär'};
 const CATEGORIES=['Waffe','Rüstung','Behälter','Verbrauchbar','Handwerkswaren','Rezept','Reagenz','Projektil','Köcher','Quest','Verschiedenes'];
 const style=el('style');style.textContent=`
 .gb{color:#ecf4ff}.gb h3{margin:0 0 4px;color:#5fe5da}.gb .gb-sub{color:#a3b6cc;margin:0 0 12px;font-size:14px}
 .gb-top{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.gb-top input[type=search]{flex:1;min-width:220px;background:#111f34;border:1px solid #42617b;border-radius:8px;padding:9px 12px;color:#ecf4ff;font:inherit}.gb-top select{background:#111f34;border:1px solid #42617b;border-radius:8px;padding:9px 12px;color:#ecf4ff;font:inherit}
 .gb-cols{display:grid;grid-template-columns:180px minmax(0,1fr) 290px;gap:14px}@media(max-width:1100px){.gb-cols{grid-template-columns:160px minmax(0,1fr)}.gb-det{grid-column:1/-1}}@media(max-width:720px){.gb-cols{grid-template-columns:1fr}}
 .gb-cat{background:#0e1a2f;border:1px solid #243448;border-radius:10px;padding:8px;font-size:13px;align-self:start}.gb-cat button{display:flex;justify-content:space-between;width:100%;background:transparent;border:0;color:#dfe9f5;padding:7px 9px;border-radius:6px;font:inherit;cursor:pointer;text-align:left}.gb-cat button.on{background:#21445a;color:#fff;font-weight:700}.gb-cat button small{color:#a3b6cc}.gb-cat .gb-cat-head{margin:12px 0 4px;border-top:1px solid #243448;padding-top:8px;color:#a3b6cc;font-size:12px}
 .gb-grid{background:#0e1a2f;border:1px solid #243448;border-radius:10px;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,66px);gap:10px;align-content:start;min-height:320px;max-height:640px;overflow:auto}
 .gb-tile{width:60px;height:60px;border:2px solid #fff;border-radius:6px;position:relative;background:#000;padding:0;cursor:pointer;overflow:hidden}.gb-tile img{width:100%;height:100%;display:block;border-radius:4px}.gb-tile .gb-n{position:absolute;right:3px;bottom:2px;font-weight:700;font-size:13px;color:#fff;text-shadow:0 0 3px #000,0 0 3px #000}.gb-tile.on{outline:3px solid #5fe5da;outline-offset:2px}.gb-tile.zero img{opacity:.35}
 .gb-empty{grid-column:1/-1;color:#a3b6cc;padding:20px}
 .gb-det{background:#0e1a2f;border:1px solid #243448;border-radius:10px;padding:12px;font-size:13px;align-self:start}.gb-det h4{margin:0 0 4px;font-size:17px}.gb-det .gb-ico{width:52px;height:52px;border:2px solid #fff;border-radius:6px;float:left;margin-right:10px}.gb-det .gb-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #243448}.gb-det .gb-lab{color:#a3b6cc}
 .gb-qty{display:flex;gap:8px;align-items:center;margin:12px 0}.gb-qty input{width:70px;background:#111f34;border:1px solid #42617b;border-radius:7px;padding:8px;color:#fff;font:inherit;font-size:15px}
 .gb-det button.primary{width:100%;background:#137c75;border:1px solid #2fd6c6;border-radius:8px;color:#fff;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer}.gb-det button:disabled{opacity:.6;cursor:default}
 .gb-status{margin-top:8px;color:#73e4ce}.gb-status.bad{color:#f87171}.gb-foot{margin-top:10px;color:#a3b6cc;font-size:12px}
 .gb-mine{margin-top:14px;border-top:1px solid #243448;padding-top:10px}.gb-mine h5{margin:0 0 8px;font-size:13px}.gb-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px}.gb-badge.pending{background:#4a3a12;color:#fbbf24}.gb-badge.approved{background:#123f2a;color:#4ade80}.gb-badge.rejected{background:#4a1d1d;color:#f87171}
 .gb-tip{position:fixed;z-index:100100;pointer-events:none;width:min(320px,calc(100vw - 32px));background:#08090bf5;border:1px solid #85858b;color:#eee;padding:12px;border-radius:5px;box-shadow:0 12px 35px #000b;font-size:13px;line-height:1.4}.gb-tip b{display:block;font-size:16px;margin-bottom:6px}.gb-tip .g{color:#1eff00}.gb-tip .w{color:#8fa2b8;margin-top:8px}
 `;document.head.append(style);
 let tip=null;const hideTip=()=>{tip?.remove();tip=null;};
 function showTip(anchor,item){
  hideTip();tip=el('div','','gb-tip');const title=el('b',item.name);title.style.color=qualityColor[item.quality]||'#fff';tip.append(title);
  for(const line of String(item.tooltip||'').split('\n').map(x=>x.trim()).filter(Boolean)){if(line===item.name)continue;const p=el('div',line);if(/^(Anlegen:|Benutzen:|\(\d+\) Set:|Set:)/.test(line))p.className='g';tip.append(p);}
  const where=(item.stacks||[]).map(s=>`${s.name} ${s.quantity}`).join(', ');tip.append(el('div',`Auf der Bank: ${item.quantity}${where?` · ${where}`:''}\nKlicken: auswählen und beantragen`,'w'));
  document.body.append(tip);const box=anchor.getBoundingClientRect(),rect=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,box.right+10))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,box.top))+'px';
 }
 window.GuildLootBank={async open(root,context){
  try{const selected=JSON.parse(document.getElementById('myLichtlootCharSelect')?.value||'null');if(selected?.name){context.character=selected.name;context.server=selected.server||'';}}catch{}
  const identity=JSON.stringify(context);if(root._identity===identity)return;root._identity=identity;
  const alive=()=>root.isConnected&&root._identity===identity;
  root.classList.add('gb');root.replaceChildren(el('h3','Gildenbank'),el('p','Bestand wird geladen …','gb-sub'));
  try{
   const data=await call(context,'getGuildBankInventory');if(!alive())return;
   const items=(data.items||[]).map(i=>({...i,quantity:Number(i.quantity)||0}));
   const scans=(data.characters||[]).filter(c=>c.observedAt);
   root.replaceChildren(el('h3','Gildenbank'));
   root.append(el('p',scans.length?`Bestand von ${scans.map(c=>c.name).join(', ')} · Stand ${new Date(Math.max(...scans.map(c=>c.observedAt))*1000).toLocaleString('de-DE')} · ${items.length} Gegenstände`:'Die Gildenleitung hat noch keinen Bestand übertragen.','gb-sub'));
   if(data.note)root.append(el('p',data.note,'gb-sub'));
   const state={search:'',category:'',character:'',quality:'',sort:'quality',selected:null};
   const top=el('div','','gb-top');const search=el('input');search.type='search';search.placeholder='Gegenstand suchen oder Itemlink einfügen';search.setAttribute('aria-label','Gegenstand auf der Gildenbank suchen');
   const charSel=el('select');charSel.setAttribute('aria-label','Bankcharakter');charSel.append(new Option('Bankcharakter: Alle',''));for(const c of data.characters||[])charSel.append(new Option(`${c.name}${c.observedAt?'':' (kein Stand)'}`,c.name));
   const qualSel=el('select');qualSel.setAttribute('aria-label','Seltenheit');qualSel.append(new Option('Seltenheit: Alle',''));for(const q of ['uncommon','rare','epic','legendary'])qualSel.append(new Option(qualityLabel[q],q));
   const sortSel=el('select');sortSel.setAttribute('aria-label','Sortierung');[['quality','Sortierung: Seltenheit'],['name','Sortierung: Name'],['quantity','Sortierung: Menge']].forEach(([v,t])=>sortSel.append(new Option(t,v)));
   top.append(search,charSel,qualSel,sortSel);root.append(top);
   const cols=el('div','','gb-cols');const cat=el('div','','gb-cat');const grid=el('div','','gb-grid');grid.setAttribute('role','list');const det=el('div','','gb-det');cols.append(cat,grid,det);root.append(cols);
   const status=el('p','','gb-status');status.setAttribute('role','status');
   const counts={};for(const i of items)counts[i.category||'Verschiedenes']=(counts[i.category||'Verschiedenes']||0)+1;
   function renderCat(){
    cat.replaceChildren();
    const add=(label,value,count,key)=>{const b=el('button');b.append(el('span',label),el('small',count===undefined?'':String(count)));b.type='button';if(state[key]===value)b.classList.add('on');b.onclick=()=>{state[key]=value;renderCat();renderGrid();};cat.append(b);};
    add('Alles','',items.length,'category');for(const c of CATEGORIES){if(counts[c])add(c,c,counts[c],'category');}
    cat.append(el('div','Bankcharaktere','gb-cat-head'));add('Alle Bankcharaktere','',undefined,'character');
    for(const c of data.characters||[]){add(c.name,c.name,c.items||0,'character');}
   }
   function visible(){
    const needle=state.search.trim().toLowerCase();const idMatch=needle.match(/item[:=](\d+)/)?.[1]||(/^\d+$/.test(needle)?needle:null);
    return items.filter(i=>(!state.category||(i.category||'Verschiedenes')===state.category)&&(!state.quality||i.quality===state.quality)&&(!state.character||(i.stacks||[]).some(s=>s.name===state.character&&s.quantity>0))&&(!needle||i.name.toLowerCase().includes(needle)||(idMatch&&String(i.itemId)===idMatch)))
     .sort((a,b)=>state.sort==='name'?a.name.localeCompare(b.name,'de'):state.sort==='quantity'?b.quantity-a.quantity:(qualityRank(b)-qualityRank(a))||a.name.localeCompare(b.name,'de'));
   }
   const qualityRank=i=>({poor:0,common:1,uncommon:2,rare:3,epic:4,legendary:5}[i.quality]??1);
   function renderGrid(){
    grid.replaceChildren();const list=visible();
    if(!list.length){grid.append(el('div',items.length?'Kein Gegenstand für diese Auswahl.':'Die Gildenbank ist leer.','gb-empty'));return;}
    for(const item of list.slice(0,400)){
     const b=el('button','','gb-tile');b.type='button';b.setAttribute('role','listitem');b.setAttribute('aria-label',`${item.name}, ${item.quantity} Stück`);b.style.borderColor=qualityColor[item.quality]||'#fff';
     const img=el('img');img.alt='';img.src=iconUrl(item);img.onerror=()=>{if(img.src!==fallback)img.src=fallback;};img.referrerPolicy='no-referrer';
     const qty=state.character?(item.stacks||[]).filter(s=>s.name===state.character).reduce((n,s)=>n+s.quantity,0):item.quantity;
     b.append(img,el('span',String(qty),'gb-n'));if(state.selected===item.itemId)b.classList.add('on');
     b.addEventListener('mouseenter',()=>showTip(b,item));b.addEventListener('mouseleave',hideTip);b.addEventListener('focus',()=>showTip(b,item));b.addEventListener('blur',hideTip);
     b.onclick=()=>{state.selected=item.itemId;hideTip();renderGrid();renderDetail(item);};
     grid.append(b);
    }
   }
   let mine=[];
   async function loadMine(){try{const list=await call(context,'getMyArmorRequests');if(alive()){mine=list.entries||[];renderMine();}}catch{}}
   const mineBox=el('div','','gb-mine');
   function renderMine(){
    mineBox.replaceChildren(el('h5','Meine Gildenbankanträge'));
    if(!mine.length){mineBox.append(el('div','Noch keine Anträge gestellt.','gb-lab'));return;}
    for(const entry of mine.slice(0,8)){const row=el('div');const badge=el('span',entry.status==='approved'?'freigegeben':entry.status==='rejected'?'abgelehnt':'offen','gb-badge '+entry.status);row.append(badge,document.createTextNode(`${(entry.materials||[]).map(m=>`${m.quantity} × ${m.name}`).join(', ')||entry.itemName} · ${entry.createdAt?new Date(entry.createdAt).toLocaleDateString('de-DE'):''}`));if(entry.reviewNote)row.append(el('div','Notiz: '+entry.reviewNote,'gb-lab'));mineBox.append(row);}
   }
   function renderDetail(item){
    det.replaceChildren();
    if(!item){det.append(el('h4','Gegenstand auswählen'),el('p','Klicke auf einen Gegenstand im Raster, um Details zu sehen und ihn zu beantragen.','gb-lab'),mineBox);return;}
    const img=el('img','','gb-ico');img.alt='';img.src=iconUrl(item);img.style.borderColor=qualityColor[item.quality]||'#fff';const h=el('h4',item.name);h.style.color=qualityColor[item.quality]||'#fff';
    det.append(img,h,el('div',`${item.category||'Verschiedenes'} · ${qualityLabel[item.quality]||'Gewöhnlich'} · #${item.itemId}`,'gb-lab'));const clear=el('div');clear.style.cssText='clear:both;margin-top:10px';det.append(clear);
    const row=(label,value,cls)=>{const r=el('div','','gb-row');r.append(el('span',label,'gb-lab'));const v=el(cls?'b':'span',value);if(cls)v.style.color=cls;r.append(v);det.append(r);};
    row('Verfügbar',`${item.quantity} Stück`,item.quantity>0?'#73e4ce':'#f87171');for(const s of item.stacks||[])row(s.name,String(s.quantity));
    const open=mine.filter(m=>m.status==='pending'&&(m.materials||[]).some(x=>Number(x.itemId)===item.itemId)).reduce((n,m)=>n+(m.materials||[]).filter(x=>Number(x.itemId)===item.itemId).reduce((a,x)=>a+Number(x.quantity||0),0),0);
    if(open)row('Deine offenen Anträge',`${open} Stück`);
    const qty=el('div','','gb-qty');const amount=el('input');amount.type='number';amount.min='1';amount.max=String(Math.max(1,item.quantity));amount.value='1';amount.setAttribute('aria-label','Menge: '+item.name);qty.append(el('span','Menge','gb-lab'),amount,el('span',`von ${item.quantity}`,'gb-lab'));det.append(qty);
    const button=el('button','Beantragen','primary');button.type='button';button.disabled=item.quantity<1;det.append(button,status);
    button.onclick=async()=>{if(!amount.reportValidity())return;button.disabled=true;status.className='gb-status';status.textContent='Antrag wird gespeichert …';
     try{const result=await call(context,'submitGuildBankRequest',{itemId:item.itemId,quantity:Number(amount.value)});if(!alive())return;status.textContent=result.duplicate?'Dieser Antrag wartet bereits auf die Freigabe.':`Antrag gespeichert: ${amount.value} × ${item.name}. Die Gildenleitung gibt ihn unter „Gildenbankanträge“ frei.`;await loadMine();renderDetail(item);}
     catch(error){status.className='gb-status bad';status.textContent=error.message;}
     finally{button.disabled=false;}
    };
    det.append(el('div','Nicht vorhandene Mengen werden als „aktuell nicht verfügbar“ abgelehnt. Freigegebene Anträge werden von der Gildenleitung ausgegeben.','gb-foot'),mineBox);
   }
   search.oninput=()=>{state.search=search.value;renderGrid();};charSel.onchange=()=>{state.character=charSel.value;renderCat();renderGrid();};qualSel.onchange=()=>{state.quality=qualSel.value;renderGrid();};sortSel.onchange=()=>{state.sort=sortSel.value;renderGrid();};
   renderCat();renderGrid();renderDetail(null);loadMine();
   // Icons und Kategorien, die der Server noch nachlädt, nach kurzer Zeit nachziehen.
   let retries=0;const refill=async()=>{if(!alive()||retries++>=4)return;try{const fresh=await call(context,'getGuildBankInventory');if(!alive())return;const byId=new Map((fresh.items||[]).map(i=>[i.itemId,i]));let changed=false;for(const item of items){const f=byId.get(item.itemId);if(f&&(f.icon!==item.icon||f.category!==item.category||f.quality!==item.quality||f.tooltip!==item.tooltip)){Object.assign(item,{icon:f.icon,category:f.category,quality:f.quality,tooltip:f.tooltip,name:f.name});changed=true;}}
    if(changed){for(const k in counts)delete counts[k];for(const i of items)counts[i.category||'Verschiedenes']=(counts[i.category||'Verschiedenes']||0)+1;renderCat();renderGrid();}
    if((fresh.pendingMeta||0)>0||items.some(i=>!i.icon))setTimeout(refill,5000);}catch{}};
   if((data.pendingMeta||0)>0||items.some(i=>!i.icon))setTimeout(refill,4000);
  }catch(error){if(alive()){root.replaceChildren(el('h3','Gildenbank'),el('p',error.message,'gb-sub'));root._identity=null;}}
 },
 // Gildenleitung: gleiche Ansicht mit Anträgen je Item, Freigabe, Ablehnung und „nicht beantragbar“.
 openAdmin(root,opts){
  const items=(opts.items||[]).map(i=>({...i,quantity:Number(i.quantity)||0}));const characters=opts.characters||[];const requests=opts.requests||[];
  const hidden=new Set((opts.hiddenItems||[]).map(Number));
  const pendingFor=id=>requests.filter(r=>r.status==='pending'&&(r.materials||[]).some(m=>Number(m.itemId)===id));
  const qtyFor=(list,id)=>list.reduce((n,r)=>n+(r.materials||[]).filter(m=>Number(m.itemId)===id).reduce((a,m)=>a+Number(m.quantity||0),0),0);
  const reservedFor=item=>{const scan=Math.max(0,...(item.stacks||[]).map(s=>Number(s.observedAt)||0));return qtyFor(requests.filter(r=>r.status==='approved'&&(!r.reviewedAt||Math.floor(new Date(r.reviewedAt).getTime()/1000)>=scan)),item.itemId);};
  const state={search:'',category:'',character:'',onlyRequests:false,selected:null,showHidden:true};
  const now=Math.floor(Date.now()/1000);const age=ts=>!ts?'kein Stand':(now-ts<86400?'heute':`${Math.floor((now-ts)/86400)} Tage`);
  root.classList.add('gb');root.replaceChildren();
  const pending=requests.filter(r=>r.status==='pending').length;
  const sub=el('p',`${characters.length} Bankcharaktere · ${items.length} Gegenstände · ${pending} offene Anträge`,'gb-sub');root.append(sub);
  const top=el('div','','gb-top');const search=el('input');search.type='search';search.placeholder='Gegenstand, Spieler oder Itemlink';search.setAttribute('aria-label','Gildenbank durchsuchen');
  const charSel=el('select');charSel.setAttribute('aria-label','Bankcharakter');charSel.append(new Option('Bankcharakter: Alle',''));for(const c of characters)charSel.append(new Option(c.name,c.name));
  const onlyReq=el('button','Nur mit Anträgen');onlyReq.type='button';onlyReq.className='small-btn ghost';
  const reqBtn=el('button',`📋 Anträge (${pending})`);reqBtn.type='button';reqBtn.className='small-btn '+(pending?'primary':'ghost');reqBtn.onclick=()=>opts.onOpenRequests?.();
  const impBtn=el('button','⬆ Export einfügen');impBtn.type='button';impBtn.className='small-btn good';impBtn.onclick=()=>opts.onOpenSettings?.('import');
  const setBtn=el('button','⚙ Einstellungen');setBtn.type='button';setBtn.className='small-btn ghost';setBtn.onclick=()=>opts.onOpenSettings?.('settings');
  top.append(search,charSel,onlyReq,reqBtn,impBtn,setBtn);root.append(top);
  const cols=el('div','','gb-cols');const cat=el('div','','gb-cat');const grid=el('div','','gb-grid');const det=el('div','','gb-det');cols.append(cat,grid,det);root.append(cols);
  const counts={};for(const i of items)counts[i.category||'Verschiedenes']=(counts[i.category||'Verschiedenes']||0)+1;
  function renderCat(){
   cat.replaceChildren();
   const add=(label,value,count,key,extraClass)=>{const b=el('button');b.append(el('span',label),el('small',count===undefined?'':String(count)));b.type='button';if(state[key]===value)b.classList.add('on');if(extraClass)b.style.color=extraClass;b.onclick=()=>{state[key]=value;renderCat();renderGrid();};cat.append(b);};
   add('Alles','',items.length,'category');for(const c of CATEGORIES){if(counts[c])add(c,c,counts[c],'category');}
   cat.append(el('div','Bankcharaktere · Stand','gb-cat-head'));add('Alle','',undefined,'character');
   for(const c of characters){const old=c.observedAt&&now-c.observedAt>7*86400;add(c.name,c.name,(old?'⚠ ':'')+age(c.observedAt),'character',old||!c.observedAt?'#f5c542':'');}
   const hiddenCount=items.filter(i=>hidden.has(i.itemId)).length;if(hiddenCount){const b=el('button');b.append(el('span','Nicht beantragbar'),el('small',String(hiddenCount)));b.type='button';b.style.color='#8fa2b8';b.onclick=()=>{state.category='__hidden';renderCat();renderGrid();};if(state.category==='__hidden')b.classList.add('on');cat.append(b);}
  }
  const qualityRank=i=>({poor:0,common:1,uncommon:2,rare:3,epic:4,legendary:5}[i.quality]??1);
  function visible(){
   const needle=state.search.trim().toLowerCase();const idMatch=needle.match(/item[:=](\d+)/)?.[1]||(/^\d+$/.test(needle)?needle:null);
   return items.filter(i=>{
    if(state.category==='__hidden')return hidden.has(i.itemId);
    if(state.category&&(i.category||'Verschiedenes')!==state.category)return false;
    if(state.character&&!(i.stacks||[]).some(s=>s.name===state.character&&s.quantity>0))return false;
    if(state.onlyRequests&&!pendingFor(i.itemId).length)return false;
    if(!needle)return true;
    return i.name.toLowerCase().includes(needle)||(idMatch&&String(i.itemId)===idMatch)||pendingFor(i.itemId).some(r=>String(r.characterName||'').toLowerCase().includes(needle));
   }).sort((a,b)=>(pendingFor(b.itemId).length-pendingFor(a.itemId).length)||(qualityRank(b)-qualityRank(a))||a.name.localeCompare(b.name,'de'));
  }
  function renderGrid(){
   grid.replaceChildren();const list=visible();
   if(!list.length){grid.append(el('div',items.length?'Kein Gegenstand für diese Auswahl.':'Noch kein Bestand übertragen. Oben „Export einfügen“ wählen.','gb-empty'));return;}
   for(const item of list.slice(0,500)){
    const b=el('button','','gb-tile');b.type='button';b.setAttribute('aria-label',`${item.name}, ${item.quantity} Stück`);b.style.borderColor=qualityColor[item.quality]||'#fff';
    const img=el('img');img.alt='';img.src=iconUrl(item);img.onerror=()=>{if(img.src!==fallback)img.src=fallback;};img.referrerPolicy='no-referrer';
    const qty=state.character?(item.stacks||[]).filter(s=>s.name===state.character).reduce((n,s)=>n+s.quantity,0):item.quantity;
    b.append(img,el('span',String(qty),'gb-n'));if(state.selected===item.itemId)b.classList.add('on');if(hidden.has(item.itemId))b.classList.add('zero');
    const open=pendingFor(item.itemId).length;if(open){const badge=el('span',String(open));badge.style.cssText='position:absolute;left:-2px;top:-2px;background:#f59e0b;color:#000;font-weight:700;font-size:11px;border-radius:999px;padding:1px 6px';b.append(badge);}
    b.addEventListener('mouseenter',()=>showTip(b,item));b.addEventListener('mouseleave',hideTip);b.addEventListener('focus',()=>showTip(b,item));b.addEventListener('blur',hideTip);
    b.onclick=()=>{state.selected=item.itemId;hideTip();renderGrid();renderDetail(item);};
    grid.append(b);
   }
  }
  function renderDetail(item){
   det.replaceChildren();
   if(!item){det.append(el('h4','Gegenstand auswählen'),el('p','Klicke auf einen Gegenstand, um Bestand, Anträge und Sichtbarkeit zu verwalten. Orange Zahlen zeigen offene Anträge.','gb-lab'));return;}
   const img=el('img','','gb-ico');img.alt='';img.src=iconUrl(item);img.style.borderColor=qualityColor[item.quality]||'#fff';const h=el('h4',item.name);h.style.color=qualityColor[item.quality]||'#fff';
   det.append(img,h,el('div',`${item.category||'Verschiedenes'} · ${qualityLabel[item.quality]||'Gewöhnlich'} · #${item.itemId}`,'gb-lab'));const clear=el('div');clear.style.cssText='clear:both;margin-top:10px';det.append(clear);
   const row=(label,value,color)=>{const r=el('div','','gb-row');r.append(el('span',label,'gb-lab'));const v=el(color?'b':'span',value);if(color)v.style.color=color;r.append(v);det.append(r);};
   row('Auf der Bank',`${item.quantity} Stück`,item.quantity>0?'#73e4ce':'#f87171');for(const s of item.stacks||[])row(s.name,String(s.quantity));
   const reserved=reservedFor(item);if(reserved)row('Reserviert (freigegeben)',String(reserved));
   const open=pendingFor(item.itemId);const head=el('div',open.length?`Offene Anträge für dieses Item (${open.length})`:'Keine offenen Anträge');head.style.cssText='margin-top:10px;font-weight:700';det.append(head);
   for(const r of open){
    const box=el('div');box.style.cssText='background:#121f36;border:1px solid #2a4560;border-radius:8px;padding:8px;margin:8px 0';
    box.append(el('b',`${r.characterName} · ${qtyFor([r],item.itemId)} Stück`),el('div',`${r.createdAt?new Date(r.createdAt).toLocaleString('de-DE'):''}${r.server?' · '+r.server:''}${r.className?' · '+r.className:''}`,'gb-lab'));
    const acts=el('div');acts.style.cssText='display:flex;gap:6px;margin-top:6px';
    const ok=el('button','Freigeben');ok.type='button';ok.className='small-btn good';ok.onclick=()=>opts.onReview?.(r.id,'approved');
    const no=el('button','Ablehnen');no.type='button';no.className='small-btn danger';no.onclick=()=>opts.onReview?.(r.id,'rejected');
    acts.append(ok,no);box.append(acts);det.append(box);
   }
   const toggle=el('label');toggle.style.cssText='display:flex;gap:8px;align-items:center;margin-top:10px;cursor:pointer';const cb=el('input');cb.type='checkbox';cb.checked=hidden.has(item.itemId);cb.onchange=()=>{if(cb.checked)hidden.add(item.itemId);else hidden.delete(item.itemId);opts.onToggleHidden?.(item.itemId,cb.checked);renderCat();renderGrid();};toggle.append(cb,el('span','Für Spieler nicht beantragbar'));det.append(toggle);
   det.append(el('div','Freigegebene Mengen zählen als reserviert, bis der nächste Bankexport den echten Stand bringt.','gb-foot'));
  }
  search.oninput=()=>{state.search=search.value;renderGrid();};charSel.onchange=()=>{state.character=charSel.value;renderCat();renderGrid();};
  onlyReq.onclick=()=>{state.onlyRequests=!state.onlyRequests;onlyReq.className='small-btn '+(state.onlyRequests?'primary':'ghost');renderGrid();};
  renderCat();renderGrid();renderDetail(null);
  return {select(id){const item=items.find(i=>i.itemId===id);if(item){state.selected=id;renderGrid();renderDetail(item);}}};
 }};
})();
