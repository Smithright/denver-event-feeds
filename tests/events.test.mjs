import test from 'node:test';
import assert from 'node:assert/strict';
import {mingle,archipelago,clayton,calendar,feedResponse,fold} from '../lib/events.mjs';
const ev={id:'12345678',name:'Networking',category:'Networking',date:'2027-03-13',time:'23:30:00',end_time:'03:00:00',venue:'Denver'};
test('overnight event keeps Denver wall time across DST, IDs survive edits',()=>{
 const a=mingle({events:[ev]})[0],b=mingle({events:[{...ev,name:'New title',date:'2027-03-14'}]})[0];
 assert.equal(a.start,'20270313T233000');assert.equal(a.end,'20270314T030000');assert.equal(a.id,b.id);
 const text=calendar('mingle-professional',[a]);assert.match(text,/DTSTART;TZID=America\/Denver:20270313T233000/);assert.match(text,/TZOFFSETTO:-0600/);
});
test('no invented duration, and non-professional events excluded',()=>{
 const a=mingle({events:[{...ev,end_time:null},{...ev,category:'Singles Mixer'}]});assert.equal(a.length,1);assert.equal(a[0].end,null);
});
test('ICS text cannot inject fields and UTF-8 folding obeys octet limit',()=>{
 const a=mingle({events:[{...ev,name:'Hello\nATTENDEE:intruder@example.com;👋,\\'}]});const text=calendar('mingle-professional',a);
 assert(!text.includes('\r\nATTENDEE:'));for(const line of text.split('\r\n'))assert(Buffer.byteLength(line)<=75);
 const long='SUMMARY:'+ '👋'.repeat(50);assert.equal(fold(long).replaceAll('\r\n ',''),long);
});
test('explicit cancellation is emitted; private rental and cache-only objects excluded',()=>{
 const item={id:'1',title:'Circling',display_on_app:true,event_datetime:'2026-11-19 01:00:00',end_datetime:'2026-11-19 04:15:00',share_url:'https://share.fitdegree.com/?r=1',is_cancelled:true};
 const data={auth_status:{code:0},response:{success:true,data:{items_with_dates:[{is_date:false,value:'1_5_x'},{is_date:false,value:'2_5_x'}],cache:{registrables:[item,{...item,id:'2',title:'Private Rental: The Mansion'},{...item,id:'3'}]}}}};
 const out=archipelago(data);assert.equal(out.length,1);assert.equal(out[0].start,'20261119T010000Z');assert.match(calendar('archipelago',out),/STATUS:CANCELLED/);
});
test('HTTP failure and schema change cannot become a successful empty calendar',async()=>{
 for(const fetcher of [async()=>new Response('down',{status:500}),async()=>Response.json({renamed:[]})]){
  const r=await feedResponse('mingle-professional',{fetcher});assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'no-store');assert(!(await r.text()).includes('BEGIN:VCALENDAR'));
 }
});
test('Clayton reads displayed day and labels missing time rather than trusting stale metadata',()=>{
 const html='<div id="events-container"><ul class="events-list"><div class="events-list-day"><span class="uk-h1">26</span><span class="uk-text-nowrap">11:00 am - 4:00 pm</span><a href="/events/feast/">Feast</a><span class="uk-text-nowrap"></span><a href="/events/wine/">Wine</a></div></ul></div>';
 const out=clayton(html,2026,11);assert.equal(out.length,2);assert.equal(out[0].start,'20261126T110000');assert.equal(out[0].end,'20261126T160000');assert.equal(out[1].dateOnly,true);assert.match(out[1].title,/time not published/);assert.throws(()=>clayton('<html>Access denied</html>',2026,11));
});
