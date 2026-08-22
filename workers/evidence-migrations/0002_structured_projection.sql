PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO schema_migrations(version,name,applied_at)
VALUES (2,'cloudflare-data-p1-structured-projection',CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS prediction_snapshots (
  content_hash TEXT PRIMARY KEY CHECK(length(content_hash)=64),
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL CHECK(gameweek BETWEEN 1 AND 38),
  deadline_time TEXT NOT NULL,
  capture_completed_at TEXT NOT NULL,
  horizon INTEGER NOT NULL CHECK(horizon BETWEEN 1 AND 8),
  timing_grade TEXT NOT NULL CHECK(timing_grade IN ('network_attested','client_recorded','clock_conflict','late')),
  official_eligible INTEGER NOT NULL CHECK(official_eligible IN (0,1)),
  build_commit TEXT NOT NULL,
  build_source_hash TEXT NOT NULL,
  model_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  simulation_version TEXT NOT NULL,
  FOREIGN KEY(content_hash) REFERENCES evidence_records(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prediction_snapshots_season_gw
  ON prediction_snapshots(season,gameweek,capture_completed_at);

CREATE TABLE IF NOT EXISTS prediction_gameweeks (
  content_hash TEXT NOT NULL,
  event_id INTEGER NOT NULL CHECK(event_id BETWEEN 1 AND 38),
  event_json TEXT NOT NULL CHECK(json_valid(event_json)),
  PRIMARY KEY(content_hash,event_id),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prediction_teams (
  content_hash TEXT NOT NULL,
  team_id INTEGER NOT NULL CHECK(team_id > 0),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  team_json TEXT NOT NULL CHECK(json_valid(team_json)),
  PRIMARY KEY(content_hash,team_id),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prediction_teams_team
  ON prediction_teams(team_id,content_hash);

CREATE TABLE IF NOT EXISTS prediction_players (
  content_hash TEXT NOT NULL,
  player_id INTEGER NOT NULL CHECK(player_id > 0),
  team_id INTEGER,
  position INTEGER,
  web_name TEXT NOT NULL,
  now_cost REAL,
  status TEXT NOT NULL,
  chance_of_playing REAL,
  player_json TEXT NOT NULL CHECK(json_valid(player_json)),
  PRIMARY KEY(content_hash,player_id),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prediction_players_player
  ON prediction_players(player_id,content_hash);
CREATE INDEX IF NOT EXISTS prediction_players_team
  ON prediction_players(content_hash,team_id,position);

CREATE TABLE IF NOT EXISTS prediction_fixtures (
  content_hash TEXT NOT NULL,
  fixture_id INTEGER NOT NULL CHECK(fixture_id > 0),
  event INTEGER,
  kickoff_time TEXT,
  team_h INTEGER,
  team_a INTEGER,
  finished INTEGER NOT NULL CHECK(finished IN (0,1)),
  fixture_json TEXT NOT NULL CHECK(json_valid(fixture_json)),
  PRIMARY KEY(content_hash,fixture_id),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS prediction_fixtures_event
  ON prediction_fixtures(content_hash,event,kickoff_time);

CREATE TABLE IF NOT EXISTS provider_observations (
  content_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('fpl','understat','odds','archive')),
  state TEXT NOT NULL CHECK(state IN ('Live','Cached','Stale','Fallback','Partial','Disabled','Unavailable')),
  included INTEGER NOT NULL CHECK(included IN (0,1)),
  did_affect_model INTEGER NOT NULL CHECK(did_affect_model IN (0,1)),
  accepted_record_count INTEGER NOT NULL CHECK(accepted_record_count >= 0),
  rejected_record_count INTEGER NOT NULL CHECK(rejected_record_count >= 0),
  last_success_at TEXT,
  recorded_at TEXT,
  age_ms REAL,
  threshold_ms REAL,
  PRIMARY KEY(content_hash,provider),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS provider_observations_provider
  ON provider_observations(provider,state,recorded_at);

CREATE TABLE IF NOT EXISTS player_predictions (
  content_hash TEXT NOT NULL,
  player_id INTEGER NOT NULL CHECK(player_id > 0),
  club_id INTEGER,
  position INTEGER,
  now_cost REAL,
  status TEXT NOT NULL,
  chance_of_playing REAL,
  next_gameweek INTEGER,
  next_gameweek_total REAL,
  horizon_from_gameweek INTEGER,
  horizon INTEGER NOT NULL CHECK(horizon BETWEEN 1 AND 8),
  horizon_total REAL,
  minutes_json TEXT NOT NULL CHECK(json_valid(minutes_json)),
  uncertainty_json TEXT NOT NULL CHECK(json_valid(uncertainty_json)),
  source_usage_json TEXT NOT NULL CHECK(json_valid(source_usage_json)),
  per_gameweek_json TEXT NOT NULL CHECK(json_valid(per_gameweek_json)),
  aggregate_json TEXT NOT NULL CHECK(json_valid(aggregate_json)),
  PRIMARY KEY(content_hash,player_id),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS player_predictions_player
  ON player_predictions(player_id,content_hash);
CREATE INDEX IF NOT EXISTS player_predictions_next_gw
  ON player_predictions(content_hash,next_gameweek,next_gameweek_total);

CREATE TABLE IF NOT EXISTS structured_projection_runs (
  content_hash TEXT PRIMARY KEY CHECK(length(content_hash)=64),
  projection_version INTEGER NOT NULL CHECK(projection_version > 0),
  status TEXT NOT NULL CHECK(status='complete'),
  projected_at TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK(row_count > 0),
  section_counts_json TEXT NOT NULL CHECK(json_valid(section_counts_json)),
  FOREIGN KEY(content_hash) REFERENCES prediction_snapshots(content_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS structured_projection_runs_projected
  ON structured_projection_runs(projected_at);
