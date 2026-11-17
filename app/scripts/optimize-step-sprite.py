"""Build the smaller step-battle atlas; retain the original as source artwork.

Run: python app/scripts/optimize-step-sprite.py (requires Pillow).
"""
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "avatars"
SOURCE = ASSETS / "step-battle-tug-sheet.png"
DESTINATION = ASSETS / "step-battle-tug-sheet-1536.png"
SIZE = (1536, 768)


def optimize():
    with Image.open(SOURCE) as original:
        assert original.size == (1774, 887) and original.mode == "RGBA"
        # Premultiply alpha while resampling to avoid dark fringes around cutouts.
        resized = original.convert("RGBa").resize(SIZE, Image.Resampling.LANCZOS).convert("RGBA")
        resized.save(DESTINATION, optimize=True, compress_level=9)
    with Image.open(DESTINATION) as result:
        assert result.size == SIZE and result.mode == "RGBA"
        assert result.getchannel("A").getextrema() == (0, 255)
    before, after = SOURCE.stat().st_size, DESTINATION.stat().st_size
    print(f"PNG: {before:,} -> {after:,} bytes ({(1 - after / before) * 100:.1f}% smaller)")
    print(f"Decoded RGBA: {1774 * 887 * 4:,} -> {1536 * 768 * 4:,} bytes")


if __name__ == "__main__":
    optimize()
