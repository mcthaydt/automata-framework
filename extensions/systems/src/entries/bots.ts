// @automata/systems/bots: bots, scenarios, playtests and fairness. Node only: build time
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
} from '../features/bots/bot'
export {
  type FairnessInput,
  type FairnessRow,
  fairness,
  pursuitModes,
  type SafeWindow,
  threatModes,
} from '../features/bots/fairness'
export { type PlayOptions, play } from '../features/bots/play'
export {
  type Playtest,
  type PlaytestOptions,
  playtest,
  type Sweep,
  type SweepRow,
  sweep,
} from '../features/bots/playtest'
export type {
  Appearance,
  Death,
  PlaytestRun,
  RunResult,
  ScenarioResult,
  ThreatCause,
} from '../features/bots/results'
export { askAs, claimsCheck, runScenario } from '../features/bots/scenario'
export { type Route, type Setup, type SystemsScene, stepsFor } from '../features/bots/scene'
export { type BotView, type Order, type PlanStep, tokenOf, verbOf, walkTo } from '../features/bots/view'
