// The puzzle plugin (M6 spec §4.5). `createPuzzlePlugin` takes the game's call functions and mapped facts; their names
// are its config, so two sims with different calls never accept each other's snapshots. `puzzlePlugin` has neither.
import { definePlugin, type PluginDef, sortedKeys } from '@automata/sim'
import { VerbCommand } from './puzzle.command'
import {
  PuzzleCheckpoint,
  PuzzleCutscene,
  PuzzleDialogue,
  PuzzleExit,
  PuzzleGave,
  PuzzleGoal,
  PuzzleKeypad,
  PuzzleNoise,
  PuzzleSaid,
} from './puzzle.event'
import { PuzzleSceneResource, PuzzleState } from './puzzle.resource'
import { type PuzzleOptions, puzzleVerbSystem } from './puzzle.system'

export function createPuzzlePlugin(options: PuzzleOptions = {}): PluginDef {
  return definePlugin({
    name: 'puzzle',
    config: { calls: sortedKeys(options.calls ?? {}), mappedFacts: options.facts !== undefined },
    resources: [PuzzleSceneResource, PuzzleState],
    commands: [VerbCommand],
    events: [
      PuzzleSaid,
      PuzzleGave,
      PuzzleGoal,
      PuzzleNoise,
      PuzzleCutscene,
      PuzzleDialogue,
      PuzzleExit,
      PuzzleCheckpoint,
      PuzzleKeypad,
    ],
    systems: [puzzleVerbSystem(options)],
  })
}

export const puzzlePlugin: PluginDef = createPuzzlePlugin()
