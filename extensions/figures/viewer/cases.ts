import { BASE, ScriptedActor, TIMES, cellOf, compose, gameplay, lookAt, member, stageFrame, STAGE_VERSION, project, type ActorScript, type CameraPose, type Lighting, type StageFrame } from '../src';
import { sheetFigures, type SheetKind } from './sheets';

/**
 * The named check frames, shared by the viewer's `?case=` page (which draws one through `StageView`) and by
 * `scripts/view-check.ts` (which compares the GPU's readback with `compose` of the same frame). Every actor is a base
 * figure and every script a fixed literal here, so `stageFrame`'s determinism makes the page and the script build the
 * same frame. It imports only `../src` and `./sheets`: it runs in the browser and in Node, with no Pixi.
 *
 * Claims: `bytes`: the readback equals `compose(frame)`, every byte. `palette`: every opaque pixel is a colour some
 * sprite's cell holds, alpha 0 or 255 only (a perspective quad is resampled, so no byte claim).
 */
export interface Case { frame: () => StageFrame; claim: 'bytes' | 'palette' }

const PITCH = 18 * Math.PI / 180, DENSITIES = [1, 2] as const;

/** An orthographic pose at the sheets' 18°, `zoom` pixels per D1 texel, round `look`, 20 m back. */
const ortho = (zoom: number, size: [number, number], look: [number, number, number] = [0, 1, 0]): CameraPose =>
  lookAt([look[0], look[1] + 20 * Math.sin(PITCH), look[2] + 20 * Math.cos(PITCH)], look, { pixelsPerMetre: zoom * 96 / 2.6 }, size);

/** The sheets' frames of a base member at a density, one one-sprite frame each (the cell copied, as the figure's next
 * draw overwrites its buffers): `turn0`…`turn7`, `walk0`…, `hero`. Cached by sheet, so Node builds each walk once. */
const sheets = new Map<string, Map<string, StageFrame>>();
function sheetFrame(who: string, density: number, kind: SheetKind, name: string): StageFrame {
  const key = `${who}/D${density}/${kind}`;
  if (!sheets.has(key)) {
    const b = BASE.find(c => c.def.id === who)!, cast = member(b.def, density), camera = ortho(density, cast.cell), frames = new Map<string, StageFrame>();
    sheetFigures(cast, PITCH, (k, i, figure) => {
      const cell = cellOf(figure), px = cell.rgba.slice();
      frames.set(`${k === 'hero' ? 'hero' : k + i}`, { version: STAGE_VERSION, camera, sprites: [{ name: who, cell: { ...cell, rgba: px, painted: px, normals: cell.normals.slice() }, at: [0, 0, 0], screen: [0, 0], scale: 1, depth: project(camera, [0, 0, 0])[2] }] });
    }, b.pose, kind);
    sheets.set(key, frames);
  }
  return sheets.get(key)!.get(name)!;
}

/** Four base figures on crossing paths, overlapping in depth near x = 0 at t = 1.3. */
const scene4 = (): ScriptedActor[] => ([
  { who: 'base-m', at: [-1.7, -1.2], path: [{ at: [1.6, -1.2] }] },
  { who: 'base-f', at: [1.5, -0.4], path: [{ at: [-1.6, -0.4] }] },
  { who: 'base-m', at: [-1.6, 0.4], path: [{ at: [1.7, 0.4] }] },
  { who: 'base-f', at: [1.8, 1.2], path: [{ at: [-1.5, 1.2] }] },
] satisfies ActorScript[]).map(s => new ScriptedActor(s));
const T4 = 1.3, SCENE_POSE = () => ortho(2, [480, 320]);
const NIGHT: Lighting = { time: TIMES.night, lamps: [{ at: [-1.2, 1.5, 0.8], color: '#ffbc4e', steps: 3, radius: 3.2 }] };
/** Three base figures before the orbit at z = 2, 0 and −2 (about 14.6, 16.3 and 18.0 m along the view). */
const trio = () => [['base-m', -0.8, 2], ['base-f', 0, 0], ['base-m', 0.8, -2]].map(([who, x, z]) => new ScriptedActor({ who: who as string, at: [x as number, z as number] }));

export const CASES: Record<string, Case> = {};
for (const b of BASE) for (const D of DENSITIES) {
  const id = b.def.id, cast = member(b.def, D);
  for (let d = 0; d < 8; d++) CASES[`sheet/${id}/turn${d}/D${D}`] = { frame: () => sheetFrame(id, D, 'turn', `turn${d}`), claim: 'bytes' };
  for (let i = 0; i < cast.gait.walkPoses; i++) CASES[`sheet/${id}/walk${i}/D${D}`] = { frame: () => sheetFrame(id, D, 'walk', `walk${i}`), claim: 'bytes' };
  CASES[`sheet/${id}/hero/D${D}`] = { frame: () => sheetFrame(id, D, 'hero', 'hero'), claim: 'bytes' };
}
for (const z of [1, 2, 3, 4, 8]) CASES[`zoom/${z}`] = { frame: () => stageFrame([new ScriptedActor({ who: 'base-m', at: [0, 0] })], 0, ortho(z, [64 * z, 96 * z])), claim: 'bytes' };
// Two figures at one distance: the later in cast order is on top, as compose has it (the GPU's tie rule).
CASES.tie = { frame: () => stageFrame([new ScriptedActor({ who: 'base-m', at: [0, 0] }), new ScriptedActor({ who: 'base-f', at: [0, 0] })], 0, ortho(1, [64, 96])), claim: 'bytes' };
CASES['tie/reversed'] = { frame: () => stageFrame([new ScriptedActor({ who: 'base-f', at: [0, 0] }), new ScriptedActor({ who: 'base-m', at: [0, 0] })], 0, ortho(1, [64, 96])), claim: 'bytes' };
CASES.scene4 = { frame: () => stageFrame(scene4(), T4, SCENE_POSE()), claim: 'bytes' };
CASES.day = { frame: () => stageFrame(scene4(), T4, SCENE_POSE(), { lighting: { time: TIMES.day, lamps: [] } }), claim: 'bytes' };
CASES.lit = { frame: () => stageFrame(scene4(), T4, SCENE_POSE(), { lighting: NIGHT }), claim: 'bytes' };
for (let k = 0; k < 8; k++) {
  CASES[`gameplay/crisp/${k}`] = { frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], k), { crisp: true, maxDensity: 1 }), claim: 'bytes' };
  CASES[`gameplay/true/${k}`] = { frame: () => stageFrame(trio(), 0, gameplay([0, 0.6, 0], k), { maxDensity: 1 }), claim: 'palette' };
}
CASES['orbit/true'] = { frame: () => stageFrame(scene4(), T4, lookAt([3, 2.2, 4], [0, 0.9, 0], { f: 600 }, [480, 320])), claim: 'palette' };
