import type { Command, Sim, StepResult } from '@mcthaydt/automata-sim'
import { createBaseSim, moveCommand } from './base-sim.ts'
import { parseRoom, ROOM, type Room, type RoomSource } from './content/room.ts'
import { createInputDevices } from './input/devices.ts'
import { type Held, toMove } from './input/keys.ts'
import { createLoop } from './loop.ts'
import { createRenderer, type Renderer, type RendererLayer } from './render/renderer.ts'

// The room, playable, with nothing around it: what a feature demo starts from (examples/README.md). The base's
// own game (game.ts) adds the splash, menu, pause and end screens; a demo gets the room, the character, input
// and the loop, and adds only the thing it shows.

export interface PlayRoomOptions {
  /** The room to play. Default: the base's room. */
  readonly room?: RoomSource
  /** Makes each sim. Default: `createBaseSim({ room })`; a demo passes its own to add plugins. */
  readonly createSim?: (room: RoomSource) => Promise<Sim>
  /** The demo's own commands for the coming step, sent with the base's `move`. */
  readonly commands?: (sim: Sim) => readonly Command[]
  /** After every sim step, with that step's result. */
  readonly onStep?: (result: StepResult, sim: Sim) => void
  /** The demo's own drawing (`Renderer.addLayer`): above the room, under its lighting, in room pixels. */
  readonly layers?: readonly RendererLayer[]
}

export interface PlayRoom {
  /** The sim in play. */
  sim(): Sim
  running(): boolean
  /** Starts (or resumes) the loop. */
  start(): void
  /** Stops the loop; the sim keeps its state. */
  stop(): void
  /**
   * Plays again on a fresh sim, in `room` when given (a new room gets a new renderer). The loop keeps the
   * state it had. Restarts run one at a time; one overtaken by a newer restart is skipped.
   */
  restart(room?: RoomSource): Promise<void>
  /** Re-fits the canvas to its container. */
  fitToHost(): void
  destroy(): void
}

/** What `createPlay` needs from the page. `playRoom` passes the real ones; tests pass fakes. */
export interface PlaySeams {
  readonly createRenderer: (room: Room) => Promise<Renderer>
  readonly held: () => Held
  readonly now: () => number
  readonly requestFrame: (callback: () => void) => number
  readonly cancelFrame: (handle: number) => void
  /** After each display frame. */
  readonly onFrame?: (renderer: Renderer, sim: Sim) => void
}

/** Puts the room in `root` and returns it stopped: call `start()` to play. */
export async function playRoom(root: HTMLElement, options: PlayRoomOptions = {}): Promise<PlayRoom> {
  root.insertAdjacentHTML(
    'afterbegin',
    `<div class="stage-box"></div>
    <div class="touch" aria-hidden="true">
      <button type="button" tabindex="-1" data-hold="left">◀</button>
      <button type="button" tabindex="-1" data-hold="right">▶</button>
      <button type="button" tabindex="-1" data-hold="jump" class="jump">▲</button>
    </div>`,
  )
  const stage = root.querySelector<HTMLElement>('.stage-box')
  if (stage === null) throw new Error('playRoom: no stage')
  const input = createInputDevices({
    target: window,
    touchButtons: [...root.querySelectorAll<HTMLElement>('[data-hold]')],
    // A demo has no pause screen of its own; one that wants pause adds it.
    onPause: () => {},
    onAnyInput: () => {},
  })
  const play = await createPlay(
    {
      createRenderer: (room) => createRenderer(stage, room),
      held: () => input.held(),
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(() => callback()),
      cancelFrame: (handle) => cancelAnimationFrame(handle),
      // The browser journeys read where the character is and how far the sim has run.
      onFrame: (renderer, sim) => {
        const at = renderer.playerPixel()
        if (at !== null) {
          root.dataset.playerX = String(at.x)
          root.dataset.playerY = String(at.y)
        }
        root.dataset.tick = String(sim.tick)
      },
    },
    options,
  )
  const onResize = () => play.fitToHost()
  window.addEventListener('resize', onResize)
  return {
    ...play,
    destroy() {
      window.removeEventListener('resize', onResize)
      input.dispose()
      play.destroy()
    },
  }
}

export async function createPlay(seams: PlaySeams, options: PlayRoomOptions = {}): Promise<PlayRoom> {
  const makeSim = options.createSim ?? ((room: RoomSource) => createBaseSim({ room }))
  let source = options.room ?? ROOM
  // Every renderer, the first and each one a new room brings, draws the demo's layers. A renderer being
  // replaced gives them back first: destroying it destroys everything still in it.
  const withLayers = async (room: RoomSource) => {
    const made = await seams.createRenderer(parseRoom(room))
    return { made, detach: (options.layers ?? []).map((layer) => made.addLayer(layer)) }
  }
  const first = await withLayers(source)
  let renderer = first.made
  let detachLayers = first.detach
  let sim = await makeSim(source)
  let latest = 0
  let queue: Promise<unknown> = Promise.resolve()

  const loop = createLoop({
    now: seams.now,
    requestFrame: seams.requestFrame,
    cancelFrame: seams.cancelFrame,
    onStep: () => {
      const result = sim.step([moveCommand(sim, toMove(seams.held())), ...(options.commands?.(sim) ?? [])])
      // A rejected command is a bug in the page's input code; the smoke tests fail on any console error.
      for (const rejected of result.rejected) console.error('play-room: the sim rejected a command', rejected)
      renderer.apply(result)
      options.onStep?.(result, sim)
    },
    onFrame: () => {
      renderer.draw(seams.now())
      seams.onFrame?.(renderer, sim)
    },
  })
  let running = false

  return {
    sim: () => sim,
    running: () => running,
    fitToHost: () => renderer.fitToHost(),
    start() {
      running = true
      loop.start()
    },
    stop() {
      running = false
      loop.stop()
    },
    restart(room) {
      // Restarts run one at a time, and one that a newer restart has overtaken is skipped before it makes
      // anything: so quick saves or clicks never make several sims at once (Koota allows 16 worlds; see
      // rounds.ts for the same rule in the base's own game).
      const restart = ++latest
      const run = queue.then(async () => {
        if (restart !== latest) return
        const next = room ?? source
        const freshSim = await makeSim(next)
        // Nothing steps while the sims and renderers change hands.
        loop.stop()
        if (room === undefined) renderer.reset()
        else {
          // A view has one parent, so the layers leave the old renderer before the new one takes them; if the
          // new one cannot be made, they go back and the old room plays on.
          for (const detach of detachLayers) detach()
          try {
            const fresh = await withLayers(next)
            renderer.destroy()
            renderer = fresh.made
            detachLayers = fresh.detach
          } catch (error) {
            detachLayers = (options.layers ?? []).map((layer) => renderer.addLayer(layer))
            freshSim.dispose()
            if (running) loop.start()
            throw error
          }
        }
        sim.dispose()
        sim = freshSim
        source = next
        renderer.draw(seams.now())
        if (running) loop.start()
      })
      // A failed restart is the caller's to report; the next restart still runs.
      queue = run.catch(() => undefined)
      return run
    },
    destroy() {
      loop.stop()
      running = false
      renderer.destroy()
      sim.dispose()
    },
  }
}
