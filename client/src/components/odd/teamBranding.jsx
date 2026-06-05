// Curated logo URLs (Wikimedia / public CDN). Where a logo isn't listed the
// circle-with-initials fallback renders. Entries are looked up by the same
// normalized key the colors are looked up by.
const W = 'https://upload.wikimedia.org/wikipedia/';
const TEAM_LOGOS = {
  arsenal: W + 'en/thumb/5/53/Arsenal_FC.svg/96px-Arsenal_FC.svg.png',
  chelsea: W + 'en/thumb/c/cc/Chelsea_FC.svg/96px-Chelsea_FC.svg.png',
  liverpool: W + 'en/thumb/0/0c/Liverpool_FC.svg/96px-Liverpool_FC.svg.png',
  'manchester city': W + 'en/thumb/e/eb/Manchester_City_FC_badge.svg/96px-Manchester_City_FC_badge.svg.png',
  manchesterCity: W + 'en/thumb/e/eb/Manchester_City_FC_badge.svg/96px-Manchester_City_FC_badge.svg.png',
  'manchester united': W + 'en/thumb/7/7a/Manchester_United_FC_crest.svg/96px-Manchester_United_FC_crest.svg.png',
  manchesterUtd: W + 'en/thumb/7/7a/Manchester_United_FC_crest.svg/96px-Manchester_United_FC_crest.svg.png',
  'man utd': W + 'en/thumb/7/7a/Manchester_United_FC_crest.svg/96px-Manchester_United_FC_crest.svg.png',
  tottenham: W + 'en/thumb/b/b4/Tottenham_Hotspur.svg/96px-Tottenham_Hotspur.svg.png',
  spurs: W + 'en/thumb/b/b4/Tottenham_Hotspur.svg/96px-Tottenham_Hotspur.svg.png',
  newcastle: W + 'en/thumb/5/56/Newcastle_United_Logo.svg/96px-Newcastle_United_Logo.svg.png',
  'newcastle united': W + 'en/thumb/5/56/Newcastle_United_Logo.svg/96px-Newcastle_United_Logo.svg.png',
  'west ham': W + 'en/thumb/c/c2/West_Ham_United_FC_logo.svg/96px-West_Ham_United_FC_logo.svg.png',
  'west ham united': W + 'en/thumb/c/c2/West_Ham_United_FC_logo.svg/96px-West_Ham_United_FC_logo.svg.png',
  westHam: W + 'en/thumb/c/c2/West_Ham_United_FC_logo.svg/96px-West_Ham_United_FC_logo.svg.png',
  'aston villa': W + 'en/thumb/9/9f/Aston_Villa_FC_new_crest.svg/96px-Aston_Villa_FC_new_crest.svg.png',
  astonVilla: W + 'en/thumb/9/9f/Aston_Villa_FC_new_crest.svg/96px-Aston_Villa_FC_new_crest.svg.png',
  brighton: W + 'en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/96px-Brighton_%26_Hove_Albion_logo.svg.png',
  'brighton & hove albion':
    W + 'en/thumb/f/fd/Brighton_%26_Hove_Albion_logo.svg/96px-Brighton_%26_Hove_Albion_logo.svg.png',
  everton: W + 'en/thumb/7/7c/Everton_FC_logo.svg/96px-Everton_FC_logo.svg.png',
  fulham: W + 'en/thumb/e/eb/Fulham_FC_%28shield%29.svg/96px-Fulham_FC_%28shield%29.svg.png',
  brentford: W + 'en/thumb/2/2a/Brentford_FC_crest.svg/96px-Brentford_FC_crest.svg.png',
  'crystal palace':
    W + 'en/thumb/0/0c/Crystal_Palace_FC_logo_%282022%29.svg/96px-Crystal_Palace_FC_logo_%282022%29.svg.png',
  crystalPalace:
    W + 'en/thumb/0/0c/Crystal_Palace_FC_logo_%282022%29.svg/96px-Crystal_Palace_FC_logo_%282022%29.svg.png',
  wolves: W + 'en/thumb/f/fc/Wolverhampton_Wanderers.svg/96px-Wolverhampton_Wanderers.svg.png',
  bournemouth: W + 'en/thumb/e/e5/AFC_Bournemouth_%282013%29.svg/96px-AFC_Bournemouth_%282013%29.svg.png',
  'nottingham forest': W + 'en/thumb/d/d2/Nottingham_Forest_F.C._logo.svg/96px-Nottingham_Forest_F.C._logo.svg.png',
  nottingham: W + 'en/thumb/d/d2/Nottingham_Forest_F.C._logo.svg/96px-Nottingham_Forest_F.C._logo.svg.png',
  barcelona: W + 'en/thumb/4/47/FC_Barcelona_%28crest%29.svg/96px-FC_Barcelona_%28crest%29.svg.png',
  'real madrid': W + 'en/thumb/5/56/Real_Madrid_CF.svg/96px-Real_Madrid_CF.svg.png',
  realMadrid: W + 'en/thumb/5/56/Real_Madrid_CF.svg/96px-Real_Madrid_CF.svg.png',
  'atletico madrid': W + 'en/thumb/f/f4/Atletico_Madrid_2024_Logo.svg/96px-Atletico_Madrid_2024_Logo.svg.png',
  atleticoMadrid: W + 'en/thumb/f/f4/Atletico_Madrid_2024_Logo.svg/96px-Atletico_Madrid_2024_Logo.svg.png',
  bayern:
    W +
    'commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/96px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png',
  'bayern munich':
    W +
    'commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/96px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png',
  dortmund: W + 'commons/thumb/6/67/Borussia_Dortmund_logo.svg/96px-Borussia_Dortmund_logo.svg.png',
  psg: W + 'en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/96px-Paris_Saint-Germain_F.C..svg.png',
  inter: W + 'commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/96px-FC_Internazionale_Milano_2021.svg.png',
  'inter milan': W + 'commons/thumb/0/05/FC_Internazionale_Milano_2021.svg/96px-FC_Internazionale_Milano_2021.svg.png',
  milan: W + 'commons/thumb/d/d0/Logo_of_AC_Milan.svg/96px-Logo_of_AC_Milan.svg.png',
  'ac milan': W + 'commons/thumb/d/d0/Logo_of_AC_Milan.svg/96px-Logo_of_AC_Milan.svg.png',
  juventus: W + 'commons/thumb/b/bc/Juventus_FC_2017_logo.svg/96px-Juventus_FC_2017_logo.svg.png',
  ajax: W + 'en/thumb/7/79/Ajax_Amsterdam.svg/96px-Ajax_Amsterdam.svg.png',
  celtic: W + 'en/thumb/3/35/Celtic_FC.svg/96px-Celtic_FC.svg.png',
  rangers: W + 'en/thumb/5/5e/Rangers_FC.svg/96px-Rangers_FC.svg.png',
  galatasaray: W + 'en/thumb/9/97/Galatasaray_Sports_Club_Logo.png/96px-Galatasaray_Sports_Club_Logo.png',
  fenerbahce: W + 'en/thumb/9/96/Fenerbah%C3%A7e_SK.png/96px-Fenerbah%C3%A7e_SK.png',
};

