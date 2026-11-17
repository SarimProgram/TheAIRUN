const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');

// Build reference sheets from the actual app art, not newly invented poses.
const assets = path.resolve(__dirname, '../../app/assets');
const output = path.resolve(__dirname, '../assets');
const W = 1024, H = 1536, COLS = 3, ROWS = 4;
async function tile(input, extract) {
  let image = sharp(input);
  if (extract) image = image.extract(extract);
  return image.resize(340, 384, { fit: 'contain', position: 'bottom', background: '#FF00FF' }).png().toBuffer();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const [row, gender] of ['male', 'female'].entries()) {
    const water = path.join(assets, 'avatars/water-drinking-v2.png');
    const waterSize = await sharp(water).metadata();
    const tiles = [await tile(path.join(assets, `imagechat-${gender}.png`))];
    for (const state of ['idle', 'progress', 'winning', 'over-target']) tiles.push(await tile(path.join(assets, `avatars/nutrition/${gender}-${state}.png`)));
    for (const frame of [0, 5]) {
      const left = Math.round(frame * waterSize.width / 6);
      tiles.push(await tile(water, { left, top: row * waterSize.height / 2, width: Math.round((frame + 1) * waterSize.width / 6) - left, height: waterSize.height / 2 }));
    }
    for (let frame = 0; frame < 4; frame++) tiles.push(await tile(path.join(assets, 'avatars/step-battle-tug-sheet-1536.png'), { left: frame * 256, top: row * 384, width: 256, height: 384 }));
    tiles.push(await tile(path.join(assets, `avatars/weekly-${gender}.png`)));
    await sharp({ create: { width: W, height: H, channels: 3, background: '#FF00FF' } })
      .composite(tiles.map((input, i) => ({ input, left: Math.round((i % COLS) * W / COLS), top: Math.floor(i / COLS) * H / ROWS })))
      .png({ palette: true, colours: 192 }).toFile(path.join(output, `avatar-home-poses-${gender}.png`));
    console.log(`Built ${gender}: ${tiles.length} reference poses`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
