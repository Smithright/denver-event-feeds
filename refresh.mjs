import {collect,calendar,SOURCES} from './lib/events.mjs';
import fs from 'node:fs/promises';
const now=new Date();
let prior={};try{prior=JSON.parse(await fs.readFile('status.json','utf8'))}catch{}
const status={checkedAt:now.toISOString(),sources:{}};
let failed=false;
await fs.mkdir('feeds',{recursive:true});
for(const source of Object.keys(SOURCES)){
 try{
  const events=await collect(source,{now});
  const file='feeds/'+source+'.ics';
  // Atomic replacement only after the entire source window validates.
  await fs.writeFile(file+'.tmp',calendar(source,events,now));await fs.rename(file+'.tmp',file);
  status.sources[source]={ok:true,count:events.length,lastSuccess:now.toISOString()};
  console.log(source+': '+events.length+' events');
 }catch(e){
  failed=true;status.sources[source]={ok:false,lastSuccess:prior.sources?.[source]?.lastSuccess||null,count:prior.sources?.[source]?.count??null,error:String(e.message)};
  console.error(source+': failed; retaining last good feed. '+e.message);
 }
}
await fs.writeFile('status.json',JSON.stringify(status,null,2)+'\n');
process.exitCode=failed?1:0;
