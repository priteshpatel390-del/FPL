/* ---------------------------------------------------------------------
   INPUT INTEGRITY (Stage 3, D-13) — validation and normalisation of
   provider payloads before any consumer sees them.

   Called from hydrate(), NOT from slim(), and deliberately so: hydrate
   runs for cached snapshots as well as fresh fetches, so a bad payload
   is re-reported on every load instead of being noticed once at fetch
   time and then silently served from cache forever. slim() keeps the
   raw-shaped list so the cached provider snapshot stays intact for
   provenance.

   Nothing here mutates the input array or any row in it.
   No scoring, weighting or calibration behaviour is touched.
   --------------------------------------------------------------------- */

// Fields whose disagreement between two rows sharing one identity is a real
// data conflict. `started`/`finished`/`provisional_start_time` are excluded:
// within a single response they are a benign in-flight artefact, not a
// contradiction about which match this is or how it is rated.
const MATERIAL_FIELDS = ['event', 'team_h', 'team_a',
  'team_h_difficulty', 'team_a_difficulty', 'kickoff_time'];

/* Identity of a fixture row.
   Provider `id` is primary and is trusted alone — a real FPL row always
   carries one, and genuine double gameweeks are distinct rows with
   distinct ids, so id-keyed dedupe can never collapse a real double.
   The composite key is a FALLBACK used only when `id` is absent; it is
   never used to second-guess an id that is present.
   Returns null when no safe identity exists — identity is never invented. */
function fixtureIdentity(f) {
  if (f === null || typeof f !== 'object' || Array.isArray(f)) return null;
  if (f.id !== undefined && f.id !== null) return 'id:' + f.id;
  // Note: a row WITH an id and a null event (postponed/TBD) is kept untouched
  // by the branch above. Only id-less rows need a complete composite.
  const { event, team_h, team_a } = f;
  if (event === undefined || event === null) return null;
  if (team_h === undefined || team_h === null) return null;
  if (team_a === undefined || team_a === null) return null;
  return 'k:' + event + '|' + team_h + '|' + team_a;
}

function materialDiff(a, b) {
  const out = [];
  for (const k of MATERIAL_FIELDS) if (!Object.is(a[k], b[k])) out.push(k);
  return out;
}

/* normaliseFixtures(input) -> { fixtures, issues }
   - exact duplicates (same identity, no material disagreement) collapse to
     the first occurrence;
   - conflicting duplicates keep the FIRST occurrence and raise an issue
     naming the disagreeing fields — never silently resolved;
   - rows with no safe identity are excluded and reported;
   - a non-array payload is fatal and yields an empty list. */
function normaliseFixtures(input) {
  const issues = [];

  if (!Array.isArray(input)) {
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixtures_not_array', severity: 'fatal', count: 1,
      received: input === null ? 'null' : typeof input });
    return { fixtures: [], issues };
  }

  const seen = new Map();
  const fixtures = [];
  const conflicts = [];
  let exactDuplicates = 0;
  let missingIdentity = 0;

  for (const row of input) {
    const key = fixtureIdentity(row);
    if (key === null) { missingIdentity++; continue; }

    if (!seen.has(key)) { seen.set(key, row); fixtures.push(row); continue; }

    const diff = materialDiff(seen.get(key), row);
    if (diff.length === 0) exactDuplicates++;
    else conflicts.push({ identity: key, fields: diff });
  }

  if (exactDuplicates)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_exact_duplicate', severity: 'partial',
      count: exactDuplicates });
  if (conflicts.length)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_conflicting_duplicate', severity: 'partial',
      count: conflicts.length, conflicts });
  if (missingIdentity)
    issues.push({ provider: 'fpl', endpoint: '/fixtures/',
      code: 'fixture_missing_identity', severity: 'partial',
      count: missingIdentity });

  return { fixtures, issues };
}

/* Payload-free rollup for the health strip: counts and worst severity only,
   never identities, team ids, or raw rows. Safe to render anywhere. */
function issueSummary(issues) {
  if (!Array.isArray(issues) || issues.length === 0)
    return { ok: true, worst: 'none', counts: {} };
  const counts = {};
  let worst = 'partial';
  for (const i of issues) {
    counts[i.code] = (counts[i.code] || 0) + (typeof i.count === 'number' ? i.count : 1);
    if (i.severity === 'fatal') worst = 'fatal';
  }
  return { ok: false, worst, counts };
}

