// @mcthaydt/automata-puzzle/solver: the puzzle solver and its tools (M6 spec §4.5, M6.6b). Node only: build time and
// tests, never in a game bundle.

export { type Analysis, analyse, keypadOf, keySet, type Route, routesOf, timing } from './analyse'
export { DOC, describe, renderDoc, showCond, showEffect, stamp } from './doc'
export { GOAL, type LockEdge, lockGraph } from './lock-graph'
export { type Budget, budget, type Matrix, matrix, type Walk } from './matrix'
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
} from './model'
export type { PuzzleScene } from './scene'
export { createSolver, type Solver, type Verb } from './solver'
export { applyEffect, holds } from './state'
export { condFacts, condItems, type Finding, used, validate } from './validate'
