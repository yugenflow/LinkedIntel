// Generate minimal valid PNG icons for development
const { writeFileSync } = require('fs');
const { deflateSync } = require('zlib');

function createPNG(size) {
  const width = size;
  const height = size;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrBody = Buffer.alloc(13);
  ihdrBody.writeUInt32BE(width, 0);
  ihdrBody.writeUInt32BE(height, 4);
  ihdrBody[8] = 8;  // bit depth
  ihdrBody[9] = 2;  // RGB
  ihdrBody[10] = 0; // compression
  ihdrBody[11] = 0; // filter
  ihdrBody[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrBody);

  // Image data - teal square
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const offset = 1 + x * 3;
      row[offset] = 0;     // R
      row[offset + 1] = 128; // G
      row[offset + 2] = 128; // B
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND
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
  const png = createPNG(size);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
});
