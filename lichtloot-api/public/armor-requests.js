(()=>{
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 async function call(context,action,values={}){const response=await fetch(context.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...context,api:undefined,action,...values})});const result=await response.json();if(!response.ok||!result.success)throw Error(result.error||'Die Anfrage konnte nicht verarbeitet werden.');return result;}
 const style=el('style');style.textContent=`
 .armor-request-panel{background:#0b1629;border:1px solid #28435b;border-radius:14px;padding:22px;margin-top:16px;color:#ecf4ff}
 .armor-request-panel h3{margin:0 0 14px;color:#5fe5da}.armor-request-panel h4{margin:16px 0 8px}
 .armor-request-panel select,.armor-request-panel input[type=number]{background:#111f34;color:#ecf4ff;border:1px solid #42617b;border-radius:7px;padding:9px;font:inherit}
 .armor-request-panel select{min-width:100px;max-width:100%}.armor-request-panel select[aria-label="Rüstungsteil"]{min-width:min(300px,100%)}
 .armor-request-panel label{border-bottom:1px solid #243448}.armor-request-panel label span{min-width:220px;font-size:14px}
 .armor-request-panel input[type=checkbox]{accent-color:#26d7c4;width:18px!important;height:18px}
 .armor-request-panel input:disabled{opacity:.45}.armor-request-panel small{color:#a3b6cc}
 .armor-request-panel button.primary{background:#137c75;border:1px solid #2fd6c6;border-radius:8px;color:white;padding:12px 20px;font:inherit;font-weight:700;cursor:pointer}
 .armor-request-panel button:disabled{opacity:.65;cursor:default}.armor-request-panel [role=status]{color:#73e4ce;margin-top:16px}
 `;document.head.append(style);
 window.GuildLootArmor={async open(root,context){
  try{const selected=JSON.parse(document.getElementById('myLichtlootCharSelect')?.value||'null');if(selected?.name){context.character=selected.name;context.server=selected.server||'';}}catch{}
  const identity=JSON.stringify(context);if(root._identity===identity)return;root._identity=identity;
  const alive=()=>root.isConnected&&root._identity===identity;
  root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p','Setdaten werden geladen …'));
  try{
   const data=await call(context,'getArmorRequestCatalog');if(!alive())return;
   root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p',`${data.character.name} – ${data.character.server} · ${data.character.className}`));
   if(!data.configured){root.append(el('p','Die Gildenleitung muss zuerst unter Layout → Discordchannel den Channel für Rüstungsteile einstellen.'));return;}
   const tier=el('select'),select=el('select'),details=el('div'),status=el('p');status.setAttribute('role','status');
   tier.setAttribute('aria-label','Rüstungsset');select.setAttribute('aria-label','Rüstungsteil');
   ['T3','T2,5'].forEach(value=>tier.add(new Option(value,value)));
   const fields=el('div');fields.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin:16px 0';fields.append(tier,select);root.append(fields,details,status);
   function render(){
    status.textContent='';details.replaceChildren();const item=data.items.find(item=>item.itemId===select.value);if(!item)return;
    details.append(el('h4',item.name));
    const token=item.requirements.find(r=>r.itemId===item.tokenId);details.append(el('p','Passendes Token: '+(token?.name||'–')));
    details.append(el('p','Markiere, was du aus der Gildenbank benötigst. Die Mengen zeigen den vollständigen Bedarf und können reduziert werden.'));
    const rows=[];
    for(const material of item.requirements){
     const row=el('label');row.style.cssText='display:flex;align-items:center;gap:12px;padding:10px 0;flex-wrap:wrap';
     const check=el('input');check.type='checkbox';check.style.width='auto';
     const amount=el('input');amount.type='number';amount.min='1';amount.max=String(material.quantity);amount.value=String(material.quantity);amount.step='1';amount.style.width='80px';amount.disabled=true;amount.setAttribute('aria-label','Menge: '+material.name);
     check.onchange=()=>amount.disabled=!check.checked;
     row.append(check,el('span',material.name+(material.itemId===item.tokenId?' (Token)':'')),amount,el('small',`von ${material.quantity}`));details.append(row);rows.push({check,amount,material});
    }
    if(item.prerequisite)details.append(el('small','Voraussetzung: '+item.prerequisite+'.'));
    if(item.reputation)details.append(el('small',`Ruf: ${item.reputation.faction} – ${item.reputation.standing}.`));
    const button=el('button','In Discord anfragen');button.className='primary';button.type='button';button.style.cssText='display:block;margin-top:18px';details.append(button);
    button.onclick=async()=>{
     const materials=rows.filter(r=>r.check.checked).map(r=>({itemId:r.material.itemId,quantity:Number(r.amount.value)}));
     if(!materials.length){status.textContent='Bitte mindestens ein benötigtes Material auswählen.';return;}
     if(rows.some(r=>r.check.checked&&!r.amount.reportValidity()))return;
     button.disabled=true;tier.disabled=true;select.disabled=true;rows.forEach(r=>{r.check.disabled=true;r.amount.disabled=true;});status.textContent='Anfrage wird gespeichert …';
     try{
      const result=await call(context,'submitArmorRequest',{itemId:item.itemId,materials});if(!alive())return;
      status.textContent=result.status==='done'?'Die Anfrage wurde im Discord-Channel veröffentlicht.':'Anfrage gespeichert. Der PO Bot veröffentlicht sie im eingestellten Discord-Channel.';
      button.textContent='Anfrage gespeichert';
      let attempts=0;
      const poll=async()=>{if(!alive()||!root.contains(button)||attempts++>=12)return;try{const state=await call(context,'getArmorRequestStatus',{requestId:result.requestId});if(!alive()||!root.contains(button))return;if(state.status==='done'){status.textContent='Die Anfrage wurde im Discord-Channel veröffentlicht.';return;}if(['failed','error'].includes(state.status)){status.textContent='Anfrage gespeichert, aber der Discord-Versand ist fehlgeschlagen. Bitte die Gildenleitung informieren.';return;}}catch{}setTimeout(poll,5000);};
      if(result.status!=='done')setTimeout(poll,3000);
     }catch(error){status.textContent=error.message;button.disabled=false;rows.forEach(r=>{r.check.disabled=false;r.amount.disabled=!r.check.checked;});}
     finally{tier.disabled=false;select.disabled=false;}
    };
   }
   function fill(){select.replaceChildren();data.items.filter(item=>item.tier===tier.value).forEach(item=>select.add(new Option(item.name,item.itemId)));render();}
   tier.onchange=fill;select.onchange=render;fill();
  }catch(error){if(alive()){root.replaceChildren(el('h3','Rüstungsteile beantragen'),el('p',error.message));root._identity=null;}}
 }};
})();
