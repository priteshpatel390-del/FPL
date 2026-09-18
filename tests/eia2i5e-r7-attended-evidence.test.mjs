import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES,
  EIA_2I5E_CANONICAL_REQUEST_MANIFEST,
  EIA_2I5E_CHECKPOINT,
  EIA_2I5E_PRODUCTION_BYTE_CEILING,
  PREVIOUSLY_QUALIFIED_PL_TEAMS,
  calculateResponseByteCeilingCandidate
} from '../src/decision-intelligence/api-football-prelive-qualification.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/eia-2i5e-sanitized-qualification.json'), 'utf8'));
const r7 = evidence.r7AttendedQualification;
const CANONICAL_IDS = EIA_2I5E_CANONICAL_REQUEST_MANIFEST.items.map(item => item.id);
const EXPECTED_ROW_IDENTITY_STATES = {
  'discovery-2': 'MATCHED',
  'discovery-3': 'MATCHED',
  'discovery-848': 'MATCHED',
  'discovery-45': 'MATCHED',
  'discovery-48': 'MATCHED',
  'fixture-1636205': 'FIXTURE_IDENTITY_MATCHED',
  'lineups-1636205': 'FIXTURE_PARTICIPANTS_MATCHED',
  'players-1636205': 'FIXTURE_PARTICIPANTS_MATCHED',
  'events-1636205': 'FIXTURE_PARAMETER_PLUS_PARTICIPANT_CONTEXT',
  'fixture-1635643': 'FIXTURE_IDENTITY_MATCHED',
  'players-1635643': 'FIXTURE_PARTICIPANTS_MATCHED'
};

test('R7 evidence identifies the exact GitHub attended run and executed candidate', () => {
  assert.equal(evidence.checkpoint, 'EIA-2I5E-R7');
  assert.equal(evidence.executedCandidateSha, '03cd231cd3e1d38821194a5d1aad87bc87232154');
  assert.equal(r7.executedCandidateSha, '03cd231cd3e1d38821194a5d1aad87bc87232154');
  assert.equal(r7.checkpoint, EIA_2I5E_CHECKPOINT);
  assert.equal(r7.workflow.runId, 35248079758);
  assert.equal(r7.workflow.runNumber, 1);
  assert.equal(r7.workflow.runAttempt, 1);
  assert.equal(r7.workflow.event, 'workflow_dispatch');
  assert.equal(r7.workflow.workflowExecutionMainSha, '7314c30580f52a56c014bd5c8fb1e7de6ad14ca2');
  assert.equal(r7.artifact.id, 10508920046);
  assert.equal(r7.artifact.digestSha256, 'dd6b907cefe6c5d0b29b8c269d91a622ff45411303a571eeb1831d004b5e3459');
});

test('R7 evidence contains exactly 11 unique successful canonical measurements and preserves attended identity states', () => {
  assert.equal(r7.attemptsUsed, 11);
  assert.equal(r7.retries, 0);
  assert.equal(r7.httpSuccessCount, 11);
  assert.equal(r7.stoppedReason, null);
  const ids = r7.measurements.map(row => row.logicalRequestId);
  assert.deepEqual(ids, CANONICAL_IDS);
  assert.equal(new Set(ids).size, 11);
  assert.deepEqual(Object.keys(EXPECTED_ROW_IDENTITY_STATES), CANONICAL_IDS);
  for (const row of r7.measurements) {
    assert.equal(row.ok, true);
    assert.equal(row.httpStatus, 200);
    assert.deepEqual(row.paging, {current: 1, total: 1});
    assert.equal(row.responseIdentityMatched, true);
    assert.equal(row.sampleSufficient, true);
    assert.equal(row.quota.state, 'known');
    assert.equal(row.bodyRetained, false);
    assert.equal(
      row.rowIdentityValidationState,
      EXPECTED_ROW_IDENTITY_STATES[row.logicalRequestId],
      `attended row identity state drifted for ${row.logicalRequestId}`
    );
  }
});

test('R7 evidence arithmetic recalculates to the qualified 720896-byte ceiling', () => {
  const observedMaximum = Math.max(...r7.measurements.map(row => row.actualBytes));
  assert.equal(observedMaximum, 347982);
  const classMaxima = {};
  for (const row of r7.measurements) classMaxima[row.endpointClass] = Math.max(classMaxima[row.endpointClass] || 0, row.actualBytes);
  assert.deepEqual(classMaxima, {fixtures_discovery:347982,fixture:42710,lineups:4068,players:30052,events:6006});
  assert.equal(observedMaximum * 2, 695964);
  assert.equal(Math.ceil((observedMaximum * 2) / EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES) * EIA_2I5E_BYTE_CEILING_QUANTUM_BYTES, 720896);
  assert.equal(r7.responseLimit.proposedCeiling, 720896);
  assert.equal(r7.responseLimit.marginBytes, 372914);
  assert.equal(r7.responseLimit.decision, 'GO');
  assert.equal(r7.responseLimit.formalQualification, true);
  assert.equal(r7.responseLimit.qualificationState, 'ATTENDED_CANONICAL_QUALIFIED');
  assert.equal(calculateResponseByteCeilingCandidate(r7.measurements).proposedCeiling, 720896);
  assert.equal(calculateResponseByteCeilingCandidate(r7.measurements).formalQualification, false);
});

test('R7 historical evidence keeps its production ceiling unimplemented and mapping separately NO-GO 2/20', () => {
  assert.equal(EIA_2I5E_PRODUCTION_BYTE_CEILING, null);
  assert.equal(r7.responseLimit.productionConstant, null);
  assert.equal(r7.responseLimit.implemented, false);
  assert.equal(r7.mapping.decision, 'NO-GO');
  assert.equal(r7.mapping.verifiedPremierLeagueTeamCount, 2);
  assert.equal(r7.mapping.remainingUnprovenClubs, 18);
  assert.equal(PREVIOUSLY_QUALIFIED_PL_TEAMS.length, 2);
  assert.equal(r7.closeout.providerRequests, 0);
  assert.equal(r7.closeout.mappingExpanded, false);
});