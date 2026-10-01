(() => {
  let dialog, session = 0;
  const context = () => {
    const guild = typeof currentActiveGuildSlug === 'function' ? currentActiveGuildSlug()
      : typeof CURRENT_GUILD_SLUG !== 'undefined' ? CURRENT_GUILD_SLUG : new URLSearchParams(location.search).get('guild');
    const pin = (typeof getStoredLichtLootPlayerPin === 'function' ? getStoredLichtLootPlayerPin()
      : typeof savedLoginForGuild === 'function' ? savedLoginForGuild(guild) : '')
      || document.getElementById('dashboardPlayerPin')?.value || document.getElementById('myPriosPin')?.value || '';
    return {guild, playerPin:String(pin).trim().toUpperCase()};
  };
  const api = async (account, action, extra = {}) => {
    const response = await fetch(typeof LICHTLOOT_API_URL !== 'undefined' ? LICHTLOOT_API_URL : '/api/apps-script', {
      method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...account,...extra,action})
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Die Übernahme konnte nicht durchgeführt werden.');
    return result;
  };
  function mount() {
    if (dialog) return;
    const style=document.createElement('style');
    style.textContent=`.guild-transfer-dialog{box-sizing:border-box;width:min(610px,calc(100vw - 28px));max-height:90vh;overflow:auto;border:1px solid #52627a;border-radius:18px;padding:26px;background:#101b2d;color:#e7edf7;font:15px/1.55 system-ui,sans-serif;box-shadow:0 24px 90px #0009}.guild-transfer-dialog::backdrop{background:#020817c9}.guild-transfer-dialog h2{margin:0 36px 12px 0;color:#facc15;font-size:23px}.guild-transfer-dialog p{margin:10px 0}.guild-transfer-dialog .gt-close{position:absolute;right:15px;top:12px;background:transparent;color:#cbd5e1;border:0;font-size:26px;cursor:pointer}.guild-transfer-dialog label{display:block;font-weight:700;margin:20px 0 6px}.guild-transfer-dialog select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #607089;border-radius:9px;background:#081223;color:#fff;font:inherit}.guild-transfer-dialog ul{padding-left:22px}.guild-transfer-dialog .gt-info{padding:12px 16px;border-radius:10px;background:#1c2a40;font-size:14px}.guild-transfer-dialog .gt-status{min-height:24px;margin-top:14px}.guild-transfer-dialog .gt-error{color:#fda4af}.guild-transfer-dialog .gt-submit,.guild-transfer-dialog .gt-open{display:inline-block;margin-top:12px;padding:12px 18px;border:0;border-radius:9px;background:#facc15;color:#101827;font:700 15px system-ui;cursor:pointer;text-decoration:none}.guild-transfer-dialog .gt-submit:disabled{opacity:.4;cursor:not-allowed}.guild-transfer-dialog [hidden]{display:none!important}`;
    document.head.append(style);
    dialog=document.createElement('dialog');dialog.className='guild-transfer-dialog';dialog.setAttribute('aria-labelledby','guildTransferTitle');
    dialog.innerHTML=`<button type="button" class="gt-close" aria-label="Schließen">×</button><h2 id="guildTransferTitle">Account in weitere Lootgilde übernehmen</h2><p>Dein Spielerlogin und alle Charaktere werden zusätzlich in der gewählten Lootgilde angelegt. Dein bisheriger Account bleibt erhalten.</p><div class="gt-info">Übernommen werden nur deine Charaktere einschließlich Main-Auswahl mit demselben Spielerlogin. P0-Punkte, Prios und Raid-Historie bleiben in der bisherigen Gilde. Gildenspezifische Freigaben werden nicht übernommen und müssen in der Zielgilde neu beantragt werden.</div><label for="guildTransferTarget">Ziel-Lootgilde</label><select id="guildTransferTarget" disabled><option value="">Gilden werden geladen …</option></select><div class="gt-preview"></div><div class="gt-status" role="status" aria-live="polite"></div><button type="button" class="gt-submit" disabled>Account zusätzlich übernehmen</button><a class="gt-open" hidden>Zur Zielgilde</a>`;
    document.body.append(dialog);
    dialog.querySelector('.gt-close').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{session++;});
  }
  window.openGuildAccountTransfer = async () => {
    mount();const token=++session, account=context();let revision=0, plan=null;
    const target=dialog.querySelector('select'), preview=dialog.querySelector('.gt-preview'), status=dialog.querySelector('.gt-status'), submit=dialog.querySelector('.gt-submit'), link=dialog.querySelector('.gt-open');
    const message=(text,error=false)=>{status.textContent=text;status.classList.toggle('gt-error',error);};
    target.replaceChildren(new Option('Gilden werden geladen …',''));target.disabled=true;preview.replaceChildren();submit.hidden=false;submit.disabled=true;link.hidden=true;
    if(!dialog.open)dialog.showModal();
    if(!account.guild||!account.playerPin){message('Bitte zuerst mit deinem SpielerLogin anmelden.',true);return;}
    message('Account wird geprüft …');
    target.onchange=async()=>{
      const ownRevision=++revision;plan=null;submit.disabled=true;preview.replaceChildren();
      if(!target.value){message('Wähle die Ziel-Lootgilde.');return;}
      message('Übernahme wird geprüft …');
      try{
        const data=await api(account,'previewAccountGuildTransfer',{targetGuild:target.value});
        if(token!==session||ownRevision!==revision)return;
        plan=data;const intro=document.createElement('p');intro.textContent=`${data.addedCharacters} neue und ${data.existingCharacters} bereits vorhandene Charaktere in ${data.targetGuild.name}:`;
        const list=document.createElement('ul');for(const c of data.characters){const li=document.createElement('li');li.textContent=`${c.name} · ${c.server} · ${c.className||'Klasse unbekannt'}${c.isMain?' · Main':''}${c.alreadyPresent?' · bereits vorhanden':''}`;list.append(li);}
        preview.replaceChildren(intro,list);
        message(data.approvalStatus==='approved'?'Der Account in der Zielgilde ist bereits freigegeben.':'Die Zielgilde muss deinen Account anschließend freigeben.');submit.disabled=false;
      }catch(error){if(token===session&&ownRevision===revision)message(error.message,true);}
    };
    submit.onclick=async()=>{
      if(!plan||submit.disabled)return;
      const current=context();if(current.guild!==account.guild||current.playerPin!==account.playerPin){submit.disabled=true;message('Dein Login hat sich geändert. Bitte das Fenster erneut öffnen.',true);return;}
      submit.disabled=true;target.disabled=true;message('Account wird übernommen …');
      try{
        const data=await api(account,'copyAccountToGuild',{targetGuild:plan.targetGuild.slug,confirmed:true});
        try{sessionStorage.setItem('lichtlootPlayerPin_'+data.targetGuild.slug,account.playerPin);}catch{}
        if(token!==session)return;
        submit.hidden=true;
        message(`Übernahme abgeschlossen: ${data.characters.length} Charaktere sind bei ${data.targetGuild.name} vorhanden. Dein bisheriger Account bleibt erhalten.${data.approvalStatus==='approved'?' Dein Spielerlogin funktioniert auch dort.':' Die Freigabe durch die Zielgilde steht noch aus.'}`);
        const destination=new URL('start.html',location.href);destination.searchParams.set('guild',data.targetGuild.slug);link.href=destination.href;link.hidden=false;
      }catch(error){if(token===session){message(error.message,true);submit.disabled=false;target.disabled=false;}}
    };
    try{
      const data=await api(account,'previewAccountGuildTransfer');if(token!==session)return;
      target.replaceChildren(new Option('Bitte Ziel-Lootgilde auswählen',''));
      for(const g of data.guilds)target.add(new Option(g.name,g.slug));
      target.disabled=!data.guilds.length;message(data.guilds.length?'Wähle die Ziel-Lootgilde.':'Es ist keine weitere Classic-Era-Lootgilde verfügbar.');
    }catch(error){if(token===session)message(error.message,true);}
  };
})();
