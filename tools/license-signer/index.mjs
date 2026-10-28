import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonical, strictTime } from '../../lib/license-core.ts';
const [command,...args]=process.argv.slice(2);
if(command==='keygen'){
 if(!args[0])throw Error('Usage: npm run license -- keygen /absolute/private/directory');
 const dir=resolve(args[0]);if(dir.startsWith(process.cwd()))throw Error('Private keys must be stored outside the repository');mkdirSync(dir,{recursive:true,mode:0o700});
 const keys=generateKeyPairSync('ed25519');writeFileSync(dir+'/private.pem',keys.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});writeFileSync(dir+'/public.pem',keys.publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});const raw=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32);console.log('Public verification key (add to lib/license-keys.ts): '+raw.toString('base64'));
}else if(command==='sign'){
 const [input,output,privatePath]=args;if(!input||!output||!privatePath)throw Error('Usage: sign input.json output.json /private/path/private.pem');const file=JSON.parse(readFileSync(input,'utf8'));if(file.version!==1||!Array.isArray(file.licenses))throw Error('Invalid schema');const ids=new Set();for(const r of file.licenses){if(!r.license_id||!r.device_id||!['trial','paid'].includes(r.license_type)||!['active','revoked'].includes(r.status)||ids.has(r.license_id)||strictTime(r.start_date)>=strictTime(r.end_date))throw Error('Invalid license');ids.add(r.license_id);}const {signature:ignored,...payload}=file;payload.issued_at=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');const signature=sign(null,Buffer.from(canonical(payload)),readFileSync(privatePath)).toString('base64');writeFileSync(output,JSON.stringify({...payload,signature},null,2)+'\n');console.log('Signed '+output);
}else if(command==='verify'){
 const [filePath,publicPath]=args;if(!filePath||!publicPath)throw Error('Usage: verify licenses.json /private/path/public.pem');const {signature,...payload}=JSON.parse(readFileSync(filePath,'utf8'));const valid=verify(null,Buffer.from(canonical(payload)),createPublicKey(readFileSync(publicPath)),Buffer.from(signature,'base64'));if(!valid)throw Error('Invalid signature');console.log('Signature verified');
}else throw Error('Commands: keygen, sign, verify');
