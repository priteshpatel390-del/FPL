import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  REVIEW_RULES,reviewCsvTextValue,reviewCsvCell,reviewCsvDocument,buildOperatingReviewBundle,serialiseOperatingReviewBundle,buildOperatingReviewCsv,buildOperatingReviewMarkdown,reviewExportFileName
} from '../src/evidence/review.mjs';
import { makeReviewEvidence } from './review-fixtures.mjs';

async function bundleFixture(){const fixture=await makeReviewEvidence({playerName:'Safe Player'});return buildOperatingReviewBundle({snapshots:[fixture.snapshot],outcomes:[fixture.outcome],evaluations:[fixture.evaluation],scope:{season:'2026-27',gameweek:1},cryptoImpl:webcrypto});}

test('the approved eight CSV tables and deterministic filenames are exact',async()=>{
  const bundle=await bundleFixture();
  assert.deepEqual(REVIEW_RULES.csvTables,['gameweeks','players','minute_fixtures','squad_decisions','transfer_horizons','transfer_horizon_gameweeks','provider_states','revisions']);
  assert.equal(reviewExportFileName(bundle,'json'),'teamsheet-2026-27-gw01-operating-review.json');
  for(const table of REVIEW_RULES.csvTables){const output=buildOperatingReviewCsv(bundle,table);assert.equal(output.filename,`teamsheet-2026-27-gw01-operating-review-${table.replaceAll('_','-')}.csv`);assert.ok(output.text.startsWith('\uFEFF'));assert.ok(output.text.endsWith('\r\n'));}
});

test('CSV preserves numeric zero, leaves null blank and blocks spreadsheet formulas',()=>{
  const csv=reviewCsvDocument(['zero','missing','negative','equals','plus','minusText','at','tab','carriage'],[{zero:0,missing:null,negative:-4,equals:'=SUM(A1:A2)',plus:'+cmd',minusText:'-formula',at:'@link',tab:'\tformula',carriage:'\rformula'}]);
  assert.ok(csv.includes('\r\n0,,-4,\'=SUM(A1:A2),\'+cmd,\'-formula,\'@link,"\'\tformula","\'\rformula"\r\n'));
  assert.equal(reviewCsvCell(-2.5),'-2.5');assert.equal(reviewCsvTextValue('  =unsafe'),"'  =unsafe");
});

test('analysis exports omit manager reference while exact JSON sources remain intact',async()=>{
  const bundle=await bundleFixture(),players=buildOperatingReviewCsv(bundle,'players'),markdown=buildOperatingReviewMarkdown(bundle),json=serialiseOperatingReviewBundle(bundle);
  assert.ok(players.text.includes('Safe Player'));assert.equal(players.text.includes('mgr-'),false);assert.equal(markdown.text.includes('mgr-'),false);assert.ok(json.text.includes('mgr-0123456789abcdef0123456789abcdef'));assert.ok(json.text.endsWith('\n'));
});

test('Markdown uses descriptive wording and labels the Hindsight oracle fully',async()=>{
  const bundle=structuredClone(await bundleFixture());bundle.weeklyReviews[0].decisions={squad:{selectedRealised:{basePoints:42},hindsightOracle:{realisedPoints:55}}};
  const output=buildOperatingReviewMarkdown(bundle);
  assert.ok(output.text.includes('Hindsight oracle: 55 (descriptive only)'));assert.ok(output.text.includes('No composite score, significance claim, calibration claim or automatic model update'));
});
