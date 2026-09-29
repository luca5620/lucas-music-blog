# Final App Store shot: Astra scene (background) + the REAL screenshot
# pasted back over the phone's screen at full resolution + the headline
# set in code. Output exact Store size, JPEG, no alpha.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, sys.argv[0].rsplit('/',1)[0]); from compose import headline
KIT='/Users/lucapivard/lucas-music-blog/docs/marketing/app-store-screenshots'
IMG='/private/tmp/claude-501/-Users-lucapivard-lucas-music-blog/b79ab53c-a922-444a-81ea-b0f370f72d50/images'
SHOTS={1:('01-aux-wars','SONG VS SONG','Start an Aux War.\nLet the room vote.'),
       2:('02-review','RATE IT','Review every album you hear.'),
       3:('03-countdown','WAITING ON AN ALBUM?','Count down with everyone else.'),
       4:('04-profile','YOUR PROFILE','Pick a console. Make it yours.'),
       5:('05-your-taste','YOUR TASTE','Find your next favorite record.'),
       6:('06-social','YOUR FRIENDS','See who’s winning this week.'),
       7:('07-ipad','YOUR MUSIC,','on the big screen.')}
def arr(im): return np.asarray(im,dtype=np.float32)
def locate(scene, raw):
    """Find the screenshot inside the scene: (x, y, w) minimising the
    difference over the screen's interior (corners/island/bars skipped)."""
    Sg=scene.convert('L'); best=None
    def sc(x,y,w,f=1):
        h=round(w*raw.height/raw.width)
        r=arr(raw.convert('L').resize((w//f,h//f),Image.BILINEAR))
        M=arr(Sg.resize((Sg.width//f,Sg.height//f),Image.BILINEAR)) if f>1 else Mfull
        xx,yy=x//f,y//f; hh,ww=r.shape
        if yy<0 or xx<0 or yy+hh>M.shape[0] or xx+ww>M.shape[1]: return 1e9
        y0,y1=int(hh*.15),int(hh*.85); x0,x1=int(ww*.1),int(ww*.9)
        return np.abs(M[yy+y0:yy+y1,xx+x0:xx+x1]-r[y0:y1,x0:x1]).mean()
    Mfull=arr(Sg)
    W,H=scene.size
    for w in range(int(W*.28),int(W*.80),8):
        h=round(w*raw.height/raw.width)
        for x in range(0,W-w,8):
            if abs(x+w/2-W/2)>W*.12: continue
            for y in range(0,H-h,8):
                s=sc(x,y,w,4)
                if best is None or s<best[0]: best=(s,x,y,w)
    s,x,y,w=best
    for w2 in range(w-8,w+9,1):
        for x2 in range(x-6,x+7):
            for y2 in range(y-6,y+7):
                s2=sc(x2,y2,w2)
                if s2<best[0]: best=(s2,x2,y2,w2)
    return best
def build(i, scene_path, out_dir):
    name,l1,l2=SHOTS[i]; ipad='ipad' in name
    W,H=(2064,2752) if ipad else (1320,2868)
    scene=Image.open(scene_path).convert('RGB'); raw=Image.open(f'{KIT}/input/{name}-raw.png').convert('RGB')
    s,x,y,w=locate(scene,raw); h=round(w*raw.height/raw.width)
    k=W/scene.width; sh=round(scene.height*k)
    big=scene.resize((W,sh),Image.LANCZOS).convert('RGBA')
    canvas=Image.new('RGBA',(W,H),(0,0,0,255))
    top=H-sh  # >0: pad the (dark) top; <0: crop the top
    canvas.paste(big,(0,top)) if top>=0 else canvas.paste(big.crop((0,-top,W,sh)),(0,0))
    # sharp screen
    X,Y,SW,SH=round(x*k),round(y*k)+top,round(w*k),round(h*k)
    screen=raw.resize((SW,SH),Image.LANCZOS).convert('RGBA')
    mask=Image.new('L',(SW,SH),0); r=int(SW*(0.035 if ipad else 0.125))
    ImageDraw.Draw(mask).rounded_rectangle((0,0,SW-1,SH-1),radius=r,fill=255)
    if not ipad:  # keep the scene's Dynamic Island
        reg=np.asarray(scene.crop((x,y,x+w,y+int(h*.08)))).max(axis=2)
        band=reg[:, w//4:3*w//4]<14; ys,xs=np.where(band)
        if len(xs):
            x0,x1=(xs.min()+w//4-1)*k,(xs.max()+w//4+1)*k; y0,y1=max(0,ys.min()-1)*k,(ys.max()+1)*k
            ImageDraw.Draw(mask).rounded_rectangle((x0,y0,x1,y1),radius=(y1-y0)/2,fill=0)
    mask=mask.filter(ImageFilter.GaussianBlur(1.2))
    canvas.paste(screen,(X,Y),mask)
    # headline centred in the dark space above the device
    dev_top=Y-int(SW*0.06)
    s_head=1.45 if ipad else 1.0
    headline(canvas,l1,l2,max(int(H*0.11),dev_top//2),s_head)
    out=f'{out_dir}/{name}.jpg'; canvas.convert('RGB').save(out,quality=95,subsampling=0)
    print(name,(W,H),'screen match',round(float(s),2),'at',(x,y,w),'device top',dev_top)
if __name__=='__main__':
    for a in sys.argv[2:]:
        i=int(a); build(i,f'{IMG}/{i}.webp',sys.argv[1])
