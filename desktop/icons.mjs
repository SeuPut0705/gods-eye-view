// Renders the desktop app icons from `public/logo.svg` into desktop/icons/:
// icon.png (1024 px, electron-builder makes the macOS .icns from it) and
// icon.ico (16-256 px) for Windows. The output is committed, so a release
// build needs no image toolchain. Re-run after changing the logo, from a
// checkout with the root dependencies installed: `node desktop/icons.mjs`.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(desktopDir, '..', 'public', 'logo.svg');
const OUT_DIR = path.join(desktopDir, 'icons');
/** `--bg-dark`, as in scripts/generate-icons.mjs. */
const BACKGROUND = '#0a0a0f';
const BORDER = '#1c2a44';
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * The logo on a rounded dark tile. `margin` is the transparent border as a
 * fraction of the canvas: macOS icons sit inside one (824 of 1024 px), while
 * Windows icons fill their square.
 */
async function render(svg, size, margin) {
  const offset = Math.round(size * margin);
  const tile = size - 2 * offset;
  const radius = tile * 0.225;
  const stroke = Math.max(1, Math.round(tile / 160));
  const tileSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="${offset + stroke / 2}" y="${offset + stroke / 2}" width="${tile - stroke}" height="${tile - stroke}" ` +
      `rx="${radius}" fill="${BACKGROUND}" stroke="${BORDER}" stroke-width="${stroke}"/></svg>`,
  );
  const box = Math.round(tile * 0.74);
  const mark = await sharp(svg, { density: 384 })
    .resize(box, box, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(tileSvg)
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** An .ico holding one PNG image per size. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(({ png }) => png)]);
}

const svg = await readFile(LOGO);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'icon.png'), await render(svg, 1024, 0.098));
const images = [];
for (const size of ICO_SIZES)
  images.push({ size, png: await render(svg, size, 0) });
await writeFile(path.join(OUT_DIR, 'icon.ico'), ico(images));
console.log(
  `icons: wrote icon.png (1024px), icon.ico (${ICO_SIZES.join(', ')}px)`,
);
