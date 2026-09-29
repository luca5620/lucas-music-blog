# App Store shot = background + real mockup + headline set with real fonts.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
KIT='/Users/lucapivard/lucas-music-blog/docs/marketing/app-store-screenshots'
BLUE=(30,144,255); WHITE=(232,230,227)
def fit(draw, text, path, size, maxw):
    while True:
        f=ImageFont.truetype(path,size)
        if draw.textlength(text,font=f)<=maxw or size<40: return f
        size-=4
def wrap(draw, text, font, maxw):
    words=text.split(); lines=[]; cur=''
    for w in words:
        t=(cur+' '+w).strip()
        if draw.textlength(t,font=font)<=maxw: cur=t
        else: lines.append(cur); cur=w
    lines.append(cur); return lines
def headline(img, l1, l2, center_y, s=1.0):
    W=img.width; d=ImageDraw.Draw(img)
    f1=fit(d,l1,KIT+'/fonts/ChakraPetch-Bold.ttf',int(150*s),int(W*0.88))
    f2=ImageFont.truetype(KIT+'/fonts/Inter-SemiBold.ttf',int(68*s))
    lines=[x for part in l2.split("\n") for x in wrap(d,part,f2,int(W*0.9))]
    h1=f1.getbbox(l1)[3]; lh=int(68*s*1.3); gap=int(40*s)
    total=h1+gap+lh*len(lines); y=int(center_y-total/2)
    # glow behind line 1
    glow=Image.new('RGBA',img.size,(0,0,0,0)); g=ImageDraw.Draw(glow)
    g.text((W/2,y),l1,font=f1,fill=BLUE+(150,),anchor='ma')
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(int(26*s))))
    d=ImageDraw.Draw(img)
    d.text((W/2,y),l1,font=f1,fill=BLUE,anchor='ma')
    y+=h1+gap
    for ln in lines:
        d.text((W/2,y),ln,font=f2,fill=WHITE,anchor='ma'); y+=lh
    return img
def scene_version(scene_path, l1, l2, out, W=1320, H=2868):
    sc=Image.open(scene_path).convert('RGBA')
    sc=sc.resize((W,round(sc.height*W/sc.width)),Image.LANCZOS)
    img=Image.new('RGBA',(W,H),(0,0,0,255)); img.paste(sc,(0,H-sc.height))
    headline(img,l1,l2,int(H*0.15)).convert('RGB').save(out,quality=95)
def flat_version(mock_path, l1, l2, out, W=1320, H=2868, phone_h=0.70):
    img=Image.new('RGBA',(W,H),(4,6,12,255))
    glow=Image.new('RGBA',(W,H),(0,0,0,0)); g=ImageDraw.Draw(glow)
    g.ellipse((W*0.05,H*0.30,W*0.95,H*0.95),fill=(30,144,255,95))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(220)))
    m=Image.open(mock_path).convert('RGBA'); ph=int(H*phone_h); m=m.resize((round(m.width*ph/m.height),ph),Image.LANCZOS)
    x=(W-m.width)//2; y=H-ph-int(H*0.035)
    sh=Image.new('RGBA',(W,H),(0,0,0,0)); sh.paste((0,0,0,170),(x+30,y+40,x+m.width-30,y+ph),)
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(40)))
    img.alpha_composite(m,(x,y))
    headline(img,l1,l2,int((y)*0.5)).convert('RGB').save(out,quality=95)
if __name__=='__main__':
    scene_version(sys.argv[1],'SONG VS SONG','Start an Aux War.\nLet the room vote.',sys.argv[2])
    flat_version(KIT+'/input/01-aux-wars-mockup.png','SONG VS SONG','Start an Aux War.\nLet the room vote.',sys.argv[3])
