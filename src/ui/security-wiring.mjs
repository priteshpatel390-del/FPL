// Stage 3 security completion — odds-key affordance wiring.
// Loaded after the main views so it can reuse the existing render/cache helpers
// without expanding the Stage 9 UI scope.
const oddsFieldForSecurity = $('oddsKey');
if(oddsFieldForSecurity){
  oddsFieldForSecurity.type = 'password';
  oddsFieldForSecurity.setAttribute('autocomplete','off');
  const oddsKeyLabel = oddsFieldForSecurity.closest('label');
  const oddsKeyRow = oddsKeyLabel && oddsKeyLabel.parentNode;
  if(oddsKeyRow && !$('forgetOddsKey')){
    const forgetButton = el('button',{class:'btn ghost sm',id:'forgetOddsKey',type:'button'},'Forget API key');
    oddsKeyRow.appendChild(forgetButton);
    forgetButton.addEventListener('click', async () => {
      forgetButton.disabled = true;
      try{
        await forgetOddsKey();
        clearXP();
        renderAll();
      }finally{
        forgetButton.disabled = false;
      }
    });
  }
}
