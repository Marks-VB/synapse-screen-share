import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Create Vector SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0a1526" />
      <stop offset="100%" stop-color="#020408" />
    </radialGradient>
    <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f3ff" />
      <stop offset="100%" stop-color="#0077aa" />
    </linearGradient>
    <linearGradient id="neonPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d946ef" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Dark Background Plate with Rounded Corners -->
  <rect width="512" height="512" rx="104" fill="url(#bgGlow)" />
  <rect width="504" height="504" x="4" y="4" rx="100" fill="none" stroke="#00f3ff" stroke-width="4" stroke-opacity="0.4" />
  
  <!-- Circuit Grid Accents -->
  <line x1="80" y1="120" x2="160" y2="120" stroke="#00f3ff" stroke-width="2" stroke-opacity="0.3" />
  <line x1="160" y1="120" x2="200" y2="160" stroke="#00f3ff" stroke-width="2" stroke-opacity="0.3" />
  <circle cx="200" cy="160" r="4" fill="#00f3ff" fill-opacity="0.6" />

  <line x1="432" y1="392" x2="352" y2="392" stroke="#d946ef" stroke-width="2" stroke-opacity="0.3" />
  <line x1="352" y1="392" x2="312" y2="352" stroke="#d946ef" stroke-width="2" stroke-opacity="0.3" />
  <circle cx="312" cy="352" r="4" fill="#d946ef" fill-opacity="0.6" />

  <!-- Center Synapse Bolt & Hex Core -->
  <g filter="url(#glow)">
    <!-- Outer Hex -->
    <polygon points="256,76 396,156 396,316 256,396 116,316 116,156" 
      fill="none" stroke="url(#neonCyan)" stroke-width="8" stroke-dasharray="16 8" />

    <!-- Core Lightning Bolt -->
    <polygon points="276,110 180,260 252,260 236,402 332,252 260,252" 
      fill="url(#neonCyan)" stroke="#ffffff" stroke-width="3" />
      
    <!-- Secondary Tactical Node -->
    <circle cx="256" cy="256" r="16" fill="url(#neonPurple)" fill-opacity="0.8" />
    <circle cx="256" cy="256" r="6" fill="#ffffff" />
  </g>

  <!-- Cyberpunk Bracket Corners -->
  <path d="M 40 90 L 40 40 L 90 40" fill="none" stroke="#00f3ff" stroke-width="5" />
  <path d="M 472 90 L 472 40 L 422 40" fill="none" stroke="#00f3ff" stroke-width="5" />
  <path d="M 40 422 L 40 472 L 90 472" fill="none" stroke="#00f3ff" stroke-width="5" />
  <path d="M 472 422 L 472 472 L 422 472" fill="none" stroke="#00f3ff" stroke-width="5" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf-8');

// 2. Pure Node.js PNG Generator
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function createCyberpunkPNG(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const center = size / 2;
  const cornerRadius = size * 0.2;

  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter byte 0: None

    for (let x = 0; x < width; x++) {
      // Rounded box distance
      const dx = Math.max(Math.abs(x - center) - (center - cornerRadius), 0);
      const dy = Math.max(Math.abs(y - center) - (center - cornerRadius), 0);
      const distFromCorner = Math.sqrt(dx * dx + dy * dy);

      if (distFromCorner > cornerRadius) {
        // Outside rounded box - transparent
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        continue;
      }

      // Inside app icon plate: dark gradient
      const normY = y / height;
      const rBg = Math.round(3 + 8 * (1 - normY));
      const gBg = Math.round(5 + 14 * (1 - normY));
      const bBg = Math.round(10 + 28 * (1 - normY));

      // Distance from center
      const distC = Math.hypot(x - center, y - center) / center;

      // Hexagon ring test
      const hexR = size * 0.32;
      const _angle = Math.atan2(y - center, x - center);
      const hexDist = Math.hypot(x - center, y - center);
      const isHexEdge = Math.abs(hexDist - hexR) < size * 0.02;

      // Bolt shape test: coordinates normalized to [-1, 1]
      const nx = (x - center) / (size * 0.35);
      const ny = (y - center) / (size * 0.35);

      // Simplified lightning bolt inside [-1, 1]
      let isBolt = false;
      if (ny >= -0.8 && ny <= 0.8) {
        if (ny < 0) {
          // Upper diagonal
          const expectedX = -0.5 * ny + 0.1;
          if (Math.abs(nx - expectedX) < 0.22) isBolt = true;
        } else {
          // Lower diagonal
          const expectedX = -0.5 * ny - 0.1;
          if (Math.abs(nx - expectedX) < 0.22) isBolt = true;
        }
      }

      let r = rBg;
      let g = gBg;
      let b = bBg;
      let a = 255;

      // Cyan outer border
      if (distFromCorner >= cornerRadius - 4 || x < 4 || x >= width - 4 || y < 4 || y >= height - 4) {
        r = 0;
        g = 243;
        b = 255;
      } else if (isBolt) {
        // Neon cyan bolt with bright core
        r = 0;
        g = 243;
        b = 255;
        if (Math.hypot(nx, ny) < 0.2) {
          r = 255;
          g = 255;
          b = 255; // White center
        }
      } else if (isHexEdge) {
        r = 0;
        g = 180;
        b = 255;
      } else if (distC < 0.1) {
        // Glowing purple core
        r = 180;
        g = 50;
        b = 240;
      }

      rawData[pos++] = r;
      rawData[pos++] = g;
      rawData[pos++] = b;
      rawData[pos++] = a;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT (Deflated raw scanlines)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Write PNGs
const png192 = createCyberpunkPNG(192);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);

const png512 = createCyberpunkPNG(512);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);

const appleIcon = createCyberpunkPNG(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleIcon);

console.log('✅ Generated public/icons/icon.svg');
console.log('✅ Generated public/icons/icon-192.png');
console.log('✅ Generated public/icons/icon-512.png');
console.log('✅ Generated public/icons/apple-touch-icon.png');
