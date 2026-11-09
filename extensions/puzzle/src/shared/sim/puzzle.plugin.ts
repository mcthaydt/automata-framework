// The puzzle plugin. `createPuzzlePlugin` takes the game's call functions and mapped facts; their names
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

/**
 * Makes the puzzle plugin with the game's options: its functions for `call` effects, where facts
 * live, and what hears noises, dialogues and cutscenes.
 */
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

/** The puzzle plugin with no options. */
export const puzzlePlugin: PluginDef = createPuzzlePlugin()