/* =====================================================================
   PER-ENDPOINT SCHEMA VALIDATION (Stage 3 item 2, D-14)

   One focused function per endpoint, deliberately NOT a single generic
   validator: each endpoint's assumptions are the ones its consumers
   actually make, and burying them in a shared schema language would hide
   exactly the detail that matters when a feed drifts.

   Every validator:
     - returns { value, issues } and is pure;
     - never mutates the provider payload (filtered collections are new
       arrays/objects; surviving rows are passed through by reference);
     - never manufactures identifiers, values or missing structures;
     - distinguishes FATAL (payload cannot be safely consumed; value is
       null) from PARTIAL (bad rows dropped, usable remainder retained).

   Issue shape: { provider, endpoint, code, severity, count } plus at most
   a small bounded diagnostic field (field names, or a received-type string).
   Raw payloads and row contents never appear in issues.
   ===================================================================== */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
// FPL ids arrive as numbers, but relays occasionally stringify them.
const isId  = v => isNum(v) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v));

function mkIssue(provider, endpoint, code, severity, count, extra) {
  const i = { provider, endpoint, code, severity, count };
  if (extra) for (const k of Object.keys(extra)) i[k] = extra[k];
  return i;
}

/* Filter a collection of rows, keeping the first valid occurrence of each
   identity where an identity accessor is supplied. Returns counts so the
   caller can raise correctly-shaped issues. Never mutates. */
function filterRows(rows, isValid, identityOf) {
  const kept = [], seen = new Set();
  let invalid = 0, duplicate = 0;
  for (const row of rows) {
    if (!isValid(row)) { invalid++; continue; }
    if (identityOf) {
      const k = identityOf(row);
      if (seen.has(k)) { duplicate++; continue; }   // retain the FIRST valid row
      seen.add(k);
    }
    kept.push(row);
  }
  return { kept, invalid, duplicate };
}

/* ---- FPL /bootstrap-static/ ------------------------------------------
   Consumers: slim() + hydrate() (events, teams, elements, element_types).
   The four collections are load-bearing for every downstream view, so a
   missing one is fatal. Individual malformed rows are dropped. */
const BOOTSTRAP_COLLECTIONS = ['events', 'teams', 'elements', 'element_types'];

/* Structural (fatal-only) check. Split out so the fresh-fetch path can
   guard slim() from throwing WITHOUT filtering rows before the snapshot is
   cached — D-13 keeps the cached snapshot raw-shaped for provenance, and
   row-level filtering belongs in hydrate() where both paths meet. */
function bootstrapStructure(payload) {
  if (!isObj(payload))
    return { ok: false, issues: [mkIssue('fpl', '/bootstrap-static/',
      'bootstrap_not_object', 'fatal', 1,
      { received: payload === null ? 'null' : Array.isArray(payload) ? 'array' : typeof payload })] };
  const missing = BOOTSTRAP_COLLECTIONS.filter(k => !Array.isArray(payload[k]));
  if (missing.length)
    return { ok: false, issues: [mkIssue('fpl', '/bootstrap-static/',
      'bootstrap_missing_collection', 'fatal', missing.length, { fields: missing })] };
  return { ok: true, issues: [] };
}

function validateBootstrap(payload) {
  const structural = bootstrapStructure(payload);
  if (!structural.ok) return { value: null, issues: structural.issues };

  const issues = [];
  const value = {};
  for (const key of BOOTSTRAP_COLLECTIONS) {
    const { kept, invalid, duplicate } = filterRows(payload[key],
      r => isObj(r) && isId(r.id), r => String(r.id));
    value[key] = kept;
    if (invalid)
      issues.push(mkIssue('fpl', '/bootstrap-static/', 'bootstrap_invalid_rows',
        'partial', invalid, { field: key }));
    if (duplicate)
      issues.push(mkIssue('fpl', '/bootstrap-static/', 'bootstrap_duplicate_rows',
        'partial', duplicate, { field: key }));
  }
  // Every other bootstrap field is passed through untouched: unknown/extra
  // fields are tolerated by design, never rejected and never counted as bad.
  for (const k of Object.keys(payload))
    if (!BOOTSTRAP_COLLECTIONS.includes(k)) value[k] = payload[k];

  return { value, issues };
}

