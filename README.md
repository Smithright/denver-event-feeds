# Denver public event feed adapters

Seven read-only public iCalendar files, refreshed by GitHub Actions every six hours (00:17, 06:17, 12:17 and 18:17 UTC). Google controls its own polling schedule; GitHub schedules can be delayed. This is the authoritative publisher. Subscription base URL: `https://raw.githubusercontent.com/Smithright/denver-event-feeds/main/feeds/`.

- `/feeds/mingle-professional.ics`: public Mingle networking, workshop and panel listings. Supplements existing New Friends and Singles Meetup calendars.
- `/feeds/archipelago.ics`: Archipelago's public fitDEGREE schedule, minus private/member rentals. Seven-day lookback and 120-day horizon. Registration restrictions remain in event descriptions.
- `/feeds/clayton.ics`: dates in Clayton's rendered monthly calendar, this month plus three months. Many listings require membership or a guest invitation. Listings without published times are omitted.

- `/feeds/cerebral-congress-park.ics`: explicit dated Congress Park Run Club entries from Cerebral’s public event page. This covers Congress Park only; it does not invent Wednesday/Thursday events for other taprooms.
- `/feeds/ephemeral.ics`: Ephemeral Run Club entries filtered from the organizer’s Meetup calendar, excluding trivia. Original event identity, dates, timezone, and cancellation status are preserved.

Only public event fields are returned. No calendar credentials, email addresses, attendees, employee records or account data are stored. Calendar entries are transparent (free), with no alarms or invitations. These feeds do not RSVP or purchase tickets.

## Source discovery, 2026-11-18

Mingle's official `/assets/events.js` identifies `https://api.mingledenver.com/api/mingle-events/upcoming` and category mapping. API yielded 67 events, 16 professional.

Archipelago's official `/calendar` embeds `fd-live-schedule-widget` with fitspot 471. The public widget at `https://widget.fitdegree.com/471/live-schedule/` uses `https://api.fitdegree.com/schedule/item/app-view/` with fitspot_id, start_datetime and end_datetime. UTC times were checked against the displayed Denver schedule. The full live adapter yielded 38 listings after rental exclusions. It propagates explicit cancellation flags. Source cache objects outside the displayed schedule are excluded.

Clayton's official `/events/?month=November&year=2026&view=list` exposes per-day times and links. Its JSON-LD still describes October, so it is deliberately ignored. The adapter yielded 56 entries across November-February, including past days of the current month. Per-occurrence UIDs use event path plus listed date. Date changes can replace the occurrence; title/time edits retain identity. No recurrence is invented from vague 'Monthly' labels.

DAC: no authorized public calendar feed or event newsletter signup verified. Public Events navigation sells event space; club schedule is in member services. The legacy ceclients print-calendar endpoint rejected direct retrieval (403). No login restriction bypass attempted.

Lighthouse: newsletter form offers Upcoming Events. Public workshop listing renders in the browser but direct, unattended requests receive 403. No reliable live adapter shipped; copying today's events would not make a subscription.

Cerebral: public server-rendered `/events` includes dated event IDs and UTC times. Only public Congress Park Run Club entries are included; scripts are parsed as text, never executed.

Ephemeral: `https://www.meetup.com/beer-you-can-only-get-here/events/ical/` mixes run club and trivia. Exact run-title filtering retains native event blocks and timezone definitions.

## Timed calendar cleanup, 2026-11-18

- `/feeds/cmc-timed.ics` merges the official Denver and Boulder ICS feeds, deduplicates organizer UIDs, and omits date-only and local-midnight-to-23:59/midnight placeholders. Genuine trip meeting times must be checked with CMC; this feed does not invent them.
- `/feeds/chaos-bloom.ics` reads upcoming event cards from the official shows calendar, including shows, jams and drop-in classes. It uses the organizer’s Google Calendar export timestamps, stable Squarespace item IDs and a 120-day horizon. Closure announcements are excluded.
- Clayton no longer publishes its unknown-time all-day placeholders. Eight were omitted in the first corrected refresh.

## Refresh and failure semantics

Each job fetches each organizer independently and atomically replaces only successfully validated feeds. A failed source retains its last good file; other sources can still update. `status.json` records checkedAt, count, lastSuccess and errors. Failure marks the GitHub workflow failed. Stable UIDs allow title/time edits without duplicates. Archipelago's explicit cancellation flag becomes STATUS:CANCELLED. Removed listings disappear from the next successful snapshot; client deletion timing varies. Clayton date changes replace an occurrence because its source has no per-occurrence ID. The feeds cannot report unpublished cancellations.

Calendars show possibilities as free, not busy, and have no reminders or invitations. Origin markup/API changes may require maintenance. No private calendar information is included.

## Run and verify

Requires Node 22 or newer; no npm dependencies.

```
node --test
node refresh.mjs
```

Tests cover Denver DST/overnight wall time, stable IDs under edits, absence of invented end times, category filtering, UTF-8 line folding and escaping, explicit cancellations, rental/cache exclusions, upstream failures, and Clayton dates versus stale metadata.

GitHub Actions uses pinned action revisions and a repository-scoped GITHUB_TOKEN; no added external secrets. Successful runs update the tracked freshness receipt as well as feeds. See Actions for execution evidence; a schedule alone is not evidence of a successful refresh.
