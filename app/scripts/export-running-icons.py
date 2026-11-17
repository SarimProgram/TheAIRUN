"""Pack the generated 4x4 sheet into a small transparent atlas for the app.

Usage: python scripts/export-running-icons.py <generated-sheet.png>
Requires Pillow. Keeps the generated alpha; never removes or rebuilds backgrounds.
"""
import sys
from pathlib import Path

from PIL import Image

DESTINATION = Path(__file__).resolve().parent.parent / 'assets' / 'onboarding' / 'running-icons'
CELL_SIZE = 256
ART_SIZE = 224


def main():
    source = Image.open(sys.argv[1]).convert('RGBA')
    atlas = Image.new('RGBA', (CELL_SIZE * 4, CELL_SIZE * 4))
    for index in range(16):
        col, row = index % 4, index // 4
        cell = source.crop((round(col * source.width / 4), round(row * source.height / 4),
                            round((col + 1) * source.width / 4), round((row + 1) * source.height / 4)))
        cell = cell.resize((ART_SIZE, ART_SIZE), Image.Resampling.LANCZOS)
        padding = (CELL_SIZE - ART_SIZE) // 2
        atlas.paste(cell, (col * CELL_SIZE + padding, row * CELL_SIZE + padding))

    DESTINATION.mkdir(parents=True, exist_ok=True)
    target = DESTINATION / 'running-icons-v1.webp'
    atlas.save(target, 'WEBP', quality=84, method=6, alpha_quality=100, exact=True)
    print(f'{target}: {target.stat().st_size:,} bytes; {atlas.width}x{atlas.height}; 16 icons')


if __name__ == '__main__':
    main()