/* ---- FPL /entry/{id}/ -------------------------------------------------
   Consumers: main.mjs (last_deadline_bank), views (name, player names,
   summary_overall_rank). Optional endpoint: a null means "not found" and
   is already handled by the caller, so it is not a validation failure. */
function validateEntry(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/entry/', 'entry_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  const issues = [];
  if (typeof payload.name !== 'string')
    issues.push(mkIssue('fpl', '/entry/', 'entry_missing_field', 'partial', 1,
      { fields: ['name'] }));
  return { value: payload, issues };
}

/* ---- FPL /entry/{id}/event/{gw}/picks/ (own AND rival) ----------------
   Consumer: squad.mjs mySquad() reads picks[].element/position/multiplier;
   views.mjs reads is_captain for effective ownership. Without picks[] there
   is nothing to consume, so that is fatal for this payload. */
function validatePicks(payload, endpoint = '/entry/event/picks/') {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', endpoint, 'picks_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (!Array.isArray(payload.picks))
    return { value: null, issues: [mkIssue('fpl', endpoint, 'picks_missing_collection',
      'fatal', 1, { fields: ['picks'] })] };

  const issues = [];
  const { kept, invalid, duplicate } = filterRows(payload.picks,
    r => isObj(r) && isId(r.element) && isId(r.position), r => String(r.element));
  if (invalid)
    issues.push(mkIssue('fpl', endpoint, 'picks_invalid_rows', 'partial', invalid));
  if (duplicate)
    issues.push(mkIssue('fpl', endpoint, 'picks_duplicate_element', 'partial', duplicate));
  return { value: { ...payload, picks: kept }, issues };
}

/* ---- FPL /entry/{id}/history/ ----------------------------------------
   Consumer: main.mjs reads chips[].name and chips[].event only. chips is
   optional in the real feed (a manager may have used none), so its absence
   is not an issue; a chips value of the wrong TYPE is. */
function validateHistory(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/entry/history/', 'history_not_object',
      'fatal', 1, { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (payload.chips === undefined || payload.chips === null)
    return { value: payload, issues: [] };
  if (!Array.isArray(payload.chips))
    return { value: { ...payload, chips: [] },
      issues: [mkIssue('fpl', '/entry/history/', 'history_chips_not_array', 'partial', 1,
        { fields: ['chips'] })] };

  const issues = [];
  const { kept, invalid } = filterRows(payload.chips, r => isObj(r) && typeof r.name === 'string');
  if (invalid)
    issues.push(mkIssue('fpl', '/entry/history/', 'history_invalid_chip_rows', 'partial', invalid));
  return { value: { ...payload, chips: kept }, issues };
}

/* ---- FPL /leagues-classic/{id}/standings/ -----------------------------
   Consumer: views.mjs reads standings.results[].entry and .rank, and
   league.name. Without standings.results there is no league to render. */
function validateStandings(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!isObj(payload))
    return { value: null, issues: [mkIssue('fpl', '/leagues-classic/standings/',
      'standings_not_object', 'fatal', 1,
      { received: Array.isArray(payload) ? 'array' : typeof payload })] };
  if (!isObj(payload.standings) || !Array.isArray(payload.standings.results))
    return { value: null, issues: [mkIssue('fpl', '/leagues-classic/standings/',
      'standings_missing_results', 'fatal', 1, { fields: ['standings.results'] })] };

  const issues = [];
  const { kept, invalid, duplicate } = filterRows(payload.standings.results,
    r => isObj(r) && isId(r.entry), r => String(r.entry));
  if (invalid)
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_invalid_rows',
      'partial', invalid));
  if (duplicate)
    issues.push(mkIssue('fpl', '/leagues-classic/standings/', 'standings_duplicate_entry',
      'partial', duplicate));
  return { value: { ...payload, standings: { ...payload.standings, results: kept } }, issues };
}

/* ---- Understat (post-parse) ------------------------------------------
   Consumer: understat.mjs reads each team's .title and .history[].xG/.xGA.
   parseUnderstat() already returns null for an unparseable page; this
   validates the shape of what it DID parse. Optional provider: a fatal
   here degrades to FPL strength ratings, it never blocks core data. */
