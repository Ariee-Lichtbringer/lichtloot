(function(){
  const CLASS_ICONS={warrior:"krieger.png",krieger:"krieger.png",druid:"druide.png",druide:"druide.png",paladin:"Pala.png",rogue:"schurke.png",schurke:"schurke.png",hunter:"jäger.png",jäger:"jäger.png",jaeger:"jäger.png",priest:"priester.png",priester:"priester.png",mage:"magier.png",magier:"magier.png",warlock:"hexenmeister.png",hexenmeister:"hexenmeister.png"};
  const CLASS_COLORS={Tank:"#2dd4bf",Warrior:"#c79c6e",Paladin:"#f58cba",Rogue:"#fff569",Hunter:"#abd473",Druid:"#ff7d0a",Priest:"#ffffff",Mage:"#69ccf0",Warlock:"#9482c9",Shaman:"#0070de",Unbekannt:"#94a3b8"};
  const CLASS_CANON={warrior:"Warrior",krieger:"Warrior",paladin:"Paladin",pala:"Paladin",rogue:"Rogue",schurke:"Rogue",hunter:"Hunter",jäger:"Hunter",jaeger:"Hunter",druid:"Druid",druide:"Druid",priest:"Priest",priester:"Priest",mage:"Mage",magier:"Mage",warlock:"Warlock",hexenmeister:"Warlock",shaman:"Shaman",schamane:"Shaman"};
  const ROLE_INFO={tank:["🛡️","Tank",0],heal:["💚","Heiler",1],healer:["💚","Heiler",1],melee:["⚔️","Nahkampf",2],range:["🏹","Fernkampf",3],ranged:["🏹","Fernkampf",3],dd:["⚔️","DD",4],flex:["✨","Flex",5]};
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const norm=value=>String(value||"").trim().toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,"");
  const roleInfo=value=>ROLE_INFO[String(value||"flex").trim().toLowerCase()]||ROLE_INFO.flex;
  const statusInfo=value=>{const key=String(value||"signed").toLowerCase();if(key==="bench")return["🪑","Bank","bench",1];if(["late","spät","spaet"].includes(key))return["🕒","Verspätet","late",2];if(["absent","abgemeldet"].includes(key))return["🚫","Abgemeldet","absent",3];if(key==="tentative")return["⚖️","Vorläufig","late",1];return["✅","Angemeldet","signed",0];};
  const prioInfo=row=>{const po=String(row.poApprovalStatus||"").toLowerCase();if(["approved","freigegeben"].includes(po))return["🧳","PO freigegeben","approved"];if(["pending","offen","wartet"].includes(po))return["🧳","PO eingetragen – wartet auf Freigabe","pending"];if(row.hasPrio===true||String(row.hasPrio).toLowerCase()==="true")return["🧳","P1, P2 und/oder P3 gespeichert","prio"];return null;};
  const roleBadge=value=>{const info=roleInfo(value);return `<span class="raid-signup-role-badge role-${esc(String(value||"flex").toLowerCase())}" title="Skillung/Rolle: ${esc(info[1])}"><span aria-hidden="true">${info[0]}</span><span>${esc(info[1])}</span></span>`;};
  function iconFor(className){const file=CLASS_ICONS[String(className||"").trim().toLowerCase()];return file?`<img class="raid-signup-class-icon" src="../images/${encodeURIComponent(file)}" alt="${esc(className)}" onerror="this.outerHTML='◆'">`:'<span class="raid-signup-class-icon" style="display:grid;place-items:center">◆</span>';}
  function currentPlayer(){return norm(document.getElementById("playerName")?.value||document.getElementById("myPriosChar")?.value||"");}
  function render(rows){
    const box=document.getElementById("raidSignupMirrorList"),count=document.getElementById("raidSignupMirrorCount");
    if(!box)return;
    const unique=[],seen=new Set();
    for(const row of rows){const name=row.player||row.char||row.playerName||"",key=norm(name);if(!key||seen.has(key))continue;seen.add(key);unique.push(row);}
    if(count)count.textContent=`${unique.length} Spieler`;
    if(!unique.length){box.innerHTML='<div class="raid-signup-mirror-empty">Noch keine Anmeldungen vorhanden.</div>';return;}
    const order=["Tank","Warrior","Paladin","Rogue","Hunter","Druid","Priest","Mage","Warlock","Shaman","Unbekannt"];
    const labels={Tank:"Tanks",Warrior:"Krieger",Paladin:"Paladine",Rogue:"Schurken",Hunter:"Jäger",Druid:"Druiden",Priest:"Priester",Mage:"Magier",Warlock:"Hexenmeister",Shaman:"Schamanen",Unbekannt:"Weitere"};
    const groups=new Map();
    for(const row of unique){
      const role=String(row.role||"").toLowerCase();
      let key=role==="tank"?"Tank":CLASS_CANON[String(row.className||row.class||"").trim().toLowerCase()]||"Unbekannt";
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    const me=currentPlayer();
    const summary=order.filter(key=>groups.has(key)).map(key=>`<span class="raid-signup-summary-chip">${key==="Tank"?'🛡️':iconFor(key)}<b>${groups.get(key).length}</b> ${esc(labels[key])}</span>`).join("");
    const sections=order.filter(key=>groups.has(key)).map(key=>{
      const players=groups.get(key).sort((a,b)=>String(a.player||a.char||"").localeCompare(String(b.player||b.char||""),"de"));
      const playerRows=players.map(row=>{
        const name=row.player||row.char||row.playerName||"-",status=statusInfo(row.status),prio=prioInfo(row),own=me&&norm(name)===me;
        const attendance=status[2]==="signed"?"":`<span class="raid-signup-attendance ${status[2]}" title="Anmeldestatus: ${esc(status[1])}">${status[0]} ${esc(status[1])}</span>`;
        const suitcase=prio?`<span class="raid-signup-prio-state ${prio[2]}" title="${esc(prio[1])}" aria-label="${esc(prio[1])}">${prio[0]}</span>`:"";
        return `<div class="raid-signup-compact-player ${own?'is-me':''} status-${status[2]}"><span class="raid-signup-player-state ${status[2]}" title="${esc(status[1])}">${status[0]}</span><span class="raid-signup-player-main"><span class="raid-signup-name">${esc(name)}${own?' <em>Du</em>':''}</span><span class="raid-signup-player-details">${roleBadge(row.role)}${attendance}${row.note?`<span class="raid-signup-note" title="${esc(row.note)}">${esc(row.note)}</span>`:''}</span></span>${suitcase}</div>`;
      }).join("");
      return `<section class="raid-signup-class-group" style="--class-color:${CLASS_COLORS[key]||CLASS_COLORS.Unbekannt}"><header>${key==="Tank"?'<span class="raid-signup-shield">🛡️</span>':iconFor(key)}<div><h3>${esc(labels[key])}</h3><span>${players.length} ${players.length===1?'Spieler':'Spieler'}</span></div></header><div class="raid-signup-class-players">${playerRows}</div></section>`;
    }).join("");
    box.innerHTML=`<div class="raid-signup-summary">${summary}</div><div class="raid-signup-status-legend"><span><b class="raid-signup-prio-state prio">🧳</b> P1–P3 gespeichert</span><span><b class="raid-signup-prio-state pending">🧳</b> PO wartet auf Freigabe</span><span><b class="raid-signup-prio-state approved">🧳</b> PO freigegeben</span><span>🪑 Bank</span><span>🕒 Verspätet</span><span>🚫 Abwesend</span></div><div class="raid-signup-class-grid">${sections}</div>`;
  }
  async function load(){const box=document.getElementById("raidSignupMirrorList"),raidId=typeof currentRaidId!=="undefined"?currentRaidId:"",raidName=typeof RAID_NAME!=="undefined"?RAID_NAME:"";if(!box||!raidId)return;box.innerHTML='<div class="raid-signup-mirror-empty">Anmeldungen werden geladen …</div>';try{const result=await apiJsonp({action:"getRaidHelper",raidId,playerPin:document.getElementById("raidPin")?.value||raidId,raid:raidName,t:Date.now()});if(!result?.success)throw new Error(result?.error||"Raid nicht gefunden");render([...(result.signups||[]),...(result.externalSignups||[])]);}catch(error){box.innerHTML=`<div class="raid-signup-mirror-empty">${esc(error.message||"Anmeldungen konnten nicht geladen werden.")}</div>`;}}
  function close(){document.querySelector(".raid-signup-modal-backdrop")?.remove();}
  function open(){close();const backdrop=document.createElement("div");backdrop.className="raid-signup-modal-backdrop";backdrop.innerHTML='<section class="raid-signup-modal" role="dialog" aria-modal="true"><div class="raid-signup-modal-head"><div><h2>👥 Raidanmeldungen</h2><div id="raidSignupMirrorCount" class="raid-signup-mirror-count">0 Spieler</div></div><button class="raid-signup-modal-close" type="button" aria-label="Schließen">×</button></div><div id="raidSignupMirrorList" class="raid-signup-mirror-list"><div class="raid-signup-mirror-empty">Anmeldungen werden geladen …</div></div></section>';backdrop.querySelector(".raid-signup-modal-close").onclick=close;backdrop.addEventListener("click",event=>{if(event.target===backdrop)close();});document.body.appendChild(backdrop);load();}
  function init(){const groups=[...document.querySelectorAll(".raid-start-group")],group=groups.find(item=>item.querySelector(".raid-start-group-toggle")?.textContent.includes("Raidorga"));if(group&&!document.querySelector(".raid-signup-nav-tab")){const button=document.createElement("button");button.type="button";button.className="raid-signup-nav-tab";button.innerHTML='<span><img src="../images/dashboard-icons/raidlead.jpg" alt="">Raidanmeldungen</span><span>›</span>';button.onclick=open;group.insertAdjacentElement("afterend",button);}const original=window.loadPrioCheck;if(typeof original==="function")window.loadPrioCheck=async function(){const result=await original.apply(this,arguments);if(document.getElementById("raidSignupMirrorList"))await load();return result;};}
  window.openRaidSignupMirror=open;window.loadRaidSignupMirror=load;if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
