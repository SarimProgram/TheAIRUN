"""Cut the white background out of generated goal icons and export app-sized PNGs.

Usage: python scripts/export-goal-icons.py <source-dir> [icon-name ...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ICONS = ['goal-lose-weight', 'goal-stronger-runner', 'goal-weight-and-run']
OUT_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'goals'
SIZE = 288
SOFT = 48.0


def cut_out(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    distance = 255.0 - rgb.min(axis=2)

    labels, _ = ndimage.label(distance < SOFT)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])

    alpha = np.ones(distance.shape, np.float32)
    alpha[background] = np.clip(distance[background] / SOFT, 0, 1) ** 1.4
    alpha = ndimage.gaussian_filter(alpha, 0.6)

    safe = np.maximum(alpha, 1e-3)[..., None]
    color = np.clip((rgb - (1 - alpha[..., None]) * 255.0) / safe, 0, 255)
    rgba = np.dstack([color, alpha * 255]).astype(np.uint8)

    image = Image.fromarray(rgba, 'RGBA')
    image = image.crop(image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    side = int(max(image.size) * 1.06)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    source = Path(sys.argv[1])
    for name in sys.argv[2:] or ICONS:
        cut_out(source / f'{name}.png').save(OUT_DIR / f'{name}.png', optimize=True)
        print('wrote', OUT_DIR / f'{name}.png')


if __name__ == '__main__':
    main()
