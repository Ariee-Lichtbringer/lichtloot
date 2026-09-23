(() => {
'use strict';
const en=window.ForeverI18n?.lang==='en',t=(de,english)=>en?english:de;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const professions={alchemy:['Alchemie','Alchemy'],blacksmithing:['Schmiedekunst','Blacksmithing'],cooking:['Kochkunst','Cooking'],enchanting:['Verzauberkunst','Enchanting'],engineering:['Ingenieurskunst','Engineering'],'first-aid':['Erste Hilfe','First Aid'],leatherworking:['Lederverarbeitung','Leatherworking'],tailoring:['Schneiderei','Tailoring'],mining:['Bergbau','Mining']};
const sources={trainer:['Lehrer','Trainer'],item:['Rezeptgegenstand','Recipe item'],unknown:['Unbekannt','Unknown']};
const link=(label,url)=>{const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
const book=document.getElementById('betaCraftingBook');if(!book)return;
book.className='plan-box';book.append(el('h3',t('Herstellungsbuch · inklusive Lehrerrezepte','Crafting book · including trainer recipes')));
const status=el('p',t('Rezepte werden beim Öffnen geladen.','Recipes load when opened.'));status.setAttribute('role','status');book.append(status);
const controls=el('div');controls.className='recipe-filter-grid';
function field(title,tag){const label=el('label',title),n=el(tag);label.append(n);controls.append(label);return n;}
const search=field(t('Rezept oder Zutat suchen','Find recipe or reagent'),'input');search.type='search';search.id='betaRecipeSearch';
const profession=field(t('Beruf','Profession'),'select');profession.append(new Option(t('Alle Berufe','All professions'),''));for(const [id,names]of Object.entries(professions))profession.append(new Option(names[en?1:0],id));
const learn=field(t('Bezugsquelle','Learn from'),'select');learn.append(new Option(t('Alle Quellen','All sources'),''));for(const[id,names]of Object.entries(sources))learn.append(new Option(names[en?1:0],id));
const skill=field(t('Meine Fertigkeit (optional)','My skill (optional)'),'input');skill.type='number';skill.min='1';skill.max='300';
const changes=field(t('Beta-Änderung','Beta change'),'select');for(const [id,de,english]of [['','Alle','All'],['new','Neu','New'],['changed','Geändert','Changed'],['unchanged','Unverändert','Unchanged']])changes.append(new Option(t(de,english),id));
book.append(controls);const list=el('div');book.append(list);const more=el('button',t('Mehr anzeigen','Show more'));more.type='button';more.hidden=true;book.append(more);
let data=null,loading=false,limit=20;
function draw(){if(!data)return;const q=search.value.trim().toLocaleLowerCase(),max=skill.value===''?null:Number(skill.value);const rows=data.recipes.filter(r=>(!profession.value||r.profession===profession.value)&&(!learn.value||r.learnSource===learn.value)&&(!changes.value||r.status===changes.value)&&(max===null||Number.isFinite(max)&&r.requiredSkill!==null&&r.requiredSkill<=max)&&(!q||(r.name+' '+r.ingredients.map(i=>i.name).join(' ')).toLocaleLowerCase().includes(q)));
 status.textContent=rows.length+' / '+data.recipes.length+t(' Rezepte · Beta-Build ',' recipes · beta build ')+data.build+t(' · Stand ',' · checked ')+data.date;
 list.replaceChildren();for(const r of rows.slice(0,limit)){
 const details=el('details');details.className='plan-box';details.append(el('summary',r.name+' · '+(professions[r.profession]?.[en?1:0]||r.profession)+' · '+t('Fertigkeit ','skill ')+(r.requiredSkill??'—')));
 details.addEventListener('toggle',()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';
 details.append(el('p',t('Gelernt durch: ','Learned from: ')+(sources[r.learnSource]?.[en?1:0]||r.learnSource)),el('p',t('Orange / Gelb / Grün / Grau: ','Orange / Yellow / Green / Grey: ')+r.thresholds.map(x=>x??'—').join(' / ')));
 if(r.outputCount)details.append(el('p',t('Erzeugt pro Herstellung: ','Output per craft: ')+r.outputCount+(r.outputMax?'–'+r.outputMax:'')));
 const ul=el('ul');for(const i of r.ingredients)ul.append(el('li',i.count+' × '+i.name));details.append(ul);
 if(!r.ingredients.length)details.append(el('p',t('Keine Zutatenliste verfügbar; nicht berechenbar.','No ingredient list available; cannot calculate.')));
 for(const item of r.recipeItems)details.append(link(item.name,'https://www.wowhead.com/forever/item='+item.id));
 const f=el('form'),label=el('label',t('Herstellungsvorgänge','Crafting count')),qty=el('input');qty.type='number';qty.min='1';qty.max='999';qty.value='1';qty.required=true;label.append(qty);const add=el('button',t('Zur Einkaufsliste hinzufügen','Add to shopping list'));add.type='submit';add.disabled=!r.ingredients.length;f.append(label,add);f.onsubmit=e=>{e.preventDefault();try{window.ForeverPlanning.addCraft(r,Number(qty.value));}catch(error){status.textContent=error.message;}};details.append(f,link(t('Datenquelle ↗','Data source ↗'),r.source));
 },{once:false});list.append(details);}
 if(!rows.length)list.append(el('p',t('Keine passenden Rezepte.','No matching recipes.')));more.hidden=rows.length<=limit;
}
for(const n of [search,profession,learn,skill,changes])n.addEventListener(n.tagName==='SELECT'?'change':'input',()=>{limit=20;draw();});more.onclick=()=>{limit+=20;draw();};
async function start(){if(data||loading)return;loading=true;try{const r=await fetch('forever-crafting-data.json?v=20260923-beta1');if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();draw();}catch{status.textContent=t('Rezepte konnten nicht geladen werden.','Could not load recipes.');const retry=el('button',t('Erneut versuchen','Retry'));retry.onclick=()=>{retry.remove();start();};book.append(retry);}finally{loading=false;}}
book.append(el('p',t('Aus dem Beta-Client gelesene Community-Daten, nicht für jedes Rezept im Spiel bestätigt. Unbekannte Werte bleiben leer. Rezeptnamen vorerst auf Englisch.','Community data read from the beta client; availability is not verified in game for every recipe. Unknown values stay empty.')));
const planner=document.getElementById('materialrechner');if(planner){const go=el('a',t('Herstellungsbuch mit Lehrerrezepten öffnen →','Open crafting book with trainer recipes →'));go.href='#berufe';go.onclick=e=>{e.preventDefault();window.showPanel('berufe');book.scrollIntoView({block:'start'});start();};planner.prepend(go);}
const update=document.getElementById('foreverChangeLog');if(update){const p=el('p',t('Fehler im Spiel oder auf der Seite? ','Game bug or website issue? '));p.append(link(t('Bekannte Beta-Probleme bei Blizzard ↗','Known beta issues at Blizzard ↗'),'https://us.forums.blizzard.com/en/wow/t/wow-forever-beta-known-issues-september-18/2352687'));update.prepend(p);}
const talent=document.getElementById('talentLoading');if(talent){const p=el('p',t('Talentdaten: Beta-Build 1.60.1.69977 · 23.09.2026. Geänderte Tooltips auf Englisch. Alte Vorschau-Builds werden vor dem Laden geprüft.','Talents: beta build 1.60.1.69977 · 23 Sep 2026. Older preview builds are validated before loading.'));talent.before(p);}
addEventListener('forever-panel',e=>{if(e.detail==='berufe')start();});if(location.hash==='#berufe')start();
})();
