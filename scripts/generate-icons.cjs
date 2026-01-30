// Generate LinkedIntel "LI" monogram icons as PNG — pure Node, no dependencies
const { writeFileSync } = require('fs');
const { deflateSync } = require('zlib');

// Colors
const TEAL = [13, 148, 136]; // #0D9488
const WHITE = [255, 255, 255];
const TEAL_LIGHT = [40, 170, 160]; // slightly lighter for the "I"

function createIcon(size) {
  const w = size, h = size;
  // Create RGBA pixel buffer
  const pixels = new Uint8Array(w * h * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
  }

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
  }

  const radius = size * 0.22;

  // Draw rounded rectangle background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = true;
      // Check corners
      if (x < radius && y < radius) {
        inside = dist(x, y, radius, radius) <= radius;
      } else if (x >= w - radius && y < radius) {
        inside = dist(x, y, w - radius, radius) <= radius;
      } else if (x < radius && y >= h - radius) {
        inside = dist(x, y, radius, h - radius) <= radius;
      } else if (x >= w - radius && y >= h - radius) {
        inside = dist(x, y, w - radius, h - radius) <= radius;
      }

      if (inside) {
        setPixel(x, y, ...TEAL);
      } else {
        setPixel(x, y, 0, 0, 0, 0); // transparent
      }
    }
  }

  // Helper to draw a filled rectangle
  function fillRect(rx, ry, rw, rh, color) {
    for (let y = Math.floor(ry); y < Math.ceil(ry + rh); y++) {
      for (let x = Math.floor(rx); x < Math.ceil(rx + rw); x++) {
        setPixel(x, y, ...color);
      }
    }
  }

  const s = size;
  const t = Math.max(2, Math.round(s * 0.14)); // stroke thickness

  // "L" — left side
  const lx = Math.round(s * 0.16);
  const ly = Math.round(s * 0.2);
  const lw = Math.round(s * 0.28);
  const lh = Math.round(s * 0.6);
  fillRect(lx, ly, t, lh, WHITE);              // vertical
  fillRect(lx, ly + lh - t, lw, t, WHITE);     // horizontal

  // "I" — right side
  const ix = Math.round(s * 0.54);
  const iy = Math.round(s * 0.2);
  const iw = Math.round(s * 0.30);
  const ih = Math.round(s * 0.6);
  fillRect(ix, iy, iw, t, WHITE);                          // top bar
  fillRect(ix + Math.round((iw - t) / 2), iy, t, ih, WHITE); // vertical center
  fillRect(ix, iy + ih - t, iw, t, WHITE);                 // bottom bar

  return renderPNG(w, h, pixels);
}

function renderPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrBody = Buffer.alloc(13);
  ihdrBody.writeUInt32BE(width, 0);
  ihdrBody.writeUInt32BE(height, 4);
  ihdrBody[8] = 8;  // bit depth
  ihdrBody[9] = 6;  // RGBA
  ihdrBody[10] = 0;
  ihdrBody[11] = 0;
  ihdrBody[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrBody);

  // Image data
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = 1 + x * 4;
      row[di] = pixels[si];
      row[di+1] = pixels[si+1];
      row[di+2] = pixels[si+2];
      row[di+3] = pixels[si+3];
    }
    rawRows.push(row);
  }
  const compressed = deflateSync(Buffer.concat(rawRows));
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

[16, 32, 48, 128].forEach(size => {
  const png = createIcon(size);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
});
