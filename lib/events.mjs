import {cmcTimed,chaosBloom} from './community.mjs';
import {cerebral} from './runs.mjs';
// Only organizer-published, unauthenticated sources. Never forward visitor headers.
export const SOURCES = {
  'mingle-professional': {name:'Mingle Professional — Public Listings', url:'https://mingledenver.com/professional-club'},
  archipelago: {name:'Archipelago — Public Listings', url:'https://www.archipelagodenver.com/calendar'},
  'cerebral-congress-park': {name:'Cerebral Congress Park — Run Club',url:'https://cerebralbrewing.com/program/run-club'},
  ephemeral: {name:'Ephemeral Run Club — Public Listings',url:'https://www.meetup.com/beer-you-can-only-get-here/'},
  'cmc-timed': {name:'CMC Denver & Boulder — Timed Events',url:'https://www.cmc.org/community/front-range-groups/denver/events'},
  'chaos-bloom': {name:'Chaos Bloom — Improv Shows & Jams',url:'https://chaosbloom.com/shows-calendar'},
  clayton: {name:'Clayton — Public Listings', url:'https://www.claytondenver.com/events/'}
};
const DAY=86400000;
const requireValue=(v,message)=>{if(!v)throw new Error(message);return v;};
export function clean(s='') {return String(s).replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,x)=>x[0]==='#'?String.fromCodePoint(x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):Number(x.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[x.toLowerCase()]).replace(/[\t ]+/g,' ').trim();}
function local(date,time){requireValue(/^\d{4}-\d\d-\d\d$/.test(date)&&/^\d\d:\d\d(?::\d\d)?$/.test(time),'Invalid organizer date/time');return date.replaceAll('-','')+'T'+time.replaceAll(':','').padEnd(6,'0');}
function utc(s){const d=new Date(s.replace(' ','T')+'Z');requireValue(Number.isFinite(+d),'Invalid UTC date');return d.toISOString().replace(/[-:]/g,'').replace('.000','');}
function dayPlus(s,n){return new Date(Date.parse(s+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);}
function slug(ev){return String(ev.name||'event').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\+/g,' plus ').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60).replace(/-+$/,'')+'-'+ev.id.slice(0,8);}
export function mingle(data){
  requireValue(Array.isArray(data.events),'Mingle schema changed');
  return data.events.filter(e=>['Networking','Workshop','Panel'].includes(e.category)).map(e=>{
    requireValue(e.id&&e.name&&e.date&&e.time,'Incomplete Mingle event');
    const url='https://mingledenver.com/events/'+slug(e);
    return {id:'mingle-'+e.id,title:e.name,start:local(e.date,e.time),end:e.end_time?local(e.end_time<=e.time?dayPlus(e.date,1):e.date,e.end_time):null,tz:true,url,location:[e.venue,e.area].filter(Boolean).join(', '),description:[e.price?'Price: '+e.price:'',e.description,'RSVP or application may be required. Calendar listing does not register you.',!e.end_time?'End time not published.':'',url].filter(Boolean).join('\n\n')};
  });
}
export function archipelago(data){
  requireValue(data.auth_status?.code===0&&data.response?.success,'Archipelago source refused or failed');
  const d=data.response.data;
  requireValue(Array.isArray(d?.items_with_dates),'Archipelago schema changed');
  if(!d.items_with_dates.length)return [];
  requireValue(Array.isArray(d.cache?.registrables),'Archipelago missing event cache');
  const visibleIds=new Set(d.items_with_dates.filter(x=>!x.is_date).map(x=>String(x.value).split('_')[0]));
  return d.cache.registrables.filter(e=>e.display_on_app!==false&&visibleIds.has(String(e.id))&&!/\b(?:private|member) rental\b/i.test(e.title)).map(e=>{
    requireValue(e.id&&e.title&&e.event_datetime&&e.end_datetime,'Incomplete Archipelago event');
    return {id:'archipelago-'+e.id,title:e.title,start:utc(e.event_datetime),end:utc(e.end_datetime),url:e.share_url,location:e.location_title||'Archipelago, 2345 7th Street, Denver',cancelled:e.is_cancelled===true,modified:e.last_deep_updated?utc(e.last_deep_updated):null,description:[clean(e.description),'Instructor: '+(e.instructor_name||'Not listed'),e.requires_payment?'Payment may be required.':'Check registration for access and pricing.','Publicly listed; guest eligibility and registration requirements vary. This is not an RSVP.',e.share_url].join('\n\n')};
  });
}
function clockTime(s){const m=s.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);requireValue(m,'Invalid Clayton time');return String(Number(m[1])%12+(m[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')+':'+m[2]+':00';}
export function clayton(html,year,month){
  requireValue(html.includes('id="events-container"')&&html.includes('events-list'),'Clayton calendar missing');
  const section=html.split('id="events-container"')[1].split('Frequently Asked Questions')[0];
  const chunks=section.split('events-list-day').slice(1);
  if(!chunks.length){requireValue(/no events/i.test(section),'Clayton calendar empty without explicit empty message');return [];}
  const out=[];
  for(const chunk of chunks){
    const day=chunk.match(/uk-h1[^>]*>\s*(\d{1,2})\s*</)?.[1];
    requireValue(day,'Clayton day missing');
    const date=`${year}-${String(month).padStart(2,'0')}-${day.padStart(2,'0')}`;
    for(const m of chunk.matchAll(/<span class="uk-text-nowrap">([\s\S]*?)<a[^>]*href="(\/events\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/g)){
      const time=clean(m[1]),title=clean(m[3]),url='https://www.claytondenver.com'+m[2];
      const times=[...time.matchAll(/\d{1,2}:\d{2}\s*(?:am|pm)/gi)].map(x=>clockTime(x[0]));
      requireValue(times.length===0||times.length===2,'Clayton ambiguous time range');
      out.push({id:'clayton-'+m[2].split('/').filter(Boolean).at(-1)+'-'+date,title:times.length?title:title+' (time not published)',start:times.length?local(date,times[0]):date.replaceAll('-',''),end:times.length?local(times[1]<=times[0]?dayPlus(date,1):date,times[1]):null,dateOnly:!times.length,tz:!!times.length,url,location:'See organizer listing',description:['Public listing; many Clayton activities require membership or a member guest invitation. Check access at the organizer link before attending.',!times.length?'Time not published: shown as an all-day placeholder, not an all-day event.':'',url].filter(Boolean).join('\n\n')});
    }
  }
  requireValue(out.length,'Clayton listed days but parsed no events');return out;
}
async function get(url,type,fetcher){const r=await fetcher(url,{signal:AbortSignal.timeout(20000),headers:{Accept:type==='json'?'application/json':'text/html'}});requireValue(r.ok,`Organizer HTTP ${r.status}`);return type==='json'?r.json():r.text();}
export async function collect(source,{now=new Date(),fetcher=fetch}={}){
  let events;
  if(source==='chaos-bloom')events=chaosBloom(await get(SOURCES[source].url,'html',fetcher),{now});
  else if(source==='cmc-timed'){
    const urls=['https://www.cmc.org/community/front-range-groups/denver/events/upcoming-denver-group-events/ical-view','https://www.cmc.org/community/front-range-groups/boulder/calendar-of-events-trips-and-courses/upcoming-boulder-group-events-trips-and-courses/ical-view'];
    const feeds=[];for(const url of urls)feeds.push({url,ics:await get(url,'html',fetcher)});events=cmcTimed(feeds);
  }
  else if(source==='cerebral-congress-park')events=cerebral(await get('https://cerebralbrewing.com/events','html',fetcher));
  else if(source==='mingle-professional')events=mingle(await get('https://api.mingledenver.com/api/mingle-events/upcoming','json',fetcher));
  else if(source==='archipelago'){
    const start=new Date(+now-7*DAY).toISOString().slice(0,10)+' 00:00:00';
    const end=new Date(+now+120*DAY).toISOString().slice(0,10)+' 23:59:59';
    const q=new URLSearchParams({fitspot_id:'471',start_datetime:start,end_datetime:end});
    events=archipelago(await get('https://api.fitdegree.com/schedule/item/app-view/?'+q,'json',fetcher));
  } else if(source==='clayton'){
    const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const [y,m]=localDate.split('-').map(Number);events=[];
    // Displayed calendar dates override the site's stale JSON-LD metadata.
    for(let i=0;i<4;i++){const d=new Date(Date.UTC(y,m-1+i,15));const month=d.toLocaleString('en-US',{month:'long',timeZone:'UTC'});const year=d.getUTCFullYear();const q=new URLSearchParams({month,year:String(year),view:'list'});events.push(...clayton(await get('https://www.claytondenver.com/events/?'+q,'html',fetcher),year,d.getUTCMonth()+1));}
  }else throw new Error('Unknown source');
  // Omit unknown-time listings rather than create all-day placeholders.
  events=events.filter(e=>!e.dateOnly);
  const ids=new Set();for(const e of events){requireValue(!ids.has(e.id),'Duplicate organizer event ID');ids.add(e.id);requireValue(e.url?.startsWith('https://'),'Missing event URL');}
  return events;
}
export const escapeICS=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
export function fold(line){let out='',part='',bytes=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>75){out+=part+'\r\n';part=' ';bytes=1;}part+=ch;bytes+=n;}return out+part;}
export function calendar(source,events,now=new Date()){
  const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Denver Community Feeds//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escapeICS(SOURCES[source].name),'X-WR-TIMEZONE:America/Denver','REFRESH-INTERVAL;VALUE=DURATION:PT1H','BEGIN:VTIMEZONE','TZID:America/Denver','BEGIN:DAYLIGHT','DTSTART:20070311T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','TZOFFSETFROM:-0700','TZOFFSETTO:-0600','TZNAME:MDT','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:20071104T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','TZOFFSETFROM:-0600','TZOFFSETTO:-0700','TZNAME:MST','END:STANDARD','END:VTIMEZONE'];
  for(const e of events){
    const param=e.dateOnly?';VALUE=DATE':e.tz?';TZID=America/Denver':'';
    lines.push('BEGIN:VEVENT','UID:'+escapeICS(e.id)+'@denver-community-event-feeds','DTSTAMP:'+stamp,'DTSTART'+param+':'+e.start);
    if(e.end)lines.push('DTEND'+param+':'+e.end);
    if(e.modified)lines.push('LAST-MODIFIED:'+e.modified);
    lines.push('SUMMARY:'+escapeICS(e.title),'DESCRIPTION:'+escapeICS(e.description),'LOCATION:'+escapeICS(e.location),'URL:'+escapeICS(e.url),'TRANSP:TRANSPARENT','STATUS:'+(e.cancelled?'CANCELLED':'CONFIRMED'),'END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export async function feedResponse(source,options={}){
  if(!SOURCES[source])return new Response('Unknown calendar',{status:404});
  try{const events=await collect(source,options);return new Response(calendar(source,events,options.now),{headers:{'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'public, max-age=900','X-Event-Count':String(events.length),'X-Content-Type-Options':'nosniff'}});}
  catch(e){console.error('Calendar refresh failed:',source,String(e));return new Response('Organizer unavailable or changed format. Retry later; no empty replacement calendar was emitted.',{status:503,headers:{'Retry-After':'900','Cache-Control':'no-store'}});}
}
