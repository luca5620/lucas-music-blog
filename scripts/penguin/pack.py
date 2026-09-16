"""Pack Blender PNGs with Pillow 12.3. No browser-side codec dependency."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / 'assets/penguin/frames'
OUT = ROOT / 'public/penguin'
OUT.mkdir(parents=True, exist_ok=True)
poster = Image.open(FRAMES/'poster.png').convert('RGBA')
for size in (32,64,96):
    poster.resize((size,size),Image.Resampling.LANCZOS).save(OUT/f'poster-{size}.webp', lossless=True)
poster.save(OUT/'poster-512.png',optimize=True)
frames=[Image.open(p).convert('RGBA') for p in sorted(FRAMES.glob('header-*.png'))]
assert len(frames)==22, 'Render the complete header sequence first'
# Duplicate the start pixels at the endpoint so settling is mathematically
# exact, including stochastic path-tracing noise and compression boundaries.
frames[-1]=frames[0].copy()
sheet=Image.new('RGBA',(96*len(frames),96))
for i,frame in enumerate(frames): sheet.paste(frame,(96*i,0))
# A shared 128-colour palette preserves identical endpoint pixels while
# removing subpixel path-tracing noise nobody can see at 28px.
sheet=sheet.quantize(colors=128,method=Image.Quantize.FASTOCTREE).convert('RGBA')
sheet.save(OUT/'header.webp',lossless=True,method=6)
assert (OUT/'header.webp').stat().st_size <=120_000
assert sum(p.stat().st_size for p in OUT.glob('poster-*.webp')) <=25_000
# Contact sheet deliberately shows EVERY pose at actual 28px, plus a
# nearest-neighbour enlargement. Black is the real header background.
qa=Image.new('RGB',(880,240),'#08080a'); draw=ImageDraw.Draw(qa)
for i,frame in enumerate(frames):
    tiny=frame.resize((21,28),Image.Resampling.LANCZOS)
    x=(i%11)*80+20; y=(i//11)*110
    qa.paste(tiny,(x,y+20),tiny)
    draw.text((x,y+55),str(i+1),fill='white')
qa.save(ROOT/'assets/penguin/header-28px.png')
sizes={p.name:p.stat().st_size for p in OUT.iterdir() if p.is_file()}
(OUT/'sizes.json').write_text(json.dumps(sizes,indent=2)+'\n',encoding='utf-8')
print(json.dumps(sizes,indent=2))
