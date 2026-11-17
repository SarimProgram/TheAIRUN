"""Export menu sheets into transparent, app-sized icons (new 3D by default)."""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
legacy = '--legacy-3d' in sys.argv
flat = '--flat' in sys.argv
source = 'minimal-menu-sheet-v2.png' if legacy else 'minimal-menu-sheet-flat-v1.png' if flat else 'minimal-menu-sheet-3d-v3.png'
sheet = Image.open(ROOT / 'assets/tabs' / source).convert('RGBA')
destination = ROOT / 'assets/tabs' / ('minimal-3d' if legacy else 'minimal-flat' if flat else 'minimal-3d-v3')
destination.mkdir(exist_ok=True)

# Gutters between the five objects in each 2172 x 724 sheet.
edges = [0, 440, 852, 1280, 1720, 2172] if legacy else [0, 460, 870, 1290, 1720, 2172]
for index, name in enumerate(['home', 'plans', 'log', 'run', 'partner']):
    icon = sheet.crop((edges[index], 140, edges[index + 1], 580))
    bounds = icon.getchannel('A').point(lambda value: 255 if value > 32 else 0).getbbox()
    if bounds is None:
        raise ValueError(f'No icon found for {name}')
    icon = icon.crop(bounds)
    icon.thumbnail((112, 112), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (120, 120))
    canvas.paste(icon, ((120 - icon.width) // 2, (120 - icon.height) // 2))
    canvas.save(destination / f'{name}.png', optimize=True)
    print(f'Exported {name}: {icon.size}')
