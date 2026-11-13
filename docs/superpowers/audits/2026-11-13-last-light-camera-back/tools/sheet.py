# usage: python3 -I sheet.py <size> <out.png>
import sys
from PIL import Image, ImageDraw, ImageFont
S='/tmp/claude-0/-home-user-automata-framework/bb6fe7d1-dbbc-5b2f-ad83-74caece663f2/scratchpad'
size=sys.argv[1]; out=sys.argv[2]
w,h=map(int,size.split('x'))
rooms=['hall-south','corridor','closet']
cols=[('before (3954f49)',lambda r:f'{S}/before/{size}/{r}.png'),('after (this branch)',lambda r:f'{S}/after/{size}/{r}.png'),('original (92e6704)',lambda r:f'{S}/old/{size}-{r}.png')]
scale=0.5 if w>900 else 0.75
tw,th=int(w*scale),int(h*scale)
pad=8; head=28; side=110
sheet=Image.new('RGB',(side+len(cols)*(tw+pad)+pad, head+len(rooms)*(th+pad)+pad),(24,24,24))
d=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
except Exception: font=None
for c,(label,_) in enumerate(cols): d.text((side+pad+c*(tw+pad),6),label,fill=(230,230,230),font=font)
for r,room in enumerate(rooms):
    y=head+r*(th+pad)
    d.text((8,y+th//2-8),room,fill=(230,230,230),font=font)
    for c,(_,path) in enumerate(cols):
        im=Image.open(path(room)).convert('RGB').resize((tw,th),Image.NEAREST if scale>=1 else Image.BOX)
        sheet.paste(im,(side+pad+c*(tw+pad),y))
sheet.save(out)
print(out, sheet.size)
