/**
 * Generates LinkedIntel "LI" monogram icons at all required sizes.
 * Run: node scripts/generate-li-icons.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const ICON_DIR = path.resolve(__dirname, '../public/icons');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size; // shorthand

  // Background: rounded rectangle with teal
  const radius = s * 0.22;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(s - radius, 0);
  ctx.quadraticCurveTo(s, 0, s, radius);
  ctx.lineTo(s, s - radius);
  ctx.quadraticCurveTo(s, s, s - radius, s);
  ctx.lineTo(radius, s);
  ctx.quadraticCurveTo(0, s, 0, s - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#0D9488';
  ctx.fill();

  // "L" letter - left side
  ctx.fillStyle = '#FFFFFF';
  const lx = s * 0.15;
  const ly = s * 0.2;
  const lw = s * 0.28;
  const lh = s * 0.6;
  const lt = s * 0.13; // stroke thickness

  // L vertical
  ctx.fillRect(lx, ly, lt, lh);
  // L horizontal
  ctx.fillRect(lx, ly + lh - lt, lw, lt);

  // "I" letter - right side
  const ix = s * 0.53;
  const iy = s * 0.2;
  const iw = s * 0.32;
  const ih = s * 0.6;

  // I top bar
  ctx.fillRect(ix, iy, iw, lt);
  // I vertical center
  ctx.fillRect(ix + (iw - lt) / 2, iy, lt, ih);
  // I bottom bar
  ctx.fillRect(ix, iy + ih - lt, iw, lt);

  return canvas;
}

// Ensure directory exists
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}

for (const size of SIZES) {
  const canvas = drawIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const filename = `icon-${size}.png`;
  fs.writeFileSync(path.join(ICON_DIR, filename), buffer);
  console.log(`Generated ${filename}`);
}

console.log('All icons generated!');
