"""Crop the approved 3x2 coach sheet without painting or changing its alpha."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'plan' / 'coaches'

with Image.open(ROOT / 'coach-sheet-v2.png') as sheet:
    assert sheet.mode == 'RGBA'
    width, height = sheet.size
    for row, gender in enumerate(('male', 'female')):
        for column, pose in enumerate(('calendar', 'strength', 'walk')):
            cell = sheet.crop((column * width // 3, row * height // 2,
                               (column + 1) * width // 3, (row + 1) * height // 2))
            bounds = cell.getchannel('A').point(lambda alpha: 255 if alpha > 32 else 0).getbbox()
            assert bounds, f'Missing {gender} {pose}'
            cell = cell.crop(bounds)
            if pose == 'calendar':
                cell = cell.crop((0, 0, cell.width, round(cell.height * .72)))
            elif pose == 'strength':
                cell = cell.crop((0, 0, cell.width, round(cell.height * .62)))
            cell.save(ROOT / f'{gender}-{pose}-v2.png', optimize=True)
            print(f'{gender}-{pose}: {cell.size}')
