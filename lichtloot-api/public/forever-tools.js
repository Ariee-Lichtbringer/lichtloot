(() => {
const names={itemdatenbank:'Itemdatenbank',talente:'Talentplaner',berufe:'Berufe & Rezepte',materialrechner:'Materialplanung',favoriten:'Meine Favoriten'};
const main=document.getElementById('main'),host=document.createElement('section');host.id='foreverTools';host.hidden=true;
host.innerHTML='<header class="forever-tools-heading"><div><small>Vorbereiten &amp; entdecken</small><h2 id="foreverToolTitle"></h2></div><a href="#termine">← Zur Raidplanung</a></header><p class="forever-tool-loading" role="status">Werkzeug wird geladen …</p><iframe class="forever-tool-frame" title="Forever-Werkzeug" loading="eager"></iframe>';
main.querySelector('.topbar').after(host);const frame=host.querySelector('iframe'),loading=host.querySelector('.forever-tool-loading');let current='';
function sizeFrame(){if(!host.hidden&&innerWidth>720)frame.style.height=Math.max(420,innerHeight-(frame.getBoundingClientRect().top+scrollY)-24)+'px';}
addEventListener('resize',sizeFrame);
function mark(name){document.querySelectorAll('.sidebar nav a').forEach(a=>{const selected=a.hash==='#'+name;a.classList.toggle('selected',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function open(name,params=location.search,write=false){
 if(!names[name]){host.hidden=true;document.body.classList.remove('forever-tool-mode');mark(name||'termine');return;}
 dispatchEvent(new Event('forever-tool-open'));host.hidden=false;document.body.classList.add('forever-tool-mode');mark(name);document.getElementById('foreverToolTitle').textContent=names[name];frame.title=names[name]+' · GuildLoot Forever';
 const url=new URL('forever.html',location.href);url.search=params;url.searchParams.set('embedded','1');const guild=new URLSearchParams(location.search).get('guild');if(guild)url.searchParams.set('guild',guild);url.hash=name;
 if(write){window.scrollTo({top:0,behavior:'instant'});const parent=new URL(location.href);parent.hash=name;history.pushState(null,'',parent);}
 if(current!==url.href){loading.hidden=false;current=url.href;frame.src=url.href;}
 requestAnimationFrame(()=>{if(write)window.scrollTo(0,0);sizeFrame();});
}
function route(){open(location.hash.slice(1));}
document.querySelectorAll('a[href^="forever.html#"]').forEach(a=>{if(names[a.hash.slice(1)])a.href=a.hash;});
document.addEventListener('click',event=>{const a=event.target.closest('a');if(!a||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const url=new URL(a.href,location.href);if(url.origin!==location.origin)return;const name=url.hash.slice(1);if(names[name]&&(url.pathname.endsWith('/forever.html')||url.pathname===location.pathname)){event.preventDefault();open(name,url.pathname===location.pathname?location.search:url.search,true);}else if(url.pathname===location.pathname&&['termine','charaktere','gruppen'].includes(name)){open(name);}});
frame.addEventListener('load',()=>{loading.hidden=true;try{const url=new URL(frame.contentWindow.location.href);if(url.origin!==location.origin)return;current=url.href;const name=url.hash.slice(1);if(names[name]){document.getElementById('foreverToolTitle').textContent=names[name];mark(name);}}catch{}});
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='forever-tool-navigation')return;const name=event.data.name;if(!names[name])return;loading.hidden=true;sizeFrame();const parent=new URL(location.href);parent.hash=name;history.replaceState(null,'',parent);document.getElementById('foreverToolTitle').textContent=names[name];mark(name);});
addEventListener('hashchange',route);addEventListener('popstate',route);route();
})();
