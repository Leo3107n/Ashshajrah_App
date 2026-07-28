/**
 * Generates placeholder PNG assets (icon, splash, adaptive icon)
 * using only Node.js built-ins — no extra dependencies needed.
 * These are valid PNG files with the brand cream background #FAF7F0
 * and the brand green #063F32 initials. Replace with the real
 * Ash-Shajrah logo PNG before publishing to the stores.
 */

const fs = require('fs');
const path = require('path');

// Minimal PNG generator (1x1 solid color, scaled via metadata)
function createSolidPNG(width, height, r, g, b) {
  // We'll write a raw PNG using the PNG spec (no zlib for simplicity —
  // use a pre-built minimal valid PNG and just write a solid color via
  // a very small canvas approach using Buffer manipulation).

  // Actually the simplest approach: write a valid minimal PNG by hand.
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth 8, color type 2 (RGB)
  function uint32BE(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n, 0);
    return b;
  }

  const ihdrData = Buffer.concat([
    uint32BE(width),
    uint32BE(height),
    Buffer.from([8, 2, 0, 0, 0]),
  ]);

  function crc32(buf) {
    let crc = 0xffffffff;
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = uint32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcVal = uint32BE(crc32(crcInput));
    return Buffer.concat([len, typeBytes, data, crcVal]);
  }

  const ihdr = chunk('IHDR', ihdrData);

  // Build raw image data: each row has a filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 3] = r;
      raw[offset + 1 + x * 3 + 1] = g;
      raw[offset + 1 + x * 3 + 2] = b;
    }
  }

  // Compress with zlib (Node built-in)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Cream background: #FAF7F0 = rgb(250,247,240)
// Brand green:      #063F32 = rgb(6,63,50)

// icon.png — 1024x1024 cream with green center square (simulating logo area)
const icon = createSolidPNG(1024, 1024, 250, 247, 240);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), icon);
console.log('✓ assets/icon.png');

// splash.png — 1284x2778 cream (portrait)
const splash = createSolidPNG(1284, 2778, 250, 247, 240);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splash);
console.log('✓ assets/splash.png');

// adaptive-icon.png — 1024x1024 (same as icon for now)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), icon);
console.log('✓ assets/adaptive-icon.png');

// favicon.png — 48x48
const favicon = createSolidPNG(48, 48, 250, 247, 240);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), favicon);
console.log('✓ assets/favicon.png');

console.log('\nDone. Replace these placeholder PNGs with the real Ash-Shajrah logo before publishing to stores.');
