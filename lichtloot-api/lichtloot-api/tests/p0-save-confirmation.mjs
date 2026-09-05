import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
const extract = (src, name) => {
  const match = src.match(new RegExp('^(?:async )?function '+name+'\\(', 'm'));
  assert.ok(match, name);
  return src.slice(match.index, src.indexOf('\n}\n', match.index)+2);
};
for (const folder of ['loot', 'lichtloot-api/public/loot']) {
  for (const raid of ['naxx','bwl','aq40','mc','zg','aq20','ony']) {
    const src = fs.readFileSync(new URL(`${folder}/${raid}-loot.html`,root),'utf8');
    for (const script of src.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
    for (const mode of ['p0','p0plus','normal','failed','edited']) {
      const fields = Object.fromEntries(Object.entries({raidPin:'5AT',playerName:'Ariee',playerServer:'Everlook',playerClass:'Priester',p1:'Formel: Brust - Große Werte',p2:'Formel: Brust - Große Werte',p3:'Formel: Brust - Große Werte'}).map(([k,value])=>[k,{value}]));
      fields.playerStatus={innerHTML:''};
      let rendered;
      const noop=()=>{};
      const ctx=vm.createContext({
        document:{getElementById:id=>fields[id]||{value:''},querySelector:()=>({})},
        console:{error:()=>{}},currentRaidId:"naxx",URLSearchParams,PRIO_COUNT:3,SUPPORTS_P0PLUS:true,
        lichtlootSelectedCharacter:null,lichtlootLoggedInCharacters:[],currentPublishedMode:false,currentPublishedPrios:[],
        normalizeOwnPrioText:v=>String(v||'').trim().toLowerCase(),
        isP0DeadlineClosed:()=>false,eraRequiredPriorityKeys:()=>['p1','p2','p3'],safe:v=>v,
        loadPublishedPrios:async()=>{},ensurePlayerPinForSave:async()=>({success:true,pin:'2882'}),
        submitPrioWithPin:async()=>mode==='failed'?{success:false,error:'Test failure'}:{success:true,prioId:'saved'},
        autoSaveDraft:noop,saveCharacterProfile:noop,updateLocalRaidleadData:noop,showParticipantPinPopup:noop,
        getSelectedPrioItemId:()=>'',sortPriosWithOwnFirst:rows=>rows,
        setTimeout:()=>0,
        refreshAfterPrioSave:async()=>{if(mode==='edited') fields.p1.value='A new unsaved choice';},
        renderCurrentPrios:()=>{rendered=ctx.priosWithLiveDraft(ctx.currentPublishedPrios);}
      });
      ctx.window=ctx;ctx.location={search:''};ctx.p0WasClicked=mode!=='normal';ctx.p0PlusWasClicked=mode==='p0plus';ctx.prioDraftDirty=true;
      for(const name of ['lichtlootPrioIsP0','getLiveDraftPrio','prioDraftSignature','samePrioCharacter','isPrioFromCurrentLichtLootAccount','priosWithLiveDraft','savePrio']) vm.runInContext(extract(src,name),ctx);
      vm.runInContext(fs.readFileSync(new URL(`${folder}/p0-selection-fix.js`,root),'utf8'),ctx);
      await ctx.savePrio();
      if(mode==='failed') {
        assert.equal(ctx.currentPublishedPrios.length,0);
        assert.ok(ctx.getLiveDraftPrio());
      } else if(mode==='edited') {
        assert.equal(rendered[0].__liveDraft,true,'New changes during refresh stay unsaved');
      } else {
        assert.equal(rendered.length,1);
        assert.notEqual(rendered[0].__liveDraft,true,`${folder}/${raid} ${mode}: confirmed row must not become a draft`);
        assert.equal(ctx.lichtlootPrioIsP0(rendered[0]),mode!=='normal');
        assert.equal(rendered[0].P0Plus,mode==='p0plus'?'ja':'nein');
        fields.playerName.value='Juksi';ctx.prioDraftDirty=false;
        assert.equal(ctx.priosWithLiveDraft(ctx.currentPublishedPrios)[0].Spieler,'Ariee','Character switch preserves saved entry');
      }
    }
  }
}
console.log('14 raid pages: P0, P0+, ordinary priorities, failed saves, edits during refresh and character switching passed; inline JavaScript syntax valid.');
