import {ephemeralCalendar} from './lib/runs.mjs';
import {collect,calendar,SOURCES} from './lib/events.mjs';
import fs from 'node:fs/promises';
const now=new Date();
let prior={};try{prior=JSON.parse(await fs.readFile('status.json','utf8'))}catch{}
const status={checkedAt:now.toISOString(),sources:{}};
let failed=false;
await fs.mkdir('feeds',{recursive:true});
for(const source of Object.keys(SOURCES)){
 try{
  let output,count;
  if(source==='ephemeral'){
    const response=await fetch('https://www.meetup.com/beer-you-can-only-get-here/events/ical/',{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Organizer HTTP '+response.status);
    const result=ephemeralCalendar(await response.text());output=result.ics;count=result.count;
  }else{const events=await collect(source,{now});output=calendar(source,events,now);count=events.length;}
  const file='feeds/'+source+'.ics';
  // Atomic replacement only after the entire source window validates.
  await fs.writeFile(file+'.tmp',output);await fs.rename(file+'.tmp',file);
  status.sources[source]={ok:true,count,lastSuccess:now.toISOString()};
  console.log(source+': '+count+' events');
 }catch(e){
  failed=true;status.sources[source]={ok:false,lastSuccess:prior.sources?.[source]?.lastSuccess||null,count:prior.sources?.[source]?.count??null,error:String(e.message)};
  console.error(source+': failed; retaining last good feed. '+e.message);
 }
}
await fs.writeFile('status.json',JSON.stringify(status,null,2)+'\n');
process.exitCode=failed?1:0;
