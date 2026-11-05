import { describe, expect, it } from 'vitest';
import { fromDef, type CharacterDef } from '../../../src/features/figure/cast';
import { GAITS, POSES } from '../../../src/features/motion/presets';
import { evaluate, standHolds, type AnchorKind } from '../../../src/features/motion/motion';
import { J, fk, skeleton } from '../../../src/features/body/rig';
import { apply, invertRigid, position, sub } from '../../../src/lib/math';
import { GROUP, reach } from '../../../src/features/body/parts';
import { BASE } from '../../../base/base';

// The base pair: the generator's poses and walks under test. Every stand in the library is held by both; one that
// names an opening the bare body lacks (a pocket, a hem) falls through to the hip or hangs (motion.ts CHAIN).
const cast: CharacterDef[] = BASE.map(c => c.def);
/** The gaits the walk is tested in: every gait the library keeps. */
const WALKS = Object.keys(GAITS);
/** Openings a hand drops into from above: its forearm falls to them, within 45° of plumb on screen. A belly pocket opens
 * at its sides, so the forearm comes in across the body as hands in a kangaroo pocket do (short of level: BELLY); a
 * jacket's slash pocket takes the hand at a slant from an elbow out and back (short of level too: SLASH). */
const DOWN: AnchorKind[] = ['frontPocket', 'thighPocket', 'hem'], BELLY = 85, SLASH = 80;
const PITCH = 18 * Math.PI / 180;
/** A hand at the front of the hips (a pocket's mouth, a thumb at a hem) keeps out of the fly: its wrist at least FLY of
 * the hip's half-width out from the pelvis's middle, so it never reads as a hand on the crotch. */
const FLY = 0.45, FRONT: AnchorKind[] = ['frontPocket', 'jacketPocket', 'hem'];

describe('pocket holds', () => {
  for (const def of cast) it(`${def.id}: every stand's hands go to openings it has, the forearm plumb to a pocket, the hand outside the cloth`, () => {
    const m = fromDef(def), s = skeleton(m.genes), look = m.outfits[m.defaultOutfit](s), k = m.genes.height / 1.62;
    const cloth = look.parts.filter(p => !([GROUP.head, GROUP.armL, GROUP.armR, GROUP.item] as number[]).includes(p.group));
    const surface = (o: [number, number, number], d: [number, number, number]) => reach(cloth, s.rest, o, d);
    for (const [name, stand] of Object.entries(POSES)) {
      const holds = standHolds(s, stand, surface, look.anchors);
      const pose = evaluate(s, m.gait, { t: 0, moving: false, phase: 0, yaw: 0, headYaw: 0, shuffle: 0, stand, holds, clear: look.clear }).pose;
      // Drawn as the hero is: three-quarter, from the sheets' pitch; and square on, for the fly.
      const world = fk(s, { ...pose, yaw: Math.PI / 4 }), square = fk(s, { ...pose, yaw: 0 }), pelvis = invertRigid(square[J.pelvis]);
      for (const h of holds) {
        const at = `${name} ${h.side} ${h.anchor}`;
        const d = sub(position(world[J[`hand.${h.side}`]]), position(world[J[`foreArm.${h.side}`]]));
        const sx = d[0], sy = d[1] * Math.cos(PITCH) - d[2] * Math.sin(PITCH), lean = Math.atan2(Math.abs(sx), -sy) * 180 / Math.PI;
        if (h.anchor && DOWN.includes(h.anchor)) expect(lean, at).toBeLessThanOrEqual(45);
        if (h.anchor === 'bellyPocket') expect(lean, at).toBeLessThanOrEqual(BELLY);
        if (h.anchor === 'jacketPocket') expect(lean, at).toBeLessThanOrEqual(SLASH);
        const hip = look.anchors!.find(a => a.kind === 'hip' && (a.side ?? h.side) === h.side)!, palm = apply(pelvis, position(square[J[`hand.${h.side}`]]));
        if (h.anchor && FRONT.includes(h.anchor) && palm[1] < s.hipY + 0.16 * k - s.rest[J.pelvis][1]) expect(Math.abs(palm[0]), `${at} fly`).toBeGreaterThanOrEqual(FLY * Math.abs(hip.at[0]));
        // The arm reaches its place: the wrist where the hold put it, not short of it with the arm stretched.
        const want = apply(world[h.in ?? J.chest], h.hand), got = position(world[J[`hand.${h.side}`]]);
        expect(Math.hypot(...sub(want, got)), `${at} reach`).toBeLessThan(0.015 * k);
        // The wrist's place (rest space) no further in from the bone's axis than the cloth's surface there.
        const bone = s.rest[h.in ?? J.chest], wrist = [bone[0] + h.hand[0], bone[1] + h.hand[1], bone[2] + h.hand[2]] as [number, number, number];
        const o: [number, number, number] = [bone[0], wrist[1], bone[2]], out = sub(wrist, o), r = Math.hypot(...out);
        expect(r, at).toBeGreaterThanOrEqual(surface(o, [out[0] / r, out[1] / r, out[2] / r]) - 0.02 * k);
      }
    }
  });
});

describe('the walk', () => {
  for (const def of cast) for (const gait of WALKS) it(`${def.id} walking ${gait}: the head bobs a texel, a foot is always down, the trailing knee long at the strike`, () => {
    const m = fromDef(def), s = skeleton(m.genes), g = { ...GAITS[gait] }, n = g.walkPoses, k = m.genes.height / 1.62;
    const heads: number[] = [];
    for (let i = 0; i < n; i++) {
      const world = fk(s, evaluate(s, g, { t: 0, moving: true, phase: i / n, yaw: 0, headYaw: 0, shuffle: 0 }).pose);
      heads.push(position(world[J.head])[1]);
      // The lower ankle on the floor (its own height over the sole, give or take the heel's roll).
      const ankles = (['L', 'R'] as const).map(side => position(world[J[`foot.${side}`]])[1] - m.genes.ankle);
      expect(Math.min(...ankles), `frame ${i}`).toBeLessThan(0.02 * k);
      expect(Math.min(...ankles), `frame ${i}`).toBeGreaterThan(-0.005 * k);
      // At the strike (frames 0 and n/2) both knees run nearly straight: a step, not a lunge or a kneel.
      if (i % (n / 2) === 0) for (const side of ['L', 'R'] as const) {
        const hip = position(world[J[`thigh.${side}`]]), knee = position(world[J[`shin.${side}`]]), ankle = position(world[J[`foot.${side}`]]);
        const a = sub(knee, hip), b = sub(ankle, knee), bend = Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b));
        expect(bend * 180 / Math.PI, `frame ${i} ${side} knee`).toBeLessThan(36);
      }
    }
    // A texel at the brand kit's density (36.9 per metre): no walk glides.
    expect(Math.max(...heads) - Math.min(...heads)).toBeGreaterThanOrEqual(1 / 36.9);
  });
});
