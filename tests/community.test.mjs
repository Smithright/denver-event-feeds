import test from 'node:test';
import assert from 'node:assert/strict';
import {cmcTimed,chaosBloom} from '../lib/community.mjs';
import {collect,calendar} from '../lib/events.mjs';
const event=(id,start,end)=>`BEGIN:VEVENT\nUID:${id}\nSUMMARY:Run\\, talk\nDTSTART:${start}\nDTEND:${end}\nEND:VEVENT\n`;
const feed=s=>({ics:'BEGIN:VCALENDAR\n'+s+'END:VCALENDAR',url:'https://www.cmc.org/calendar'});
test('CMC suppresses midnight placeholders across DST, retains timed events, deduplicates groups',()=>{
 const timed=event('timed','20261120T013000Z','20261120T030000Z');
 const out=cmcTimed([feed(timed+event('winter','20261120T070000Z','20261121T065900Z')+event('dst','20270314T070000Z','20270315T055900Z')),feed(timed)]);
 assert.equal(out.length,1);assert.equal(out[0].title,'Run, talk');assert.equal(out[0].start,'20261120T013000Z');
 assert.throws(()=>cmcTimed([feed(event('bad','bad','bad'))]),/timestamp/);
 assert.throws(()=>cmcTimed([{ics:'Access denied',url:'https://www.cmc.org'}]),/Invalid/);
});
const chaos=(title='Jam',dates='20261122T040000Z/20261122T050000Z')=>`<div class="eventlist"><article class="eventlist-event--upcoming"><a href="http://www.google.com/calendar/event?action=TEMPLATE&amp;text=${encodeURIComponent(title)}&amp;dates=${dates}&amp;location=Denver" class="eventlist-meta-export-google">Calendar</a><a href="/shows-calendar/jam?format=ical">ICS</a><div id="item-0123456789abcdef01234567"></div></article></div>`;
test('Chaos uses exact exported times and stable identity, omits closures and fails on missing times',()=>{
 const opts={now:new Date('2026-11-18T00:00:00Z')};const out=chaosBloom(chaos(),opts);
 assert.equal(out.length,1);assert.equal(out[0].start,'20261122T040000Z');assert.equal(out[0].id,chaosBloom(chaos('Changed title'),opts)[0].id);
 assert.equal(chaosBloom(chaos('CLOSED'),opts).length,0);assert.throws(()=>chaosBloom(chaos('Jam','20261122/20261123'),opts),/timestamp/);
});
test('Clayton publication omits unknown-time placeholders without inventing a start time',async()=>{
 const html='<div id="events-container"><ul class="events-list"><div class="events-list-day"><span class="uk-h1">26</span><span class="uk-text-nowrap">11:00 am - 4:00 pm</span><a href="/events/feast/">Feast</a><span class="uk-text-nowrap"></span><a href="/events/wine/">Wine</a></div></ul></div>';
 const events=await collect('clayton',{now:new Date('2026-11-18'),fetcher:async()=>new Response(html)});
 assert.equal(events.length,4);assert.ok(events.every(e=>!e.dateOnly));assert.ok(!calendar('clayton',events).includes('VALUE=DATE'));
});
