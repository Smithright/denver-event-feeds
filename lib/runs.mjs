// Parse only explicit dated public listings; never execute organizer scripts.
export function cerebral(html) {
  const blocks=[...html.matchAll(/\{id:"[^"\n]+",title:"Run Club"[^{}]+\}/g)].map(m=>m[0]);
  if(!blocks.length)throw new Error('Cerebral dated Run Club listings missing');
  const value=(block,key)=>{const m=block.match(new RegExp('(?:^\\{|,)'+key+':("(?:[^"\\\\]|\\\\.)*")'));return m?JSON.parse(m[1]):null;};
  return blocks.filter(b=>value(b,'location')==='Congress Park'&&value(b,'access')==='public').map(b=>{
    const id=value(b,'id'),start=value(b,'event_start_at'),end=value(b,'event_end_at');
    const stamp=s=>{if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/.test(s||'')||!Number.isFinite(Date.parse(s)))throw new Error('Invalid Cerebral timestamp');return new Date(s).toISOString().replace(/[-:]/g,'').replace('.000','');};
    if(!id||!end||Date.parse(end)<=Date.parse(start))throw new Error('Incomplete Cerebral event');
    const url='https://cerebralbrewing.com/event/'+id;
    return {id:'cerebral-'+id,title:'Cerebral Run Club — Congress Park',start:stamp(start),end:stamp(end),url,location:'Cerebral Brewing — Congress Park',description:'Denver Athletics community run. All levels welcome; social time at the taproom afterward. Check the organizer listing for route, address and holiday/weather changes. Calendar listing is not registration.\n\n'+url};
  });
}
export function ephemeralCalendar(ics) {
  // Preserve native UIDs, dates, timezone definitions, exceptions and cancellation status.
  const s=ics.replace(/\r?\n/g,'\r\n');
  if(!s.startsWith('BEGIN:VCALENDAR\r\n')||!s.includes('END:VCALENDAR'))throw new Error('Invalid Ephemeral calendar');
  const all=[...s.matchAll(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g)].map(m=>m[0]);
  if(!all.length)throw new Error('Ephemeral source has no dated events');
  let count=0;
  const filtered=s.replace(/BEGIN:VEVENT\r\n[\s\S]*?END:VEVENT\r\n/g,block=>{
    if(!/^SUMMARY:Ephemeral Run Club!?\s*$/mi.test(block.replace(/\r\n[ \t]/g,'')))return '';
    if(!/^UID:.+/m.test(block)||!/^DTSTART[;:].+/m.test(block))throw new Error('Incomplete Ephemeral run');
    count++;return block.replace(/^TRANSP:.*\r\n/gm,'').replace('END:VEVENT','TRANSP:TRANSPARENT\r\nEND:VEVENT');
  }).replace(/^X-WR-CALNAME:.*$/gm,'X-WR-CALNAME:Ephemeral Run Club — Public Listings');
  return {ics:filtered,count};
}
