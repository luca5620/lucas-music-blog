import sys, numpy as np
from PIL import Image
KIT='/Users/lucapivard/lucas-music-blog/docs/marketing/app-store-screenshots'
def locate(scene_path, name, xr, yr, wr):
    sc=np.asarray(Image.open(scene_path).convert('L'),dtype=np.float32)
    raw=Image.open(f'{KIT}/input/{name}-raw.png').convert('L'); best=None
    for w in range(*wr):
        h=round(w*raw.height/raw.width); r=np.asarray(raw.resize((w,h),Image.BILINEAR),dtype=np.float32)
        y0,y1=int(h*.15),int(h*.85); x0,x1=int(w*.1),int(w*.9); rr=r[y0:y1,x0:x1]
        for x in range(*xr):
            for y in range(*yr):
                if y+y1>sc.shape[0] or x+x1>sc.shape[1]: continue
                s=np.abs(sc[y+y0:y+y1,x+x0:x+x1]-rr).mean()
                if best is None or s<best[0]: best=(s,x,y,w)
    return best
IMG='/private/tmp/claude-501/-Users-lucapivard-lucas-music-blog/b79ab53c-a922-444a-81ea-b0f370f72d50/images'
for i,name in [(5,'05-your-taste'),(6,'06-social')]:
    b=locate(f'{IMG}/{i}.webp',name,(290,350,3),(310,470,3),(360,430,3))
    s,x,y,w=b; b2=locate(f'{IMG}/{i}.webp',name,(x-3,x+4),(y-3,y+4),(w-3,w+4))
    print(i,name,b2,flush=True)
