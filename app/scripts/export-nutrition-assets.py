"""Export exact, transparent nutrition crops without changing pose alignment.

Run from any directory: python app/scripts/export-nutrition-assets.py
Requires Pillow. Original sprite sheets are retained as source artwork.
"""
from pathlib import Path
from PIL import Image

AVATARS = Path(__file__).resolve().parents[1] / "assets" / "avatars"
OUTPUT = AVATARS / "nutrition"
POSES = ("idle", "progress", "winning", "over-target")


def export_assets():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(AVATARS / "nutrition-reactions-v3.png") as sheet:
        assert sheet.size == (1536, 1024), "Unexpected character sheet dimensions"
        assert sheet.mode == "RGBA", "Character sheet must preserve transparency"
        for row, gender in enumerate(("male", "female")):
            for column, pose in enumerate(POSES):
                x, y = column * 384 + 44, row * 512
                crop = sheet.crop((x, y, x + 300, y + 512))
                crop.save(OUTPUT / f"{gender}-{pose}.png", optimize=True)
    with Image.open(AVATARS / "nutrition-food-v1.png") as sheet:
        assert sheet.size == (1774, 887), "Unexpected food sheet dimensions"
        assert sheet.mode == "RGBA", "Food sheet must preserve transparency"
        for side, x in (("left", 60), ("right", 947)):
            crop = sheet.crop((x, 300, x + 770, 840))
            crop.save(OUTPUT / f"food-{side}.png", optimize=True)


if __name__ == "__main__":
    export_assets()
    for asset in sorted(OUTPUT.glob("*.png")):
        print(f"{asset.name}: {asset.stat().st_size:,} bytes")
