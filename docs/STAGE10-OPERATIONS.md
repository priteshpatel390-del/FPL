# STAGE10-OPERATIONS.md — Live-season evidence operations
Purpose: phone-first operating and disaster-recovery procedure for Stage 10. Last updated: 2026-08-12.

## What is live today

**Local capture, recovery and owner-controlled export are the operating evidence path.** Automatic cloud custody is implemented as the GW1-P2 candidate on draft PR #119, but it is unaccepted and unmerged, so it is not part of this procedure and must not be relied on. Every step below is therefore local and owner-driven, and it stays that way until PR #119 passes its physical acceptance and is merged. See [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).

Navigation note: evidence surfaces live under **Settings → Evidence & Performance**. The former `More` area no longer exists; older Stage 10 records describing it are historical.

## Before every deadline
1. Open Teamsheet in Safari during the preferred 20–10 minute window.
2. Let the verified refresh complete, then open Settings → Evidence & Performance → Deadline evidence.
3. Confirm the current Gameweek is Official-eligible. “Recorded only” is valid diagnostic evidence but is not official.
4. If capture is still due, keep the visible page open. Teamsheet retries every five minutes, at most three times for the same verified dataset and timing priority, and stops at the two-minute safety cutoff.
5. Use Diagnostic capture only before the cutoff when automatic capture has not succeeded.
6. Request the snapshot JSON and confirm the deterministic file appears in Files or Downloads. A browser click is not proof that the file was retained.

## After a Gameweek
1. Open Teamsheet after Official FPL marks the event checked.
2. Provisional outcomes remain outside metrics. Complete or corrected outcomes create immutable downstream revisions.
3. Confirm the evaluated Gameweek appears in Settings → Evidence & Performance → Operating review.
4. Request the weekly operating-review JSON and verify it in Files. Import only the required CSV tables into Google Sheets.
5. After a correction, retain the earlier export if an audit trail is wanted and request the corrected weekly bundle.

## Warning meanings
- Official-eligible: locally captured prospective evidence that passed timing and completeness rules.
- Recorded only: valid evidence that cannot qualify officially.
- Recovery only: imported or origin-unproven evidence; never official/current.
- Provisional: official outcome checking is incomplete.
- Complete/Corrected: authoritative outcome revision eligible for evaluation.
- Partial review: derived metrics remain usable, but one or more exact source/revision payloads are missing.
- Storage attention required: the app failed closed; export accessible records before reset or deletion.

## Durable backup schedule
- Every deadline: snapshot JSON.
- Every complete or corrected Gameweek: weekly operating-review JSON.
- As needed: CSV tables for manual Google Sheets import.
- Monthly, before clearing browser data, and before changing devices: season operating-review JSON.

## Storage loss and disaster recovery
1. Do not reset or delete storage until accessible files have been checked.
2. Restore snapshot/outcome JSON only through the recovery controls. Restored records remain recovery-only and cannot establish local official/current status.
3. Imported files are never silently migrated or rewritten. Unknown versions fail closed and the original file remains owner-controlled.
4. A trustworthy interrupted-write journal may complete a local transaction. An orphan without that journal is never promoted to official/current.
5. Local metric views may not be reconstructable from recovery-only imports. The exported operating-review JSON is the durable audit copy.
6. Static GitHub Pages cannot collect while Safari is fully closed or suspended. Reopen Teamsheet to resume checks.

## Manual Google Sheets boundary
Use the future dedicated Teamsheet Google account. Keep the live 2026/27 workbook separate from historical read-only data. Import one deterministic CSV into its matching tab, preserve IDs/hashes/revisions, and retain canonical JSON outside the sheet. No OAuth, workbook ID or unattended append exists in Stage 10.5.

## Completion wording
Stage 10 collection and evaluation infrastructure is complete; prospective model validation remains in progress. This does not prove accuracy, calibration, external timestamp notarisation or guaranteed closed-app collection.
