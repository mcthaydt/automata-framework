// Tuning: the numbers a game runs on, authored in `content/tuning.toml`.
//
// Two ways to say what a tunable may be, one per source:
//   - Code-owned (FloorFifty packages/content/src/validate/bounds.ts, 122a220): the game passes its
//     declarations (type, inclusive range, default) and the TOML holds bare numbers. Content selects; it
//     never widens a range. Every check and message here is FloorFifty's.
//   - Authored: the game declares nothing in code and each tunable may carry its own range
//     inline, `NAME = { value, min, max, step }`, which also feeds the debug sliders, and may name itself for the
//     Tuner with `label` and `feel` (text only: they never reach the values or the meta).

import type { DataPath, Problem } from '../diagnostics/diagnostic'

export type TunableType = 'int' | 'float'

/**
 * A tunable a game declares in code: `int` or `float`, an inclusive range and a default. Content selects a
 * value inside the range and never widens it.
 */
export interface TunableDeclaration {
  readonly type: TunableType
  /** Inclusive lower bound. */
  readonly min: number
  /** Inclusive upper bound. */
  readonly max: number
  readonly default: number
}

/** A game's tunables by name (upper-case words joined by underscores, such as `GRAVITY`). */
export type TunableDeclarations = Readonly<Record<string, TunableDeclaration>>

export interface TuningOptions {
  /** Code-owned names and ranges. Absent means ranges are authored in the TOML. */
  readonly tunables?: TunableDeclarations | undefined
  /** Code-only constants an author might try to write; refused with a reason rather than as a typo. */
  readonly invariants?: readonly string[] | undefined
}

export type TuningValue = number | boolean | string

