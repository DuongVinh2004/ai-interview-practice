import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const glyphA = [
  ' 111 ',
  '1   1',
  '1   1',
  '11111',
  '1   1',
  '1   1',
  '1   1',
];

const glyphI = [
  '111',
  ' 1 ',
  ' 1 ',
  ' 1 ',
  ' 1 ',
  ' 1 ',
  '111',
];

function createIconPng(width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Background #10b981 = 16, 185, 129
  // Foreground #ffffff = 255, 255, 255
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Uint8Array(width * 4);
    for (let x = 0; x < width; x++) {
      grid[y][x * 4 + 0] = 0x10;
      grid[y][x * 4 + 1] = 0xb9;
      grid[y][x * 4 + 2] = 0x81;
      grid[y][x * 4 + 3] = 255;
    }
  }

  // Draw 'AI'
  const scale = Math.max(1, Math.floor(height / 14));
  const textW = 9 * scale;
  const textH = 7 * scale;
  const startX = Math.floor((width - textW) / 2);
  const startY = Math.floor((height - textH) / 2);

  // Draw A
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (glyphA[r][c] === '1') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = startX + c * scale + dx;
            const py = startY + r * scale + dy;
            if (py >= 0 && py < height && px >= 0 && px < width) {
              grid[py][px * 4 + 0] = 255;
              grid[py][px * 4 + 1] = 255;
              grid[py][px * 4 + 2] = 255;
              grid[py][px * 4 + 3] = 255;
            }
          }
        }
      }
    }
  }

  // Draw I
  const offsetI = 6 * scale;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 3; c++) {
      if (glyphI[r][c] === '1') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = startX + offsetI + c * scale + dx;
            const py = startY + r * scale + dy;
            if (py >= 0 && py < height && px >= 0 && px < width) {
              grid[py][px * 4 + 0] = 255;
              grid[py][px * 4 + 1] = 255;
              grid[py][px * 4 + 2] = 255;
              grid[py][px * 4 + 3] = 255;
            }
          }
        }
      }
    }
  }

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    Buffer.from(grid[y].buffer).copy(rawData, rowOffset + 1);
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createIco(png32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png32.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png32]);
}

const pubDir = path.resolve(__dirname, '../public');
const pwa192 = createIconPng(192, 192);
const pwa512 = createIconPng(512, 512);
const appleIcon = createIconPng(180, 180);
const favicon32 = createIconPng(32, 32);
const ico = createIco(favicon32);

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#10b981" />
  <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="240" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">AI</text>
</svg>
`;

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), pwa192);
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), pwa512);
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), appleIcon);
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), ico);
fs.writeFileSync(path.join(pubDir, 'masked-icon.svg'), svgContent);

console.log('Generated icons in apps/web/public:');
console.log('pwa-192x192.png:', pwa192.length);
console.log('pwa-512x512.png:', pwa512.length);
console.log('apple-touch-icon.png:', appleIcon.length);
console.log('favicon.ico:', ico.length);
console.log('masked-icon.svg:', svgContent.length);
