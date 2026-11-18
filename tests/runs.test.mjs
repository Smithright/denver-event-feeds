import test from 'node:test';
import assert from 'node:assert/strict';
import {cerebral,ephemeralCalendar} from '../lib/runs.mjs';
import {calendar} from '../lib/events.mjs';
const event=(start='2027-03-16T00:00:00+00:00',end='2027-03-16T02:00:00+00:00',access='public')=>`{id:"abc",title:"Run Club",description:d,event_start_at:"${start}",event_end_at:"${end}",location:"Congress Park",access:"${access}"}`;
test('Cerebral uses organizer UTC across DST, excludes nonpublic, and fails closed on broken data',()=>{
 const events=cerebral(event());assert.equal(events[0].start,'20270316T000000Z');assert.match(calendar('cerebral-congress-park',events),/DTSTART:20270316T000000Z/);
 assert.equal(cerebral(event(undefined,undefined,'members')).length,0);
 assert.throws(()=>cerebral('<html>changed</html>'),/missing/);
 assert.throws(()=>cerebral(event('bad')),/timestamp/);
 assert.throws(()=>cerebral(event(undefined,'2027-03-15T00:00:00Z')),/Incomplete/);
});
test('Ephemeral preserves native run IDs, timezone, cancellation, and folded description while removing trivia',()=>{
 const run='BEGIN:VEVENT\r\nUID:one\r\nSUMMARY:Ephemeral Run Club!\r\nDTSTART;TZID=America/Denver:20261119T180000\r\nSTATUS:CANCELLED\r\nDESCRIPTION:A long\r\n  line\r\nEND:VEVENT\r\n';
 const trivia=run.replace('UID:one','UID:two').replace('Ephemeral Run Club!','Beer Bar Trivia!');
 const {ics,count}=ephemeralCalendar('BEGIN:VCALENDAR\r\nX-WR-CALNAME:Mixed\r\nBEGIN:VTIMEZONE\r\nTZID:America/Denver\r\nEND:VTIMEZONE\r\n'+run+trivia+'END:VCALENDAR\r\n');
 assert.equal(count,1);assert.ok(ics.includes(run.replace('END:VEVENT','TRANSP:TRANSPARENT\r\nEND:VEVENT')));assert.ok(ics.includes('BEGIN:VTIMEZONE'));assert.ok(!ics.includes('UID:two'));assert.ok(!ics.includes('\r\r'));
 assert.throws(()=>ephemeralCalendar('blocked'),/Invalid/);assert.throws(()=>ephemeralCalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR'),/no dated/);
});