function validateUnderstat(parsed) {
  if (parsed === null || parsed === undefined) return { value: null, issues: [] };
  if (!isObj(parsed))
    return { value: null, issues: [mkIssue('understat', 'league/EPL',
      'understat_not_object', 'fatal', 1,
      { received: Array.isArray(parsed) ? 'array' : typeof parsed })] };

  const issues = [];
  const value = {};
  let invalid = 0;
  for (const k of Object.keys(parsed)) {
    const t = parsed[k];
    if (!isObj(t) || typeof t.title !== 'string' || !Array.isArray(t.history)) { invalid++; continue; }
    value[k] = t;
  }
  if (invalid)
    issues.push(mkIssue('understat', 'league/EPL', 'understat_invalid_teams', 'partial', invalid));
  if (!Object.keys(value).length)
    issues.push(mkIssue('understat', 'league/EPL', 'understat_no_usable_teams', 'fatal', 1));
  return { value: Object.keys(value).length ? value : null, issues };
}

/* ---- The Odds API v4 --------------------------------------------------
   Consumer: odds.mjs reads home_team/away_team/commence_time/bookmakers[].
   A row whose bookmakers field is present but not an array cannot be
   consumed (the parser iterates it), so the ROW is dropped rather than
   having an empty array manufactured for it. Optional provider. */
function validateOdds(payload) {
  if (payload === null || payload === undefined) return { value: null, issues: [] };
  if (!Array.isArray(payload))
    return { value: null, issues: [mkIssue('odds', 'v4/sports/soccer_epl/odds',
      'odds_not_array', 'fatal', 1,
      { received: payload === null ? 'null' : typeof payload })] };

  const issues = [];
  const { kept, invalid } = filterRows(payload, r => isObj(r) &&
    typeof r.home_team === 'string' && typeof r.away_team === 'string' &&
    (r.bookmakers === undefined || r.bookmakers === null || Array.isArray(r.bookmakers)));
  if (invalid)
    issues.push(mkIssue('odds', 'v4/sports/soccer_epl/odds', 'odds_invalid_events',
      'partial', invalid));
  return { value: kept, issues };
}

/* ---- Historical archive CSV (vaastav merged_gw.csv) -------------------
   Consumer: computeBacktest(). Column presence is the only structural
   contract; the existing thrown message is preserved verbatim because it
   is user-facing and pinned by a resilience test. */
const ARCHIVE_REQUIRED_COLUMNS = ['name', 'position', 'minutes', 'total_points', 'GW'];

function validateArchiveHeader(headerRow) {
  if (!Array.isArray(headerRow))
    return { value: null, issues: [mkIssue('archive', 'merged_gw.csv',
      'archive_no_header', 'fatal', 1)] };
  const present = new Set(headerRow.map(h => String(h).trim()));
  const missing = ARCHIVE_REQUIRED_COLUMNS.filter(c => !present.has(c));
  if (missing.length)
    return { value: null, issues: [mkIssue('archive', 'merged_gw.csv',
      'archive_missing_columns', 'fatal', missing.length, { fields: missing })] };
  return { value: headerRow, issues: [] };
}

/* Merge issues sharing provider+endpoint+code, summing counts. Pooled calls
   (20 rival squads) would otherwise emit 20 near-identical issue objects;
   this keeps S.dataIssues bounded regardless of fan-out. Bounded diagnostic
   fields from the first occurrence are kept; nothing is concatenated. */
function collapseIssues(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const byKey = new Map();
  for (const i of list) {
    const k = i.provider + '|' + i.endpoint + '|' + i.code;
    if (!byKey.has(k)) byKey.set(k, { ...i, count: typeof i.count === 'number' ? i.count : 1 });
    else byKey.get(k).count += (typeof i.count === 'number' ? i.count : 1);
  }
  return [...byKey.values()];
}

/* Convenience predicates used at every integration point. */
const hasFatal = issues => Array.isArray(issues) && issues.some(i => i.severity === 'fatal');

// NOTE: single-line export — the bundler's strip contract (README-BUILD.md)
// only recognises `export { ... };` on one line. A wrapped list survives into
// the bundle as a syntax error.
export { MATERIAL_FIELDS, fixtureIdentity, normaliseFixtures, issueSummary, BOOTSTRAP_COLLECTIONS, ARCHIVE_REQUIRED_COLUMNS, bootstrapStructure, validateBootstrap, validateEntry, validatePicks, validateHistory, validateStandings, validateUnderstat, validateOdds, validateArchiveHeader, collapseIssues, hasFatal };
