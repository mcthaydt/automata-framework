/**
 * Records the goldens. Each golden test draws its frames again and compares them, so a change that moves a single
 * texel fails:
 *
 * - base: the frames `npm run render` draws (each member's 8 standing views, its walk's poses and its lookbook hero, at
 *   the 18° pitch), at DENSITY 1 and 2, as raw RGBA, gzipped, into tests/golden/base/ (tests/golden/base.test.ts);
 * - lit: the md5 of every lit frame tests/golden/lit.ts draws, into tests/golden/lit.json (tests/golden/lit.test.ts);
 * - actors: the md5 of every frame tests/golden/actors.ts draws, into tests/golden/actors.json
 *   (tests/golden/actors.test.ts).
 *
 *   npm run golden [-- base|lit|actors]
 *
 * With no argument it records them all. Run it only to accept a deliberate visual change, and say so in the commit.
 * The base goldens were recorded at f04063b; the others before the base-pair cut
 * (docs/superpowers/plans/2026-11-05-base-pair-refactor.md, Task 2). The dressed golden (the wardrobe's) was recorded in
 * commit 7f0f634db2c031aadeb4d087b2e74e44d13efd15 and cut with the wardrobe; a fork that ports the wardrobe restores it
 * from there.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { goldenFrames, GOLDEN_DENSITIES } from '../tests/golden/base';
import { litFrames } from '../tests/golden/lit';
import { ACTOR_WHO, actorFrames } from '../tests/golden/actors';

const which = process.argv[2] ?? 'all', KINDS = ['all', 'base', 'lit', 'actors'];
if (!KINDS.includes(which)) throw new Error(`golden: record ${KINDS.join(', ')}; not ${which}`);
const tests = resolve(import.meta.dirname, '../tests'), wants = (kind: string) => which === 'all' || which === kind;
/** Writes each sheet's RGBA, gzipped, into `dir`. */
function sheets(dir: string, frames: { name: string; bytes: Uint8Array }[]) {
  mkdirSync(dir, { recursive: true });
  for (const { name, bytes } of frames) { writeFileSync(resolve(dir, `${name}.rgba.gz`), gzipSync(bytes, { level: 9 })); console.log(name, bytes.length); }
}
/** Writes a frame-name → md5 map as JSON. */
function hashes(file: string, frames: Record<string, string>) {
  writeFileSync(resolve(tests, file), `${JSON.stringify(frames, null, 1)}\n`);
  console.log(file, Object.keys(frames).length, 'frames');
}
if (wants('base')) for (const d of GOLDEN_DENSITIES) sheets(resolve(tests, 'golden/base'), goldenFrames(d));
if (wants('lit')) hashes('golden/lit.json', litFrames());
if (wants('actors')) hashes('golden/actors.json', Object.assign({}, ...ACTOR_WHO.map(actorFrames)));
