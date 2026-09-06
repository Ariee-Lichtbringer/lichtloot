const MAX_BYTES=5*1024*1024;
export function validateSupportScreenshot(value) {
  if(value==null||value==='')return '';
  if(typeof value!=='string'||value.length>Math.ceil(MAX_BYTES/3)*4+64)throw Object.assign(new Error('Screenshot darf maximal 5 MB groß sein.'),{statusCode:400});
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match)throw Object.assign(new Error('Screenshot muss PNG, JPG oder WebP sein.'),{statusCode:400});
  const data=Buffer.from(match[2],'base64');
  const valid=match[1]==='png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?data[0]===255&&data[1]===216&&data[2]===255:data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
  if(!valid||data.length<12||data.length>MAX_BYTES||data.toString('base64')!==match[2])throw Object.assign(new Error('Screenshot ist ungültig oder größer als 5 MB.'),{statusCode:400});
  return value;
}
export function supportPageUrl(value){try{const url=new URL(String(value||''));return ['http:','https:'].includes(url.protocol)?(url.origin+url.pathname).slice(0,500):'';}catch{return '';}}
