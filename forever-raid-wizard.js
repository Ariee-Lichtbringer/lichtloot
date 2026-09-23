(() => {
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
window.prepareForeverRaidWizard=(data,planning,api)=>{
 const form=document.getElementById('signupCreateForm'),dialog=document.getElementById('signupEditor');
 if(!form.dataset.wizard){
  form.dataset.wizard='true';dialog.classList.add('forever-raid-wizard');
  const fields={};for(const label of form.querySelectorAll('label')){const input=label.querySelector('[name]');if(input)fields[input.name]=label;}
  const actions=form.querySelector('.actions'),error=document.getElementById('signupCreateError');form.replaceChildren();
  const steps=el('div',null,'raid-wizard-steps');steps.setAttribute('aria-label','Schritte zum Raidanmelder');form.append(steps);
  const titles=['Raid & Termin','Plätze & Regeln','Discord','P0-Anmelder','Prüfen'];
  const panels=titles.map((title,i)=>{const panel=el('section',null,'raid-wizard-panel');panel.append(el('h3',(i+1)+'. '+title));form.append(panel);const b=el('button',(i+1)+' · '+title);b.type='button';b.onclick=()=>show(i);steps.append(b);return panel;});
  for(const [i,names] of [[0,['kind','title','date','time','groupId','repeatWeeks']],[1,['size','tanks','heals','rolePolicy','description']]]){const grid=el('div',null,'grid');for(const name of names)grid.append(fields[name]);panels[i].append(grid);}
  function field(panel,label,name,type='text'){const l=el('label',label),input=el(type==='select'?'select':'input');input.name=name;if(type!=='select')input.type=type;l.append(input);panel.append(l);return input;}
  const template=field(panels[0],'Vorlage verwenden','template','select');template.onchange=()=>{const t=form._planning?.templates?.find(t=>t.name===template.value);if(!t)return;for(const [key,value] of Object.entries(t.config)){const input=form.elements[key];if(input&&key!=='date')input.value=value??'';}form.elements.rolePolicy.value=t.config.strict_roles?'strict':'soft';};
  field(panels[1],'Raidleitung','raidleadId','select');field(panels[1],'Plündermeister','lootmasterId','select');
  field(panels[2],'Discord-Raidbild (HTTPS, optional)','imageUrl','url');const channel=el('p');channel.id='wizardDiscordChannel';panels[2].append(channel,el('p','Der Anmelder wird nach dem Erstellen automatisch im verbundenen Kanal veröffentlicht. Eine Raidgruppe kann einen eigenen Kanal verwenden.'));const setup=el('a','Discord-Kanal und Raidgruppen verwalten →');setup.href='#gruppen';setup.onclick=()=>dialog.close();panels[2].append(setup);
  panels[3].append(el('h4','P0 und Prioritäten für diesen Raid'),el('p','Der neue Termin steht direkt in den P0-Anmeldungen und auf seiner Prioseite bereit. Gegenstände und P0-Pflicht legst du unter „Lootregeln“ fest; Freigaben erteilst du pro Charakter unter „Freigabeanträge“.'));
  const rules=el('a','Lootregeln verwalten →');rules.href='#p0items';rules.onclick=()=>dialog.close();panels[3].append(rules);const summary=el('div');summary.id='wizardRaidSummary';panels[4].append(summary);
  const back=el('button','Zurück'),next=el('button','Weiter','primary'),saveTemplate=el('button','Als Vorlage speichern');for(const b of [back,next,saveTemplate])b.type='button';actions.prepend(back,next);panels[4].append(saveTemplate);form.append(error,actions);let current=0;
  function validate(){for(const input of panels[current].querySelectorAll('input,select,textarea'))if(!input.reportValidity())return false;return true;}
  function show(index){if(index>current&&!validate())return;current=index;panels.forEach((p,i)=>p.hidden=i!==index);[...steps.children].forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-current',i===index?'step':'false');});back.hidden=index===0;next.hidden=index===4;form.querySelector('[type=submit]').hidden=index!==4;summary.replaceChildren();for(const name of ['title','kind','date','time','size','tanks','heals','groupId','repeatWeeks']){const input=form.elements[name];summary.append(el('p',(input.closest('label')?.firstChild.textContent||name)+': '+(input.selectedOptions?.[0]?.textContent||input.value)));}dialog.scrollTop=0;}
  back.onclick=()=>show(Math.max(0,current-1));next.onclick=()=>show(Math.min(4,current+1));
  form.addEventListener('invalid',e=>{const i=panels.findIndex(p=>p.contains(e.target));if(i>=0){current=i;show(i);}},true);
  saveTemplate.onclick=async()=>{if(!form.reportValidity())return;const name=prompt('Vorlagenname');if(!name?.trim())return;saveTemplate.disabled=true;try{await form._api('saveTemplate',{name,config:Object.fromEntries(new FormData(form))});error.hidden=false;error.textContent='Vorlage gespeichert.';}catch(e){error.hidden=false;error.textContent=e.message;}finally{saveTemplate.disabled=false;}};
  form._show=()=>{current=0;show(0);};form.elements.size.max='40';form.elements.description.maxLength=1500;
 }
 form._planning=planning;form._api=api;
 form.elements.template.replaceChildren(new Option('Ohne Vorlage',''),...(planning.templates||[]).map(t=>new Option(t.name,t.name)));
 for(const name of ['raidleadId','lootmasterId'])form.elements[name].replaceChildren(new Option('Gildenleitung / nicht zugewiesen',''),...(planning.members||[]).map(p=>new Option(p.name||'Spieler',p.id)));
 const updateChannel=()=>{const group=data.groups.find(g=>g.id===form.elements.groupId.value),id=group?.discord_channel_id||data.discord?.channel_id;document.getElementById('wizardDiscordChannel').textContent=id?'Zielkanal: '+id:'Noch kein Discord-Kanal verbunden. Der Raid wird gespeichert; der Discord-Post kann nach der Verbindung veröffentlicht werden.';};form.elements.groupId.onchange=updateChannel;updateChannel();form._show();
};
})();
