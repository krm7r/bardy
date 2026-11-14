"""Generate the small PWA icon variants from the approved square master icon.

Replace assets/icon-512.png with the updated square artwork before regenerating
these derivatives. This avoids accidentally shrinking the full horizontal logo
into an unusably small app icon.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MASTER = ASSETS / "icon-512.png"

with Image.open(MASTER) as image:
    if image.size != (512, 512):
        raise ValueError(f"Expected a 512x512 master icon, got {image.size}")
    master = image.convert("RGB")

for size, name in (
    (192, "icon-192.png"),
    (180, "apple-touch-icon.png"),
    (64, "favicon.png"),
):
    output = master.resize((size, size), Image.Resampling.LANCZOS)
    path = ASSETS / name
    output.save(path, format="PNG", optimize=True)
    print(path)
