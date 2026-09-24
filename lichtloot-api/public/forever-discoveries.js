(() => {
  const host=document.getElementById('itemdatenbank');if(!host)return;
  const section=document.createElement('section');section.className='card';
  const title=document.createElement('h3');title.textContent='Neue Funde aus dem Spiel';
  const info=document.createElement('p');info.textContent='Von Forever-Spielern per Add-on gemeldete Drops. Diese Funde ergänzen den Datenbestand; sie sind noch nicht redaktionell geprüft.';
  const button=document.createElement('button');button.textContent='Itemfunde laden';
  const search=document.createElement('input');search.placeholder='Item oder Fundort suchen';search.setAttribute('aria-label','Itemfunde durchsuchen');search.hidden=true;
  const results=document.createElement('div');results.setAttribute('aria-live','polite');
  section.append(title,info,button,search,results);host.prepend(section);
  let items=[];
  const render=()=>{
    const term=search.value.toLocaleLowerCase();const matches=items.filter(x=>(x.item_name+' '+x.zone_name+' '+x.source_name).toLocaleLowerCase().includes(term));
    results.replaceChildren();
    for(const item of matches.slice(0,100)){
      const row=document.createElement('p'),link=document.createElement('a');link.textContent=item.item_name+' · #'+item.item_id;
      link.href='https://www.wowhead.com/forever/item='+Number(item.item_id);link.target='_blank';link.rel='noopener noreferrer';
      row.append(link,document.createTextNode(' — '+(item.source_name||'Quelle nicht benannt')+' · '+(item.zone_name||'Fundort unbekannt')+' · Build '+item.client_build));
      const meta=item.metadata||{};if(meta.itemLevel!==undefined)row.append(document.createTextNode(' · Itemlevel '+meta.itemLevel));
      results.append(row);
    }
    if(!matches.length)results.textContent='Noch keine passenden Itemfunde.';
    if(matches.length>100){const note=document.createElement('p');note.textContent='Die ersten 100 Treffer werden angezeigt. Bitte Suche eingrenzen.';results.append(note);}
  };
  search.oninput=render;
  button.onclick=async()=>{
    button.disabled=true;results.textContent='Itemfunde werden geladen …';
    try{const response=await fetch((['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://lichtloot-production.up.railway.app')+'/api/forever/discoveries',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const data=await response.json();if(!data.success)throw Error();items=data.items;search.hidden=false;render();}
    catch{results.textContent='Itemfunde konnten nicht geladen werden. Bitte später erneut versuchen.';}
    finally{button.disabled=false;}
  };
})();
