// controlsFrom(): the input map for `content/controls.toml`, the same map `keys()` builds from code. The file's actions
// keep their own ids and names (a game's Settings and saved bindings read them), and each has its own touch switch.

import type { ControlsFile } from '@automata/content/controls'
import type { CommandDef } from '@automata/sim'
import type { z } from 'zod'
import { type InputMap, inputMapOf, payloadProblem } from './input-map-of.ts'

/**
 * The input map for a controls file. Throws when the file is for another command, and when an action's `send` is
 * not something the command takes, naming the action.
 */
export function controlsFrom<Z extends z.ZodType>(command: CommandDef<Z>, file: ControlsFile): InputMap {
  if (file.command !== command.id)
    throw new Error(`The controls file is for "${file.command}", but the game sends "${command.id}".`)
  for (const action of file.action) {
    const why = payloadProblem(command, undefined, action.send)
    if (why !== undefined)
      throw new Error(
        `The controls file's action "${action.id}" sends ${JSON.stringify(action.send)}, which "${command.id}" does not take (${why}).`,
      )
  }
  return inputMapOf(
    command,
    file.action.map((action) => ({
      id: action.id,
      payload: action.send,
      keys: action.keys ?? [],
      pad: action.pad ?? [],
      stick: action.stick ?? [],
      gesture: action.gesture ?? [],
      label: action.label,
      touch: action.touch,
      required: action.required,
    })),
  )
}