export interface TuningEntryMeta {
  readonly type: TunableType | 'boolean' | 'string'
  readonly value: TuningValue
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

/**
 * Every tunable's type, value and range (`min`, `max`, `step`) by name, as written to `tuning-meta.json` for
 * debug sliders.
 */
export type TuningMeta = Readonly<Record<string, TuningEntryMeta>>

export interface TuningResult {
  readonly values: Readonly<Record<string, TuningValue>>
  readonly meta: TuningMeta
  readonly problems: Problem[]
}

const NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/
const RANGE_KEYS = ['value', 'min', 'max', 'step']
/**
 * Words a ranged tunable may carry for the Tuner (its name on screen, what a player feels and the unit it is shown
 * in); never in the values.
 */
const WORD_KEYS = ['feel', 'label', 'unit']
/**
 * How the Tuner shows the value in its `unit`: the value times `scale` (a speed in subpixels per tick, times 60/256,
 * is pixels a second). Display only: the file, the values and the sim keep the sim's own units.
 */
const SCALE_KEY = 'scale'

const isTable = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const problem = (path: DataPath, code: Problem['code'], message: string): Problem => ({ path, code, message })

/**
 * Checks one layer of tuning against code-owned declarations. `complete` is true for the base layer, which
 * must name every tunable; false for a partial override (a stage or mode layer).
 *
 * Invariants are rejected before unknown names so the more specific answer wins, then non-numbers, then
 * integer declarations, then the inclusive range.
 */
export function checkTuningLayer(
  layer: Readonly<Record<string, unknown>>,
  options: TuningOptions & { readonly tunables: TunableDeclarations },
  { complete }: { readonly complete: boolean },
): Problem[] {
  const problems: Problem[] = []
  const invariants = new Set(options.invariants ?? [])
  for (const name of Object.keys(layer).sort()) {
    const value = layer[name]
    if (invariants.has(name)) {
      problems.push(
        problem([name], 'invariantNotAuthorable', `${name} is a code-only invariant and cannot be authored`),
      )
      continue
    }
    const declaration = options.tunables[name]
    if (declaration === undefined) {
      problems.push(problem([name], 'unknownField', `unknown tunable: ${name}`))
      continue
    }
    if (isTable(value)) {
      problems.push(
        problem([name], 'invalidType', `the range of ${name} is declared in code; write a bare number`),
      )
      continue
    }
    if (typeof value !== 'number') {
      problems.push(problem([name], 'invalidType', `${name} must be a number`))
      continue
    }
    // NaN passes every range comparison, so it is refused before the range check (FloorFifty).
    if (!Number.isFinite(value)) {
      problems.push(problem([name], 'invalidType', `${name} must be a finite number, received ${value}`))
      continue
    }
    if (declaration.type === 'int' && !Number.isInteger(value)) {
      problems.push(problem([name], 'invalidType', `${name} is declared int, received ${value}`))
      continue
    }
    if (value < declaration.min || value > declaration.max) {
      problems.push(
        problem([name], 'outOfRange', `expected ${declaration.min}..${declaration.max}, received ${value}`),
      )
    }
  }
  if (complete) {
    for (const name of Object.keys(options.tunables).sort()) {
      if (!(name in layer)) problems.push(problem([name], 'missingField', `base tuning must declare ${name}`))
    }
  }
  return problems
}

function checkDeclared(
  raw: Readonly<Record<string, unknown>>,
  options: TuningOptions & { readonly tunables: TunableDeclarations },
): TuningResult {
  const problems = checkTuningLayer(raw, options, { complete: true })
  const values: Record<string, TuningValue> = {}
  const meta: Record<string, TuningEntryMeta> = {}
  for (const name of Object.keys(options.tunables).sort()) {
    const value = raw[name]
    const declaration = options.tunables[name] as TunableDeclaration
    if (typeof value !== 'number') continue
    values[name] = value
    meta[name] = { type: declaration.type, value, min: declaration.min, max: declaration.max }
  }
  return { values, meta, problems }
}

/** One authored `{ value, min, max, step }` table. Adds its problems; returns its meta when it is usable. */
function checkRanged(
  name: string,
  table: Record<string, unknown>,
  problems: Problem[],
): TuningEntryMeta | undefined {
  const before = problems.length
  for (const key of Object.keys(table).sort()) {
    if (WORD_KEYS.includes(key)) {
      if (typeof table[key] !== 'string')
        problems.push(problem([name, key], 'invalidType', `${key} must be text`))
    } else if (key === SCALE_KEY) {
      const scale = table[key]
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale === 0)
        problems.push(problem([name, key], 'invalidType', `${key} must be a finite number other than 0`))
    } else if (!RANGE_KEYS.includes(key))
      problems.push(problem([name, key], 'unknownField', `unknown field: ${key}`))
  }
  const { value, min, max, step } = table
  for (const [key, bound] of [
    ['min', min],
    ['max', max],
    ['step', step],
  ] as const) {
    if (bound !== undefined && (typeof bound !== 'number' || !Number.isFinite(bound))) {
      problems.push(problem([name, key], 'invalidType', `${key} must be a finite number`))
    }
  }
  if (value === undefined) problems.push(problem([name, 'value'], 'missingField', 'required'))
  else if (typeof value !== 'number' || !Number.isFinite(value)) {
    problems.push(problem([name, 'value'], 'invalidType', 'a ranged value must be a number'))
  }
  if (typeof min !== 'number' || typeof max !== 'number') {
    if (min === undefined) problems.push(problem([name, 'min'], 'missingField', 'required'))
    if (max === undefined) problems.push(problem([name, 'max'], 'missingField', 'required'))
    return undefined
  }
  if (min > max) problems.push(problem([name, 'min'], 'invalidType', `min ${min} is above max ${max}`))
  if (typeof step === 'number' && step <= 0) {
    problems.push(problem([name, 'step'], 'invalidType', `step must be above 0, received ${step}`))
  }
  if (problems.length > before || typeof value !== 'number') return undefined
  if (value < min || value > max) {
    problems.push(problem([name, 'value'], 'outOfRange', `expected ${min}..${max}, received ${value}`))
    return undefined
  }
  const integral = [value, min, max, ...(typeof step === 'number' ? [step] : [])].every(Number.isInteger)
  return {
    type: integral ? 'int' : 'float',
    value,
    min,
    max,
    ...(typeof step === 'number' ? { step } : {}),
  }
}

function checkAuthored(raw: Readonly<Record<string, unknown>>): TuningResult {
  const problems: Problem[] = []
  const values: Record<string, TuningValue> = {}
  const meta: Record<string, TuningEntryMeta> = {}
  for (const name of Object.keys(raw).sort()) {
    const value = raw[name]
    if (!NAME_PATTERN.test(name)) {
      problems.push(problem([name], 'invalidType', `tunable names match ${NAME_PATTERN.source}`))
      continue
    }
    let entry: TuningEntryMeta | undefined
    if (typeof value === 'number') {
      if (Number.isFinite(value)) entry = { type: 'float', value }
      else problems.push(problem([name], 'invalidType', `${name} must be finite`))
    } else if (typeof value === 'boolean') entry = { type: 'boolean', value }
    else if (typeof value === 'string') entry = { type: 'string', value }
    else if (isTable(value)) entry = checkRanged(name, value, problems)
    else {
      problems.push(
        problem([name], 'invalidType', 'expected a number, boolean, string or { value, min, max, step }'),
      )
    }
    if (entry === undefined) continue
    values[name] = entry.value
    meta[name] = entry
  }
  return { values, meta, problems }
}

/** Checks a whole `tuning.toml` (its parsed root table). */
export function checkTuning(raw: unknown, options: TuningOptions): TuningResult {
  const table = isTable(raw) ? raw : {}
  const { tunables } = options
  return tunables === undefined ? checkAuthored(table) : checkDeclared(table, { ...options, tunables })
}
