/**
 * Generate client/public/og-image.png (1200×630) for link previews.
 * Pure SVG → PNG via sharp. No external font files required — uses the
 * generic `sans-serif` family that resvg falls back to on any system.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'client', 'public', 'og-image.png');

const W = 1200,
  H = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g" cx="80%" cy="100%" r="80%">
      <stop offset="0%"  stop-color="#7ed957" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#7ed957" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#7ed957" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="${H}" fill="url(#g)"/>

  <!-- Wordmark: Bet in dark ink, Nexa in brand green, plus a small green dot at baseline -->
  <g font-family="sans-serif" font-weight="800" letter-spacing="-4">
    <text x="80" y="350" font-size="180" fill="#172117">Bet</text>
    <text x="330" y="350" font-size="180" fill="#15803d">Nexa</text>
    <circle cx="850" cy="345" r="14" fill="#15803d"/>
  </g>

  <!-- Tagline -->
  <text x="80" y="420" font-family="sans-serif" font-weight="500" font-size="32" fill="#657365">
    Premium Sports Betting · Ghana
  </text>

  <!-- 18+ chip bottom-left -->
  <g transform="translate(80, 530)">
    <rect width="84" height="40" rx="20" fill="#f3fbf1" stroke="#15803d" stroke-opacity="0.5"/>
    <text x="42" y="27" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="16" fill="#15803d">18+</text>
  </g>

  <!-- License caption bottom-right -->
  <text x="${W - 80}" y="555" text-anchor="end" font-family="sans-serif" font-size="18" fill="#93a693">
    Licensed · Gaming Commission of Ghana
  </text>
</svg>`;

async function main() {
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(OUT, buf);
  console.log(`wrote og-image.png (${buf.length} bytes, ${W}×${H})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
