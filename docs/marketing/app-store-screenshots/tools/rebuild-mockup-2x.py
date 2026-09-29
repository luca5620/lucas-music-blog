# Rebuild each shots.so 1x mockup at 2x: frame upscaled from shots.so,
# SCREEN re-pasted from the full-res simulator screenshot so text is sharp.
# Wherever shots.so drew over the screen (dynamic island, rounded glass
# corners) the frame is kept: found as pixels that differ from the raw.
import numpy as np
from PIL import Image, ImageFilter
IN='/Users/lucapivard/lucas-music-blog/docs/marketing/app-store-screenshots/input'
DL='/Users/lucapivard/Downloads'
K=2
jobs={'298':('07-ipad',595,234,729)}
for n,(name,x,y,w) in jobs.items():
    M=Image.open(f'{DL}/{n}shots_so.png').convert('RGBA')
    raw=Image.open(f'{IN}/{name}-raw.png').convert('RGB')
    h=round(w*raw.height/raw.width)
    small=raw.resize((w,h),Image.LANCZOS)
    mc=M.crop((x,y,x+w,y+h)).convert('RGB')
    blur=lambda im: np.asarray(im.filter(ImageFilter.GaussianBlur(1.2)),dtype=np.float32)
    d=np.abs(blur(mc)-blur(small)).max(axis=2)
    m=Image.fromarray((d>45).astype(np.uint8)*255)
    # opening: drop thin text-edge noise, keep solid frame shapes
    m=m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    # also keep a rounded-corner ring and anything transparent in the mockup
    a=np.asarray(M.crop((x,y,x+w,y+h)).getchannel('A'))
    m=np.maximum(np.asarray(m),(a<250).astype(np.uint8)*255)
    if "ipad" not in name:
        # Dynamic Island: a black pill on a dark header, too close in value
        # for the diff test. Take the bbox of near-black pixels in the top
        # band, centre third, and keep the mockup inside that pill.
        mcA=np.asarray(mc).max(axis=2); band=mcA[:80, w//4:3*w//4]<8
        ys,xs=np.where(band)
        if len(xs):
            from PIL import ImageDraw
            x0,x1=xs.min()+w//4-2, xs.max()+w//4+2; y0,y1=max(0,ys.min()-2), ys.max()+2
            pill=Image.new("L",(w,h),0); ImageDraw.Draw(pill).rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)//2,fill=255)
            m=np.maximum(m,np.asarray(pill))
            print("  island",(x0,y0,x1,y1))
    frame_mask=Image.fromarray(m).filter(ImageFilter.MaxFilter(3)).resize((w*K,h*K),Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.5))
    big=M.resize((M.width*K,M.height*K),Image.LANCZOS)
    screen=raw.resize((w*K,h*K),Image.LANCZOS).convert('RGBA')
    region=big.crop((x*K,y*K,(x+w)*K,(y+h)*K))
    region=Image.composite(region,screen,frame_mask)   # frame where mask, sharp screen elsewhere
    big.paste(region,(x*K,y*K))
    bb=big.getchannel('A').getbbox(); pad=40
    big=big.crop((max(0,bb[0]-pad),max(0,bb[1]-pad),min(big.width,bb[2]+pad),min(big.height,bb[3]+pad)))
    big.save(f'{IN}/{name}-mockup.png')
    cover=(np.asarray(frame_mask)>128).mean()
    print(name,big.size,f'frame-over-screen {cover:.1%}')
