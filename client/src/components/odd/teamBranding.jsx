const TEAM_COLORS = {
  arsenal: { bg: '#ef0107', fg: '#ffffff', short: 'ARS' },
  astonVilla: { bg: '#670e36', fg: '#95bfe5', short: 'AVL' },
  'aston villa': { bg: '#670e36', fg: '#95bfe5', short: 'AVL' },
  bournemouth: { bg: '#da291c', fg: '#000000', short: 'BOU' },
  brentford: { bg: '#c8102e', fg: '#ffffff', short: 'BRE' },
  brighton: { bg: '#0057b8', fg: '#ffffff', short: 'BRI' },
  'brighton & hove albion': { bg: '#0057b8', fg: '#ffffff', short: 'BRI' },
  burnley: { bg: '#6c1d45', fg: '#9ac9eb', short: 'BUR' },
  chelsea: { bg: '#034694', fg: '#ffffff', short: 'CHE' },
  crystalPalace: { bg: '#1b458f', fg: '#c4122e', short: 'CRY' },
  'crystal palace': { bg: '#1b458f', fg: '#c4122e', short: 'CRY' },
  everton: { bg: '#003399', fg: '#ffffff', short: 'EVE' },
  fulham: { bg: '#000000', fg: '#ffffff', short: 'FUL' },
  liverpool: { bg: '#c8102e', fg: '#ffffff', short: 'LIV' },
  luton: { bg: '#ff4720', fg: '#0f1b47', short: 'LUT' },
  'luton town': { bg: '#ff4720', fg: '#0f1b47', short: 'LUT' },
  manchesterCity: { bg: '#6cabdd', fg: '#1c2f68', short: 'MCI' },
  'manchester city': { bg: '#6cabdd', fg: '#1c2f68', short: 'MCI' },
  manchesterUtd: { bg: '#da291c', fg: '#fbea0b', short: 'MUN' },
  'manchester united': { bg: '#da291c', fg: '#fbea0b', short: 'MUN' },
  'man utd': { bg: '#da291c', fg: '#fbea0b', short: 'MUN' },
  newcastle: { bg: '#241f20', fg: '#ffffff', short: 'NEW' },
  'newcastle united': { bg: '#241f20', fg: '#ffffff', short: 'NEW' },
  nottingham: { bg: '#e53233', fg: '#ffffff', short: 'NFO' },
  'nottingham forest': { bg: '#e53233', fg: '#ffffff', short: 'NFO' },
  sheffieldUtd: { bg: '#ee2737', fg: '#ffffff', short: 'SHU' },
  'sheffield united': { bg: '#ee2737', fg: '#ffffff', short: 'SHU' },
  spurs: { bg: '#132257', fg: '#ffffff', short: 'TOT' },
  tottenham: { bg: '#132257', fg: '#ffffff', short: 'TOT' },
  westHam: { bg: '#7a263a', fg: '#1bb1e7', short: 'WHU' },
  'west ham': { bg: '#7a263a', fg: '#1bb1e7', short: 'WHU' },
  'west ham united': { bg: '#7a263a', fg: '#1bb1e7', short: 'WHU' },
  wolves: { bg: '#fdb913', fg: '#231f20', short: 'WOL' },
  barcelona: { bg: '#a50044', fg: '#004d98', short: 'BAR' },
  realMadrid: { bg: '#febe10', fg: '#002b7f', short: 'RMA' },
  'real madrid': { bg: '#febe10', fg: '#002b7f', short: 'RMA' },
  atleticoMadrid: { bg: '#cb3524', fg: '#0c4a8e', short: 'ATM' },
  'atletico madrid': { bg: '#cb3524', fg: '#0c4a8e', short: 'ATM' },
  bayern: { bg: '#dc052d', fg: '#0066b3', short: 'BAY' },
  'bayern munich': { bg: '#dc052d', fg: '#0066b3', short: 'BAY' },
  dortmund: { bg: '#fde100', fg: '#000000', short: 'BVB' },
  psg: { bg: '#004170', fg: '#da291c', short: 'PSG' },
  inter: { bg: '#010e80', fg: '#000000', short: 'INT' },
  'inter milan': { bg: '#010e80', fg: '#000000', short: 'INT' },
  milan: { bg: '#fb090b', fg: '#000000', short: 'ACM' },
  'ac milan': { bg: '#fb090b', fg: '#000000', short: 'ACM' },
  juventus: { bg: '#000000', fg: '#ffffff', short: 'JUV' },
  ajax: { bg: '#d3122e', fg: '#ffffff', short: 'AJA' },
  celtic: { bg: '#00985f', fg: '#ffffff', short: 'CEL' },
  rangers: { bg: '#0032a0', fg: '#ffffff', short: 'RAN' },
  galatasaray: { bg: '#a3262e', fg: '#ffb516', short: 'GAL' },
  fenerbahce: { bg: '#241d5e', fg: '#fedd02', short: 'FEN' },
};

