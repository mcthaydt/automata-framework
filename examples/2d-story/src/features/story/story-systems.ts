import type { CutsceneScript, Cutscenes } from '@automata/cutscenes/sim'
import { type DialogueGraph, type Narrative, NarrativeDialogue, NarrativeEnv } from '@automata/narrative/sim'
import { loadNavGraph, type NavGraph } from '@automata/nav/sim'
import { defineSystem, type SystemDef } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import { type Systems, type SystemsDef, SystemsEnv } from '@automata/systems/sim'
import { Hero } from '../../shared/hero.component.ts'
import { Square } from '../../shared/square.component.ts'
import { Story } from './story.resource.ts'

// The story's behaviour, which stays code: the keeper starts talking when the player walks up to him, and the second answer
// sends the player to the gate in a cutscene. What is said, where the guard walks and how he behaves are files, handed in.

/** A point in the level's pixels. */
export interface Spot {
  readonly x: number
  readonly y: number
}

/** What the story's systems work with: the extensions' handles, the story's files, and where the editor placed two characters. */
export interface StoryOptions {
  readonly narrative: Narrative
  readonly cutscenes: Cutscenes
  readonly systems: Systems
  readonly graphs: readonly DialogueGraph[]
  readonly scripts: readonly CutsceneScript[]
  readonly nav: NavGraph
  readonly guardDef: SystemsDef
  /** Where the keeper and the guard stand (their feet). */
  readonly keeper: Spot
  readonly guard: Spot
  /** Level pixels in a metre. */
  readonly metre: number
}

/** How close the player walks (in the level's pixels) before the keeper speaks, and how far away they must go before he can again. */
const TOUCH = 24
const REARM = 40

/** The story's three systems: load the files, freeze the player while busy, and start the conversation and the cutscene. */
export function storySystems(options: StoryOptions): SystemDef[] {
  const { narrative, cutscenes, systems } = options

  /** Hands the story's files to the extensions, once, on the first tick. */
  const load = defineSystem('story.load', 'input', (ctx) => {
    const story = ctx.resource(Story)
    if (story.loaded) return
    story.loaded = true
    const [hero] = ctx.query(Hero)
    if (hero === undefined) throw new Error('The story needs the player in the level.')
    ctx.resource(NarrativeEnv).player = hero.sid
    ctx.resource(SystemsEnv).player = hero.sid
    loadNavGraph(ctx, options.nav)
    narrative.load(ctx, { graphs: options.graphs, storylets: [] })
    cutscenes.load(ctx, options.scripts)
    // The guard starts where the editor placed him, in metres: the places' plan.
    systems.load(ctx, options.guardDef, {
      guard: { x: options.guard.x / options.metre, z: options.guard.y / options.metre },
    })
  })

  /** The player cannot walk while someone is talking to them or a cutscene plays. */
  const freeze = defineSystem('story.freeze', 'prePhysics', (ctx) => {
    const busy = cutscenes.locked(ctx) || ctx.resource(NarrativeDialogue).graph !== null
    for (const hero of ctx.query(Hero)) hero.set(Hero, { frozen: busy })
  })

  /** The keeper speaks when the player arrives; the cutscene starts when the conversation has ended on the second answer. */
  const run = defineSystem('story.run', 'gameplay', (ctx) => {
    const story = ctx.resource(Story)
    if (cutscenes.locked(ctx)) return
    const dialogue = ctx.resource(NarrativeDialogue)
    if (dialogue.graph === null && dialogue.facts.gate === true) {
      // The answer is used up, so asking again needs the answer again.
      dialogue.facts = { ...dialogue.facts, gate: false }
      cutscenes.start(ctx, 'gate')
      return
    }
    const [hero] = ctx.query(Hero)
    if (hero === undefined) return
    const at = hero.get(Square)
    const gap = hypot(at.x - options.keeper.x, at.y - options.keeper.y)
    if (!story.near && gap <= TOUCH && dialogue.graph === null) {
      story.near = true
      narrative.startDialogue(ctx, 'keeper')
    } else if (story.near && gap > REARM) story.near = false
  })

  return [load, freeze, run]
}
