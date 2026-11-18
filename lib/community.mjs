const need=(v,m)=>{if(!v)throw new Error(m);return v};
const unescape=s=>s.replace(/\\[nN]/g,'\n').replace(/\\([\\,;])/g,'$1');
const instant=s=>{need(/^\d{8}T\d{6}Z$/.test(s||''),'Expected organizer UTC timestamp');return new Date(s.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/,'$1-$2-$3T$4:$5:$6Z'));};
const wall=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Denver',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
export function cmcTimed(feeds){
 const events=new Map();
 for(const {ics,url} of feeds){
  need(ics.startsWith('BEGIN:VCALENDAR')&&ics.includes('END:VCALENDAR'),'Invalid CMC calendar');
  const blocks=[...ics.replace(/\r?\n[ \t]/g,'').matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)];
  need(blocks.length,'CMC calendar has no event records');
  for(const m of blocks){
   const b=m[1];if(/^DTSTART;VALUE=DATE:/m.test(b))continue;
   const field=k=>b.match(new RegExp('^'+k+':([^\\r\\n]+)','m'))?.[1];
   const start=field('DTSTART'),end=field('DTEND'),id=field('UID'),title=field('SUMMARY');
   need(id&&title&&start&&end,'Incomplete CMC event');const a=instant(start),z=instant(end);
   need(+z>+a,'Invalid CMC time range');
   // CMC exports unknown trip times as local midnight through 23:59 (or midnight).
   if(wall(a)==='00:00'&&['23:59','00:00'].includes(wall(z))&&z-a>=22*3600000)continue;
   events.set(id,{id,title:unescape(title),start,end,url:field('URL')||url,location:unescape(field('LOCATION')||'See organizer listing'),cancelled:field('STATUS')==='CANCELLED',description:unescape(field('DESCRIPTION')||'')+'\n\nConfirm meeting details and registration with CMC. Calendar listing is not registration.\n'+url});
  }
 }
 return [...events.values()];
}
export function chaosBloom(html,{now=new Date()}={}){
 need(html.includes('eventlist'),'Chaos Bloom calendar missing');
 const blocks=[...html.matchAll(/<article[^>]*eventlist-event--upcoming[^>]*>([\s\S]*?)<\/article>/g)];
 need(blocks.length,'Chaos Bloom upcoming listings missing');const events=[];
 for(const m of blocks){
  const b=m[1],google=b.match(/href="([^"]+)" class="eventlist-meta-export-google"/)?.[1];
  need(google,'Chaos Bloom event has no explicit time export');
  const q=new URL(google.replaceAll('&amp;','&')).searchParams;
  const title=q.get('text')?.trim(),[start,end]=(q.get('dates')||'').split('/');
  need(title,'Chaos Bloom title missing');if(/^(closed|no shows)/i.test(title))continue;
  const a=instant(start),z=instant(end);need(+z>+a,'Invalid Chaos Bloom time range');
  if(z<now||a>new Date(+now+120*86400000))continue;
  const path=b.match(/href="([^"?]+)\?format=ical"/)?.[1];need(path?.startsWith('/shows-calendar/'),'Chaos Bloom detail link missing');
  const url='https://chaosbloom.com'+path;
  // Squarespace item identity survives changes to title, slug, and event time.
  const id=b.match(/id="item-([a-f0-9]{24})"/)?.[1];need(id,'Chaos Bloom stable item ID missing');
  events.push({id:'chaos-'+id,title,start,end,url,location:q.get('location')||'Chaos Bloom Theater, 70 South Broadway, Denver',description:'Improv and sketch theater community. See the event page for the format, price, eligibility and tickets. Calendar listing does not book a seat or enroll you.\n\n'+url});
 }
 return events;
}
