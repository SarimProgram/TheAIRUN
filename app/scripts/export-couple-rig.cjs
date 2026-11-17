// Bake the existing SVG masks once, instead of decoding/masking an atlas on-device.
// Run from any directory: node app/scripts/export-couple-rig.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('../../backend/node_modules/sharp');
const ts = require('../node_modules/typescript');

async function main() {
  const root = path.resolve(__dirname, '../assets/avatars');
  const opponents = process.argv.includes('--opponents');
  const out = path.join(root, opponents ? 'couple-opponents-v1' : 'couple-rig');
  await fs.mkdir(out, { recursive: true });
  const geometry = await fs.readFile(path.resolve(__dirname, '../components/battle/coupleRigGeometry.ts'), 'utf8');
  const fixture = { exports: {} };
  new Function('exports', ts.transpileModule(geometry, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(fixture.exports);
  const { RIG_WIDTH: width, RIG_HEIGHT: height, RIG_WAIST: waist, HEAD_MASK: head, REAR_ARM_MASK: rear, FRONT_ARM_MASK: front } = fixture.exports;
  const atlasPath = path.join(root, opponents ? 'couple-opponents-sheet-v1.png' : 'couple-breathing-sheet-v1.png');
  const atlas = (await sharp(atlasPath).resize(1774, 887, { fit: 'fill' }).png().toBuffer()).toString('base64');
  for (const [row, identity] of ['male', 'female'].entries()) {
    for (const part of ['legs', 'torso', 'head', 'rear', 'front', 'rest']) {
      const clip = part === 'legs' ? `<rect y="${waist}" width="${width}" height="${height - waist}"/>`
        : `<path d="${part === 'head' ? head : part === 'rear' ? rear : front}"/>`;
      const mask = `<rect width="${width}" height="${part === 'torso' ? waist + 3 : height}" fill="white"/>
        <path d="${head}" fill="black" stroke="white" stroke-width="6"/>
        ${part === 'torso' ? `<path d="${rear}" fill="black" stroke="white" stroke-width="6"/>` : ''}
        <path d="${front}" fill="black" stroke="white" stroke-width="6"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="296" height="444" viewBox="0 0 ${width} ${height}">
        <defs><clipPath id="clip">${clip}</clipPath><mask id="mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">${mask}</mask></defs>
        <image xlink:href="data:image/png;base64,${atlas}" y="${-row * height}" width="1774" height="887"
          ${part !== 'rest' && part !== 'torso' ? 'clip-path="url(#clip)"' : ''}
          ${part === 'torso' || part === 'rear' ? 'mask="url(#mask)"' : ''}/></svg>`;
      const rendered = await sharp(Buffer.from(svg)).png().toBuffer();
      await sharp(rendered).webp({ lossless: true }).toFile(path.join(out, `${identity}-${part}.webp`));
      if (part === 'rest') {
        await sharp(rendered).extract({ left: 83, top: 6, width: 104, height: 104 }).resize(104, 104)
          .webp({ lossless: true }).toFile(path.join(out, `${identity}-portrait.webp`));
      }
    }
  }
  if (!opponents) await sharp(path.join(root, 'couple-park-fullscreen-v2.png')).webp({ quality: 85 }).toFile(path.join(out, 'park.webp'));
  const files = await fs.readdir(out);
  console.log('Baked couple artwork:', (await Promise.all(files.map(async file => (await fs.stat(path.join(out, file))).size))).reduce((a, b) => a + b, 0), 'bytes');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