const LEAGUE_LOGOS = {
  'premier league': W + 'en/thumb/f/f2/Premier_League_Logo.svg/96px-Premier_League_Logo.svg.png',
  'english premier league': W + 'en/thumb/f/f2/Premier_League_Logo.svg/96px-Premier_League_Logo.svg.png',
  epl: W + 'en/thumb/f/f2/Premier_League_Logo.svg/96px-Premier_League_Logo.svg.png',
  'la liga': W + 'commons/thumb/a/ad/LaLiga.svg/96px-LaLiga.svg.png',
  'primera division': W + 'commons/thumb/a/ad/LaLiga.svg/96px-LaLiga.svg.png',
  bundesliga: W + 'en/thumb/d/df/Bundesliga_logo_%282017%29.svg/96px-Bundesliga_logo_%282017%29.svg.png',
  'serie a': W + 'commons/thumb/e/e1/Serie_A_logo_2022.svg/96px-Serie_A_logo_2022.svg.png',
  'ligue 1': W + 'en/thumb/9/9b/Ligue1_Uber_Eats.svg/96px-Ligue1_Uber_Eats.svg.png',
  eredivisie: W + 'en/thumb/1/13/Eredivisie_nuovo_logo.png/96px-Eredivisie_nuovo_logo.png',
  'primeira liga': W + 'en/thumb/d/d6/Liga_Portugal_logo.svg/96px-Liga_Portugal_logo.svg.png',
  'champions league': W + 'en/thumb/b/bf/UEFA_Champions_League.svg/96px-UEFA_Champions_League.svg.png',
  'uefa champions league': W + 'en/thumb/b/bf/UEFA_Champions_League.svg/96px-UEFA_Champions_League.svg.png',
  'europa league': W + 'commons/thumb/d/df/UEFA_Europa_League.svg/96px-UEFA_Europa_League.svg.png',
  'uefa europa league': W + 'commons/thumb/d/df/UEFA_Europa_League.svg/96px-UEFA_Europa_League.svg.png',
  'world cup': W + 'en/thumb/6/67/2022_FIFA_World_Cup.svg/96px-2022_FIFA_World_Cup.svg.png',
  'fa cup': W + 'en/thumb/4/4b/2024%E2%80%9325_FA_Cup_logo.png/96px-2024%E2%80%9325_FA_Cup_logo.png',
  'carabao cup': W + 'en/thumb/3/3a/EFL_Cup.png/96px-EFL_Cup.png',
  'efl cup': W + 'en/thumb/3/3a/EFL_Cup.png/96px-EFL_Cup.png',
  'africa cup of nations': W + 'en/thumb/3/39/2023_Africa_Cup_of_Nations.svg/96px-2023_Africa_Cup_of_Nations.svg.png',
  afcon: W + 'en/thumb/3/39/2023_Africa_Cup_of_Nations.svg/96px-2023_Africa_Cup_of_Nations.svg.png',
};