const LEAGUE_COLORS = {
  'premier league': { bg: '#37003c', fg: '#ffffff', short: 'PL' },
  'english premier league': { bg: '#37003c', fg: '#ffffff', short: 'PL' },
  'epl': { bg: '#37003c', fg: '#ffffff', short: 'PL' },
  'la liga': { bg: '#c60b1e', fg: '#febe10', short: 'LL' },
  'primera division': { bg: '#c60b1e', fg: '#febe10', short: 'LL' },
  'bundesliga': { bg: '#d3051e', fg: '#ffffff', short: 'BL' },
  'serie a': { bg: '#004694', fg: '#ffffff', short: 'SA' },
  'ligue 1': { bg: '#002654', fg: '#ed2939', short: 'L1' },
  'eredivisie': { bg: '#001f5b', fg: '#ffffff', short: 'ED' },
  'primeira liga': { bg: '#006434', fg: '#ffffff', short: 'PL' },
  'ghana premier league': { bg: '#e8112d', fg: '#fedd00', short: 'GPL' },
  'premier league ghana': { bg: '#e8112d', fg: '#fedd00', short: 'GPL' },
  'champions league': { bg: '#002b7f', fg: '#f5c000', short: 'UCL' },
  'uefa champions league': { bg: '#002b7f', fg: '#f5c000', short: 'UCL' },
  'europa league': { bg: '#dd0b2e', fg: '#ffd700', short: 'UEL' },
  'uefa europa league': { bg: '#dd0b2e', fg: '#ffd700', short: 'UEL' },
  'world cup': { bg: '#32612d', fg: '#dfb02a', short: 'WC' },
  'fa cup': { bg: '#dedede', fg: '#000000', short: 'FAC' },
  'carabao cup': { bg: '#82c341', fg: '#0f1b3d', short: 'CC' },
  'efl cup': { bg: '#82c341', fg: '#0f1b3d', short: 'CC' },
  'copa america': { bg: '#003f87', fg: '#fedd00', short: 'CA' },
  'africa cup of nations': { bg: '#009a44', fg: '#e11a22', short: 'AFCON' },
  'afcon': { bg: '#009a44', fg: '#e11a22', short: 'AFCON' },
};

export function getTeamBranding(name) {
  if (!name) return { bg: '#333', fg: '#fff', short: '?', initials: '?' };
  const key = name.toLowerCase().trim().replace(/\s+/g, '');
  const direct = TEAM_COLORS[key];
  if (direct) return { ...direct, initials: direct.short };

  const byFull = TEAM_COLORS[name.toLowerCase().trim()];
  if (byFull) return { ...byFull, initials: byFull.short };

  const words = name.split(/[\s'-]+/).filter(Boolean);
  const initials = words.length >= 2
    ? words.map(w => w[0].toUpperCase()).join('').slice(0, 3)
    : name.slice(0, 3).toUpperCase();

  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 47) % 360;
  const sat = 55 + ((hash * 13) % 25);
  const lit = 25 + ((hash * 7) % 15);
  return {
    bg: `hsl(${hue}, ${sat}%, ${lit}%)`,
    fg: lit > 40 ? '#000' : '#fff',
    short: initials,
    initials,
  };
}

export function getLeagueBranding(name) {
  if (!name) return { bg: '#333', fg: '#fff', short: '?' };
  const byName = LEAGUE_COLORS[name.toLowerCase().trim()];
  if (byName) return byName;

  const words = name.split(/[\s'-]+/).filter(Boolean);
  const initials = words.map(w => w[0].toUpperCase()).join('').slice(0, 4);

  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 73) % 360;
  return {
    bg: `hsl(${hue}, 50%, 30%)`,
    fg: '#fff',
    short: initials,
  };
}

export function TeamLogo({ name, size = 20, style }) {
  const brand = getTeamBranding(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: brand.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      <span style={{
        color: brand.fg,
        fontSize: Math.max(9, size * 0.45),
        fontWeight: 800,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        lineHeight: 1,
      }}>{brand.initials}</span>
    </div>
  );
}

export function LeagueLogo({ name, size = 20, style }) {
  const brand = getLeagueBranding(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: brand.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      <span style={{
        color: brand.fg,
        fontSize: Math.max(8, size * 0.4),
        fontWeight: 800,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        lineHeight: 1,
      }}>{brand.short}</span>
    </div>
  );
}
