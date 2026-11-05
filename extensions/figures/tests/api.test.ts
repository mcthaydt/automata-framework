import { describe, expect, it } from 'vitest';
import { BASE, Figure, hero, lightFigure, member, ScriptedActor, standing, TIMES, view, walking } from '../src/index';

/** The public surface (src/index.ts) on its own: the base pair drawn as sheets, lit, and played by an actor, imported
 * from the entry point only, as a fork's code would. */
describe('the public surface', () => {
  const def = BASE[0].def;
  it('draws the base pair', () => {
    const cast = member(def, 2), cell = 128 * 192 * 4;
    expect(standing(cast, 1).length).toBe(cell);
    expect(walking(cast)).toHaveLength(cast.gait.walkPoses);
    expect(hero(cast, BASE[0].pose).length).toBe(cell);
  });
  it('lights it', () => {
    const f = new Figure(member(def, 2));
    for (let i = 0; i < 3; i++) f.update(1 / 60, { facing: Math.PI / 4, moving: false, view: view() });
    const lit = lightFigure(f, { time: TIMES.night, lamps: [{ at: [-1, 1.5, 1], color: '#ffbc4e', steps: 3, radius: 3 }] });
    expect(lit.length).toBe(f.painted.length);
    expect(lit.some((v, i) => v !== f.painted[i])).toBe(true);
  });
  it('plays it as an actor', () => {
    const actor = new ScriptedActor({ who: def, at: [0, 0], actions: [{ t: 0.2, action: 'wave' }] }, { density: 2 });
    expect(actor.draw(0.6, view()).painted.some(v => v > 0)).toBe(true);
  });
});
