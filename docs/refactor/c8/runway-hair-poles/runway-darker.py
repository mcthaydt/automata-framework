# The 12 texels of the runway re-record that are darker than every unchanged hair texel beside them (README), as a x8 before | after sheet
# and a list with each texel's part (seam) number. Reads the dumps of runway-dump.mts (/tmp/ra/{before,after}); writes runway-darker.png and
# runway-darker.json beside this file. A changed texel counts when it is hair (seam 2000 to 2999, either side), has an unchanged hair texel
# among its 8 neighbours, and is darker (luma) than all of them. Cells whose "before" dump is not the old golden's md5 are skipped: on
# some machines the old builder's poles flip by a last bit (the bug this commit fixes), so a before drawn here may not be the golden's.
import os, json, hashlib, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
R = '/tmp/ra'; HERE = os.path.dirname(os.path.abspath(__file__)); S = 8
P = 'extensions/character-kit/tests/fixtures/goldens/runway-cells.json'
def load(side, n):
    b = open(f'{R}/{side}/{n}.bin', 'rb').read(); w = int.from_bytes(b[:4], 'little'); h = int.from_bytes(b[4:8], 'little')
    return np.frombuffer(b[8:8+w*h*4], np.uint8).reshape(h, w, 4), np.frombuffer(b[8+w*h*4:8+w*h*6], np.int16).reshape(h, w)
old = json.loads(subprocess.check_output(['git', 'show', f'ea71e0a3^:{P}'], text=True))
def golden(n):
    i, k, d = n.split('_'); return old['cells'][i][d] if k == 'own' else old['fit'][i][k][d]
luma = lambda p: 0.2126*p[..., 0] + 0.7152*p[..., 1] + 0.0722*p[..., 2]
cells = []; skipped = []
for f in sorted(os.listdir(f'{R}/before')):
    n = f[:-4]; (b, bp), (a, ap) = load('before', n), load('after', n)
    if hashlib.md5(b.tobytes()).hexdigest() != golden(n): skipped.append(n.replace('_', '/')); continue
    ch = ((b[..., 3] > 0) | (a[..., 3] > 0)) & np.any(b != a, axis=2); hair = ((bp >= 2000) & (bp < 3000)) | ((ap >= 2000) & (ap < 3000))
    la = luma(a.astype(float)); H, W = ch.shape; hit = []
    for y, x in zip(*np.nonzero(ch & hair)):
        un = [la[y+dy, x+dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and 0 <= y+dy < H and 0 <= x+dx < W and hair[y+dy, x+dx] and not ch[y+dy, x+dx]]
        if un and la[y, x] < min(un): hit.append((int(x), int(y)))
    if hit: cells.append((n, b, a, bp, ap, hit))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
panels = []; out = []
def flat(p):
    bg = np.full(p.shape[:2]+(3,), 235, np.uint8); al = p[..., 3:4]/255.0
    return (p[..., :3]*al + bg*(1-al)).astype(np.uint8)
for n, b, a, bp, ap, hit in cells:
    xs = [x for x, _ in hit]; ys = [y for _, y in hit]; M = 6
    y0, y1, x0, x1 = max(min(ys)-M, 0), min(max(ys)+M+1, b.shape[0]), max(min(xs)-M, 0), min(max(xs)+M+1, b.shape[1])
    fb, fa = flat(b[y0:y1, x0:x1]), flat(a[y0:y1, x0:x1]); up = lambda p: np.kron(p, np.ones((S, S, 1), np.uint8))
    mark = up(fa).copy()
    for x, y in hit:  # a magenta frame round each texel
        yy, xx = (y-y0)*S, (x-x0)*S; mark[yy:yy+S, xx:xx+S][[0, S-1], :] = (255, 0, 255); mark[yy:yy+S, xx:xx+S][:, [0, S-1]] = (255, 0, 255)
    gap = np.full((fb.shape[0]*S, 10, 3), 255, np.uint8)
    panels.append((n.replace('_', '/'), np.concatenate([up(fb), gap, up(fa), gap, mark], axis=1), len(hit)))
    for x, y in hit:
        pb, pa = b[y, x], a[y, x]
        out.append(dict(cell=n.replace('_', '/'), x=x, y=y, part_before=int(bp[y, x]), part_after=int(ap[y, x]), before=f'{pb[0]:02x}{pb[1]:02x}{pb[2]:02x}', after=f'{pa[0]:02x}{pa[1]:02x}{pa[2]:02x}'))
W = max(p.shape[1] for _, p, _ in panels); H = sum(p.shape[0]+26 for _, p, _ in panels)
img = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(img); y = 0
for name, p, k in panels:
    d.text((4, y+3), f'{name}   {k} texel(s) darker than every unchanged hair texel beside them   [before | after | the texels framed]', fill=(0, 0, 0), font=font)
    img.paste(Image.fromarray(p), (0, y+26)); y += p.shape[0]+26
img.save(f'{HERE}/runway-darker.png')
json.dump(dict(texels=len(out), skipped_cells_before_not_the_golden=skipped, parts=sorted({o['part_after'] for o in out} | {o['part_before'] for o in out}), list=out), open(f'{HERE}/runway-darker.json', 'w'), indent=1)
print(len(out), 'texels', len(cells), 'cells; skipped', skipped, 'parts', sorted({o['part_after'] for o in out}))
