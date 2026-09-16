"""Cut the mascot out of its photo background and size it for the header.

The header mark is a FREE-STANDING penguin (Luca 2026-09-15: "i dont
want a circle like a profile picture... no boxing in the penguin, have
it be free"), so it needs real transparency, not a round mask hiding a
grey backdrop. rembg's isnet model plus alpha matting keeps the down
tips half transparent; a hard mask shaves the fluff off and the bird
ends up with a cut-out sticker edge.

    py -m pip install rembg onnxruntime pillow
    py scripts/penguin-mark.py
"""
from pathlib import Path
from PIL import Image
from rembg import remove, new_session

ROOT = Path(__file__).resolve().parents[1]
src = Image.open(ROOT / 'public/penguin-logo.png').convert('RGBA')
cut = remove(src, session=new_session('isnet-general-use'), alpha_matting=True,
             alpha_matting_foreground_threshold=250,
             alpha_matting_background_threshold=15,
             alpha_matting_erode_size=8)
cut = cut.crop(cut.getbbox())          # no dead margin: the box IS the bird
out = ROOT / 'public/penguin'
out.mkdir(parents=True, exist_ok=True)
w, h = cut.size
print('trimmed', cut.size)
# Sized by HEIGHT, which is the dimension the header row fixes.
for size in (44, 88, 132, 64, 128, 192):
    cut.resize((round(w * size / h), size), Image.Resampling.LANCZOS).save(
        out / f'mark-{size}.webp', lossless=True)
# One big one for anywhere that shows the bird properly (auth, and
# later the splash). WebP: the same picture as a PNG cost 279KB.
cut.resize((round(w * 512 / h), 512), Image.Resampling.LANCZOS).save(
    out / 'mark-512.webp', quality=88, method=6)
for p in sorted(out.iterdir()):
    print(p.name, p.stat().st_size)
