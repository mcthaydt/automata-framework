// examples/host/lifecycle-and-saves: the game's host, through AF's `Hosting` service.
//
// Shows: the three things every Ruken game does with its host. It waits for ready before drawing anything
// (Ruken R-04); it stops the room while the host has it in the background (a drawer, an ad, a hidden tab) and
// plays on when it comes back; and it keeps the player's best time and run count in their host saves, read at
// boot and written each time Wick reaches the ember. The panel shows what the host reports as it happens.
// Opened directly, the page runs standalone: same code, and the saves live only as long as the page.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump; on-screen buttons on touch. The ember is a short
// dash to the right, so a run takes a couple of seconds.
// Base: base-2d (`@af-examples/base-2d`: the room, Wick, input and the loop through `playRoom`).
// Packages: @mcthaydt/automata-host, effect, and the base's own.
import '@af-examples/base-2d/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import '@af-examples/base-2d/style.css'
import './panel.css'
import { ROOM, type RoomSource, tuning } from '@af-examples/base-2d'
import { playRoom } from '@af-examples/base-2d/play'
import { type Hosting, makeHosting } from '@mcthaydt/automata-host'
import { Effect, Stream } from 'effect'

/** Must equal `[game] id` in ship.config.ts; the host checks it. */
const GAME_ID = 'demo-host-lifecycle-and-saves'

/** The base's room with the ember moved down to the floor, a short dash right of the start. */
const DASH_ROOM: RoomSource = {
  id: 'dash',
  tileSize: ROOM.tileSize,
  rows: ROOM.rows.map((row, ty) => {
    const noGoal = row.replace('G', '.')
    return ty === 22 ? `${noGoal.slice(0, 20)}G${noGoal.slice(21)}` : noGoal
  }),
}

/** After reaching the ember, how long before the next run starts. */
const NEXT_RUN_MS = 1200

/** The two save keys. Saves are strings; the host stores them for this player and this game. */
const BEST_TICKS = 'best-ticks'
const RUNS = 'runs'

const root = document.querySelector<HTMLElement>('#game')
if (root === null) throw new Error('index.html has no #game element')

/** Reads a whole number save, or 0 when the player has none yet. */
const readCount = (hosting: Hosting, key: string) =>
  hosting.saves.get(key).pipe(Effect.map((value) => (value === null ? 0 : Number.parseInt(value, 10) || 0)))

const program = Effect.gen(function* () {
  // `makeHosting` does the Ruken handshake. Outside a Ruken frame the SDK hands back its standalone session.
  const hosting = yield* makeHosting({ gameId: GAME_ID, wants: ['saves'], pauseBehavior: 'pause' })
  yield* hosting.ready
  // Nothing was drawn before this line: the page stays empty until the host says ready.

  let best = yield* readCount(hosting, BEST_TICKS)
  let runs = yield* readCount(hosting, RUNS)

  const panel = document.createElement('aside')
  panel.className = 'host-panel'
  root.append(panel)
  const show = (lines: Record<string, string>) => {
    panel.replaceChildren(
      ...Object.entries(lines).map(([label, value]) => {
        const line = document.createElement('p')
        line.dataset.line = label
        line.textContent = value
        return line
      }),
    )
  }
  let lifecycle = 'active'
  let savesStatus = 'saved'
  const refresh = () => {
    root.dataset.host = hosting.kind
    root.dataset.lifecycle = lifecycle
    root.dataset.runs = String(runs)
    show({
      host: hosting.kind === 'ruken' ? `Ruken · ${hosting.player.displayName}` : 'Standalone',
      lifecycle: `Lifecycle: ${lifecycle}`,
      saves: `Saves: ${hosting.granted.has('saves') ? savesStatus : 'this page only'}`,
      best: best === 0 ? 'Best: none yet' : `Best ${(best / tuning.TICK_HZ).toFixed(2)} s`,
      runs: runs === 1 ? '1 run' : `${runs} runs`,
    })
  }
  refresh()

  // A run ends at the ember: count it, keep the best, write both to the host's saves, then go again.
  const finishRun = (ticks: number) =>
    Effect.gen(function* () {
      runs += 1
      if (best === 0 || ticks < best) best = ticks
      refresh()
      yield* hosting.round.end('complete')
      yield* hosting.saves.set(RUNS, String(runs))
      yield* hosting.saves.set(BEST_TICKS, String(best))
      yield* Effect.sleep(NEXT_RUN_MS)
      yield* Effect.promise(() => play.restart())
      yield* hosting.round.start
    })

  const play = yield* Effect.promise(() =>
    playRoom(root, {
      room: DASH_ROOM,
      onStep: (result) => {
        if (result.events.some((event) => event.type === 'goal.reached'))
          Effect.runFork(finishRun(result.tick).pipe(Effect.catchAll((error) => Effect.logError(error))))
      },
    }),
  )

  // The host's lifecycle as a stream: its current value first, then each change. In the background the room
  // stops (pauseBehavior 'pause' promises the host this); back in front it plays on from the same tick.
  yield* hosting.lifecycle.changes.pipe(
    Stream.runForEach((change) =>
      Effect.sync(() => {
        lifecycle = change.state
        if (change.state === 'background') play.stop()
        else play.start()
        refresh()
      }),
    ),
    Effect.forkScoped,
  )
  yield* hosting.savesStatus.changes.pipe(
    Stream.runForEach((status) =>
      Effect.sync(() => {
        savesStatus = status
        refresh()
      }),
    ),
    Effect.forkScoped,
  )
  yield* hosting.round.start
  document.documentElement.dataset.state = 'ready'
  // Hosting closes (and hands the host any save still on its way) when this scope ends.
  yield* Effect.never
})

Effect.runPromise(Effect.scoped(program)).catch((error: unknown) => {
  root.textContent = "Couldn't connect to Ruken."
  document.documentElement.dataset.state = 'failed'
  console.error(error)
})
