/**
 * Generate the favicon size set from client/public/favicon.svg using sharp.
 * Idempotent — re-running produces identical bytes given the same input SVG.
 *
 * Outputs to client/public/:
 *   favicon-16.png, favicon-32.png, favicon-48.png
 *   apple-touch-icon-180.png
 *   icon-192.png, icon-512.png
 *   maskable-icon-512.png   (with 10% safe-zone padding on each side)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'client', 'public');

const SRC = resolve(PUBLIC, 'favicon.svg');
const svg = readFileSync(SRC);

const SIZES = [
  { name: 'favicon-16.png',          size: 16  },
  { name: 'favicon-32.png',          size: 32  },
  { name: 'favicon-48.png',          size: 48  },
  { name: 'apple-touch-icon-180.png',size: 180 },
  { name: 'icon-192.png',            size: 192 },
  { name: 'icon-512.png',            size: 512 },
];

async function renderSquare(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderMaskable(size = 512) {
  // 80% safe zone → 10% padding on each side. Background is opaque #0a0a0a
  // (Android requires the maskable variant to fill the canvas).
  const inner = Math.round(size * 0.8);
  const innerPng = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
  })
    .composite([{ input: innerPng, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  for (const { name, size } of SIZES) {
    const buf = await renderSquare(size);
    writeFileSync(resolve(PUBLIC, name), buf);
    console.log(`wrote ${name} (${buf.length} bytes)`);
  }
  const maskable = await renderMaskable(512);
  writeFileSync(resolve(PUBLIC, 'maskable-icon-512.png'), maskable);
  console.log(`wrote maskable-icon-512.png (${maskable.length} bytes)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
