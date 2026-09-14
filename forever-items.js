(() => {
  'use strict';
  const language=window.ForeverI18n?.lang||'de';
  const $ = id => document.getElementById(id);
  const qualities = ['Schlecht','Gewöhnlich','Ungewöhnlich','Selten','Episch','Legendär','Artefakt','Erbstück','WoW-Marke'];
  const categories = {0:'Verbrauchbar',1:'Behälter',2:'Waffe',4:'Rüstung',5:'Reagenz',6:'Munition',7:'Handwerksmaterial',9:'Rezept',10:'Währung',11:'Köcher',12:'Questgegenstand',13:'Schlüssel',15:'Verschiedenes',16:'Glyphe',18:'WoW-Marke'};
  const slots = {1:'Kopf',2:'Hals',3:'Schulter',4:'Hemd',5:'Brust',6:'Taille',7:'Beine',8:'Füße',9:'Handgelenke',10:'Hände',11:'Finger',12:'Schmuck',13:'Einhändig',14:'Schild',15:'Distanz',16:'Rücken',17:'Zweihändig',18:'Tasche',19:'Wappenrock',20:'Robe',21:'Waffenhand',22:'Schildhand',23:'Nebenhand',24:'Munition',25:'Wurfwaffe',26:'Distanz',28:'Relikt'};
  const statNames = {agi:'Beweglichkeit',str:'Stärke',sta:'Ausdauer',int:'Intelligenz',spi:'Willenskraft',armor:'Rüstung',dura:'Haltbarkeit',health:'Gesundheit',mana:'Mana',dps:'Schaden pro Sekunde',speed:'Waffentempo',dmgmin1:'Minimaler Schaden',dmgmax1:'Maximaler Schaden',atkpwr:'Angriffskraft',mleatkpwr:'Nahkampfangriffskraft',rgdatkpwr:'Distanzangriffskraft',splpwr:'Zaubermacht',spldmg:'Zauberschaden',splheal:'Heilung',manargn:'Mana alle 5 Sekunden',healthrgn:'Gesundheit alle 5 Sekunden',def:'Verteidigung',block:'Blockchance',blockrtng:'Blockwertung',blockvalue:'Blockwert',dodgertng:'Ausweichwertung',dodge:'Ausweichchance',parry:'Parierchance',critstrkrtng:'Kritische Trefferwertung',mlecritstrkrtng:'Kritische Nahkampftrefferwertung',splcritstrkrtng:'Kritische Zaubertrefferwertung',hitrtng:'Trefferwertung',mlehitrtng:'Nahkampftrefferwertung',splhitrtng:'Zaubertrefferwertung',firres:'Feuerwiderstand',frores:'Frostwiderstand',natres:'Naturwiderstand',shares:'Schattenwiderstand',arcres:'Arkanwiderstand',holres:'Heiligwiderstand'};
  let data, pending, filtered=[],page=1, opener, setData, activeSet=null, setClass=1, itemView="sets";
  const perPage=48;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de');
  const number=n=>Number(n).toLocaleString(language==='de'?'de-DE':'en-US',{maximumFractionDigits:2});
  const link=x=>'https://www.wowhead.com/forever/'+(language==='de'?'de/':'')+'item='+x.id;
  function icon(x){const img=node('img','item-icon');img.src='https://wow.zamimg.com/images/wow/icons/large/'+encodeURIComponent(x.icon)+'.jpg';img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';};return img;}
  const detailCache=new Map();
  async function itemDetails(id){
    if(!detailCache.has(id))detailCache.set(id,(async()=>{
      const response=await fetch('https://nether.wowhead.com/tooltip/item/'+Number(id)+'?dataEnv=16&locale='+(language==='de'?3:0),{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Item details: '+response.status);
      const result=await response.json();if(!result.tooltip)throw Error('Missing item details');return result.tooltip;
    })().catch(error=>{detailCache.delete(id);throw error;}));
    return detailCache.get(id);
  }
  // Rebuild the source markup with a small allowlist; never execute remote HTML.
  function detailMarkup(html){
    const source=new DOMParser().parseFromString(html,'text/html'),fragment=document.createDocumentFragment();
    const tags=new Set(['TABLE','TBODY','TR','TD','TH','BR','B','STRONG','SPAN','DIV','A','I','SMALL']);
    function copy(original,parent){
      if(original.nodeType===3){parent.append(document.createTextNode(original.textContent));return;}
      if(original.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT','SVG','IMG'].includes(original.tagName))return;
      const el=tags.has(original.tagName)?document.createElement(original.tagName.toLowerCase()):document.createElement('span');
      for(const cl of original.classList)if(/^(q[0-9]?|c[0-9]+|indent|moneygold|moneysilver|moneycopper|whtt-[a-z-]+|wowhead-tooltip-item-classes)$/.test(cl))el.classList.add(cl);
      if(original.tagName==='A'){
        try{const url=new URL(original.getAttribute('href'),'https://www.wowhead.com');if(url.protocol==='https:'&&url.hostname==='www.wowhead.com'){el.href=url.href;el.target='_blank';el.rel='noopener noreferrer';}}catch{}
      }
      for(const child of original.childNodes)copy(child,el);parent.append(el);
    }
    for(const child of source.body.childNodes)copy(child,fragment);return fragment;
  }
  function fillDetails(host,html,x){
    host.replaceChildren();host.classList.add('item-full-details');host.append(detailMarkup(html));
    host.append(node('p','item-hover-id','ItemID: '+x.id));
  }
  function loadDetails(host,x,valid,done){
    const status=node('p','item-detail-status',language==='en'?'Loading full item details …':'Vollständige Itemdetails werden geladen …');host.append(status);
    itemDetails(x.id).then(html=>{if(!valid())return;fillDetails(host,html,x);done?.();}).catch(()=>{if(valid())status.textContent=language==='en'?'Full details could not be loaded. Please try again or open Wowhead.':'Vollständige Details konnten nicht geladen werden. Bitte erneut versuchen oder Wowhead öffnen.';});
  }
  let hoverTip,hoverAnchor,hoverTimer,dismissedAnchor;
  const tr=s=>window.ForeverI18n?.t(s)||s;
  function hideHover(){clearTimeout(hoverTimer);if(hoverTip)hoverTip.hidden=true;hoverAnchor?.removeAttribute('aria-describedby');hoverAnchor=null;}
  function delayHide(){clearTimeout(hoverTimer);hoverTimer=setTimeout(hideHover,180);}
  function positionHover(){
    if(!hoverAnchor||!hoverTip||hoverTip.hidden)return;
    const r=hoverAnchor.getBoundingClientRect(),gap=12;
    hoverTip.style.maxHeight=Math.max(100,innerHeight-gap*2)+'px';
    const w=hoverTip.offsetWidth;let left=r.right+gap,top;
    if(left+w<=innerWidth-gap)top=r.top+20;
    else if(r.left-w-gap>=gap){left=r.left-w-gap;top=r.top+20;}
    else{left=Math.max(gap,Math.min(r.left,innerWidth-w-gap));const below=innerHeight-r.bottom-gap*2,above=r.top-gap*2;hoverTip.style.maxHeight=Math.max(100,Math.max(below,above))+'px';top=below>=above?r.bottom+gap:r.top-hoverTip.offsetHeight-gap;}
    const h=hoverTip.offsetHeight;hoverTip.style.left=Math.max(gap,left)+'px';hoverTip.style.top=Math.max(gap,Math.min(top,innerHeight-h-gap))+'px';
  }
  function showHover(x,anchor){
    if($('itemDialog').open||dismissedAnchor===anchor)return;
    clearTimeout(hoverTimer);hoverAnchor?.removeAttribute('aria-describedby');hoverAnchor=anchor;
    if(!hoverTip){hoverTip=node('aside','item-hover');hoverTip.id='itemHoverTooltip';hoverTip.setAttribute('role','tooltip');hoverTip.onpointerenter=()=>clearTimeout(hoverTimer);hoverTip.onpointerleave=delayHide;document.body.append(hoverTip);}
    hoverTip.className='item-hover q'+x.quality;hoverTip.replaceChildren();
    hoverTip.append(node('h3','item-name',x.name),node('p','item-hover-id','ItemID: '+x.id),node('p','item-hover-slot',tr(slots[x.slot]||categories[x.classs]||'Gegenstand')));
    const stats=node('div','item-hover-stats');
    const plain=new Set(['armor','dura','dps','speed','dmgmin1','dmgmax1']);
    for(const [key,label] of Object.entries(statNames)){const val=x.stats[key]??x[key];if(typeof val==='number'&&val!==0){stats.append(node('p',plain.has(key)?'item-hover-basic':'item-hover-bonus',(val>0&&!plain.has(key)?'+':'')+number(val)+' '+tr(label)));}}
    hoverTip.append(stats);const req=x.reqlevel||x.stats.reqlevel;if(req)hoverTip.append(node('p','item-hover-level',language==='en'?'Requires level '+req:'Benötigt Stufe '+req));
    const sources=[...new Set((x.sourcemore||[]).map(s=>s.n).filter(Boolean))];
    if(sources.length){const footer=node('p','item-hover-source');footer.append(node('strong','',language==='en'?'Source: ':'Quelle: '),document.createTextNode(sources.join(' · ')));hoverTip.append(footer);}
    loadDetails(hoverTip,x,()=>hoverAnchor===anchor&&!hoverTip.hidden,positionHover);
    hoverTip.hidden=false;anchor.setAttribute('aria-describedby',hoverTip.id);positionHover();
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&hoverTip&&!hoverTip.hidden){e.preventDefault();e.stopPropagation();dismissedAnchor=hoverAnchor;hideHover();}});
  addEventListener('resize',positionHover);addEventListener('scroll',e=>{if(!hoverTip?.contains(e.target))positionHover();},true);
  document.addEventListener('pointerdown',e=>{if(!hoverTip?.contains(e.target))hideHover();});
  const classInfo=[
    [1,'Krieger','inv_sword_27','#c79c6e'],[2,'Paladin','ability_thunderbolt','#f58cba'],[3,'Jäger','inv_weapon_bow_07','#abd473'],[4,'Schurke','inv_throwingknife_04','#fff569'],[5,'Priester','inv_staff_30','#ffffff'],[7,'Schamane','spell_nature_bloodlust','#4d9eff'],[8,'Magier','inv_staff_13','#69ccf0'],[9,'Hexenmeister','spell_nature_drowsy','#9482c9'],[11,'Druide','inv_misc_monsterclaw_04','#ff7d0a']
  ];
  function setName(s){return language==='de'?s.nameDe:s.name;}
  function setView(view){
    hideHover();itemView=view;
    $('itemSetBrowser').hidden=view!=='sets';$('itemSetSelection').hidden=view!=='set';$('itemFilters').hidden=view!=='all';$('itemResults').hidden=view==='sets';$('itemPagination').hidden=view!=='all';$('itemCount').hidden=view==='sets';
    $('itemSetsView').setAttribute('aria-pressed',String(view!=='all'));$('itemAllView').setAttribute('aria-pressed',String(view==='all'));
    if(!data)return;
    if(view==='sets'){activeSet=null;renderSets();}else if(view==='all'){activeSet=null;filter();}
    const u=new URL(location.href);if(view==='set'&&activeSet){u.searchParams.set('set',activeSet.id);u.searchParams.delete('items');}else{u.searchParams.delete('set');if(view==='all')u.searchParams.set('items','all');else u.searchParams.delete('items');}history.replaceState(null,'',u);
  }
  function renderSets(){
    const host=$('itemSetCards');host.replaceChildren();
    const selected=classInfo.find(c=>c[0]===setClass);$('itemSetHeading').textContent=selected?tr(selected[1])+' · Sets':(language==='en'?'Other sets':'Weitere Sets');
    $('itemSetClasses').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.class)===setClass)));
    const sets=setData.sets.filter(s=>setClass?(s.classes||[]).includes(setClass):!s.classes?.length).sort((a,b)=>a.minlevel-b.minlevel||setName(a).localeCompare(setName(b),language));
    $('itemSetHeading').textContent+=' · '+sets.length+' Sets';
    for(const set of sets){
      const b=node('button','item-set-card q'+set.quality);b.type='button';b.dataset.setId=set.id;
      const images=node('span','item-set-icons');const pieces=set.pieces.map(id=>data.items.find(x=>x.id===id)).filter(Boolean);for(const x of pieces.slice(0,4))images.append(icon(x));
      b.append(images,node('strong','item-name',setName(set)),node('span','item-meta',set.pieces.length+(language==='en'?' pieces':' Teile')+(set.minlevel?' · '+(language==='en'?'Item level ':'Gegenstandsstufe ')+set.minlevel+(set.maxlevel!==set.minlevel?'–'+set.maxlevel:''):'')),node('span','item-set-open',language==='en'?'View set →':'Set ansehen →'));
      b.onclick=()=>selectSet(set);host.append(b);
    }
  }
  function selectSet(set){
    activeSet=set;setView('set');$('itemSetTitle').textContent=setName(set);const ids=new Set(set.pieces);filtered=data.items.filter(x=>ids.has(x.id));page=1;render();
    const missing=set.pieces.length-filtered.length;$('itemSetInfo').textContent=language==='en'?filtered.length+' available pieces'+(missing?' · '+missing+' pieces not listed in the item database':''):filtered.length+' verfügbare Set-Teile'+(missing?' · '+missing+' Teile nicht in der Itemdatenbank vorhanden':'');
    $('itemCount').textContent=filtered.length+(language==='en'?' set pieces':' Set-Teile');
    let bonuses=$('itemSetBonuses');if(!bonuses){bonuses=node('div','item-set-bonuses');bonuses.id='itemSetBonuses';$('itemSetSelection').append(bonuses);}bonuses.replaceChildren();
    if(filtered[0]){const status=node('p','',language==='en'?'Loading set bonuses …':'Setboni werden geladen …');bonuses.append(status);
      itemDetails(filtered[0].id).then(html=>{if(activeSet!==set)return;const markup=node('div');markup.append(detailMarkup(html));const bonus=Array.from(markup.querySelectorAll('span.q0')).find(e=>/\(\d+\)\s*Set/.test(e.textContent));bonuses.replaceChildren(node('h3','',language==='en'?'Set bonuses':'Setboni'));if(bonus)bonuses.append(bonus);else bonuses.append(node('p','',language==='en'?'No set bonuses listed for this item.':'Für diesen Gegenstand sind keine Setboni aufgeführt.'));}).catch(()=>{if(activeSet===set)status.textContent=language==='en'?'Set bonuses could not be loaded.':'Setboni konnten nicht geladen werden.';});
    }
  }
  function initSets(){
    const host=$('itemSetClasses');
    for(const [id,name,iconName,color] of [...classInfo,[0,'Weitere Sets','inv_chest_chain_04','#ecd09a']]){const b=node('button','talent-class-card');b.type='button';b.dataset.class=id;b.style.setProperty('--class-color',color);b.append(icon({icon:iconName}),node('span','',tr(name)));b.onclick=()=>{setClass=id;renderSets();};host.append(b);}
    $('itemSetsView').onclick=()=>setView('sets');$('itemAllView').onclick=()=>setView('all');$('itemSetBack').onclick=()=>setView('sets');
  }
  function filter(){
    if(!data)return;
    const q=norm($('itemSearch').value).trim(),cat=$('itemCategory').value,quality=$('itemQuality').value,slot=$('itemSlot').value,cl=Number($('itemClass').value),min=$('itemLevelMin').value,max=$('itemLevelMax').value;
    filtered=data.items.filter(x=>(!q||x.search.includes(q))&&(!cat||String(x.classs)===cat)&&(!quality||String(x.quality)===quality)&&(!slot||String(x.slot)===slot)&&(!cl||!x.stats.classes||(x.stats.classes&cl))&&(min===''||Number(x.level||0)>=Number(min))&&(max===''||Number(x.level||0)<=Number(max)));
    const sort=$('itemSort').value;
    filtered.sort(sort==='level-desc'?(a,b)=>(b.level||0)-(a.level||0)||a.name.localeCompare(b.name,'de'):sort==='quality-desc'?(a,b)=>b.quality-a.quality||(b.level||0)-(a.level||0):sort==='id'?(a,b)=>a.id-b.id:(a,b)=>a.name.localeCompare(b.name,'de'));
    page=1;render();
  }
  function render(){
    hideHover();const list=$('itemResults');list.replaceChildren();
    $('itemCount').textContent=number(filtered.length)+' von '+number(data.count)+' Gegenständen';
    const pages=Math.max(1,Math.ceil(filtered.length/perPage));page=Math.min(page,pages);
    $('itemPage').textContent='Seite '+page+' von '+pages;$('itemPrevious').disabled=page===1;$('itemNext').disabled=page===pages;
    if(!filtered.length){list.append(node('p','items-empty',itemView==='set'?(language==='en'?'No pieces from this set are currently available in the item database.':'Für dieses Set sind derzeit keine Teile in der Itemdatenbank verfügbar.'):'Keine passenden Gegenstände. Ändere die Suche oder setze die Filter zurück.'));return;}
    for(const x of filtered.slice((page-1)*perPage,page*perPage)){
      const card=node('button','item-card q'+x.quality);card.type='button';card.append(icon(x));
      const copy=node('span','item-card-copy');copy.append(node('strong','item-name',x.name),node('span','item-meta',(slots[x.slot]||categories[x.classs]||'Gegenstand')+' · Gegenstandsstufe '+(x.level||0)),node('small','item-meta',qualities[x.quality]+' · ID '+x.id));card.append(copy);card.onpointerenter=e=>{if(e.pointerType!=='touch')showHover(x,card);};card.onpointerleave=()=>{if(dismissedAnchor===card)dismissedAnchor=null;delayHide();};card.onfocus=()=>{dismissedAnchor=null;if(card.dataset.touch!=='true')showHover(x,card);};card.onblur=()=>{if(dismissedAnchor===card)dismissedAnchor=null;hideHover();};card.onpointerdown=e=>{card.dataset.touch=String(e.pointerType==='touch');};card.onclick=()=>open(x,card);list.append(card);
    }
  }
  function open(x,button){
    hideHover();opener=button||document.activeElement;const d=$('itemDialog');$('itemDialogTitle').textContent=x.name;$('itemDialogTitle').className='q'+x.quality;
    const body=$('itemDialogContent');body.replaceChildren(icon(x));
    body.append(node('p','',qualities[x.quality]+' · '+(slots[x.slot]||categories[x.classs]||'Gegenstand')),node('p','','Gegenstandsstufe '+(x.level||0)+(x.reqlevel||x.stats.reqlevel?' · Benötigt Stufe '+(x.reqlevel||x.stats.reqlevel):'')));
    const dl=node('dl','item-stats');
    for(const [key,label] of Object.entries(statNames)){const val=x.stats[key]??x[key];if(val!==undefined&&val!==0){dl.append(node('dt','',label),node('dd','',number(val)));}}
    body.append(dl);
    const summary=Array.from(body.children);const full=node('div','item-full-details');body.prepend(full);const selectedId=x.id;d.dataset.itemId=String(selectedId);loadDetails(full,x,()=>d.open&&d.dataset.itemId===String(selectedId),()=>{for(const child of summary)child.remove();});
    if(x.sourcemore?.length){body.append(node('h4','','In der Datenbank aufgeführte Quellen'));const ul=node('ul');for(const source of x.sourcemore){if(source.n)ul.append(node('li','',source.n));}body.append(ul);}
    body.append(node('p','item-disclaimer','Forever-Datenbankeintrag bei Wowhead. Verfügbarkeit, Werte und Fundorte können sich bis zur Beta ändern. Übernommene Classic-Einträge sind keine Bestätigung für Beute in neuen Forever-Raids.'));
    const a=node('a','loot-link','Vollständige Effekte und Quelle bei Wowhead ↗');a.href=link(x);a.target='_blank';a.rel='noopener noreferrer';body.append(a);
    const u=new URL(location.href);u.searchParams.set('item',x.id);u.hash='itemdatenbank';history.replaceState(null,'',u);
    if(!d.open)d.showModal();
  }
  async function start(){
    if(data)return;if(pending)return pending;
    pending=(async()=>{try{
      $('itemLoading').textContent='Itemdatenbank wird geladen …';
      const r=await fetch('forever-items-data.json?v=20260914');if(!r.ok)throw Error('HTTP '+r.status);const incoming=await r.json();if(incoming.items.length!==incoming.count)throw Error('Unvollständige Daten');
      if(language==='en'){const er=await fetch('forever-items-en.json?v=20260914');if(!er.ok)throw Error('English item data unavailable');const english=await er.json();if(Object.keys(english).length!==incoming.count)throw Error('Incomplete English data');for(const x of incoming.items)Object.assign(x,english[x.id]);}
      const sr=await fetch('forever-sets-data.json?v=20260914');if(!sr.ok)throw Error('Set data unavailable');setData=await sr.json();
      data=incoming;for(const x of data.items)x.search=norm(x.name+' '+x.id+' '+(x.sourcemore||[]).map(s=>s.n||'').join(' '));
      for(const [id,label] of Object.entries(categories)){if(data.items.some(x=>x.classs===Number(id))){const o=node('option','',label);o.value=id;$('itemCategory').append(o);}}
      qualities.forEach((label,id)=>{const o=node('option','',label);o.value=id;$('itemQuality').append(o);});
      for(const [id,label] of Object.entries(slots)){const o=node('option','',label);o.value=id;$('itemSlot').append(o);}
      $('itemLoading').hidden=true;initSets();const params=new URL(location.href).searchParams;const requestedSet=setData.sets.find(s=>s.id===Number(params.get('set')));if(requestedSet){setClass=requestedSet.classes?.[0]||0;selectSet(requestedSet);}else setView(params.get('items')==='all'||params.has('item')?'all':'sets');
      const requested=Number(new URL(location.href).searchParams.get('item'));if(requested){const x=data.items.find(x=>x.id===requested);if(x)open(x);}
    }catch(e){$('itemLoading').textContent='Die Itemdatenbank konnte nicht geladen werden. Bitte erneut versuchen.';$('itemRetry').hidden=false;data=null;}finally{pending=null;}})();return pending;
  }
  for(const id of ['itemSearch','itemCategory','itemQuality','itemSlot','itemClass','itemLevelMin','itemLevelMax','itemSort'])$(id).addEventListener(id==='itemSearch'?'input':'change',filter);
  $('itemReset').onclick=()=>{$('itemFilters').reset();filter();};
  $('itemPrevious').onclick=()=>{page--;render();$('itemCount').scrollIntoView({block:'start'});};$('itemNext').onclick=()=>{page++;render();$('itemCount').scrollIntoView({block:'start'});};
  $('itemRetry').onclick=()=>{$('itemRetry').hidden=true;start();};
  $('itemDialogClose').onclick=()=>$('itemDialog').close();
  $('itemDialog').addEventListener('close',()=>{const u=new URL(location.href);u.searchParams.delete('item');history.replaceState(null,'',u);opener?.focus();hideHover();});
  $('itemDialog').addEventListener('click',e=>{if(e.target===$('itemDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  addEventListener('forever-panel',e=>{hideHover();if(e.detail==='itemdatenbank')start();else if($('itemDialog').open)$('itemDialog').close();});
  if(location.hash==='#itemdatenbank')start();
})();
