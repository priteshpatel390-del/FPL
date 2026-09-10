CREATE TABLE IF NOT EXISTS observer_dispatch_receipts (
  opportunity_at TEXT PRIMARY KEY NOT NULL,
  cron TEXT NOT NULL CHECK (cron IN ('17 4 * * *','17 8 * * *')),
  dispatch_state TEXT NOT NULL CHECK (dispatch_state IN ('CLAIMED','DISPATCHED','FAILED','AMBIGUOUS')),
  github_run_id INTEGER UNIQUE,
  reason_code TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  finalized_at TEXT,
  CHECK (
    (dispatch_state = 'DISPATCHED' AND github_run_id IS NOT NULL AND finalized_at IS NOT NULL)
    OR (dispatch_state IN ('FAILED','AMBIGUOUS') AND github_run_id IS NULL AND finalized_at IS NOT NULL)
    OR (dispatch_state = 'CLAIMED' AND github_run_id IS NULL AND finalized_at IS NULL)
  )
);
