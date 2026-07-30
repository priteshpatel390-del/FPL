import { canonicalise } from './snapshot.mjs';
import { OPERATING_REVIEW_RULES } from './review-common.mjs';

function operatingReviewMarkdownNumber(value,digits=2){ return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits); }
function operatingReviewMarkdownPercent(value){ return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`; }
function buildOperatingReviewMarkdown(bundle){
  const lines=[`# Teamsheet operating review — ${bundle.scope.season}`,``,`Evidence through: ${bundle.evidenceThrough}`,`Bundle: \`${bundle.identity.bundleId}\``,``,`> Descriptive evidence only. This is not a validated-accuracy or calibration claim.`,``];
  for(const review of bundle.weeklyReviews||[]){
    lines.push(`## GW${review.gameweek}`,``,`- Snapshot: ${review.status.snapshot}` ,`- Outcome: ${review.status.outcome}` ,`- Evaluation: ${review.status.evaluation}` ,`- Evidence: ${review.completeness.status}`);
    if(review.headline) lines.push(`- Player observations: ${review.headline.observations}`,`- MAE: ${operatingReviewMarkdownNumber(review.headline.playerMae)}`,`- Bias: ${operatingReviewMarkdownNumber(review.headline.playerBias)} (positive means overprediction)`,`- Coverage: ${operatingReviewMarkdownPercent(review.headline.coverage)}`);
    const squad=review.decisions?.squad,captain=review.decisions?.captaincy,bench=review.decisions?.bench;
    if(squad) lines.push(`- Frozen XI realised base points: ${squad.selectedRealised?.basePoints??'—'}`,`- Hindsight oracle: ${squad.hindsightOracle?.realisedPoints??'—'} points`);
    if(captain) lines.push(`- Captain doubled contribution: ${captain.selected?.doubledContribution??0}${captain.selected?.viceTookOver?' (vice-captain fallback)':''}`);
    if(bench) lines.push(`- Automatic-substitution contribution: ${bench.automaticSubstitutionContribution??0}`,`- Points left on unused bench: ${bench.pointsLeftOnBench??0}`);
    if(review.warnings?.length){lines.push(``,`Warnings:`);for(const warning of review.warnings) lines.push(`- ${warning}`);}
    lines.push(``);
  }
  const cumulative=bundle.cumulativeReview;
  if(cumulative){
    lines.push(`## Season to date`,``,`Evaluated Gameweeks: ${cumulative.status.evaluatedGameweeks}`,`Corrected Gameweeks: ${cumulative.status.correctedGameweeks}`,
      `Overall player MAE: ${operatingReviewMarkdownNumber(cumulative.overall?.player?.metrics?.mae)}`,
      `Schedule-aligned player MAE: ${operatingReviewMarkdownNumber(cumulative.scheduleAligned?.player?.metrics?.mae)}`,
      ``,`Frozen transfer horizons are listed individually and are not summed because horizons can overlap or represent alternatives.`,``,`## Integrity`,``,`Manifest SHA-256: \`${bundle.identity.manifestHash}\``,`Review SHA-256: \`${bundle.identity.reviewDataHash}\``,`Bundle SHA-256: \`${bundle.identity.contentHash}\``);
  }
  return lines.join('\n').trimEnd()+'\n';
}
function operatingReviewFileStem(bundle){ const from=String(bundle.scope.fromGameweek).padStart(2,'0'),to=String(bundle.scope.toGameweek).padStart(2,'0');return bundle.scope.fromGameweek===bundle.scope.toGameweek?`teamsheet-${bundle.scope.season}-gw${from}`:`teamsheet-${bundle.scope.season}-gw${from}-gw${to}`; }
function operatingReviewFileName(bundle,format,tableName=null){
  const stem=operatingReviewFileStem(bundle),profile=bundle.profile.replaceAll('_','-'); if(format==='json') return `${stem}-${profile}-v1.json`; if(format==='markdown') return `${stem}-${profile}-v1.md`; if(format==='csv'&&tableName) return `${stem}-${tableName.replaceAll('_','-')}-v1.csv`; throw new Error('Export filename format is not supported');
}
function operatingReviewUtf8Bytes(value){ return typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(value)).length:String(value).length*2; }
function assessOperatingReviewExport(value){
  const bytes=operatingReviewUtf8Bytes(value); return canonicalise({bytes,warning:bytes>OPERATING_REVIEW_RULES.warningBytes,allowed:bytes<=OPERATING_REVIEW_RULES.maximumBytes,warningBytes:OPERATING_REVIEW_RULES.warningBytes,maximumBytes:OPERATING_REVIEW_RULES.maximumBytes});
}

export { buildOperatingReviewMarkdown,operatingReviewFileName,assessOperatingReviewExport };
