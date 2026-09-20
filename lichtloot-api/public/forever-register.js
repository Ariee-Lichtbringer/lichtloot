(() => {
const $=id=>document.getElementById(id),base=['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://lichtloot-production.up.railway.app';
function message(t){$('notice').hidden=false;$('notice').textContent=t;}
function sync(){const g=$('guildSelect').value;$('backLink').href='forever-start.html'+(g?'?'+new URLSearchParams({guild:g}):'');}
$('guildSelect').onchange=sync;
fetch(base+'/api/apps-script?action=listGuilds&game=forever').then(r=>r.json()).then(d=>{if(!Array.isArray(d.guilds))throw Error();$('guildSelect').replaceChildren(new Option('Gilde auswählen',''),...d.guilds.map(g=>new Option(g.name,g.slug)));const g=new URLSearchParams(location.search).get('guild');if(d.guilds.some(x=>x.slug===g))$('guildSelect').value=g;sync();}).catch(()=>message('Gilden konnten nicht geladen werden. Bitte lade die Seite neu.'));
$('registerForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const response=await fetch(base+'/api/forever/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))}),d=await response.json();if(!response.ok||!d.success)throw Error(d.error||'Registrierung nicht möglich.');message(d.message);f.reset();f.hidden=true;}catch(err){message(err.message);}finally{b.disabled=false;}};
})();
