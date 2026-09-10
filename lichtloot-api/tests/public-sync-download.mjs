import test from 'node:test';
import assert from 'node:assert/strict';
import { installAddonBetaDownload } from '../src/addon-beta-download.js';
function setup(materialize=async()=>'/tmp/installer'){
 let handler;installAddonBetaDownload({post:(_path,h)=>handler=h},{encryptionKey:'ab'.repeat(32),artifacts:{windows:{name:'setup.exe',type:'application/octet-stream'}},materialize});
 const res={code:200,set(){return this},status(n){this.code=n;return this},json(body){this.body=body;return this},download(path,name){this.file={path,name};return this}};
 return {handler,res};
}
test('installer is public without a PIN',async()=>{const {handler,res}=setup();await handler({body:{platform:'windows'}},res);assert.equal(res.code,200);assert.equal(res.file.name,'setup.exe')});
test('unknown platforms and old ZIP route cannot select files',async()=>{for(const platform of ['addon','../secret',undefined]){const {handler,res}=setup(()=>{throw Error('must not materialize')});await handler({body:{platform}},res);assert.equal(res.code,400)}});
test('unavailable installer returns safe retry message',async()=>{const {handler,res}=setup(async()=>{throw Error('private detail')});await handler({body:{platform:'windows'}},res);assert.equal(res.code,503);assert.ok(!res.body.error.includes('private detail'))});