function teamLogoFor(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim().replace(/\s+/g, '');
  return TEAM_LOGOS[key] || TEAM_LOGOS[name.toLowerCase().trim()] || null;
}
function leagueLogoFor(name) {
  if (!name) return null;
  return LEAGUE_LOGOS[name.toLowerCase().trim()] || null;
}

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
  epl: { bg: '#37003c', fg: '#ffffff', short: 'PL' },
  'la liga': { bg: '#c60b1e', fg: '#febe10', short: 'LL' },
  'primera division': { bg: '#c60b1e', fg: '#febe10', short: 'LL' },
  bundesliga: { bg: '#d3051e', fg: '#ffffff', short: 'BL' },
  'serie a': { bg: '#004694', fg: '#ffffff', short: 'SA' },
  'ligue 1': { bg: '#002654', fg: '#ed2939', short: 'L1' },
  eredivisie: { bg: '#001f5b', fg: '#ffffff', short: 'ED' },
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
  afcon: { bg: '#009a44', fg: '#e11a22', short: 'AFCON' },
};

export function getTeamBranding(name) {
  if (!name) return { bg: '#333', fg: '#fff', short: '?', initials: '?' };
  const key = name.toLowerCase().trim().replace(/\s+/g, '');
  const direct = TEAM_COLORS[key];
  if (direct) return { ...direct, initials: direct.short };

  const byFull = TEAM_COLORS[name.toLowerCase().trim()];
  if (byFull) return { ...byFull, initials: byFull.short };

  const words = name.split(/[\s'-]+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? words
          .map((w) => w[0].toUpperCase())
          .join('')
          .slice(0, 3)
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
  const initials = words
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 4);

  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 73) % 360;
  return {
    bg: `hsl(${hue}, 50%, 30%)`,
    fg: '#fff',
    short: initials,
  };
}

import { useState } from 'react';

/**
 * Internal: round chip that prefers a real image (Wikimedia / public CDN)
 * and falls back to a colored-monogram chip if the URL is missing or the
 * image fails to load (offline, blocked, deprecated thumb path).
 */
function BadgeWithFallback({ url, brand, size, style, alt, fontScale = 0.45, minFont = 9 }) {
  const [failed, setFailed] = useState(false);
  const showImg = url && !failed;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: showImg ? '#fff' : brand.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt={alt}
          width={Math.round(size * 0.78)}
          height={Math.round(size * 0.78)}
          style={{ objectFit: 'contain' }}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          style={{
            color: brand.fg,
            fontSize: Math.max(minFont, size * fontScale),
            fontWeight: 800,
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            lineHeight: 1,
          }}
        >
          {brand.short || brand.initials}
        </span>
      )}
    </div>
  );
}

export function TeamLogo({ name, logoUrl, size = 20, style }) {
  const brand = getTeamBranding(name);
  // Prefer an explicit URL passed in (e.g. from the provider response) over
  // the curated Wikimedia map, so live api-football data overrides the
  // static fallback once Phase 2 wiring reaches the server normaliser.
  const url = logoUrl || teamLogoFor(name);
  return (
    <BadgeWithFallback
      url={url}
      brand={brand}
      size={size}
      style={style}
      alt={name ? `${name} logo` : 'team logo'}
      fontScale={0.45}
      minFont={9}
    />
  );
}

export function LeagueLogo({ name, logoUrl, size = 20, style }) {
  const brand = getLeagueBranding(name);
  const url = logoUrl || leagueLogoFor(name);
  return (
    <BadgeWithFallback
      url={url}
      brand={brand}
      size={size}
      style={style}
      alt={name ? `${name} logo` : 'league logo'}
      fontScale={0.4}
      minFont={8}
    />
  );
}
