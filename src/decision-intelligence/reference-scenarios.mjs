import {deepFreeze} from './canonical.mjs';

// Infrastructure fixtures only. Values are synthetic and make no football-accuracy claim.
export const DI3_REFERENCE_SCENARIOS=deepFreeze([
  {id:'clear-xi',domain:'xi',state:'complete',case:'clear'},
  {id:'near-tied-xi',domain:'xi',state:'complete',case:'near_tie'},
  {id:'clear-captain',domain:'captain',state:'complete',case:'clear'},
  {id:'near-tied-captain',domain:'captain',state:'complete',case:'near_tie'},
  {id:'roll-v-marginal-transfer',domain:'transfers',state:'complete',case:'roll_comparator'},
  {id:'beneficial-transfer',domain:'transfers',state:'complete',case:'existing_semantics'},
  {id:'transfer-hit',domain:'transfers',state:'complete',case:'existing_hit_semantics'},
  {id:'missing-evidence',domain:'xi',state:'partial',case:'missing'},
  {id:'stale-conflicting-future-signal',domain:'captain',state:'partial',case:'stale_conflict'},
  {id:'unapproved-signal',domain:'transfers',state:'no_decision',case:'approval_fail_closed'},
  {id:'partial-decision',domain:'multi',state:'partial',case:'missing_domain'},
  {id:'no-decision',domain:'multi',state:'no_decision',case:'adapter_unavailable'},
  {id:'reconsideration-trigger',domain:'captain',state:'complete',case:'deadline_predicate'},
  {id:'deterministic-tie',domain:'bench',state:'complete',case:'policy_tie_break'}
]);
