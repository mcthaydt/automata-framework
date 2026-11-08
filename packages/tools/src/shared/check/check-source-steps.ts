import { join } from 'node:path'
import { Effect } from 'effect'
import { Files, type FilesService } from '../node/files.ts'
import { boardNamesIn, declaredBoardsIn, isBoardSource } from '../ship/prepare/board-names.ts'
import { declaredInputsIn, isInputsSource, keysBindingsIn } from '../ship/prepare/input-bindings.ts'
import {
  declaredOrientationIn,
  gameOrientationsIn,
  isOrientationSource,
} from '../ship/prepare/orientation.ts'
import { inputsProblems, type ShipInputBindings } from '../ship/targets/ruken/check-inputs.ts'
import type { CheckFinding } from './check-report.ts'
import type { StepEffect } from './check-tool.ts'
import { CheckToolError } from './csp-probe.ts'

// The steps of `automata check` that read the game's sources against what its `ship.config.ts` tells the host: the
// leaderboards it declares, the orientation it plays in, the inputs it binds. They are the same scans `ship prepare`
// runs, so a mismatch shows up while the author is editing, not at publish time. Each reads `ship.config.ts` as
// written, never by running it.

/** Makes a tool error for the step named `tool`. */
const toolErrorFor = (tool: string) => (detail: string) =>
  new CheckToolError({ kind: 'failed', tool, detail })

/** Every game file that `isSource` accepts, in name order, with its text. */
const readSources = (
  files: FilesService,
  gameDir: string,
  isSource: (file: string) => boolean,
  toolError: (detail: string) => CheckToolError,
) =>
  Effect.gen(function* () {
    const listed = yield* Effect.mapError(files.listFiles(gameDir), (error) => toolError(error.message))
    const sources: { file: string; code: string }[] = []
    for (const file of listed.filter(isSource).sort()) {
      const code = yield* Effect.mapError(files.readText(join(gameDir, file)), (error) =>
        toolError(error.message),
      )
      sources.push({ file, code })
    }
    return sources
  })

/**
 * The board scan `ship prepare` runs, over the game's sources, against the boards its `ship.config.ts` declares
 * under `leaderboards`. No `ship.config.ts` declares no boards.
 */
export const boardsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = toolErrorFor('boards')
    const configPath = join(gameDir, 'ship.config.ts')
    const declared = (yield* files.exists(configPath))
      ? declaredBoardsIn(
          yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
        )
      : []
    if (declared === undefined)
      return yield* toolError(
        'cannot read the leaderboards in ship.config.ts: write them as an object literal',
      )
    const known = new Set(declared)
    const findings: CheckFinding[] = []
    for (const { file, code } of yield* readSources(files, gameDir, isBoardSource, toolError)) {
      for (const name of boardNamesIn(file, code) ?? []) {
        if (known.has(name.board)) continue
        findings.push({
          file,
          line: name.line,
          col: name.col,
          rule: 'undeclared-board',
          message: `board "${name.board}" is not declared in ship.config.ts leaderboards`,
        })
      }
    }
    return findings
  })

/**
 * The scan `ship prepare` runs over the game's sources for the orientation each `defineGame` plays in, against the
 * `runtime.orientation` its `ship.config.ts` sends the host. A game with no `ship.config.ts`, or with no
 * `defineGame` to compare, finds nothing; a config whose orientation is not a literal, with a `defineGame` to compare
 * against it, is a tool error, never a pass.
 */
export const orientationStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = toolErrorFor('orientation')
    const configPath = join(gameDir, 'ship.config.ts')
    if (!(yield* files.exists(configPath))) return []
    const played: { file: string; line: number; col: number; orientation: string }[] = []
    for (const { file, code } of yield* readSources(files, gameDir, isOrientationSource, toolError)) {
      for (const found of gameOrientationsIn(file, code) ?? []) played.push({ file, ...found })
    }
    if (played.length === 0) return []
    const declared = declaredOrientationIn(
      yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
    )
    if (declared === undefined)
      return yield* toolError(
        'cannot read runtime.orientation in ship.config.ts: write it as a string literal',
      )
    return played
      .filter((found) => found.orientation !== declared)
      .map((found) => ({
        file: found.file,
        line: found.line,
        col: found.col,
        rule: 'orientation-mismatch',
        message: `defineGame plays "${found.orientation}", but ship.config.ts runtime.orientation is "${declared}"`,
      }))
  })

/**
 * The scan `ship prepare` runs over the game's sources for what its `keys()` calls bind, against the
 * `runtime.inputs` its `ship.config.ts` sends the host, with `inputsProblems`' own rule. A game with no
 * `ship.config.ts`, or with no `keys()` call to compare, finds nothing; a config whose inputs are not string
 * literals, with a `keys()` call to compare against them, is a tool error, never a pass.
 */
export const inputsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = toolErrorFor('inputs')
    const configPath = join(gameDir, 'ship.config.ts')
    if (!(yield* files.exists(configPath))) return []
    const bound: { [action: string]: ShipInputBindings[string] } = {}
    for (const { file, code } of yield* readSources(files, gameDir, isInputsSource, toolError)) {
      Object.assign(bound, keysBindingsIn(file, code))
    }
    if (Object.keys(bound).length === 0) return []
    const declared = declaredInputsIn(
      yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
    )
    if (declared === undefined)
      return yield* toolError(
        'cannot read runtime.inputs in ship.config.ts: write it as an array of string literals',
      )
    return inputsProblems(declared.inputs, bound).map((message) => ({
      file: 'ship.config.ts',
      line: declared.line,
      col: declared.col,
      rule: 'inputs-mismatch',
      message,
    }))
  })
