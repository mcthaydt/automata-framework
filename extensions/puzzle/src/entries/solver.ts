// @automata/puzzle/solver: the puzzle solver and its tools. Node only: build time and
// tests, never in a game bundle.

export {
  type Analysis,
  analyse,
  keypadOf,
  keySet,
  type Route,
  routesOf,
  timing,
} from '../features/solver/analyse'
export { DOC, describe, renderDoc, showCond, showEffect, stamp } from '../features/solver/doc'
export { GOAL, type LockEdge, lockGraph } from '../features/solver/lock-graph'
export { type Budget, budget, type Matrix, matrix, type Walk } from '../features/solver/matrix'
export type {
  HintResult,
  KeyDecl,
  KeyResult,
  PuzzleModel,
  Softlocks,
  Solution,
  SolveResult,
  State,
  Step,
} from '../features/solver/model'
export type { PuzzleScene } from '../features/solver/scene'
export { createSolver, type Solver, type Verb } from '../features/solver/solver'
export { applyEffect, holds } from '../features/solver/state'
export { condFacts, condItems, type Finding, used, validate } from '../features/solver/validate'
