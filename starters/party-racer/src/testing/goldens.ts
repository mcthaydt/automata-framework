// The starter's goldens, recorded from Node and confirmed in Chromium, WebKit and Firefox (`pnpm test:parity`). A
// mismatch in any engine is investigated, never rebaselined per engine.

/** xxhash64 of the canonical JSON of the placeholder course (`createCourse(PLACEHOLDER_COURSE_SEED, …)`). */
export const PLACEHOLDER_COURSE_HASH = 'b92243c1c7556cad'

/** The scripted four-player race (`runScriptedRace`): its end tick, sim hash, event hash and result. */
export const SCRIPTED_RACE = {
  ticks: 530,
  hash: '9c5d87536ffe7a28',
  events: '0d03c77b48a5bb6a',
  eventCount: 187,
  standings: [0] as readonly number[],
  winner: 0,
}
