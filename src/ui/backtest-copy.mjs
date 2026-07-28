const backtestButton=document.getElementById('btBtn');
if(backtestButton){
  backtestButton.textContent='Run deadline-safe walk-forward check';
  const hint=backtestButton.parentElement?.nextElementSibling;
  if(hint?.classList?.contains('hint')){
    hint.textContent='Downloads a commit-pinned 2025–26 archive and evaluates one Gameweek at a time using only earlier information. Results are diagnostic, do not change live projections, and clearly report unavailable historical provider coverage.';
  }
}
