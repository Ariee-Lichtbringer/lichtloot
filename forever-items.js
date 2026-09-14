(() => {
  'use strict';
  const language=window.ForeverI18n?.lang||'de';
  const $ = id => document.getElementById(id);
  const qualities = ['Schlecht','Gewöhnlich','Ungewöhnlich','Selten','Episch','Legendär','Artefakt','Erbstück','WoW-Marke'];
  const categories = {0:'Verbrauchbar',1:'Behälter',2:'Waffe',4:'Rüstung',5:'Reagenz',6:'Munition',7:'Handwerksmaterial',9:'Rezept',10:'Währung',11:'Köcher',12:'Questgegenstand',13:'Schlüssel',15:'Verschiedenes',16:'Glyphe',18:'WoW-Marke'};
  const slots = {1:'Kopf',2:'Hals',3:'Schulter',4:'Hemd',5:'Brust',6:'Taille',7:'Beine',8:'Füße',9:'Handgelenke',10:'Hände',11:'Finger',12:'Schmuck',13:'Einhändig',14:'Schild',15:'Distanz',16:'Rücken',17:'Zweihändig',18:'Tasche',19:'Wappenrock',20:'Robe',21:'Waffenhand',22:'Schildhand',23:'Nebenhand',24:'Munition',25:'Wurfwaffe',26:'Distanz',28:'Relikt'};
  const statNames = {agi:'Beweglichkeit',str:'Stärke',sta:'Ausdauer',int:'Intelligenz',spi:'Willenskraft',armor:'Rüstung',dura:'Haltbarkeit',health:'Gesundheit',mana:'Mana',dps:'Schaden pro Sekunde',speed:'Waffentempo',dmgmin1:'Minimaler Schaden',dmgmax1:'Maximaler Schaden',atkpwr:'Angriffskraft',mleatkpwr:'Nahkampfangriffskraft',rgdatkpwr:'Distanzangriffskraft',splpwr:'Zaubermacht',spldmg:'Zauberschaden',splheal:'Heilung',manargn:'Mana alle 5 Sekunden',healthrgn:'Gesundheit alle 5 Sekunden',def:'Verteidigung',block:'Blockchance',blockrtng:'Blockwertung',blockvalue:'Blockwert',dodgertng:'Ausweichwertung',dodge:'Ausweichchance',parry:'Parierchance',critstrkrtng:'Kritische Trefferwertung',mlecritstrkrtng:'Kritische Nahkampftrefferwertung',splcritstrkrtng:'Kritische Zaubertrefferwertung',hitrtng:'Trefferwertung',mlehitrtng:'Nahkampftrefferwertung',splhitrtng:'Zaubertrefferwertung',firres:'Feuerwiderstand',frores:'Frostwiderstand',natres:'Naturwiderstand',shares:'Schattenwiderstand',arcres:'Arkanwiderstand',holres:'Heiligwiderstand'};
  let data, pending, filtered=[],page=1, opener;
  const perPage=48;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de');
  const number=n=>Number(n).toLocaleString(language==='de'?'de-DE':'en-US',{maximumFractionDigits:2});
  const link=x=>'https://www.wowhead.com/forever/'+(language==='de'?'de/':'')+'item='+x.id;
  function icon(x){const img=node('img','item-icon');img.src='https://wow.zamimg.com/images/wow/icons/large/'+encodeURIComponent(x.icon)+'.jpg';img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';};return img;}
  function filter(){
    if(!data)return;
    const q=norm($('itemSearch').value).trim(),cat=$('itemCategory').value,quality=$('itemQuality').value,slot=$('itemSlot').value,cl=Number($('itemClass').value),min=$('itemLevelMin').value,max=$('itemLevelMax').value;
    filtered=data.items.filter(x=>(!q||x.search.includes(q))&&(!cat||String(x.classs)===cat)&&(!quality||String(x.quality)===quality)&&(!slot||String(x.slot)===slot)&&(!cl||!x.stats.classes||(x.stats.classes&cl))&&(min===''||Number(x.level||0)>=Number(min))&&(max===''||Number(x.level||0)<=Number(max)));
    const sort=$('itemSort').value;
    filtered.sort(sort==='level-desc'?(a,b)=>(b.level||0)-(a.level||0)||a.name.localeCompare(b.name,'de'):sort==='quality-desc'?(a,b)=>b.quality-a.quality||(b.level||0)-(a.level||0):sort==='id'?(a,b)=>a.id-b.id:(a,b)=>a.name.localeCompare(b.name,'de'));
    page=1;render();
  }
  function render(){
    const list=$('itemResults');list.replaceChildren();
    $('itemCount').textContent=number(filtered.length)+' von '+number(data.count)+' Gegenständen';
    const pages=Math.max(1,Math.ceil(filtered.length/perPage));page=Math.min(page,pages);
    $('itemPage').textContent='Seite '+page+' von '+pages;$('itemPrevious').disabled=page===1;$('itemNext').disabled=page===pages;
    if(!filtered.length){list.append(node('p','items-empty','Keine passenden Gegenstände. Ändere die Suche oder setze die Filter zurück.'));return;}
    for(const x of filtered.slice((page-1)*perPage,page*perPage)){
      const card=node('button','item-card q'+x.quality);card.type='button';card.append(icon(x));
      const copy=node('span','item-card-copy');copy.append(node('strong','item-name',x.name),node('span','item-meta',(slots[x.slot]||categories[x.classs]||'Gegenstand')+' · Gegenstandsstufe '+(x.level||0)),node('small','item-meta',qualities[x.quality]+' · ID '+x.id));card.append(copy);card.onclick=()=>open(x,card);list.append(card);
    }
  }
  function open(x,button){
    opener=button||document.activeElement;const d=$('itemDialog');$('itemDialogTitle').textContent=x.name;$('itemDialogTitle').className='q'+x.quality;
    const body=$('itemDialogContent');body.replaceChildren(icon(x));
    body.append(node('p','',qualities[x.quality]+' · '+(slots[x.slot]||categories[x.classs]||'Gegenstand')),node('p','','Gegenstandsstufe '+(x.level||0)+(x.reqlevel||x.stats.reqlevel?' · Benötigt Stufe '+(x.reqlevel||x.stats.reqlevel):'')));
    const dl=node('dl','item-stats');
    for(const [key,label] of Object.entries(statNames)){const val=x.stats[key]??x[key];if(val!==undefined&&val!==0){dl.append(node('dt','',label),node('dd','',number(val)));}}
    body.append(dl);
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
      data=incoming;for(const x of data.items)x.search=norm(x.name+' '+x.id+' '+(x.sourcemore||[]).map(s=>s.n||'').join(' '));
      for(const [id,label] of Object.entries(categories)){if(data.items.some(x=>x.classs===Number(id))){const o=node('option','',label);o.value=id;$('itemCategory').append(o);}}
      qualities.forEach((label,id)=>{const o=node('option','',label);o.value=id;$('itemQuality').append(o);});
      for(const [id,label] of Object.entries(slots)){const o=node('option','',label);o.value=id;$('itemSlot').append(o);}
      $('itemLoading').hidden=true;filter();
      const requested=Number(new URL(location.href).searchParams.get('item'));if(requested){const x=data.items.find(x=>x.id===requested);if(x)open(x);}
    }catch(e){$('itemLoading').textContent='Die Itemdatenbank konnte nicht geladen werden. Bitte erneut versuchen.';$('itemRetry').hidden=false;data=null;}finally{pending=null;}})();return pending;
  }
  for(const id of ['itemSearch','itemCategory','itemQuality','itemSlot','itemClass','itemLevelMin','itemLevelMax','itemSort'])$(id).addEventListener(id==='itemSearch'?'input':'change',filter);
  $('itemReset').onclick=()=>{$('itemFilters').reset();filter();};
  $('itemPrevious').onclick=()=>{page--;render();$('itemCount').scrollIntoView({block:'start'});};$('itemNext').onclick=()=>{page++;render();$('itemCount').scrollIntoView({block:'start'});};
  $('itemRetry').onclick=()=>{$('itemRetry').hidden=true;start();};
  $('itemDialogClose').onclick=()=>$('itemDialog').close();
  $('itemDialog').addEventListener('close',()=>{const u=new URL(location.href);u.searchParams.delete('item');history.replaceState(null,'',u);opener?.focus();});
  $('itemDialog').addEventListener('click',e=>{if(e.target===$('itemDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  addEventListener('forever-panel',e=>{if(e.detail==='itemdatenbank')start();else if($('itemDialog').open)$('itemDialog').close();});
  if(location.hash==='#itemdatenbank')start();
})();
