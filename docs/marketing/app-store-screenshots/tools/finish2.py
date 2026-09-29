# Same as finish.py, but the PHONE is the same size in every iPhone shot:
# the scene is scaled so the screen is SCREEN_FRAC of the canvas width,
# then cropped at the sides (centred on the phone) and padded/cropped at
# the top. Takes the screen position finish.py already found.
import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0,'docs/marketing/app-store-screenshots/tools')
from compose import headline
from finish import SHOTS, KIT
SCREEN_FRAC=0.4545   # = shot 2's natural size (387px of 851)
def build(i, scene_path, loc, out_dir):
    name,l1,l2=SHOTS[i]; ipad='ipad' in name
    W,H=(2064,2752) if ipad else (1320,2868)
    x,y,w=loc
    scene=Image.open(scene_path).convert('RGB'); raw=Image.open(f'{KIT}/input/{name}-raw.png').convert('RGB')
    h=round(w*raw.height/raw.width)
    # never smaller than the canvas width: side bars look worse than a
    # slightly bigger phone
    k=(W/scene.width) if ipad else max(SCREEN_FRAC*W/w, W/scene.width)
    big=scene.resize((round(scene.width*k),round(scene.height*k)),Image.LANCZOS).convert('RGBA')
    # horizontal: centre on the phone
    cx=round((x+w/2)*k); left=min(max(0,cx-W//2),max(0,big.width-W))
    if big.width>=W: big=big.crop((left,0,left+W,big.height)); ox=-left
    else: ox=(W-big.width)//2; left=-ox
    # fade the scene's top edge into black so padding never shows a seam
    fade=Image.new('L',(1,big.height),255)
    for j in range(min(160,big.height)): fade.putpixel((0,j),int(255*j/160))
    blk=Image.new('RGBA',big.size,(0,0,0,255)); big=Image.composite(big,blk,fade.resize(big.size))
    canvas=Image.new('RGBA',(W,H),(0,0,0,255))
    top=H-big.height
    if top>=0: canvas.paste(big,(max(0,ox) if big.width<W else 0,top))
    else: canvas.paste(big.crop((0,-top,big.width,big.height)),(max(0,ox) if big.width<W else 0,0))
    X=round(x*k)-left; Y=round(y*k)+top; SW,SH=round(w*k),round(h*k)
    screen=raw.resize((SW,SH),Image.LANCZOS).convert('RGBA')
    mask=Image.new('L',(SW,SH),0); r=int(SW*(0.035 if ipad else 0.125))
    ImageDraw.Draw(mask).rounded_rectangle((0,0,SW-1,SH-1),radius=r,fill=255)
    if not ipad:
        reg=np.asarray(scene.crop((x,y,x+w,y+int(h*.08)))).max(axis=2)
        band=reg[:, w//4:3*w//4]<14; ys,xs=np.where(band)
        if len(xs):
            x0,x1=(xs.min()+w//4-1)*k,(xs.max()+w//4+1)*k; y0,y1=max(0,ys.min()-1)*k,(ys.max()+1)*k
            ImageDraw.Draw(mask).rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)/2,fill=0)
    canvas.paste(screen,(X,Y),mask.filter(ImageFilter.GaussianBlur(1.2)))
    dev_top=Y-int(SW*0.06)
    headline(canvas,l1,l2,(max(int(H*0.11),dev_top//2) if ipad else int(H*0.14)),1.45 if ipad else 1.0)
    canvas.convert('RGB').save(f'{out_dir}/{name}.jpg',quality=95,subsampling=0)
    print(name,'k',round(k,2),'screen at',(X,Y,SW,SH),'device top',dev_top)
