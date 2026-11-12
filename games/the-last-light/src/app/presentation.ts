import { CutsceneState } from '@automata/cutscenes/sim'
import type { DrawSim } from '@automata/framework'
import type { HudFile, HudModel } from '@automata/hud'
import { useCommands } from '@automata/interact'
import { Combine, EnterCode, type Hotspot, Use } from '@automata/interact/sim'
import { PuzzleState } from '@automata/puzzle/sim'
import { InSector } from '@automata/sectors/sim'
import type { SimContext } from '@automata/sim'
import { lampFacts } from '../features/lamp/lamp-facts.ts'
import { Ada } from '../shared/ada.component.ts'
import type { PlayContent } from '../shared/play-content.ts'
import type { Live } from './live.ts'
import { hudModelOf, type PlayState } from './play-state.ts'
import type { Runtime } from './runtime.ts'
import { CODE_DIGITS, screen } from './screen-state.ts'

// The screen's reading of the sim, in one place: what the HUD shows, what the music asks, where Ada stands, and what a press
// on the HUD sends. It reads through the draw layer's read-only view and sends commands; it never writes the sim.

/** Where Ada stands on the plan, or undefined with no sim or no Ada. */
export function adaAt(sim: DrawSim | undefined): { readonly x: number; readonly z: number } | undefined {
  const [ada] = sim?.query(Ada, InSector) ?? []
  if (ada === undefined) return undefined
  const { x, z } = ada.get(InSector)
  return { x, z }
}

/** What the sim reported this frame, as the HUD's model reads it. */
export function playStateOf(sim: DrawSim, play: PlayContent, runtime: Runtime): PlayState {
  const puzzle = sim.resource(PuzzleState)
  // The lamp's `lit` and `fuel` are the carried light's, not the puzzle's; the objective rows ask for them.
  const ctx = sim as unknown as SimContext
  return {
    facts: { ...puzzle.facts, lit: lampFacts.get(ctx, 'lit'), fuel: lampFacts.get(ctx, 'fuel') },
    items: puzzle.items,
    held: screen.held,
    inReach: runtime.interact.inReach(sim as never),
    examine: screen.examine,
    keypad: { open: screen.keypadOpen, digits: CODE_DIGITS },
    locked: sim.resource(CutsceneState).id !== null,
    hotspots: play.hotspots,
  }
}

/** The HUD's model for this frame; the first nothing before the screen has a sim. */
export function modelFor(live: Live, file: HudFile, play: PlayContent, runtime: Runtime): HudModel {
  if (live.sim === undefined)
    return {
      objective: undefined,
      prompt: undefined,
      items: [],
      held: undefined,
      examine: undefined,
      keypad: { open: false, digits: CODE_DIGITS },
      locked: false,
    }
  return hudModelOf(playStateOf(live.sim, play, runtime), file)
}

/** What a press on the HUD asks the game to do. Each is a command; the examine box and the keypad are the screen's own. */
export function hudActions(live: Live, play: PlayContent) {
  const spot = (id: string): Hotspot | undefined => play.hotspots.find((hotspot) => hotspot.id === id)
  return {
    use(at: string): void {
      const ada = live.sim?.query(Ada)[0]
      const target = spot(at)
      if (ada === undefined || target === undefined) return
      screen.examine = undefined
      const [walk, use] = useCommands(ada.sid, target, screen.held)
      live.send({ type: 'nav.walk-to', payload: walk })
      live.send({ type: Use.id, payload: use })
    },
    hold(item: string | undefined): void {
      screen.held = item
    },
    examineItem(): void {},
    combine(a: string, b: string): void {
      live.send({ type: Combine.id, payload: { a, b } })
    },
    code(code: string): void {
      screen.keypadOpen = false
      live.send({ type: EnterCode.id, payload: { code } })
    },
    dismiss(): void {
      screen.examine = undefined
      screen.keypadOpen = false
    },
  }
}
