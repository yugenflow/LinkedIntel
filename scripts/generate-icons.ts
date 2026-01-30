// Run with: npx ts-node scripts/generate-icons.ts
// Generates placeholder PNG icons for the extension
// For production, replace with actual designed icons

import { writeFileSync } from 'fs';

function createPNG(size: number): Buffer {
  // Minimal valid PNG with a teal square
  // This creates an uncompressed PNG - good enough for dev placeholder
  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(2, 17); // color type (RGB)
  ihdr.writeUInt8(0, 18); // compression
  ihdr.writeUInt8(0, 19); // filter
  ihdr.writeUInt8(0, 20); // interlace

  // Calculate CRC for IHDR
  const ihdrCrc = crc32(ihdr.subarray(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // IDAT chunk - raw image data
  // Each row: filter byte (0) + RGB pixels
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      // Teal color #008080
      rawData.push(0);    // R
      rawData.push(128);  // G
      rawData.push(128);  // B
    }
  }

  // Deflate raw data (store block, no compression)
  const raw = Buffer.from(rawData);
  const deflated = deflateStore(raw);

  const idatData = Buffer.alloc(deflated.length + 12);
  idatData.writeUInt32BE(deflated.length, 0);
  idatData.write('IDAT', 4);
  deflated.copy(idatData, 8);
  const idatCrc = crc32(idatData.subarray(4, 8 + deflated.length));
  idatData.writeUInt32BE(idatCrc, 8 + deflated.length);

  // IEND chunk
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 0xAE, 0x42, 0x60, 0x82]);

  return Buffer.concat([signature, ihdr, idatData, iend]);
}

function deflateStore(data: Buffer): Buffer {
  // Zlib header + stored deflate blocks
  const maxBlock = 65535;
  const blocks: Buffer[] = [];

  // Zlib header (CM=8, CINFO=7, FCHECK)
  blocks.push(Buffer.from([0x78, 0x01]));

  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, maxBlock);
    const isLast = offset + blockSize >= data.length;

    const header = Buffer.alloc(5);
    header.writeUInt8(isLast ? 1 : 0, 0);
    header.writeUInt16LE(blockSize, 1);
    header.writeUInt16LE(blockSize ^ 0xFFFF, 3);

    blocks.push(header);
    blocks.push(data.subarray(offset, offset + blockSize));
    offset += blockSize;
  }

  // Adler32 checksum
  const adler = adler32(data);
  const adlerBuf = Buffer.alloc(4);
  adlerBuf.writeUInt32BE(adler, 0);
  blocks.push(adlerBuf);

  return Buffer.concat(blocks);
}

function adler32(data: Buffer): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

// CRC32 lookup table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png = createPNG(size);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Generated icon-${size}.png`);
}
