/* Slice generated artwork into foot-aligned animation strips. No alpha removal,
 * recoloring or per-pose stretching. Run: node app/scripts/export-food-coach.cjs */
const sharp = require('../../backend/node_modules/sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../assets/avatars');
const out = path.join(root, 'food-coach');
const ROWS = [[0, 262], [262, 512], [512, 770], [770, 1024]];
const FRAME_W = 256, FRAME_H = 384;
const SCALE = 1.38;

async function main() {
  await fs.mkdir(out, { recursive: true });
  const source = path.join(root, 'food-coach-poses-v2.png');
  const meta = await sharp(source).metadata();
  if (meta.width !== 1536 || meta.height !== 1024 || !meta.hasAlpha) throw new Error('Unexpected source atlas dimensions or missing alpha');
  for (const [genderIndex, gender] of ['male', 'female'].entries()) {
    const strips = [];
    for (let index = 0; index < 12; index++) {
      const row = genderIndex * 2 + Math.floor(index / 6);
      const [top, bottom] = ROWS[row];
      const cell = { left: (index % 6) * 256, top, width: 256, height: bottom - top };
      const { data, info } = await sharp(source).extract(cell).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let minX = 256, maxX = 0, minY = info.height, maxY = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < 256; x++) {
        if (data[(y * 256 + x) * 4 + 3] > 100) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      // Align the center of both shoes, rather than hands/hair that move.
      let leftFoot = 256, rightFoot = 0;
      for (let y = Math.max(0, maxY - 12); y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (data[(y * 256 + x) * 4 + 3] > 128) { leftFoot = Math.min(leftFoot, x); rightFoot = Math.max(rightFoot, x); }
      }
      const footX = (leftFoot + rightFoot) / 2;
      const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      const width = Math.round(box.width * SCALE), height = Math.round(box.height * SCALE);
      const left = Math.round(FRAME_W / 2 - (footX - minX) * SCALE);
      const y = Math.round(376 - (maxY - minY + 1) * SCALE);
      if (left < 0 || y < 0 || left + width > FRAME_W || y + height > FRAME_H) throw new Error(`${gender} frame ${index} would clip`);
      const pose = await sharp(data, { raw: info }).extract(box).resize(width, height).png().toBuffer();
      const frame = await sharp({ create: { width: FRAME_W, height: FRAME_H, channels: 4, background: '#00000000' } }).composite([{ input: pose, left, top: y }]).png().toBuffer();
      strips.push({ input: frame, left: index * FRAME_W, top: 0 });
    }
    const target = path.join(out, `${gender}-sequence.png`);
    await sharp({ create: { width: FRAME_W * 12, height: FRAME_H, channels: 4, background: '#00000000' } }).composite(strips).png({ compressionLevel: 9 }).toFile(target);
    console.log(`${gender}: 12 aligned frames, 3072x384 RGBA, ${(await fs.stat(target)).size} bytes`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
