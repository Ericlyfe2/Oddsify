const MARKET_NAMES = {
  '1X2': 'Match Winner',
  DC: 'Double Chance',
  BTTS: 'Both Teams To Score',
  OU05: 'Total Goals (O/U 0.5)',
  OU15: 'Total Goals (O/U 1.5)',
  OU25: 'Total Goals (O/U 2.5)',
  OU35: 'Total Goals (O/U 3.5)',
  OU45: 'Total Goals (O/U 4.5)',
  DNB: 'Draw No Bet',
  AH1: 'Asian Handicap (±1)',
  AH2: 'Asian Handicap (±2)',
  '1H1X2': '1st Half Winner',
  '1HOU05': '1st Half Goals (O/U 0.5)',
  '1HBTTS': '1st Half BTTS',
  HTFT: 'Half-Time / Full-Time',
  WINBTTS: 'Result & Both Teams To Score',
  WINOU25: 'Result & Total Goals (2.5)',
  BTTSOU25: 'BTTS & Total Goals (2.5)',
  CS: 'Correct Score',
  ML: 'Match Winner',
  TP: 'Total Points',
  HCAP: 'Handicap',
  SETS: 'Total Sets',
  OU: 'Over / Under',
  HT: 'Half Time',
  FT: 'Full Time',
};

export function expandMarketName(market) {
  if (!market) return 'Match Winner';
  if (MARKET_NAMES[market]) return MARKET_NAMES[market];
  return market;
}

export function getSelectionLabel(leg) {
  if (leg.pickLabel || leg.label) return leg.pickLabel || leg.label;
  if (leg.outcomeLabel) return leg.outcomeLabel;
  if (leg.outcome) return leg.outcome;
  if (leg.pick) return leg.pick;
  if (leg.key) return leg.key;
  return '—';
}
