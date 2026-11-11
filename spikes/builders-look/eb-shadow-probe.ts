// The builder's cast shadow, measured, for after-shadow/ (the survey's builders-shadow.json). Not part of the framework: copy
// it into EnvironmentBuilder's scripts/ (at f7c5356, with FigureBuilder at 23f889c in its vendor/) and run it there, changing nothing in
// that repository:
//
//   npm ci --ignore-scripts && cp spikes/builders-look/eb-shadow-probe.ts <EnvironmentBuilder>/scripts/_shadow_probe.ts
//   npx vite-node scripts/_shadow_probe.ts <out dir>
//
// For each base scene and view it draws the frame with the figure shadow on (`look.figureShadow` 0.6) and off (1), finds the figures'
// texels by their depth (the frame's against the scene's), and counts the other texels that differ: the shadow's footprint, and
// the mean of luma on over luma off, how much darker it makes them. shoot.mjs's SHADOW_ONLY mode measures ours the same way.
import { writeFileSync } from 'node:fs';
import { checkedMap } from '../base/base';
import { writeFileSync } from 'node:fs';
import { checkedMap } from '../base/base';
import { LOOK } from '../src/features/paint/look';
import { FirstPerson } from '../src/features/view/fp';
import { mapRenderer } from '../src/features/view/render';
const out = process.argv[2]!;
const luma = (a: Uint8ClampedArray, i: number) => 0.2126 * a[i]! + 0.7152 * a[i + 1]! + 0.0722 * a[i + 2]!;
const rows: unknown[] = [];
for (const id of ['base-interior', 'base-interior-dressed', 'base-exterior', 'base-exterior-dressed'])
  for (const view of ['diorama', 'fp'] as const) {
    const map = checkedMap(id);
    const shot = (shadow: number) => {
      (LOOK as { figureShadow: number }).figureShadow = shadow;
      if (view === 'fp') {
        const fp = new FirstPerson(map, { w: 320, h: 200 }), room = fp.drawRoom(map.views?.fp ?? { at: [0, 0], angle: 0 }, 0);
        const rgba = fp.drawFigures(room);
        return { rgba, w: 320, h: 200, figure: (k: number) => fp.depth![k] !== fp.g.depth[k] };
      }
      const r = mapRenderer(map, 'diorama'), room = r.drawRoom(0, 1 / 12), { w, h } = r.cam;
      const rgba = r.drawFigures(room);
      return { rgba, w, h, figure: (k: number) => r.depth![k] !== r.g.depth[k] };
    };
    const on = shot(0.6), off = shot(1);
    // figures: depth differs from the scene's. roomOf hides the buffers, so find them by what two frames share:
    // a figure's texels differ between the two only by exposure; the floor differs by the shadow. Use ours as the mask: not here.
    const n = on.w * on.h;
    let count = 0, ratio = 0;
    const diff: number[] = [];
    for (let k = 0; k < n; k++) {
      const i = k * 4;
      if (!on.figure(k) && !off.figure(k) && (on.rgba[i] !== off.rgba[i] || on.rgba[i + 1] !== off.rgba[i + 1] || on.rgba[i + 2] !== off.rgba[i + 2])) {
        count++;
        diff.push(k);
        ratio += luma(on.rgba, i) / Math.max(1, luma(off.rgba, i));
      }
    }
    writeFileSync(`${out}/${id}-${view}-on.raw`, on.rgba);
    writeFileSync(`${out}/${id}-${view}-off.raw`, off.rgba);
    let figs = 0; for (let k = 0; k < n; k++) if (on.figure(k)) figs++;
    rows.push({ id, view, w: on.w, h: on.h, figureTexels: figs, differing: count, meanRatio: count ? ratio / count : 1 });
  }
writeFileSync(`${out}/eb-shadow.json`, JSON.stringify(rows, null, 1));
