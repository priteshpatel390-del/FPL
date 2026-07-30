import { canonicalise } from './snapshot.mjs';
import { operatingReviewCsvCell,operatingReviewPrimaryCsvSchemas } from './review-csv-base.mjs';
import { operatingReviewTransferCsvSchemas } from './review-csv-transfer.mjs';

function operatingReviewCsvSchemas(bundle,sourceRecords={}){ return {...operatingReviewPrimaryCsvSchemas(bundle,sourceRecords),...operatingReviewTransferCsvSchemas(bundle)}; }
function buildOperatingReviewCsv(bundle,tableName,sourceRecords={}){
  const schemas=operatingReviewCsvSchemas(bundle,sourceRecords),schema=schemas[tableName]; if(!schema) throw new Error('CSV table is not supported');
  const numberColumns=new Set(['gameweek','horizon','start_gameweek','horizon_gameweek','revision','transfer_evaluation_revision','player_id','club_id','position','frozen_price','predicted_points','observed_points','signed_error','absolute_error','official_starts','observed_minutes','fixture_id','predicted_minutes','start_probability','appearance_probability','sixty_probability','minutes_error','minutes_absolute_error','correction_count','eligible_predictions','official_outcomes','matched_players','player_coverage','schedule_aligned_players','minute_fixture_rows','unallocatable_minute_rows','start_label_rows','uncertainty_rows','missing_predictions','missing_outcomes','player_mae','player_rmse','player_bias','predicted_mean','observed_mean','within_two','within_five','minutes_mae','minutes_bias','minutes_within_15','minutes_within_30','p10_p90_coverage','p10_p90_width','p25_p75_coverage','p25_p75_width','transfer_count','hit_cost','roll_difference','free_transfers_next_gameweek','realised_base_points','baseline_realised_base_points','gross_gain','net_gain_after_hits','schedule_changed_gameweek_count','accepted_record_count','rejected_record_count','age_ms','threshold_ms']);
  const booleanColumns=new Set(['evidence_complete','appeared','reached_sixty','schedule_aligned','blank_outcome','return_outcome','haul_outcome','mega_haul_outcome','started','vice_took_over','is_zero_transfer_baseline','schedule_changed','included','did_affect_model','current','full_record_available']);
  const lines=[schema.columns.map(column=>operatingReviewCsvCell(column)).join(',')];
  for(const row of schema.rows) lines.push(schema.columns.map(column=>operatingReviewCsvCell(row[column],numberColumns.has(column)?'number':booleanColumns.has(column)?'boolean':'text')).join(','));
  return canonicalise({tableName,columns:schema.columns,rowCount:schema.rows.length,mimeType:'text/csv;charset=utf-8',text:`\uFEFF${lines.join('\r\n')}\r\n`});
}

export { buildOperatingReviewCsv };
