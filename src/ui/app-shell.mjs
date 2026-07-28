// Stage 9.1 — app shell and primary navigation only.
// Reorganises existing views without changing their rendering or model behaviour.

function setupAppShell(){
  if(typeof document === 'undefined' ||
     typeof document.querySelector !== 'function' ||
     typeof document.getElementById !== 'function' ||
     typeof document.createElement !== 'function' ||
     typeof document.createTextNode !== 'function') return;

  const nav = document.querySelector('nav.tabs');
  const main = document.querySelector('main');
  const teamView = document.getElementById('view-squad');
  const playersView = document.getElementById('view-players');
  const transfersView = document.getElementById('view-transfers');
  const fixturesView = document.getElementById('view-fixtures');
  const leagueView = document.getElementById('view-league');
  const askView = document.getElementById('view-ask');
  const setupPanel = document.getElementById('setupPanel');

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
  hint.textContent = 'Fixtures, setup, provider controls, mini-league tools and Ask remain available here.';
  moreHeader.append(eyebrow, heading, hint);
  moreView.appendChild(moreHeader);

  [setupPanel, fixturesView, leagueView, askView].filter(Boolean).forEach(section => {
    section.classList.remove('view');
    section.hidden = false;
    moreView.appendChild(section);
  });
  main.appendChild(moreView);

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
