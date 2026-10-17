import sys,re
# usage: tick2.py <plan> <step> <progress n> <note>   (format: "- [ ] **N. Title** ...")
p,step,prog,note=sys.argv[1:5]
s=open(p).read()
s=re.sub(r'- \*\*Progress:\*\* \d+ of', f'- **Progress:** {prog} of', s, count=1)
pat=re.compile(rf'^- \[ \] (\*\*{step}\. [^\n]*)$', re.M)
m=pat.search(s); assert m, step
s=s[:m.start()]+f'- [x] {m.group(1)}\n  - *{note}*'+s[m.end():]
open(p,'w').write(s)
