window.createSupportReplyScreenshot = function(form, prefix, onChange) {
  const box=document.createElement('div');box.className='reply-screenshot';
  box.innerHTML=`<label for="${prefix}File">Screenshot anhängen (optional)</label><input type="file" id="${prefix}File" accept="image/png,image/jpeg,image/webp" aria-describedby="${prefix}Hint"><p id="${prefix}Hint" class="reply-hint">PNG, JPG oder WebP · maximal 5 MB</p><p data-status role="status"></p><img hidden alt="Vorschau des angehängten Screenshots" style="display:block;max-width:100%;max-height:240px;object-fit:contain"><button type="button" hidden>Screenshot entfernen</button>`;
  form.querySelector('textarea').closest('label').after(box);
  const input=box.querySelector('input'),preview=box.querySelector('img'),remove=box.querySelector('button'),status=box.querySelector('[data-status]');
  let value={},version=0,locked=false,busy=false,error='';
  function render(){input.disabled=locked||busy;remove.disabled=locked||busy;remove.hidden=!value.screenshotData;preview.hidden=!value.screenshotData;preview.style.display=value.screenshotData?'block':'none';if(value.screenshotData)preview.src=value.screenshotData;else preview.removeAttribute('src');status.textContent=busy?'Screenshot wird geladen …':error||value.screenshotName||'';}
  input.onchange=async()=>{const file=input.files[0];if(!file)return;const token=++version;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){input.value='';status.textContent='Bitte PNG, JPG oder WebP mit maximal 5 MB auswählen.';return;}
    busy=true;error='';render();
    try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Screenshot konnte nicht gelesen werden.'));reader.readAsDataURL(file);});if(token!==version)return;value={screenshotData:data,screenshotName:file.name};onChange();}
    catch(e){if(token===version)error=e.message;}
    finally{if(token===version){busy=false;input.value='';render();}}
  };
  remove.onclick=()=>{if(locked||busy)return;value={};error='';input.value='';render();onChange();};
  return {get data(){return {screenshotData:value.screenshotData||'',screenshotName:value.screenshotName||''};},get busy(){return busy;},reset(draft={}){version++;busy=false;error='';value={screenshotData:draft?.screenshotData||'',screenshotName:draft?.screenshotName||''};input.value='';render();},lock(flag){locked=!!flag;render();}};
};
