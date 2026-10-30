// The starter's goldens, recorded from Node and confirmed in Chromium, WebKit and Firefox (`pnpm test:parity`). A
// mismatch in any engine is investigated, never rebaselined per engine.

/** xxhash64 of the canonical JSON of the placeholder course (`createCourse(PLACEHOLDER_COURSE_SEED, …)`). */
export const PLACEHOLDER_COURSE_HASH = 'b92243c1c7556cad'

/** The scripted four-player race (`runScriptedRace`): its end tick, sim hash, event hash and result. */
export const SCRIPTED_RACE = {
  ticks: 530,
  hash: 'edad364f7d76604a',
  events: '776806e3de51ec68',
  eventCount: 188,
  standings: [0] as readonly number[],
  winner: 0,
  coverage: { floorsLanded: 51, laps: 4, falls: 1, manualResets: 1, wraps: 1, finished: 1 },
}
