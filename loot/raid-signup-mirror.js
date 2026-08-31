(function(){
  let allSignupRows=[],raidSignupEnabled=null,raidLeadAuthenticated=false,raidLeadPin="",raidLeadMaster=false,activeCharacterPickerOpen=false,lastPageSignupLoadKey="",lastPageSignupLoadAt=0,pageSignupLoadedRaidId="",manualCharacterSelection=false,characterSyncInProgress=false,autoCharacterSelectionKey="",prioSignupSummaryRaidId="",prioSignupSummaryEnabled=false,prioSignupSummaryRows=[];
  const CLASS_ICONS={warrior:"classicon_warrior",krieger:"classicon_warrior",druid:"classicon_druid",druide:"classicon_druid",paladin:"classicon_paladin",rogue:"classicon_rogue",schurke:"classicon_rogue",hunter:"classicon_hunter",jäger:"classicon_hunter",jaeger:"classicon_hunter",priest:"classicon_priest",priester:"classicon_priest",mage:"classicon_mage",magier:"classicon_mage",warlock:"classicon_warlock",hexenmeister:"classicon_warlock",shaman:"classicon_shaman",schamane:"classicon_shaman"};
  const CLASS_COLORS={Tank:"#2dd4bf",Warrior:"#c79c6e",Paladin:"#f58cba",Rogue:"#fff569",Hunter:"#abd473",Druid:"#ff7d0a",Priest:"#ffffff",Mage:"#69ccf0",Warlock:"#9482c9",Shaman:"#0070de",Unbekannt:"#94a3b8"};
  const CLASS_CANON={warrior:"Warrior",krieger:"Warrior",paladin:"Paladin",pala:"Paladin",rogue:"Rogue",schurke:"Rogue",hunter:"Hunter",jäger:"Hunter",jaeger:"Hunter",druid:"Druid",druide:"Druid",priest:"Priest",priester:"Priest",mage:"Mage",magier:"Mage",warlock:"Warlock",hexenmeister:"Warlock",shaman:"Shaman",schamane:"Shaman"};
  const characterColor=className=>CLASS_COLORS[CLASS_CANON[String(className||"").trim().toLowerCase()]||"Unbekannt"]||CLASS_COLORS.Unbekannt;
  const ROLE_INFO={tank:["🛡️","Tank",0],heal:["💚","Heiler",1],healer:["💚","Heiler",1],melee:["⚔️","Nahkampf",2],range:["🏹","Fernkampf",3],ranged:["🏹","Fernkampf",3],dd:["⚔️","DD",4],flex:["✨","Flex",5]};
  const CLASS_SPECS={krieger:[["Tank","tank","inv_shield_06"],["Waffen","dd","ability_warrior_savageblow"],["Furor","dd","ability_warrior_innerrage"]],warrior:[["Tank","tank","inv_shield_06"],["Waffen","dd","ability_warrior_savageblow"],["Furor","dd","ability_warrior_innerrage"]],paladin:[["Heilig","heal","spell_holy_holybolt"],["Schutz","tank","inv_shield_06"],["Vergeltung","dd","spell_holy_auraoflight"]],schurke:[["Meucheln","dd","ability_rogue_eviscerate"],["Kampf","dd","ability_backstab"],["Täuschung","dd","ability_stealth"]],rogue:[["Meucheln","dd","ability_rogue_eviscerate"],["Kampf","dd","ability_backstab"],["Täuschung","dd","ability_stealth"]],jäger:[["Tierherrschaft","dd","ability_hunter_beasttaming"],["Treffsicherheit","dd","ability_marksmanship"],["Überleben","dd","ability_hunter_camouflage"]],hunter:[["Tierherrschaft","dd","ability_hunter_beasttaming"],["Treffsicherheit","dd","ability_marksmanship"],["Überleben","dd","ability_hunter_camouflage"]],druide:[["Heilung","heal","spell_nature_healingtouch"],["Wiederherstellung","heal","spell_nature_healingtouch"],["Tank","tank","ability_racial_bearform"],["Wildheit","dd","ability_druid_catform"],["Wildheit DD","dd","ability_druid_catform"],["Gleichgewicht","dd","spell_nature_starfall"]],druid:[["Heilung","heal","spell_nature_healingtouch"],["Wiederherstellung","heal","spell_nature_healingtouch"],["Tank","tank","ability_racial_bearform"],["Wildheit","dd","ability_druid_catform"],["Wildheit DD","dd","ability_druid_catform"],["Gleichgewicht","dd","spell_nature_starfall"]],priester:[["Heilig","heal","spell_holy_guardianspirit"],["Disziplin","heal","spell_holy_powerwordshield"],["Schatten","dd","spell_shadow_shadowwordpain"]],priest:[["Heilig","heal","spell_holy_guardianspirit"],["Disziplin","heal","spell_holy_powerwordshield"],["Schatten","dd","spell_shadow_shadowwordpain"]],magier:[["Feuer","dd","spell_fire_firebolt02"],["Arkan","dd","spell_holy_magicalsentry"],["Frost","dd","spell_frost_frostbolt02"]],mage:[["Feuer","dd","spell_fire_firebolt02"],["Arkan","dd","spell_holy_magicalsentry"],["Frost","dd","spell_frost_frostbolt02"]],hexenmeister:[["Dämonologie","dd","spell_shadow_metamorphosis"],["Zerstörung","dd","spell_shadow_rainoffire"],["Gebrechen","dd","spell_shadow_deathcoil"]],warlock:[["Dämonologie","dd","spell_shadow_metamorphosis"],["Zerstörung","dd","spell_shadow_rainoffire"],["Gebrechen","dd","spell_shadow_deathcoil"]],schamane:[["Heilung","heal","spell_holy_flashheal"],["Verstärkung","dd","ability_shaman_stormstrike"],["Elementar","dd","spell_nature_lightningshield"]],shaman:[["Heilung","heal","spell_holy_flashheal"],["Verstärkung","dd","ability_shaman_stormstrike"],["Elementar","dd","spell_nature_lightningshield"]]};
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const norm=value=>String(value||"").trim().toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,"");
  const activeSignupRaidId=()=>{const params=new URLSearchParams(location.search);return params.get("signupOnly")==="1"?(params.get("raidId")||""):(typeof currentRaidId!=="undefined"?currentRaidId:"");};
  const roleInfo=value=>ROLE_INFO[String(value||"flex").trim().toLowerCase()]||ROLE_INFO.flex;
  const statusInfo=value=>{const key=String(value||"signed").toLowerCase();if(key==="bench")return["🪑","Bank","bench",1];if(key==="tentative")return["⚖️","Vorläufig","tentative",1];if(["late","spät","spaet"].includes(key))return["🕒","Verspätet","late",2];if(["absent","abgemeldet"].includes(key))return["🚫","Abgemeldet","absent",3];return["✅","Angemeldet","signed",0];};
  const prioInfo=row=>{const po=String(row.poApprovalStatus||"").toLowerCase();if(["approved","freigegeben"].includes(po))return["../images/lootbags/beutegrun.jpg","PO freigegeben","approved"];if(["pending","offen","wartet"].includes(po))return["../images/lootbags/beuteorange.jpg","PO eingetragen – wartet auf Freigabe","pending"];if(row.hasPrio===true||String(row.hasPrio).toLowerCase()==="true")return["../images/lootbags/beutelilia.jpg","P1–P3 eingetragen","prio"];return null;};
  const roleBadge=value=>{const info=roleInfo(value);return `<span class="raid-signup-role-badge role-${esc(String(value||"flex").toLowerCase())}" title="Skillung/Rolle: ${esc(info[1])}"><span aria-hidden="true">${info[0]}</span><span>${esc(info[1])}</span></span>`;};
  function specializationInfo(row){const raw=String(row.note||row.spec||row.specialization||"").replace(/^\s*Skillung\s*:\s*/i,"").trim(),rawKey=norm(raw),role=String(row.role||"flex").toLowerCase(),classKey=String(row.className||row.class||"").trim().toLowerCase(),specs=CLASS_SPECS[classKey]||[],match=specs.find(item=>{const key=norm(item[0]);return key===rawKey||(key&&rawKey&&(rawKey.includes(key)||key.includes(rawKey)));})||(role==="tank"?specs.find(item=>item[1]==="tank"):null)||(role==="heal"||role==="healer"?specs.find(item=>item[1]==="heal"):null);if(match)return{label:raw||match[0],role:match[1],icon:match[2]};if(rawKey.includes("wiederherstellung")||rawKey.includes("restoration")||rawKey==="resto")return{label:raw,role:"heal",icon:"spell_nature_healingtouch"};if(rawKey.includes("schutz")||rawKey.includes("tank"))return{label:raw,role:"tank",icon:classKey.includes("druid")||classKey.includes("druide")?"ability_racial_bearform":"inv_shield_06"};if(rawKey.includes("furor")||rawKey.includes("fury"))return{label:raw,role:"dd",icon:"ability_warrior_innerrage"};if(rawKey.includes("waffen")||rawKey.includes("arms"))return{label:raw,role:"dd",icon:"ability_warrior_savageblow"};return raw?{label:raw,role,icon:role==="tank"?"inv_shield_06":"inv_misc_questionmark"}:null;}
  function specializationBadge(row){const spec=specializationInfo(row);return spec?`<span class="raid-signup-spec-badge" title="Skillung: ${esc(spec.label)}"><img src="${specIconUrl(spec.icon)}" alt=""><span>${esc(spec.label)}</span></span>`:"";}
  function iconFor(className){const icon=CLASS_ICONS[String(className||"").trim().toLowerCase()];return icon?`<img class="raid-signup-class-icon" src="https://wow.zamimg.com/images/wow/icons/large/${encodeURIComponent(icon)}.jpg" alt="${esc(className)}" loading="lazy" onerror="this.outerHTML='◆'">`:'<span class="raid-signup-class-icon" style="display:grid;place-items:center">◆</span>';}
  function currentPlayer(){return norm(document.getElementById("playerName")?.value||document.getElementById("myPriosChar")?.value||"");}
  function currentPlayerName(){return String(document.querySelector("#raidSignupMirrorCharacters [data-character].is-selected")?.dataset.character||document.getElementById("raidSignupPageCharacter")?.value||document.getElementById("playerName")?.value||document.getElementById("myPriosChar")?.value||"").trim();}
  function currentPlayerPin(){return String((typeof getStoredLichtLootPlayerPin==="function"?getStoredLichtLootPlayerPin():"")||document.getElementById("playerPin")?.value||"").trim();}
  function activeCharacterData(){
    const selected=typeof lichtlootSelectedCharacter!=="undefined"&&lichtlootSelectedCharacter ? lichtlootSelectedCharacter : null;
    const characters=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters) ? lichtlootLoggedInCharacters : [];
    const currentName=String(document.getElementById("playerName")?.value||"").trim();
    return selected || characters.find(char=>norm(char?.name)===norm(currentName)) || null;
  }
  function activePrioPin(){return String(document.getElementById("raidPin")?.value||new URLSearchParams(location.search).get("pin")||"").trim();}
  function activeRaidLabel(){return String(typeof RAID_NAME!=="undefined"?RAID_NAME:new URLSearchParams(location.search).get("raid")||"Raid").trim().toUpperCase();}
  function activeCharacterPrioState(name){
    const rows=typeof currentPublishedPrios!=="undefined"&&Array.isArray(currentPublishedPrios)?currentPublishedPrios:[];
    const row=rows.find(item=>norm(item?.Spieler||item?.player||item?.char)===norm(name));
    return {loaded:rows.length>0,exists:Boolean(row&&(row.P1||row.P2||row.P3||row.P0||row.P0Plus||row.poItem))};
  }
  function changeActiveCharacter(){
    activeCharacterPickerOpen=!activeCharacterPickerOpen;
    const panel=document.getElementById("lootActiveCharacterPanel");
    if(panel) panel.dataset.signature="";
    renderActiveCharacterPanel();
  }
  function applyLoggedInCharacter(index,manual=false){
    if(typeof selectLoggedInCharacter!=="function") return;
    const characters=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],char=characters[index];
    if(!char)return;
    characterSyncInProgress=true;
    selectLoggedInCharacter(index);
    const signupSelect=document.getElementById("raidSignupPageCharacter");
    if(signupSelect&&signupSelect.value!==char.name){signupSelect.value=char.name;signupSelect.dispatchEvent(new Event("change",{bubbles:true}));}
    syncPageSignupState();
    characterSyncInProgress=false;
    if(manual)manualCharacterSelection=true;
  }
  function chooseActiveCharacter(index){
    applyLoggedInCharacter(index,true);
    activeCharacterPickerOpen=false;
    const panel=document.getElementById("lootActiveCharacterPanel");
    if(panel) panel.dataset.signature="";
    renderActiveCharacterPanel();
  }
  function bindPageCharacterSync(){
    const select=document.getElementById("raidSignupPageCharacter");
    if(!select||select.dataset.activeCharacterSyncBound)return;
    select.dataset.activeCharacterSyncBound="true";
    select.addEventListener("change",()=>{if(characterSyncInProgress)return;const characters=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],index=characters.findIndex(char=>norm(char?.name)===norm(select.value));if(index>=0)applyLoggedInCharacter(index,true);});
  }
  function autoSelectRaidCharacter(){
    if(manualCharacterSelection)return;
    const raidId=activeSignupRaidId(),characters=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[];
    if(!raidId||pageSignupLoadedRaidId!==String(raidId)||!characters.length)return;
    const signupNames=new Set(allSignupRows.filter(row=>statusInfo(row.status||row.signupStatus)[2]!=="absent").map(row=>norm(row.player||row.char||row.playerName||row.characterName)).filter(Boolean));
    const withSignup=characters.map((char,index)=>({char,index,hasSignup:signupNames.has(norm(char.name)),hasPrio:activeCharacterPrioState(char.name).exists})).filter(item=>item.hasSignup);
    const withPrio=characters.map((char,index)=>({char,index,hasSignup:false,hasPrio:activeCharacterPrioState(char.name).exists})).filter(item=>item.hasPrio);
    const selected=(withSignup.sort((a,b)=>Number(b.hasPrio)-Number(a.hasPrio))[0])||withPrio[0];
    if(!selected)return;
    const key=`${raidId}|${norm(selected.char.name)}`;
    if(autoCharacterSelectionKey===key)return;
    autoCharacterSelectionKey=key;
    applyLoggedInCharacter(selected.index,false);
  }
  function hideLegacyCharacterSelection(){
    document.querySelector(".login-character-panel")?.classList.add("loot-legacy-character-panel");
    const drop=document.getElementById("selectedCharacterDrop");
    drop?.classList.add("loot-legacy-character-drop");
    if(drop?.previousElementSibling?.tagName==="LABEL") drop.previousElementSibling.classList.add("loot-legacy-character-label");
  }
  function reorganizeLootHeaderControls(){
    document.getElementById("playerStatus")?.classList.add("loot-status-source");
    const button=document.querySelector(".plundermeister-login-btn"),raids=document.getElementById("lootSidebarCurrentRaids");
    if(button&&raids&&!raids.querySelector(".loot-sidebar-raids-loading")&&button.parentElement!==raids){button.classList.add("loot-sidebar-plundermeister");raids.appendChild(button);}
    if(raids&&!document.getElementById("lootGuildSwitchButton")){
      const switcher=document.createElement("div");
      switcher.id="lootGuildSwitcher";
      switcher.className="loot-sidebar-guild-switcher";
      const guildButton=document.createElement("button");
      guildButton.id="lootGuildSwitchButton";
      guildButton.type="button";
      guildButton.className="loot-sidebar-guild-switch";
      guildButton.setAttribute("aria-haspopup","listbox");
      guildButton.setAttribute("aria-expanded","false");
      guildButton.innerHTML=lootGuildTriggerMarkup();
      guildButton.onclick=openLootGuildSwitchPopup;
      const menu=document.createElement("div");
      menu.id="lootGuildSwitchMenu";
      menu.className="loot-sidebar-guild-menu hidden";
      menu.setAttribute("role","listbox");
      menu.setAttribute("aria-label","LootGilde wechseln");
      switcher.append(guildButton,menu);
      raids.appendChild(switcher);
    }
  }

  function storedLoginForGuild(slug){
    const key=`lichtlootPlayerPin_${String(slug||"").trim().toLowerCase()}`;
    try{return String(sessionStorage.getItem(key)||localStorage.getItem(key)||"").trim();}catch(error){return "";}
  }
  function lootGuildName(guild){const slug=String(guild?.slug||"").toLowerCase();return slug==="lichtloot"?"Lichtbringer":String(guild?.name||guild?.lootName||guild?.slug||"LootGilde");}
  function lootGuildLogo(guild){if(typeof guildLogoUrl==="function")return guildLogoUrl(guild);return String(guild?.logoUrl||"../images/guild-defaults/default-logo.png");}
  function lootGuildTriggerMarkup(){const guild=typeof currentGuildInfo!=="undefined"?currentGuildInfo:null;return `<img src="${esc(lootGuildLogo(guild))}" alt=""><span><small>Aktive LootGilde · wechseln</small><strong>${esc(lootGuildName(guild||{slug:typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot"}))}</strong></span><i aria-hidden="true">●<b>⌄</b></i>`;}
  function closeLootGuildSwitchPopup(){const root=document.getElementById("lootGuildSwitcher"),menu=document.getElementById("lootGuildSwitchMenu"),button=document.getElementById("lootGuildSwitchButton");root?.classList.remove("is-open");menu?.classList.add("hidden");button?.setAttribute("aria-expanded","false");}
  async function openSelectedLootGuild(slug){
    const feedback=document.getElementById("lootGuildSwitchFeedback"),button=document.getElementById("lootGuildSwitchButton");
    if(!slug)return;
    document.querySelectorAll(".loot-sidebar-guild-option").forEach(option=>option.disabled=true);
    if(feedback)feedback.textContent="Aktive Raids werden geladen …";
    try{
      const result=await apiJsonp({action:"getActiveRaids",guild:slug,t:Date.now()});
      if(!result?.success)throw new Error(result?.error||"Raids konnten nicht geladen werden.");
      const today=new Date();today.setHours(0,0,0,0);
      const rows=[...(result.allRaids||result.raids||result.entries||result.activeRaids||[])]
        .map(row=>({row,key:sidebarRaidKey(row.raid||row.raidName||row.name||row.raidId||row.id)}))
        .filter(item=>item.key&&(!sidebarRaidDate(item.row)||sidebarRaidTimestamp(item.row)>=today.getTime()))
        .sort((a,b)=>sidebarRaidTimestamp(a.row)-sidebarRaidTimestamp(b.row));
      if(!rows.length)throw new Error("In dieser LootGilde gibt es aktuell keinen offenen Raid.");
      const selected=rows[0],freeKeys=["other","scholomance","lbrs","ubrs","brd","strath-live"],isFree=freeKeys.includes(selected.key);
      const target=new URL(isFree?"bwl-loot.html":`${selected.key}-loot.html`,window.location.href);
      target.searchParams.set("guild",slug);
      if(isFree){target.searchParams.set("signupOnly","1");target.searchParams.set("raidId",String(selected.row.raidId||selected.row.id||sidebarRaidPin(selected.row)||""));}
      else if(sidebarRaidPin(selected.row))target.searchParams.set("pin",sidebarRaidPin(selected.row));
      window.location.assign(target.href);
    }catch(error){if(feedback)feedback.textContent=error.message||"LootGilde konnte nicht geöffnet werden.";document.querySelectorAll(".loot-sidebar-guild-option").forEach(option=>option.disabled=false);if(button)button.disabled=false;}
  }
  async function openLootGuildSwitchPopup(event){
    event?.stopPropagation();
    const root=document.getElementById("lootGuildSwitcher"),menu=document.getElementById("lootGuildSwitchMenu"),button=document.getElementById("lootGuildSwitchButton");
    if(!root||!menu||!button)return;
    button.innerHTML=lootGuildTriggerMarkup();
    const opening=menu.classList.contains("hidden");
    if(!opening){closeLootGuildSwitchPopup();return;}
    root.classList.add("is-open");menu.classList.remove("hidden");button.setAttribute("aria-expanded","true");
    menu.innerHTML='<div class="loot-guild-switch-feedback">Gilden werden geladen …</div>';
    try{
      const result=await apiJsonp({action:"listGuilds",t:Date.now()});
      const current=String(typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot").toLowerCase();
      const guilds=(result?.guilds||[]).filter(guild=>{const slug=String(guild?.slug||"").toLowerCase();return storedLoginForGuild(slug)||(slug===current&&typeof getStoredLichtLootPlayerPin==="function"&&getStoredLichtLootPlayerPin());});
      menu.innerHTML=guilds.length?guilds.map(guild=>{const slug=String(guild.slug||""),active=slug.toLowerCase()===current;return `<button class="loot-sidebar-guild-option${active?' is-current':''}" type="button" role="option" aria-selected="${active}" data-guild="${esc(slug)}"><img src="${esc(lootGuildLogo(guild))}" alt=""><span><strong>${esc(lootGuildName(guild))}</strong><small>${active?'Aktuell ausgewählt':'Zu dieser LootGilde wechseln'}</small></span><i aria-hidden="true">${active?'✓':''}</i></button>`;}).join("")+'<div id="lootGuildSwitchFeedback" class="loot-guild-switch-feedback"></div>':'<div class="loot-guild-switch-feedback">In diesem Browser ist kein SpielerLogin für eine LootGilde gespeichert.</div>';
      menu.querySelectorAll("[data-guild]").forEach(option=>option.onclick=()=>openSelectedLootGuild(option.dataset.guild));
    }catch(error){menu.innerHTML=`<div class="loot-guild-switch-feedback">${esc(error.message||"Gilden konnten nicht geladen werden.")}</div>`;}
  }

  function installProtectedPrioSearch(){
    const original=window.filterPriosBySearch;
    if(typeof original!=="function"||original.__protectedPrioSearch)return;
    const protectedFilter=function(prios){
      if(currentPublishedMode)return original.call(this,prios);
      const query=String(document.getElementById("prioSearch")?.value||"").trim().toLowerCase();
      if(!query)return prios;
      return (prios||[]).filter(prio=>{
        const p0Item=typeof lichtlootPrioIsP0==="function"&&lichtlootPrioIsP0(prio)&&typeof lichtlootPrioP0Item==="function"?lichtlootPrioP0Item(prio):"";
        return [prio?.Spieler,prio?.Server,prio?.Klasse,p0Item].join(" ").toLowerCase().includes(query);
      });
    };
    protectedFilter.__protectedPrioSearch=true;
    window.filterPriosBySearch=protectedFilter;
  }

  function activeRaidSignupNames(){
    const excluded=new Set(["absent","abgemeldet","declined"]),seen=new Set();
    return (prioSignupSummaryRows||[]).filter(row=>!excluded.has(String(row?.status||row?.signupStatus||"").toLowerCase())).map(row=>String(row?.player||row?.char||row?.playerName||row?.characterName||row?.name||"").trim()).filter(name=>{const key=norm(name);if(!key||seen.has(key))return false;seen.add(key);return true;});
  }
  function activeRaidMissingSignupRows(){
    const prioNames=new Set((typeof currentPublishedPrios!=="undefined"?currentPublishedPrios:[]).map(prio=>norm(prio?.Spieler||prio?.player||prio?.char)).filter(Boolean)),seen=new Set(),excluded=new Set(["absent","abgemeldet","declined"]);
    return (prioSignupSummaryRows||[]).filter(row=>{const name=String(row?.player||row?.char||row?.playerName||row?.characterName||row?.name||"").trim(),key=norm(name);if(!key||seen.has(key)||excluded.has(String(row?.status||row?.signupStatus||"").toLowerCase())||prioNames.has(key))return false;seen.add(key);return true;});
  }
  function renderPrioSignupSummary(){
    const existing=document.getElementById("lootPrioSignupSummary");
    if(!prioSignupSummaryEnabled){existing?.remove();return;}
    const title=document.querySelector("#prioCard h2");
    if(!title)return;
    const missingRows=activeRaidMissingSignupRows();
    const signature=missingRows.map(row=>[row?.player||row?.char,row?.className||row?.class,row?.note||row?.spec].join("|")).join(":");
    if(existing?.dataset.signature===signature)return;
    existing?.remove();
    const box=document.createElement("section");
    box.id="lootPrioSignupSummary";
    box.className="loot-prio-signup-summary";
    box.dataset.signature=signature;
    box.innerHTML=`<div class="${missingRows.length?"has-missing":"complete"}"><strong>Fehlende Prioeinträge (${missingRows.length})</strong><span class="loot-missing-prio-chips">${missingRows.length?missingRows.map(row=>{const name=String(row?.player||row?.char||row?.playerName||row?.characterName||row?.name||""),className=String(row?.className||row?.class||""),spec=specializationInfo(row),fallbackIcon=CLASS_ICONS[className.toLowerCase()]||"inv_misc_questionmark";return `<span class="loot-missing-prio-chip"><img src="${specIconUrl(spec?.icon||fallbackIcon)}" alt=""><span><b style="color:${characterColor(className)}">${esc(name)}</b><small>${esc(spec?.label||className||"Skillung unbekannt")}</small></span></span>`;}).join(""):"Alle angemeldeten Charaktere haben eine Prio."}</span></div>`;
    title.insertAdjacentElement("afterend",box);
  }
  async function loadPrioSignupSummary(){
    const raidId=String(typeof currentRaidId!=="undefined"?currentRaidId:"").trim();
    if(!raidId){prioSignupSummaryEnabled=false;prioSignupSummaryRows=[];prioSignupSummaryRaidId="";renderPrioSignupSummary();return;}
    if(prioSignupSummaryRaidId===raidId){renderPrioSignupSummary();return;}
    prioSignupSummaryRaidId=raidId;
    try{
      const result=await apiJsonp({action:"getRaidHelper",raidId,playerPin:document.getElementById("raidPin")?.value||raidId,t:Date.now()});
      prioSignupSummaryEnabled=Boolean(result?.success&&result?.raid?.raidHelperEnabled!==false&&!result?.raid?.p0Only);
      prioSignupSummaryRows=prioSignupSummaryEnabled?[...(result.signups||[]),...(result.externalSignups||[])]:[];
    }catch(error){prioSignupSummaryEnabled=false;prioSignupSummaryRows=[];}
    renderPrioSignupSummary();
  }

  function compactLootReleaseSummary(){
    const box=document.getElementById("selectedCharacterPoReleases");
    if(!box)return;
    const raidKey=String([...document.body.classList].find(name=>name.startsWith("raid-"))||"").slice(5).toUpperCase();
    const aliases={NAXX:["NAXX","NAXXRAMAS"],MC:["MC","MOLTEN CORE"],BWL:["BWL","BLACKWING LAIR"],AQ40:["AQ40","AHN'QIRAJ 40"],AQ20:["AQ20","AHN'QIRAJ 20"],ZG:["ZG","ZUL GURUB"],ONY:["ONY","ONYXIA"]}[raidKey]||[raidKey];
    box.querySelectorAll(".loot-release-list").forEach(list=>{
      const chips=[...list.querySelectorAll(".loot-release-chip")];
      chips.forEach(chip=>chip.classList.toggle("loot-release-current",aliases.some(alias=>String(chip.textContent||"").trim().toUpperCase().startsWith(alias))));
    });
    const titles=[...box.querySelectorAll(".loot-release-title")];
    const releaseTitle=titles.find(title=>!title.classList.contains("loot-attendance-title"));
    if(releaseTitle)releaseTitle.textContent="P0-Freigabe";
  }
  function renderActiveCharacterPanel(){
    const panel=document.getElementById("lootActiveCharacterPanel");
    if(!panel) return;
    const char=activeCharacterData();
    const name=String(char?.name||currentPlayerName()||"").trim();
    const className=String(char?.className||char?.class||document.getElementById("playerClass")?.value||"").trim();
    const server=String(char?.server||document.getElementById("playerServer")?.value||"").trim();
    const playerLogin=currentPlayerPin();
    const raid=activeRaidLabel();
    const prioPin=activePrioPin();
    const icon=CLASS_ICONS[className.toLowerCase()]||"inv_misc_questionmark";
    const characters=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[];
    const prioState=activeCharacterPrioState(name);
    const signature=[name,className,server,playerLogin,raid,prioPin,prioState.loaded,prioState.exists,activeCharacterPickerOpen,characters.map(item=>[item?.name,item?.className,item?.server].join("~")).join(",")].join("|");
    if(panel.dataset.signature===signature) return;
    panel.dataset.signature=signature;
    const choices=activeCharacterPickerOpen?`<div class="loot-active-character-picker"><div class="loot-active-character-picker-title">Hauptcharakter und Twinks</div>${characters.length?characters.map((item,index)=>{const itemName=String(item?.name||"").trim(),itemClass=String(item?.className||item?.class||"").trim(),itemServer=String(item?.server||"").trim(),itemIcon=CLASS_ICONS[itemClass.toLowerCase()]||"inv_misc_questionmark",selected=norm(itemName)===norm(name),isMain=item?.mainChar&&norm(item.mainChar)===norm(itemName);return `<button type="button" class="loot-active-character-option${selected?" is-selected":""}" data-character-index="${index}"><img src="${specIconUrl(itemIcon)}" alt=""><span><strong style="color:${characterColor(itemClass)}">${esc(itemName)}</strong><small>${esc([itemClass,itemServer].filter(Boolean).join(" · ")||"Charakter")}</small></span>${selected?'<b>✓</b>':isMain?'<em>MAIN</em>':'<em>TWINK</em>'}</button>`;}).join(""):'<div class="loot-active-character-empty">Keine Charaktere gefunden. Bitte zuerst mit dem SpielerLogin anmelden.</div>'}</div>`:"";
    panel.innerHTML=`<div class="loot-active-character-title">Aktiver Charakter</div>${name?`<div class="loot-active-character-state">✓ Für diese Prio ausgewählt</div><div class="loot-active-character-main"><img src="${specIconUrl(icon)}" alt="${esc(className||"Klasse")}"><div><strong>${esc(name)}</strong><span>${esc([className,server].filter(Boolean).join(" · ")||"Charakter")}</span></div><b aria-label="Ausgewählt">✓</b></div><div class="loot-active-character-meta"><span>SpielerLogin: <strong>${esc(playerLogin||"aktiv")}</strong></span><span>${esc(raid)}${prioPin?` · PrioPIN: ${esc(prioPin)}`:""}</span></div>`:`<div class="loot-active-character-empty">Noch kein Charakter ausgewählt. Bitte zuerst mit deinem SpielerLogin anmelden.</div>`}<button type="button" class="loot-active-character-change">${activeCharacterPickerOpen?"Auswahl schließen":"↪ Charakter wechseln"}</button>${choices}`;
    if(name){const state=document.createElement("div");state.className=`loot-active-character-prio ${prioState.exists?"has-prio":"no-prio"}`;state.textContent=prioState.exists?`✓ Aktuelle Prio für ${raid} vorhanden`:`⚠ Keine aktuelle Prio für ${raid} gewählt`;panel.querySelector(".loot-active-character-main")?.insertAdjacentElement("afterend",state);}
    panel.querySelector(".loot-active-character-change").onclick=changeActiveCharacter;
    panel.querySelectorAll("[data-character-index]").forEach(button=>button.onclick=()=>chooseActiveCharacter(Number(button.dataset.characterIndex)));
  }
  function mountActiveCharacterPanel(){
    if(document.getElementById("lootActiveCharacterPanel")) return;
    const panel=document.createElement("aside");
    panel.id="lootActiveCharacterPanel";
    panel.className="loot-active-character-panel";
    panel.setAttribute("aria-live","polite");
    const lootCard=document.getElementById("lootCard");
    const host=document.getElementById("mainGrid")||document.querySelector("body > .overlay")||document.body;
    if(lootCard?.parentElement===host) lootCard.insertAdjacentElement("afterend",panel);
    else host.insertBefore(panel,host.firstChild);
    hideLegacyCharacterSelection();
    reorganizeLootHeaderControls();
    renderActiveCharacterPanel();
  }
  function signupRow(row){
    const name=row.player||row.char||row.playerName||"-",status=statusInfo(row.status),prio=prioInfo(row),own=currentPlayer()&&norm(name)===currentPlayer();
    const attendance=status[2]==="signed"?"":`<span class="raid-signup-attendance ${status[2]}" title="Anmeldestatus: ${esc(status[1])}">${status[0]} ${esc(status[1])}</span>`,spec=specializationInfo(row);
    const suitcase=prio?`<span class="raid-signup-prio-state ${prio[2]}" title="${esc(prio[1])}" aria-label="${esc(prio[1])}"><img src="${esc(prio[0])}" alt="Lootbag"><span>${esc(prio[1])}</span></span>`:"";
    const signupId=row.id||row.signupId||"",leadActions=raidLeadAuthenticated&&signupId?`<span class="raid-signup-lead-actions"><button type="button" title="Angemeldet" onclick="window.raidSignupLeadStatus('${esc(signupId)}','signed')">✅</button><button type="button" title="Bank" onclick="window.raidSignupLeadStatus('${esc(signupId)}','bench')">🪑</button><button type="button" title="Verspätet" onclick="window.raidSignupLeadStatus('${esc(signupId)}','late')">🕒</button><button type="button" title="Abwesend" onclick="window.raidSignupLeadStatus('${esc(signupId)}','absent')">🚫</button></span>`:"";
    return `<div class="raid-signup-compact-player ${own?'is-me':''} status-${status[2]}"><span class="raid-signup-player-state ${status[2]}" title="${esc(status[1])}">${status[0]}</span><span class="raid-signup-player-main"><span class="raid-signup-name">${esc(name)}${own?' <em>Du</em>':''}</span><span class="raid-signup-player-details">${specializationBadge(row)}${attendance}${row.note&&!spec?`<span class="raid-signup-note" title="${esc(row.note)}">${esc(row.note)}</span>`:''}</span></span><span class="raid-signup-row-actions">${suitcase}${leadActions}</span></div>`;
  }
  CLASS_SPECS.paladin=[["Tank","tank","inv_shield_06"],["Heilig","heal","spell_holy_holybolt"],["Vergeltung","dd","spell_holy_auraoflight"]];
  function applySearch(){render(allSignupRows);}
  function render(rows){
    const box=document.getElementById("raidSignupMirrorList"),count=document.getElementById("raidSignupMirrorCount");
    if(!box)return;
    const query=norm(document.getElementById("raidSignupMirrorSearch")?.value||"");
    const unique=[],seen=new Set();
    for(const row of rows){const name=row.player||row.char||row.playerName||"",key=norm(name);if(!key||seen.has(key))continue;seen.add(key);const haystack=norm([name,row.className||row.class,row.role,row.status,row.note].join(" "));if(query&&!haystack.includes(query))continue;unique.push(row);}
    if(count)count.textContent=`${unique.length} Spieler`;
    if(!unique.length){box.innerHTML='<div class="raid-signup-mirror-empty">Noch keine Anmeldungen vorhanden.</div>';return;}
    const order=["Tank","Warrior","Paladin","Rogue","Hunter","Druid","Priest","Mage","Warlock","Shaman","Unbekannt"];
    const labels={Tank:"Tanks",Warrior:"Krieger",Paladin:"Paladine",Rogue:"Schurken",Hunter:"Jäger",Druid:"Druiden",Priest:"Priester",Mage:"Magier",Warlock:"Hexenmeister",Shaman:"Schamanen",Unbekannt:"Weitere"};
    const active=unique.filter(row=>statusInfo(row.status)[2]==="signed");
    const inactive=unique.filter(row=>statusInfo(row.status)[2]!=="signed");
    const roleCounts={tank:0,melee:0,ranged:0,heal:0};active.forEach(row=>{const role=String(row.role||"").toLowerCase(),classKey=CLASS_CANON[String(row.className||row.class||"").trim().toLowerCase()]||"";if(role==="tank")roleCounts.tank++;else if(["heal","healer"].includes(role))roleCounts.heal++;else if(["Warrior","Paladin","Rogue","Druid"].includes(classKey))roleCounts.melee++;else roleCounts.ranged++;});
    const roleSummary=`<div class="raid-signup-role-counter"><span>🛡️ Tanks <b>${roleCounts.tank}</b></span><span>⚔️ Nahkampf <b>${roleCounts.melee}</b></span><span>🏹 Fernkampf <b>${roleCounts.ranged}</b></span><span>✚ Heiler <b>${roleCounts.heal}</b></span></div>`;
    const groups=new Map();
    for(const row of active){
      const role=String(row.role||"").toLowerCase();
      let key=role==="tank"?"Tank":CLASS_CANON[String(row.className||row.class||"").trim().toLowerCase()]||"Unbekannt";
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    const me=currentPlayer();
    const summary=order.filter(key=>groups.has(key)).map(key=>`<span class="raid-signup-summary-chip">${key==="Tank"?'🛡️':iconFor(key)}<b>${groups.get(key).length}</b> ${esc(labels[key])}</span>`).join("");
    const sections=order.filter(key=>groups.has(key)).map(key=>{
      const players=groups.get(key).sort((a,b)=>String(a.player||a.char||"").localeCompare(String(b.player||b.char||""),"de"));
      const playerRows=players.map(signupRow).join("");
      return `<section class="raid-signup-class-group" style="--class-color:${CLASS_COLORS[key]||CLASS_COLORS.Unbekannt}"><header>${key==="Tank"?'<span class="raid-signup-shield">🛡️</span>':iconFor(key)}<div><h3>${esc(labels[key])}</h3><span>${players.length} ${players.length===1?'Spieler':'Spieler'}</span></div></header><div class="raid-signup-class-players">${playerRows}</div></section>`;
    }).join("");
    const statusOrder=[["bench","🪑 Bank"],["tentative","⚖️ Vorläufig"],["late","🕒 Verspätet"],["absent","🚫 Abwesend"]];
    const inactiveSections=statusOrder.map(([status,label])=>{const players=inactive.filter(row=>statusInfo(row.status)[2]===status).sort((a,b)=>String(a.player||a.char||"").localeCompare(String(b.player||b.char||""),"de"));return players.length?`<section class="raid-signup-inactive-group status-${status}"><h3>${label} (${players.length})</h3><div>${players.map(signupRow).join("")}</div></section>`:"";}).join("");
    const bankCount=unique.filter(row=>statusInfo(row.status)[2]==="bench").length,tentativeCount=unique.filter(row=>statusInfo(row.status)[2]==="tentative").length,lateCount=unique.filter(row=>statusInfo(row.status)[2]==="late").length;
    box.innerHTML=`<div class="raid-signup-total">👥 Fest angemeldet: <b>${active.length}</b> · 🪑 Bank <b>(${bankCount})</b> · ⚖️ Vorläufig <b>(${tentativeCount})</b>${lateCount?` · 🕒 Verspätet <b>(${lateCount})</b>`:""}</div>${roleSummary}<div class="raid-signup-summary">${summary||'<span class="raid-signup-muted">Keine fest Angemeldeten in dieser Auswahl.</span>'}</div><div class="raid-signup-status-legend"><span><b class="raid-signup-prio-state prio"><img src="../images/lootbags/beutelilia.jpg" alt=""></b> P1–P3 eingetragen</span><span><b class="raid-signup-prio-state pending"><img src="../images/lootbags/beuteorange.jpg" alt=""></b> PO eingetragen</span><span><b class="raid-signup-prio-state approved"><img src="../images/lootbags/beutegrun.jpg" alt=""></b> PO freigegeben</span><span>🪑 Bank</span><span>⚖️ Vorläufig</span><span>🕒 Verspätet</span><span>🚫 Abwesend</span></div><div class="raid-signup-class-grid">${sections}</div>${inactiveSections?`<div class="raid-signup-inactive">${inactiveSections}</div>`:""}`;
  }
  function syncPageSignupState(){const select=document.getElementById("raidSignupPageStatus"),character=document.getElementById("raidSignupPageCharacter"),feedback=document.getElementById("raidSignupPageFeedback");if(!select||!character)return;if(!select.querySelector('option[value=""]'))select.insertAdjacentHTML("afterbegin",'<option value="">⚪ Nicht angemeldet</option>');const row=allSignupRows.find(item=>norm(item.player||item.char||item.playerName||item.characterName)===norm(character.value));if(row){const status=statusInfo(row.status||row.signupStatus);select.value=status[2];if(feedback)feedback.innerHTML=`Aktueller Status: <strong>${status[0]} ${esc(status[1])}</strong>`;}else{select.value="";if(feedback)feedback.innerHTML='<strong>⚪ Nicht angemeldet</strong> – beim Speichern wird eine neue Anmeldung erstellt.';}}
  function refreshPageSignupState(){const raidId=activeSignupRaidId(),now=Date.now();if(!raidId)return;if(raidId!==lastPageSignupLoadKey||now-lastPageSignupLoadAt>30000){lastPageSignupLoadKey=raidId;lastPageSignupLoadAt=now;load();}}
  async function load(){const box=document.getElementById("raidSignupMirrorList"),raidId=activeSignupRaidId(),raidName=typeof RAID_NAME!=="undefined"?RAID_NAME:"";if(!raidId)return;if(box)box.innerHTML='<div class="raid-signup-mirror-empty">Anmeldungen werden geladen …</div>';try{const result=await apiJsonp({action:"getRaidHelper",raidId,playerPin:document.getElementById("raidPin")?.value||raidId,raid:raidName,t:Date.now()});if(!result?.success)throw new Error(result?.error||"Raid nicht gefunden");allSignupRows=[...(result.signups||[]),...(result.externalSignups||[])];pageSignupLoadedRaidId=String(raidId);syncPageSignupState();autoSelectRaidCharacter();if(box)render(allSignupRows);}catch(error){if(box)box.innerHTML=`<div class="raid-signup-mirror-empty">${esc(error.message||"Anmeldungen konnten nicht geladen werden.")}</div>`;}}
  async function raidLeadLogin(){const pin=document.getElementById("raidSignupLeadPin")?.value.trim()||"",feedback=document.getElementById("raidSignupLeadFeedback"),raidId=String(activeSignupRaidId());if(!pin){if(feedback)feedback.textContent="Bitte LeadPIN eingeben.";return;}if(feedback)feedback.textContent="PIN wird geprüft …";try{const result=await apiJsonp({action:"validateLeadPin",leadPin:pin,raidId,allowMaster:"true",t:Date.now()});if(!result?.success)throw new Error(result?.error||"Gildenleiter-/LeadPIN ist nicht gültig.");raidLeadAuthenticated=true;raidLeadPin=pin;raidLeadMaster=result.managerMode==="master";sessionStorage.setItem(`raidSignupLeadPin_${raidId}`,pin);if(feedback)feedback.textContent=raidLeadMaster?"✓ Gildenleiter-Funktionen freigeschaltet.":"✓ Raidlead-Funktionen freigeschaltet.";document.getElementById("raidSignupLeadLogin")?.classList.add("is-authenticated");render(allSignupRows);}catch(error){raidLeadAuthenticated=false;raidLeadPin="";raidLeadMaster=false;if(feedback)feedback.textContent=error.message||"PIN konnte nicht geprüft werden.";}}
  async function setRaidLeadStatus(signupId,status){if(!raidLeadAuthenticated||!raidLeadPin)return;const feedback=document.getElementById("raidSignupLeadFeedback"),labels={signed:"angemeldet",bench:"auf die Bank gesetzt",late:"als verspätet markiert",absent:"als abwesend markiert"};if(feedback)feedback.textContent="Status wird gespeichert …";try{const auth=raidLeadMaster?{masterCode:raidLeadPin}:{leadPin:raidLeadPin},result=await apiJsonp({action:"guildUpdateRaidHelperSignup",signupId,signupStatus:status,...auth,notifyMessage:`${raidLeadMaster?"Gildenleitung":"Raidlead"} hat den Status auf ${labels[status]||status} geändert.`,t:Date.now()});if(!result?.success)throw new Error(result?.error||"Status konnte nicht gespeichert werden.");if(feedback)feedback.textContent=result.noticeQueued?"✓ Status gespeichert und Spieler im Discord informiert.":"✓ Status gespeichert. Discord-Raidanmelder wird aktualisiert.";await load();}catch(error){if(feedback)feedback.textContent=error.message||"Status konnte nicht gespeichert werden.";}}
  async function saveOwnSignup(){
    const raidId=activeSignupRaidId(),raidName=typeof RAID_NAME!=="undefined"?RAID_NAME:"",playerPin=currentPlayerPin(),char=currentPlayerName();
    const feedback=document.getElementById("raidSignupMirrorFeedback"),button=document.getElementById("raidSignupMirrorSave");
    if(!playerPin||!char){document.querySelectorAll("#raidSignupMirrorFeedback,#raidSignupPageFeedback").forEach(node=>node.textContent="Bitte zuerst mit deinem SpielerLogin anmelden und einen Charakter auswählen.");document.getElementById("raidSignupPageSave")?.removeAttribute("disabled");return;}
    if(button)button.disabled=true;document.querySelectorAll("#raidSignupMirrorFeedback,#raidSignupPageFeedback").forEach(node=>node.textContent="Anmeldung wird gespeichert …");
    const status=document.getElementById("raidSignupMirrorStatus")?.value||document.getElementById("raidSignupPageStatus")?.value||"signed",specSelect=document.getElementById("raidSignupMirrorSpec")||document.getElementById("raidSignupPageSpec"),role=specSelect?.selectedOptions?.[0]?.dataset.role||"flex",note=specSelect?.value?`Skillung: ${specSelect.value}`:"";
    try{const result=await apiJsonp({action:"saveRaidSignup",raidId,raid:raidName,playerPin,char,signupStatus:status,signupRole:role,note,source:"loot_page",t:Date.now()});if(!result?.success)throw new Error(result?.error||"Anmeldung konnte nicht gespeichert werden.");document.querySelectorAll("#raidSignupMirrorFeedback,#raidSignupPageFeedback").forEach(node=>node.textContent=result.refreshQueued?"✓ Angemeldet. Der Discord-Raidanmelder wird aktualisiert.":"✓ Anmeldung gespeichert.");await load();}catch(error){document.querySelectorAll("#raidSignupMirrorFeedback,#raidSignupPageFeedback").forEach(node=>node.textContent=error.message||"Anmeldung konnte nicht gespeichert werden.");}finally{if(button)button.disabled=false;document.getElementById("raidSignupPageSave")?.removeAttribute("disabled");}
  }
  const specIconUrl=icon=>`https://wow.zamimg.com/images/wow/icons/large/${encodeURIComponent(icon||"inv_misc_questionmark")}.jpg`;
  const classIconUrl=className=>{const icon=CLASS_ICONS[String(className||"").trim().toLowerCase()];return icon?`https://wow.zamimg.com/images/wow/icons/large/${encodeURIComponent(icon)}.jpg`:"";};
  function decorateCharacterControls(){document.querySelectorAll("#characterButtons .character-chip").forEach(chip=>{if(chip.querySelector(".lichtloot-class-icon"))return;const className=chip.querySelector("small")?.textContent?.trim()||"",url=classIconUrl(className);if(!url)return;const img=document.createElement("img");img.className="lichtloot-class-icon";img.src=url;img.alt=className;img.style.cssText="width:22px;height:22px;border-radius:5px;margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,.25)";chip.prepend(img);chip.style.color=characterColor(className);});const select=document.getElementById("raidSignupPageCharacter");if(select){const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],char=chars.find(item=>item.name===select.value),url=classIconUrl(char?.className);select.style.color=characterColor(char?.className);select.style.fontWeight="900";select.style.paddingLeft=url?"40px":"10px";select.style.backgroundImage=url?`url('${url}')`:"";select.style.backgroundSize="25px 25px";select.style.backgroundPosition="8px center";select.style.backgroundRepeat="no-repeat";if(!select.dataset.classStyleBound){select.dataset.classStyleBound="true";select.addEventListener("change",decorateCharacterControls);}}}
  function raidSignupMeta(){const names={mc:"Molten Core",bwl:"Blackwing Lair",aq20:"Ahn'Qiraj 20",aq40:"Ahn'Qiraj 40",zg:"Zul'Gurub",ony:"Onyxia",naxx:"Naxxramas"};const key=String(typeof RAID_NAME!=="undefined"?RAID_NAME:"").toLowerCase(),name=String(typeof currentRaidName!=="undefined"&&currentRaidName?currentRaidName:(names[key]||key||"Raid")),rawDate=String(typeof currentRaidDate!=="undefined"?currentRaidDate:""),time=String(typeof currentRaidTime!=="undefined"?currentRaidTime:"");let date=rawDate;if(/^\d{4}-\d{2}-\d{2}/.test(rawDate)){const parts=rawDate.slice(0,10).split("-");date=`${parts[2]}.${parts[1]}.${parts[0]}`;}return [name,date,time?`${time.slice(0,5)} Uhr`:""].filter(Boolean).join(" · ");}
  const characterControlStyle=document.createElement("style");characterControlStyle.textContent="#raidSignupPageCharacter{padding-left:10px!important;text-indent:36px!important;background-position:9px center!important;background-size:25px 25px!important;background-repeat:no-repeat!important}#raidSignupPageCharacter option{text-indent:0!important;padding-left:8px!important}";document.head.appendChild(characterControlStyle);
  function upgradeSignupCharacterPicker(){const select=document.getElementById("raidSignupPageCharacter");if(!select||select.dataset.customCharacterPicker)return;select.dataset.customCharacterPicker="true";select.classList.add("raid-signup-spec-native");const picker=document.createElement("div");picker.className="raid-signup-spec-picker";const button=document.createElement("button");button.type="button";button.className="raid-signup-spec-button";const menu=document.createElement("div");menu.className="raid-signup-spec-menu hidden";picker.append(button,menu);select.insertAdjacentElement("afterend",picker);const sync=()=>{const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],selected=chars.find(char=>char.name===select.value),url=classIconUrl(selected?.className);button.style.color=characterColor(selected?.className);button.innerHTML=`${url?`<img src="${url}" alt="">`:""}<span>${esc(select.selectedOptions[0]?.textContent||"Charakter auswählen")}</span><b>⌄</b>`;};const render=()=>{const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[];menu.innerHTML=chars.map(char=>`<button type="button" data-character-name="${esc(char.name)}" style="color:${characterColor(char.className)}"><img src="${classIconUrl(char.className)}" alt=""><span>${esc(char.name)} – ${esc(char.className||"")} ${char.server?`(${esc(char.server)})`:""}</span></button>`).join("");menu.querySelectorAll("[data-character-name]").forEach(item=>item.onclick=()=>{select.value=item.dataset.characterName;select.dispatchEvent(new Event("change",{bubbles:true}));menu.classList.add("hidden");sync();});sync();};button.onclick=()=>{render();menu.classList.toggle("hidden");};render();}
  function choosePageSpec(index){const select=document.getElementById("raidSignupPageSpec"),menu=document.getElementById("raidSignupPageSpecMenu");if(!select)return;select.selectedIndex=Number(index)||0;const option=select.selectedOptions[0],button=document.getElementById("raidSignupPageSpecButton");if(button)button.innerHTML=`<img src="${specIconUrl(option?.dataset.icon)}" alt=""><span>${esc(option?.value||"Skillung")}</span><b>⌄</b>`;menu?.classList.add("hidden");}
  function togglePageSpecMenu(){document.getElementById("raidSignupPageSpecMenu")?.classList.toggle("hidden");}
  function syncPageSpecs(){const charSelect=document.getElementById("raidSignupPageCharacter"),specSelect=document.getElementById("raidSignupPageSpec"),menu=document.getElementById("raidSignupPageSpecMenu");if(!charSelect||!specSelect)return;const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],char=chars.find(item=>item.name===charSelect.value),specs=CLASS_SPECS[String(char?.className||"").trim().toLowerCase()]||[["Flex","flex","inv_misc_questionmark"]];specSelect.innerHTML=specs.map(([label,role,icon])=>`<option value="${esc(label)}" data-role="${esc(role)}" data-icon="${esc(icon)}">${esc(label)}</option>`).join("");if(menu)menu.innerHTML=specs.map(([label,role,icon],index)=>`<button type="button" onclick="window.chooseRaidSignupSpec(${index})"><img src="${specIconUrl(icon)}" alt=""><span>${esc(label)}</span></button>`).join("");choosePageSpec(0);syncPageSignupState();}
  function syncPageCharacters(){const select=document.getElementById("raidSignupPageCharacter");if(!select)return;const previous=select.value,current=String(document.getElementById("playerName")?.value||"").trim();const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[];select.innerHTML=chars.length?chars.map(char=>`<option value="${esc(char.name)}" ${char.name===previous||(!previous&&char.name===current)?"selected":""}>${esc(char.name)}${char.className?` – ${esc(char.className)}`:""}${char.server?` (${esc(char.server)})`:""}</option>`).join(""):'<option value="">Bitte zuerst mit dem SpielerLogin anmelden</option>';syncPageSpecs();}
  function selectMirrorCharacter(button){document.querySelectorAll("#raidSignupMirrorCharacters [data-character]").forEach(item=>item.classList.toggle("is-selected",item===button));syncMirrorSpecs();}
  function syncMirrorCharacters(){const box=document.getElementById("raidSignupMirrorCharacters");if(!box)return;const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],current=String(document.getElementById("raidSignupPageCharacter")?.value||document.getElementById("playerName")?.value||"").trim();box.innerHTML=chars.length?chars.map((char,index)=>`<button type="button" data-character="${esc(char.name)}" class="raid-signup-character-chip ${char.name===current||(!current&&index===0)?"is-selected":""}" style="--character-color:${characterColor(char.className)}"><strong>${esc(char.name)}</strong>${char.className?`<span>${esc(char.className)}</span>`:""}${char.server?`<small>${esc(char.server)}</small>`:""}</button>`).join(""):'<span class="raid-signup-muted">Bitte zuerst mit dem SpielerLogin anmelden.</span>';box.querySelectorAll("[data-character]").forEach(button=>button.onclick=()=>selectMirrorCharacter(button));}
  function chooseMirrorSpec(index){const select=document.getElementById("raidSignupMirrorSpec"),menu=document.getElementById("raidSignupMirrorSpecMenu");if(!select)return;select.selectedIndex=Number(index)||0;const option=select.selectedOptions[0],button=document.getElementById("raidSignupMirrorSpecButton");if(button)button.innerHTML=`<img src="${specIconUrl(option?.dataset.icon)}" alt=""><span>${esc(option?.value||"Skillung")}</span><b>⌄</b>`;menu?.classList.add("hidden");}
  function syncMirrorSpecs(){const select=document.getElementById("raidSignupMirrorSpec"),menu=document.getElementById("raidSignupMirrorSpecMenu"),selectedName=document.querySelector("#raidSignupMirrorCharacters [data-character].is-selected")?.dataset.character;if(!select)return;const chars=typeof lichtlootLoggedInCharacters!=="undefined"&&Array.isArray(lichtlootLoggedInCharacters)?lichtlootLoggedInCharacters:[],char=chars.find(item=>item.name===selectedName),specs=CLASS_SPECS[String(char?.className||"").trim().toLowerCase()]||[["Flex","flex","inv_misc_questionmark"]];select.innerHTML=specs.map(([label,role,icon])=>`<option value="${esc(label)}" data-role="${esc(role)}" data-icon="${esc(icon)}">${esc(label)}</option>`).join("");if(menu)menu.innerHTML=specs.map(([label,role,icon],index)=>`<button type="button" onclick="window.chooseRaidSignupMirrorSpec(${index})"><img src="${specIconUrl(icon)}" alt=""><span>${esc(label)}</span></button>`).join("");chooseMirrorSpec(0);}
  function applyRaidSignupAvailability(){const enabled=raidSignupEnabled===true;const box=document.getElementById("raidSignupPageBox");if(box){box.classList.toggle("is-disabled",!enabled);box.querySelectorAll("select,button").forEach(control=>control.disabled=!enabled);const feedback=box.querySelector("#raidSignupPageFeedback");if(feedback)feedback.textContent=enabled?"Die Anmeldung erscheint anschließend automatisch im Discord-Raidanmelder.":"Die Raidanmeldung ist von der Gildenleitung auf den Lootseiten deaktiviert.";}const own=document.querySelector(".raid-signup-own");if(own){own.classList.toggle("is-disabled",!enabled);own.querySelectorAll("select,button").forEach(control=>control.disabled=!enabled);const feedback=own.querySelector("#raidSignupMirrorFeedback");if(feedback&&!enabled)feedback.textContent="Von der Gildenleitung deaktiviert.";}}
  async function loadRaidSignupAvailability(){const guild=String(typeof currentGuildSlug==="function"?currentGuildSlug():"").toLowerCase();raidSignupEnabled=guild!=="lichtloot";applyRaidSignupAvailability();try{const result=await apiJsonp({action:"getRaidSignupPageSettings",t:Date.now()});if(result?.success)raidSignupEnabled=Boolean(result.enabled);}catch(_error){}applyRaidSignupAvailability();return raidSignupEnabled;}
  function sidebarRaidKey(value){const raw=String(value||"").trim().toLowerCase();if(raw.includes("scholo"))return"scholomance";if(raw.includes("lbrs"))return"lbrs";if(raw.includes("ubrs"))return"ubrs";if(raw==="brd"||raw.includes("blackrock depths"))return"brd";if(raw.includes("strath")&&raw.includes("live"))return"strath-live";if(raw==="other"||raw.startsWith("other-"))return"other";if(raw.includes("naxx"))return"naxx";if(raw.includes("blackwing")||raw.includes("bwl"))return"bwl";if(raw.includes("molten")||raw==="mc"||raw.startsWith("mc-"))return"mc";if(raw.includes("aq40")||raw.includes("qiraj 40"))return"aq40";if(raw.includes("aq20")||raw.includes("qiraj 20"))return"aq20";if(raw.includes("zul")||raw==="zg"||raw.startsWith("zg-"))return"zg";if(raw.includes("ony"))return"ony";return"";}
  function sidebarRaidDate(row){return String(row.raidDate||row.datum||row.date||row.Datum||"").slice(0,10);}
  function sidebarRaidTime(row){return String(row.raidTime||row.uhrzeit||row.time||row.Uhrzeit||"").slice(0,5);}
  function sidebarRaidPin(row){return String(row.playerPin||row.prioPin||row.raidPin||row.pin||"").trim();}
  function sidebarRaidTimestamp(row){const date=sidebarRaidDate(row),time=sidebarRaidTime(row)||"00:00";if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return Number.MAX_SAFE_INTEGER;const stamp=new Date(`${date}T${time}:00`).getTime();return Number.isFinite(stamp)?stamp:Number.MAX_SAFE_INTEGER;}
  function sidebarRaidDateLabel(value){const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}.${match[2]}.${match[1]}`:String(value||"-");}
  function sidebarRaidWeekday(value){const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return"";const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));return new Intl.DateTimeFormat("de-DE",{weekday:"long"}).format(date);}
  function currentSidebarRaidPin(){const params=new URLSearchParams(window.location.search);return String(params.get("pin")||params.get("raidId")||(typeof currentRaidId!=="undefined"?currentRaidId:"")||document.getElementById("raidPin")?.value||"").trim();}
  function isCurrentSidebarRaid(row,key){const currentPin=currentSidebarRaidPin();if(currentPin&&sidebarRaidPin(row))return norm(currentPin)===norm(sidebarRaidPin(row));const pageKey=sidebarRaidKey(window.location.pathname.split("/").pop()?.replace("-loot.html",""));return pageKey===key;}
  function normalizeLootBuffDate(value){const raw=String(value||"").trim().slice(0,10);let match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(match)return`${match[1]}-${match[2]}-${match[3]}`;match=raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);return match?`${match[3]}-${String(match[2]).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`:"";}
  function normalizeLootBuff(row){if(!row)return null;const buff=String(row.buff||row.Buff||row.name||row.Name||row.type||row.Type||"").trim(),date=normalizeLootBuffDate(row.datum||row.Datum||row.date||row.Date),time=String(row.uhrzeit||row.Uhrzeit||row.time||row.Time||"").trim().slice(0,5),guild=String(row.gilde||row.Gilde||row.guild||row.Guild||row.fraktion||row.Fraktion||row["Gilde / Fraktion"]||"").trim();return buff&&date&&time?{buff,date,time,guild}:null;}
  function lootBuffKind(value){const key=norm(value);if(key.includes("hakkar")||key==="zg")return["hakkar","Hakkar","../images/worldbuff-zg.png"];if(key.includes("ony"))return["ony","Ony","../images/worldbuff-ony.png"];if(key.includes("nef"))return["nef","Nef","../images/worldbuff-nef.png"];if(key.includes("rend"))return["rend","Rend","../images/worldbuff-rend.png"];return["other",String(value||"Buff"),"../images/dashboard-icons/worldbuffs.jpg"];}
  function lootBuffRows(result){const rows=result?.buffs||result?.entries||result?.rows||result?.data||[];return(Array.isArray(rows)?rows:[]).map(normalizeLootBuff).filter(Boolean);}
  function lootBuffGuildScore(value){const text=String(value||"").trim(),key=norm(text);if(!text||["worldbuff","worldbuffs","worldbuffticker","ticker"].includes(key))return 0;if(key.includes("wird")||key.includes("gesucht")||key.includes("offen"))return 1;if(key.includes("lichtbringer")||key.includes("hordeworldbuff")||key.includes("nachtwaechter"))return 4;return 3;}
  async function mountRaidHeaderBuffs(row){const date=sidebarRaidDate(row),meta=document.getElementById("lootRaidHeaderDate");if(!meta||!date)return;let box=document.getElementById("lootRaidHeaderBuffs");if(!box){box=document.createElement("div");box.id="lootRaidHeaderBuffs";box.className="loot-raid-header-buffs";meta.insertAdjacentElement("afterend",box);}box.innerHTML='<span class="loot-raid-header-buffs-label">Worldbuffs &amp; Rend</span><span class="loot-raid-header-buffs-loading">Termine werden geladen …</span>';
    try{const guild=typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot",results=await Promise.allSettled([apiJsonp({action:"getPublicWorldbuffs",guild,days:3650,t:Date.now()}),apiJsonp({action:"getPublicHordenbuffs",guild,days:3650,t:Date.now()})]),bySlot=new Map();results.forEach(result=>{if(result.status!=="fulfilled"||result.value?.success===false)return;lootBuffRows(result.value).forEach(entry=>{if(entry.date!==date)return;const kind=lootBuffKind(entry.buff),key=`${kind[0]}|${entry.time}`,candidate={...entry,kind},current=bySlot.get(key);if(!current||lootBuffGuildScore(candidate.guild)>lootBuffGuildScore(current.guild))bySlot.set(key,candidate);});});const entries=[...bySlot.values()].sort((a,b)=>a.time.localeCompare(b.time)||a.kind[1].localeCompare(b.kind[1]));if(!entries.length){box.innerHTML='<span class="loot-raid-header-buffs-label">Worldbuffs &amp; Rend</span><span class="loot-raid-header-buffs-empty">Keine Termine für diesen Raidtag eingetragen.</span>';return;}box.innerHTML='<span class="loot-raid-header-buffs-label">Worldbuffs &amp; Rend</span><span class="loot-raid-header-buffs-list">'+entries.map(entry=>`<span class="loot-raid-header-buff is-${esc(entry.kind[0])}" title="${esc(entry.guild||entry.kind[1])}"><img src="${esc(entry.kind[2])}" alt="${esc(entry.kind[1])}"><span class="loot-raid-header-buff-copy"><strong>${esc(entry.kind[1])}</strong><span><time>${esc(entry.time)} Uhr</time>${entry.guild?`<small>${esc(entry.guild)}</small>`:""}</span></span></span>`).join("")+'</span>';}catch(error){box.innerHTML='<span class="loot-raid-header-buffs-label">Worldbuffs &amp; Rend</span><span class="loot-raid-header-buffs-empty">Termine derzeit nicht verfügbar.</span>';}}
  function mountRaidHeaderDate(row){const title=document.querySelector(".raid-page-title");if(!title)return;let meta=document.getElementById("lootRaidHeaderDate");if(!meta){meta=document.createElement("div");meta.id="lootRaidHeaderDate";meta.className="loot-raid-header-date";title.insertAdjacentElement("afterend",meta);}const date=sidebarRaidDate(row),time=sidebarRaidTime(row);meta.textContent=`${sidebarRaidWeekday(date)} · ${sidebarRaidDateLabel(date)} · ${time||"-"} Uhr`;mountRaidHeaderBuffs(row);}
  function sidebarRaidLink(row,key){const pin=sidebarRaidPin(row),guild=typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot",isFree=["other","scholomance","lbrs","ubrs","brd","strath-live"].includes(key),url=new URL(isFree?"bwl-loot.html":`${key}-loot.html`,window.location.href);if(isFree){url.searchParams.set("signupOnly","1");url.searchParams.set("raidId",String(row.raidId||row.id||pin||""));}else if(pin)url.searchParams.set("pin",pin);if(guild&&guild!=="lichtloot")url.searchParams.set("guild",guild);return url.href;}
  async function mountSidebarCurrentRaids(anchor){
    if(!anchor||document.getElementById("lootSidebarCurrentRaids"))return;
    const box=document.createElement("section");box.id="lootSidebarCurrentRaids";box.className="loot-sidebar-current-raids";box.innerHTML='<div class="loot-sidebar-raids-title">Aktuelle Raids</div><div class="loot-sidebar-raids-loading">werden geladen …</div>';anchor.insertAdjacentElement("afterend",box);
    try{
      const result=await apiJsonp({action:"getActiveRaids",guild:typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot",t:Date.now()});
      if(!result?.success)throw new Error(result?.error||"Raids konnten nicht geladen werden.");
      const today=new Date();today.setHours(0,0,0,0);
      const rows=[...(result.allRaids||result.raids||result.entries||result.activeRaids||[])].map(row=>({row,key:sidebarRaidKey(row.raid||row.raidName||row.name||row.raidId||row.id)})).filter(item=>item.key&&(!sidebarRaidDate(item.row)||sidebarRaidTimestamp(item.row)>=today.getTime())).sort((a,b)=>sidebarRaidTimestamp(a.row)-sidebarRaidTimestamp(b.row));
      const names={mc:"Molten Core",bwl:"Blackwing Lair",aq20:"Ahn’Qiraj 20",aq40:"Ahn’Qiraj 40",zg:"Zul’Gurub",ony:"Onyxia",naxx:"Naxxramas",scholomance:"Scholomance",lbrs:"LBRS",ubrs:"UBRS",brd:"BRD","strath-live":"Stratholme Live",other:"Freier Raid"};
      const currentRaid=rows.find(({row,key})=>isCurrentSidebarRaid(row,key));
      if(currentRaid)mountRaidHeaderDate(currentRaid.row);
      const freeKeys=["other","scholomance","lbrs","ubrs","brd","strath-live"];
      const renderCard=({row,key})=>`<a class="loot-sidebar-raid-card${isCurrentSidebarRaid(row,key)?" is-current":""}" href="${esc(sidebarRaidLink(row,key))}"${isCurrentSidebarRaid(row,key)?' aria-current="page"':''}><img src="${freeKeys.includes(key)?'../images/raid-templates/wow-other-raids.png':`../images/raid-templates/${esc(key)}.jpg`}" alt=""><span><strong>${esc(row.raidName||row.name||names[key])}</strong><small>${esc(sidebarRaidDateLabel(sidebarRaidDate(row)))} · ${esc(sidebarRaidTime(row)||"-")} Uhr</small></span><b>›</b></a>`;
      const renderGroup=(title,items)=>items.length?`<div class="loot-sidebar-raid-group"><div class="loot-sidebar-raid-group-title">${esc(title)}</div>${items.map(renderCard).join("")}</div>`:"";
      const freeRaids=rows.filter(item=>freeKeys.includes(item.key)),raids40=rows.filter(item=>!["aq20","zg",...freeKeys].includes(item.key)),raids20=rows.filter(item=>["aq20","zg"].includes(item.key));
      box.innerHTML='<div class="loot-sidebar-raids-title">Aktuelle Raids</div>'+(rows.length?renderGroup("40er Raids",raids40)+renderGroup("20er Raids",raids20)+renderGroup("Freie Raids",freeRaids):'<div class="loot-sidebar-raids-empty">Keine aktuellen Raids.</div>');
    }catch(error){box.innerHTML=`<div class="loot-sidebar-raids-title">Aktuelle Raids</div><div class="loot-sidebar-raids-empty">${esc(error.message||"Nicht verfügbar")}</div>`;}
  }
  function lootPageSectionSettings(){const layout=currentGuildInfo&&currentGuildInfo.layout&&typeof currentGuildInfo.layout==="object"?currentGuildInfo.layout:{},saved=layout.lootPageSections&&typeof layout.lootPageSections==="object"?layout.lootPageSections:{},pageKey=sidebarRaidKey(window.location.pathname.split("/").pop()?.replace("-loot.html","")),byRaid=layout.lootPageSectionsByRaid&&typeof layout.lootPageSectionsByRaid==="object"?layout.lootPageSectionsByRaid:{},raidSaved=byRaid[pageKey]&&typeof byRaid[pageKey]==="object"?byRaid[pageKey]:{};return{worldbuffs:saved.worldbuffs!==false&&raidSaved.worldbuffs!==false,raidSignup:saved.raidSignup!==false&&raidSaved.raidSignup!==false,poReleases:saved.poReleases!==false&&raidSaved.poReleases!==false,miniRaids:saved.miniRaids!==false&&raidSaved.miniRaids!==false,gearPlanner:saved.gearPlanner!==false&&raidSaved.gearPlanner!==false,poReleaseScope:layout.lootPagePoReleaseScope==="raid"?"raid":"all",pageKey};}
  function setLootSectionVisible(selector,visible){document.querySelectorAll(selector).forEach(node=>{node.hidden=!visible;node.style.setProperty("display",visible?"":"none",visible?"":"important");});}
  function filterLootPagePoReleases(settings){
    const box=document.getElementById("selectedCharacterPoReleases");if(!box)return;
    const chips=[...box.querySelectorAll(".loot-release-chip")],title=box.querySelector(".loot-release-title:not(.loot-attendance-title)"),oldEmpty=box.querySelector(".loot-release-scope-empty");
    oldEmpty?.remove();
    chips.forEach(chip=>chip.style.removeProperty("display"));
    if(settings.poReleaseScope!=="raid"){if(title)title.textContent="PO-Freigaben für alle Raids";return;}
    const names={mc:"MC",bwl:"BWL",aq40:"AQ40",naxx:"NAXX",zg:"ZG",aq20:"AQ20",ony:"Onyxia"},wanted=names[settings.pageKey]||String(settings.pageKey||"").toUpperCase();
    let visible=0;
    chips.forEach(chip=>{const label=String(chip.textContent||"").trim().toUpperCase();const match=settings.pageKey==="zg"?label.startsWith("ZG "):label.startsWith(wanted.toUpperCase()+":");chip.style.setProperty("display",match?"":"none",match?"":"important");if(match)visible++;});
    if(title)title.textContent=`PO-Freigabe für ${wanted}`;
    const list=box.querySelector(".loot-release-list");
    if(list&&chips.length&&!visible){const empty=document.createElement("span");empty.className="loot-release-scope-empty";empty.textContent="Für diesen Raid ist keine eigene PO-Freigabe eingerichtet.";list.appendChild(empty);}
  }
  function applyLootPageSectionSettings(){const settings=lootPageSectionSettings();setLootSectionVisible("#lootRaidHeaderBuffs",settings.worldbuffs);setLootSectionVisible("#raidSignupPageBox,.raid-signup-nav-tab",settings.raidSignup);setLootSectionVisible("#selectedCharacterPoReleases",settings.poReleases);setLootSectionVisible("#lootSidebarCurrentRaids",settings.miniRaids);setLootSectionVisible('button[onclick*="toggleGearPlanner"]',settings.gearPlanner);filterLootPagePoReleases(settings);}
  async function loadLootPageSectionSettings(){
    try{
      const slug=String(typeof currentGuildSlug==="function"?currentGuildSlug():"lichtloot").trim().toLowerCase();
      const result=await apiJsonp({action:"listGuilds",t:Date.now()});
      const guild=(result?.guilds||[]).find(entry=>String(entry?.slug||"").trim().toLowerCase()===slug);
      if(guild) currentGuildInfo={...(currentGuildInfo||{}),...guild};
    }catch(error){console.warn("Lootseiten-Einstellungen konnten nicht geladen werden:",error);}
    applyLootPageSectionSettings();
  }
  function mountPageSignup(){const releases=document.getElementById("selectedCharacterPoReleases");if(!releases||document.getElementById("raidSignupPageBox"))return;const box=document.createElement("section");box.id="raidSignupPageBox";box.className="raid-signup-page-box is-disabled";box.innerHTML='<div class="raid-signup-page-title">👥 Für diesen Raid anmelden</div><div class="raid-signup-page-grid"><label><span>Charakter</span><select id="raidSignupPageCharacter"></select></label><label><span>Skillung</span><select id="raidSignupPageSpec" class="raid-signup-spec-native" tabindex="-1"></select><div class="raid-signup-spec-picker"><button id="raidSignupPageSpecButton" class="raid-signup-spec-button" type="button"></button><div id="raidSignupPageSpecMenu" class="raid-signup-spec-menu hidden"></div></div></label><label><span>Status</span><select id="raidSignupPageStatus"><option value="signed">✅ Angemeldet</option><option value="bench">🪑 Bank</option><option value="late">🕒 Verspätet</option><option value="absent">🚫 Abwesend</option></select></label><button id="raidSignupPageSave" type="button">Raidanmeldung speichern</button></div><div id="raidSignupPageFeedback" class="raid-signup-page-feedback">Einstellung der Gildenleitung wird geladen …</div>';releases.insertAdjacentElement("afterend",box);box.querySelector("#raidSignupPageCharacter").onchange=syncPageSpecs;box.querySelector("#raidSignupPageSpecButton").onclick=togglePageSpecMenu;box.querySelector("#raidSignupPageSave").onclick=()=>{box.querySelector("#raidSignupPageSave").disabled=true;saveOwnSignup();};syncPageCharacters();new MutationObserver(syncPageCharacters).observe(document.getElementById("characterButtons")||document.body,{childList:true,subtree:true});loadRaidSignupAvailability();}
  function close(){document.querySelector(".raid-signup-modal-backdrop")?.remove();}
  function open(){
    close();
    const backdrop=document.createElement("div");
    backdrop.className="raid-signup-modal-backdrop";
    backdrop.innerHTML='<section class="raid-signup-modal" role="dialog" aria-modal="true"><div class="raid-signup-modal-head"><div><h2>👥 Raidanmeldungen</h2><div id="raidSignupMirrorCount" class="raid-signup-mirror-count">0 Spieler</div></div><button class="raid-signup-modal-close" type="button" aria-label="Schließen">×</button></div><div class="raid-signup-tools"><label class="raid-signup-search"><span>🔎</span><input id="raidSignupMirrorSearch" type="search" placeholder="Charakter, Klasse, Rolle oder Status suchen …"></label><div class="raid-signup-own"><strong>Direkt für diesen Raid anmelden</strong><div class="raid-signup-character-choice"><span>Charaktere aus meinem LichtLoot</span><div id="raidSignupMirrorCharacters" class="raid-signup-character-chips"></div></div><label class="raid-signup-modal-field"><span>Skillung</span><select id="raidSignupMirrorSpec" class="raid-signup-spec-native" tabindex="-1"></select><div class="raid-signup-spec-picker"><button id="raidSignupMirrorSpecButton" class="raid-signup-spec-button" type="button"></button><div id="raidSignupMirrorSpecMenu" class="raid-signup-spec-menu hidden"></div></div></label><label class="raid-signup-modal-field"><span>Status</span><select id="raidSignupMirrorStatus"><option value="signed">✅ Angemeldet</option><option value="bench">🪑 Bank</option><option value="late">🕒 Verspätet</option><option value="absent">🚫 Abwesend</option></select></label><button id="raidSignupMirrorSave" type="button">Anmeldung speichern</button><span id="raidSignupMirrorFeedback"></span></div><div id="raidSignupLeadLogin" class="raid-signup-lead-login"><strong>⚑ Raidlead-Login</strong><input id="raidSignupLeadPin" type="password" placeholder="Gildenleiter-/LeadPIN"><button id="raidSignupLeadButton" type="button">Raidlead freischalten</button><span id="raidSignupLeadFeedback">Danach kannst du Spieler auf Bank, verspätet, abwesend oder angemeldet setzen.</span></div></div><div id="raidSignupMirrorList" class="raid-signup-mirror-list"><div class="raid-signup-mirror-empty">Anmeldungen werden geladen …</div></div></section>';
    const meta=document.createElement("div");meta.className="raid-signup-raid-meta";meta.textContent=raidSignupMeta();meta.style.cssText="margin-top:4px;color:#facc15;font-size:13px;font-weight:900";backdrop.querySelector(".raid-signup-modal-head h2")?.insertAdjacentElement("afterend",meta);
    backdrop.querySelector(".raid-signup-modal-close").onclick=close;
    backdrop.querySelector("#raidSignupMirrorSearch").oninput=applySearch;
    backdrop.querySelector("#raidSignupMirrorSpecButton").onclick=()=>backdrop.querySelector("#raidSignupMirrorSpecMenu")?.classList.toggle("hidden");
    backdrop.querySelector("#raidSignupMirrorSave").onclick=saveOwnSignup;
    backdrop.querySelector("#raidSignupLeadButton").onclick=raidLeadLogin;
    backdrop.querySelector("#raidSignupLeadPin").onkeydown=event=>{if(event.key==="Enter")raidLeadLogin();};
    backdrop.addEventListener("click",event=>{if(event.target===backdrop)close();});
    document.body.appendChild(backdrop);
    const savedLeadPin=sessionStorage.getItem(`raidSignupLeadPin_${activeSignupRaidId()}`)||"";
    if(savedLeadPin){backdrop.querySelector("#raidSignupLeadPin").value=savedLeadPin;raidLeadLogin();}
    syncMirrorCharacters();syncMirrorSpecs();applyRaidSignupAvailability();loadRaidSignupAvailability();load();
  }
  async function openSignupOnlyPage(){
    const params=new URLSearchParams(location.search),raidId=params.get("raidId")||"";
    if(!raidId)return;
    currentRaidId=raidId;
    document.body.classList.add("raid-signup-only-page");
    const style=document.createElement("style");
    style.textContent='.raid-signup-only-page #mainGrid,.raid-signup-only-page .header-actions,.raid-signup-only-page .subtitle,.raid-signup-only-page #raidSignupPageBox,.raid-signup-only-page .player-input-grid,.raid-signup-only-page .prio-hidden-selects{display:none!important}.raid-signup-only-page .raid-signup-modal-backdrop{position:static!important;display:block!important;padding:0!important;background:transparent!important;backdrop-filter:none!important}.raid-signup-only-page .raid-signup-modal{width:100%!important;max-width:none!important;max-height:none!important;margin-top:14px!important}.raid-signup-only-page .raid-signup-modal-close{display:none!important}.raid-signup-only-page .header{padding-bottom:22px}.raid-signup-only-page .header-tools{display:block}.raid-signup-only-page #playerCard{margin-bottom:14px}';
    document.head.appendChild(style);
    try{
      const result=await apiJsonp({action:"getRaidHelper",raidId,playerPin:raidId,t:Date.now()});
      if(!result?.success)throw new Error(result?.error||"Raid nicht gefunden");
      const raid=result.raid||{},title=raid.raidName||raid.name||"Raidanmeldungen";
      currentRaidName=title;currentRaidDate=raid.raidDate||"";currentRaidTime=raid.raidTime||"";
      const heading=document.querySelector(".raid-page-title");
      if(heading){const icon=heading.querySelector("img");heading.innerHTML="";if(icon){icon.src=raid.raidImageUrl||"../images/raid-templates/wow-other-raids.png";heading.appendChild(icon);}heading.append(document.createTextNode(`${title} – Raidanmeldungen`));}
      document.title=`${title} – Raidanmeldungen · LichtLoot`;
    }catch(error){console.warn("Raidinformationen konnten nicht geladen werden:",error);}
    open();
    const backdrop=document.querySelector(".raid-signup-modal-backdrop"),tools=document.querySelector(".header-tools")||document.querySelector(".header");
    if(backdrop&&tools)tools.appendChild(backdrop);
  }
  function init(){window.prioDraftDirty=false;document.addEventListener("click",event=>{if(!event.target.closest("#lootGuildSwitcher"))closeLootGuildSwitchPopup();if(event.target.closest(".mini-btn[data-prio]"))window.prioDraftDirty=true;},true);document.addEventListener("keydown",event=>{if(event.key==="Escape")closeLootGuildSwitchPopup();});document.addEventListener("change",event=>{if(["p1","p2","p3"].includes(event.target?.id))window.prioDraftDirty=true;},true);installProtectedPrioSearch();mountPageSignup();mountActiveCharacterPanel();const groups=[...document.querySelectorAll(".raid-start-group")],group=groups.find(item=>item.querySelector(".raid-start-group-toggle")?.textContent.includes("Raidorga"));let raidSignupButton=document.querySelector(".raid-signup-nav-tab");if(group&&!raidSignupButton){raidSignupButton=document.createElement("button");raidSignupButton.type="button";raidSignupButton.className="raid-signup-nav-tab";raidSignupButton.innerHTML='<span><img src="../images/dashboard-icons/raidlead.jpg" alt="">Raidanmeldungen</span><span>›</span>';raidSignupButton.onclick=open;group.insertAdjacentElement("afterend",raidSignupButton);}mountSidebarCurrentRaids(raidSignupButton);applyLootPageSectionSettings();loadLootPageSectionSettings();const original=window.loadPrioCheck;if(typeof original==="function")window.loadPrioCheck=async function(){const result=await original.apply(this,arguments);if(document.getElementById("raidSignupMirrorList"))await load();return result;};if(new URLSearchParams(location.search).get("signupOnly")==="1")openSignupOnlyPage();}
  window.setInterval(()=>{decorateCharacterControls();upgradeSignupCharacterPicker();bindPageCharacterSync();applyLootPageSectionSettings();hideLegacyCharacterSelection();reorganizeLootHeaderControls();compactLootReleaseSummary();refreshPageSignupState();autoSelectRaidCharacter();renderActiveCharacterPanel();loadPrioSignupSummary();},500);window.openRaidSignupMirror=open;window.loadRaidSignupMirror=load;window.chooseRaidSignupSpec=choosePageSpec;window.chooseRaidSignupMirrorSpec=chooseMirrorSpec;window.raidSignupLeadStatus=setRaidLeadStatus;if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();

/* Raidregeln direkt im Inhaltsbereich der Lootseite anzeigen. */
(function(){
  function currentLootRaidKey(){
    const bodyClass=[...document.body.classList].find(name=>name.startsWith("raid-"));
    if(bodyClass) return bodyClass.slice(5);
    const file=location.pathname.split("/").pop() || "";
    return file.replace(/-loot\.html$/i,"").toLowerCase();
  }
  function currentLootGuild(){
    if(typeof currentGuildSlug==="function") return currentGuildSlug();
    return new URLSearchParams(location.search).get("guild") || "lichtloot";
  }
  function ensureRulesStyles(){
    if(document.getElementById("lootRaidRulesStyles")) return;
    const style=document.createElement("style");
    style.id="lootRaidRulesStyles";
    style.textContent=`
      .loot-raid-rules-view{margin-top:18px;padding:18px;border:1px solid rgba(var(--gold-rgb),.38);border-radius:18px;background:linear-gradient(180deg,rgba(12,18,32,.9),rgba(2,6,23,.82));box-shadow:0 18px 38px rgba(0,0,0,.32)}
      .loot-raid-rules-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .loot-raid-rules-head h2{margin:0;color:var(--gold);font-size:24px}
      .loot-raid-rules-back{padding:9px 14px;border:1px solid rgba(var(--gold-rgb),.48);border-radius:10px;background:rgba(var(--gold-rgb),.12);color:#fff;font-weight:900;cursor:pointer}
      .loot-raid-rules-frame{display:block;width:100%;min-height:520px;border:0;background:transparent}
      @media(max-width:800px){.loot-raid-rules-view{padding:12px}.loot-raid-rules-head{align-items:flex-start}.loot-raid-rules-head h2{font-size:20px}}
    `;
    document.head.appendChild(style);
  }
  function hideLootRaidRules(){
    document.getElementById("lootRaidRulesView")?.remove();
    const grid=document.getElementById("mainGrid");
    if(grid) grid.hidden=false;
    document.querySelectorAll('[data-loot-action="raidregeln"]').forEach(button=>button.classList.remove("active"));
  }
  function showLootRaidRules(){
    ensureRulesStyles();
    const grid=document.getElementById("mainGrid");
    if(!grid) return;
    document.getElementById("lootRaidRulesView")?.remove();
    grid.hidden=true;
    const raid=currentLootRaidKey();
    const guild=currentLootGuild();
    const view=document.createElement("section");
    view.id="lootRaidRulesView";
    view.className="loot-raid-rules-view";
    view.innerHTML=`<div class="loot-raid-rules-head"><h2>Raidregeln</h2><button class="loot-raid-rules-back" type="button">← Zur Prioliste</button></div><iframe class="loot-raid-rules-frame" title="Raidregeln" scrolling="no" src="../raidregeln.html?guild=${encodeURIComponent(guild)}&raid=${encodeURIComponent(raid)}&embed=1"></iframe>`;
    grid.insertAdjacentElement("beforebegin",view);
    view.querySelector(".loot-raid-rules-back").onclick=hideLootRaidRules;
    document.querySelectorAll('[data-loot-action="raidregeln"]').forEach(button=>button.classList.add("active"));
    view.scrollIntoView({behavior:"smooth",block:"start"});
  }
  document.addEventListener("click",event=>{
    const button=event.target.closest("button");
    if(!button || button.textContent.trim()!=="Raidregeln") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showLootRaidRules();
  },true);
  window.showLootRaidRules=showLootRaidRules;
  window.hideLootRaidRules=hideLootRaidRules;
})();
