// @mcthaydt/automata-systems/bots: bots, scenarios, playtests and fairness (M6 spec §4.6, M6.7b). Node only: build time
// and tests, never in a game bundle.
export {
  type Bot,
  type BotOptions,
  createBot,
  EVADE_STEP,
  POLICIES,
  type Policy,
  REACH,
  THREAT_RANGE,
} from './bot'
export {
  type FairnessInput,
  type FairnessRow,
  fairness,
  pursuitModes,
  type SafeWindow,
  threatModes,
} from './fairness'
export { type PlayOptions, play } from './play'
export { type Playtest, type PlaytestOptions, playtest, type Sweep, type SweepRow, sweep } from './playtest'
export type { Appearance, Death, PlaytestRun, RunResult, ScenarioResult, ThreatCause } from './results'
export { askAs, claimsCheck, runScenario } from './scenario'
export { type Route, type Setup, type SystemsScene, stepsFor } from './scene'
export { type BotView, type Order, type PlanStep, tokenOf, verbOf, walkTo } from './view'
