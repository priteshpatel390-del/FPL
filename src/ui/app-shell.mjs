// Stage 9 app shell — primary navigation plus More/Settings integration.
// Reorganises existing views without changing their rendering or model behaviour.

function setupAppShell(){
  if(typeof document === 'undefined' ||
     typeof document.querySelector !== 'function' ||
     typeof document.getElementById !== 'function' ||
     typeof document.createElement !== 'function' ||
     typeof document.createTextNode !== 'function') return;

  const nav = document.querySelector('nav.tabs');
  const main = document.querySelector('main');
  const header = document.querySelector('header');
  const teamView = document.getElementById('view-squad');
  const playersView = document.getElementById('view-players');
  const transfersView = document.getElementById('view-transfers');
  const fixturesView = document.getElementById('view-fixtures');
  const leagueView = document.getElementById('view-league');
  const askView = document.getElementById('view-ask');
  const setupPanel = document.getElementById('setupPanel');
  const evidencePanel = document.getElementById('evidencePanel');

  if(!nav || !main || !teamView || !playersView || !transfersView || !fixturesView) return;

  const tabs = Array.from(nav.querySelectorAll('.tab'));
  const byView = Object.fromEntries(tabs.map(tab => [tab.dataset.view, tab]));
  const teamTab = byView.squad;
  const playersTab = byView.players;
  const transfersTab = byView.transfers;
  const moreTab = byView.fixtures;

  if(!teamTab || !playersTab || !transfersTab || !moreTab) return;

  const setTabLabel = (tab, icon, label) => {
    tab.textContent = '';
    const iconNode = document.createElement('span');
    iconNode.className = 'ic';
    iconNode.setAttribute('aria-hidden','true');
    iconNode.textContent = icon;
    tab.append(iconNode, document.createTextNode(label));
  };

  setTabLabel(teamTab, '◈', 'Team');
  setTabLabel(playersTab, '↗', 'Players');
  setTabLabel(transfersTab, '⇄', 'Transfers');
  setTabLabel(moreTab, '•••', 'More');
  moreTab.dataset.view = 'more';

  const moreView = document.createElement('section');
  moreView.id = 'view-more';
  moreView.className = 'view more-view';
  moreView.hidden = true;

  const moreHeader = document.createElement('div');
  moreHeader.className = 'panel more-header';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Tools and settings';
  const heading = document.createElement('h2');
  heading.textContent = 'More';
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Automatic evidence, provider detail, Settings, fixtures, mini-league tools and Ask live here.';
  moreHeader.append(eyebrow, heading, hint);
  moreView.appendChild(moreHeader);

  const healthPanel = document.createElement('section');
  healthPanel.id = 'providerHealthDetail';
  healthPanel.className = 'panel';
  healthPanel.tabIndex = -1;
  const healthEyebrow = document.createElement('span');
  healthEyebrow.className = 'eyebrow';
  healthEyebrow.textContent = 'Data status';
  const healthHeading = document.createElement('h2');
  healthHeading.textContent = 'Provider Health';
  const healthHint = document.createElement('p');
  healthHint.className = 'hint';
  healthHint.textContent = 'Which data source is active, how fresh it is and what any fallback changes.';
  const healthRowsNode = document.createElement('div');
  healthRowsNode.id = 'providerHealthRows';
  healthPanel.append(healthEyebrow, healthHeading, healthHint, healthRowsNode);
  moreView.appendChild(healthPanel);

  if(setupPanel){
    const setupEyebrow = setupPanel.querySelector('.eyebrow');
    const setupHeading = setupPanel.querySelector('h2');
    const setupHint = setupPanel.querySelector('.hint');
    if(setupEyebrow) setupEyebrow.textContent = 'Settings';
    if(setupHeading){ setupHeading.id = 'settingsTitle'; setupHeading.textContent = 'Team and data settings'; }
    if(setupHint) setupHint.textContent = 'Connect your team, set transfer context and manage optional provider controls.';
    setupPanel.setAttribute('aria-labelledby','settingsTitle');
  }

  [evidencePanel, setupPanel, fixturesView, leagueView, askView].filter(Boolean).forEach(section => {
    section.classList.remove('view');
    section.hidden = false;
    moreView.appendChild(section);
  });
  main.appendChild(moreView);

  if(header && !document.getElementById('providerHealthCompact')){
    const compact = document.createElement('button');
    compact.id = 'providerHealthCompact';
    compact.type = 'button';
    compact.className = 'chip';
    compact.setAttribute('aria-controls','providerHealthDetail');
    compact.setAttribute('aria-label','Provider Health: waiting for first data load');
    compact.append(document.createTextNode('Data '));
    const waiting = document.createElement('span');
    waiting.className = 'flag dark';
    waiting.textContent = 'Waiting';
    compact.appendChild(waiting);
    compact.addEventListener('click', () => {
      moreTab.click();
      setTimeout(() => {
        if(typeof healthPanel.scrollIntoView === 'function') healthPanel.scrollIntoView({block:'start'});
        if(typeof healthPanel.focus === 'function') healthPanel.focus({preventScroll:true});
      }, 0);
    });
    header.appendChild(compact);
  }

  tabs.forEach(tab => tab.remove());
  [teamTab, playersTab, transfersTab, moreTab].forEach(tab => nav.appendChild(tab));

  [teamView, playersView, transfersView, moreView].forEach(view => {
    view.hidden = view !== teamView;
  });
  [teamTab, playersTab, transfersTab, moreTab].forEach(tab => {
    tab.setAttribute('aria-selected', tab === teamTab ? 'true' : 'false');
  });
}

setupAppShell();

export { setupAppShell };
