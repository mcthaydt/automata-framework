import os, json, numpy as np
from PIL import Image, ImageDraw, ImageFont
R='/tmp/ra'; OUT=f'{R}/out'; S=8
def load(side,name):
    b=open(f'{R}/{side}/{name}.bin','rb').read()
    w=int.from_bytes(b[:4],'little');h=int.from_bytes(b[4:8],'little')
    return np.frombuffer(b[8:8+w*h*4],dtype=np.uint8).reshape(h,w,4), np.frombuffer(b[8+w*h*4:8+w*h*5],dtype=np.uint8).reshape(h,w)
def up(a): return np.kron(a,np.ones((S,S,1),dtype=np.uint8))
rows=[]; tot=dict(cells=0,moved=0,texels=0,hair=0,ear=0,beside=0,far=0,darker=0)
for f in sorted(os.listdir(f'{R}/before')):
    n=f[:-4]; b,bm=load('before',n); a,am=load('after',n); tot['cells']+=1
    seen=(b[...,3]>0)|(a[...,3]>0); ch=seen&np.any(b!=a,axis=2)
    c=int(ch.sum())
    if not c: continue
    hair=ch&((bm==1)|(am==1)); ear=ch&~hair&((bm==2)|(am==2)); non=ch&~hair&~ear
    hm=(bm>0)|(am>0); near=np.zeros_like(hm)
    for dy in range(-2,3):
        for dx in range(-2,3): near|=np.roll(np.roll(hm,dy,0),dx,1)
    far=non&~near
    # brightness change of the changed hair texels (luma): the brief: a pole no longer faces in -> not darker
    luma=lambda p:(0.2126*p[...,0]+0.7152*p[...,1]+0.0722*p[...,2])
    dl=luma(a.astype(float))-luma(b.astype(float))
    darker=int((ch&(dl<0)).sum()); lighter=int((ch&(dl>0)).sum())
    tot['moved']+=1; tot['texels']+=c; tot['hair']+=int(hair.sum()); tot['ear']+=int(ear.sum()); tot['beside']+=int((non&near).sum()); tot['far']+=int(far.sum()); tot['darker']+=darker
    rows.append(dict(name=n.replace('_','/'),count=c,hair=int(hair.sum()),ear=int(ear.sum()),beside=int((non&near).sum()),far=int(far.sum()),darker=darker,lighter=lighter,b=b,a=a,ch=ch))
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except Exception: font=ImageFont.load_default()
files=[]
for k in range(0,len(rows),12):
    chunk=rows[k:k+12]; panels=[]
    for r in chunk:
        ys,xs=np.nonzero(r['ch']); M=6
        y0,y1,x0,x1=max(ys.min()-M,0),min(ys.max()+M+1,r['ch'].shape[0]),max(xs.min()-M,0),min(xs.max()+M+1,r['ch'].shape[1])
        cr=lambda a:a[y0:y1,x0:x1]
        def flat(p):
            bg=np.full(p.shape[:2]+(3,),235,np.uint8); al=p[...,3:4]/255.0
            return (p[...,:3]*al+bg*(1-al)).astype(np.uint8)
        fb,fa=flat(cr(r['b'])),flat(cr(r['a'])); diff=(fa*0.35+235*0.65).astype(np.uint8); diff[cr(r['ch'])]=(255,0,255)
        gap=np.full((fb.shape[0]*S,10,3),255,np.uint8)
        panels.append((r,np.concatenate([up(fb),gap,up(fa),gap,up(diff)],axis=1)))
    W=max(p.shape[1] for _,p in panels); H=sum(p.shape[0]+26 for _,p in panels)
    img=Image.new('RGB',(W,H),(255,255,255)); d=ImageDraw.Draw(img); y=0
    for r,p in panels:
        d.text((4,y+3),f"{r['name']}   changed {r['count']}  hair {r['hair']}  ear {r['ear']}  beside hair {r['beside']}  elsewhere {r['far']}  (lighter {r['lighter']}, darker {r['darker']})   [before | after | changed texels]",fill=(0,0,0),font=font)
        img.paste(Image.fromarray(p),(0,y+26)); y+=p.shape[0]+26
    fn=f'runway-moved-{k//12+1}.png'; img.save(f'{OUT}/{fn}'); files.append(fn)
cells=[{k:v for k,v in r.items() if k not in('b','a','ch')} for r in rows]
json.dump(dict(total=tot,sheets=files,cells=cells),open(f'{OUT}/summary.json','w'),indent=1)
print(json.dumps(tot)); print(len(files),'sheets'); print([c['name'] for c in cells if c['far']])
