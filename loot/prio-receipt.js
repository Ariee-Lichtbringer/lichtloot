(function(){
  async function verify(url,result){
    const check=new URL(url);check.searchParams.set('action','getSavedPrioState');check.searchParams.set('prioId',result.prioId);check.searchParams.set('t',Date.now());
    // Retain authentication and character identity, not the write payload.
    for(const key of [...check.searchParams.keys()])if(!['action','guild','player','server','playerPin','characterPin','pin','prioId','t'].includes(key))check.searchParams.delete(key);
    const response=await fetch(check,{cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await response.json();
    if(!response.ok||!data.success||!data.entry)throw Error('Der gespeicherte Eintrag konnte nicht erneut bestätigt werden. Bitte zuerst deine Prioliste prüfen.');
    if(!result.savedRaidId || data.entry.raid_id!==result.savedRaidId)throw Error('Der Raid stimmt nicht mit der Speicherung überein. Bitte die Prioliste prüfen.');
    const e=data.entry,actual=[e.p1_item_id,e.p2_item_id,e.p3_item_id];
    if(!Array.isArray(result.savedItemIds)||actual.some((id,i)=>(id||null)!==(result.savedItemIds[i]||null)))throw Error('Die Prio wurde inzwischen verändert. Bitte die aktuelle Prioliste prüfen.');
    const date=String(e.raid_date||'').slice(0,10).split('-').reverse().join('.');
    const stamp=new Date(e.updated_at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'});
    const signed=['signed','registered','angemeldet','confirmed','fest'].includes(String(e.signup_status||'').toLowerCase());
    return `${e.character} · ${e.server}\n${e.raid_name} · ${date} · ${e.raid_time||''}\n${[e.p1,e.p2,e.p3].map((item,i)=>item?`P${i+1}: ${item}`:'').filter(Boolean).join('\n')}\nGespeichert: ${stamp}\nPrio: gespeichert und geprüft ✅ · Anmeldung: ${signed?'angemeldet ✅':e.signup_status==='bench'?'Warteliste':e.signup_status==='absent'?'abgemeldet':'nicht bestätigt'}`;
  }
  window.GuildLootPrioReceipt={verify};
})();
