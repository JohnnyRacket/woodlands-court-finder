-- Before the sync learned about the 1-hour booking cutoff, it stored ActiveNet's "taken" for hours
-- that could no longer be booked, as if they were reserved. Drop every slot reading and status
-- change seen at or after its hour's cutoff (start − 1 hour). All rows date from October 2026
-- (CDT, UTC−5), so the cutoff in UTC is the local start + 4 hours.
DELETE FROM `slots`
WHERE julianday(`fetched_at`) >= julianday(`date` || ' ' || printf('%02d:00:00', `hour`), '+4 hours');
--> statement-breakpoint
DELETE FROM `slot_changes`
WHERE julianday(`observed_at`) >= julianday(`date` || ' ' || printf('%02d:00:00', `hour`), '+4 hours');
