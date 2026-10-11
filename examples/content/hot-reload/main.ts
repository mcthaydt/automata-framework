// examples/content/hot-reload: content that changes while the game runs.
//
// Shows: the room as a content file (content/room.toml) compiled by automata-content, and edited live. Run
// `pnpm --filter @af-examples/content-hot-reload dev`, open the page, change a tile in content/room.toml and
// save: Wick's room is rebuilt in place, on a fresh sim, without reloading the page. Save a mistake (a row of
// the wrong width, a second P) and the compiler's message shows over the room, which stays as it last
// compiled; the next good save clears it. A production build embeds the content and its hash, and never
// reloads.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump; on-screen buttons on touch.
// Base: base-2d (`@af-examples/base-2d`: the room, Wick, input and the loop through `playRoom`).
// Packages: @mcthaydt/automata-content (its Vite plugin and `virtual:automata/content`),
// @mcthaydt/automata-host, effect, and the base's own.
import '@af-examples/base-2d/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import '@af-examples/base-2d/style.css'
import './content-panel.css'
import { content, contentHash } from 'virtual:automata/content'
import { type PlayRoom, playRoom } from '@af-examples/base-2d'
import { makeHosting } from '@mcthaydt/automata-host'
import { Effect } from 'effect'

/** Must equal `[game] id` in ship.config.ts; the host checks it. */
const GAME_ID = 'demo-content-hot-reload'

const found = document.querySelector<HTMLElement>('#game')
if (found === null) throw new Error('index.html has no #game element')
const root: HTMLElement = found

/** The compiler's messages for a bad save, over the room until the next good one. */
const problems = document.createElement('aside')
problems.className = 'content-problems'
problems.hidden = true

/** Shows which content is in play: the page's journeys read it, and so can you. */
function showContent(hash: string): void {
  root.dataset.contentHash = hash
  problems.hidden = true
  problems.replaceChildren()
}

function showProblems(lines: readonly string[]): void {
  const title = document.createElement('h2')
  title.textContent = "content/room.toml didn't compile. Still playing the last good room."
  const list = document.createElement('pre')
  list.textContent = lines.join('\n')
  problems.replaceChildren(title, list)
  problems.hidden = false
  root.dataset.contentProblems = String(lines.length)
}

/**
 * In dev, follows content/ as it is saved. The plugin recompiles on each save and sends `automata:content`
 * once the new content is ready, or `automata:content-error` with the compiler's messages. The browser has
 * already loaded `virtual:automata/content` once, so reading it again takes a new URL: the hash makes one.
 */
function followSaves(play: PlayRoom): void {
  const hot = import.meta.hot
  if (hot === undefined) return
  hot.on('automata:content', async ({ hash }: { hash: string }) => {
    const url = `/@id/__x00__virtual:automata/content?v=${hash}`
    const fresh: typeof import('virtual:automata/content') = await import(/* @vite-ignore */ url)
    // A new room is a new world: the sim and the renderer start over in it.
    await play.restart(fresh.content.room)
    showContent(fresh.contentHash)
  })
  hot.on('automata:content-error', ({ diagnostics }: { diagnostics: readonly string[] }) =>
    showProblems(diagnostics),
  )
}

const program = Effect.gen(function* () {
  const hosting = yield* makeHosting({ gameId: GAME_ID, wants: [], pauseBehavior: 'pause' })
  yield* hosting.ready
  // Nothing was drawn before this line: the page stays empty until the host says ready.
  const play = yield* Effect.promise(() => playRoom(root, { room: content.room }))
  root.append(problems)
  showContent(contentHash)
  followSaves(play)
  play.start()
  document.documentElement.dataset.state = 'ready'
  yield* Effect.never
})

Effect.runPromise(Effect.scoped(program)).catch((error: unknown) => {
  root.textContent = "Couldn't connect to Ruken."
  document.documentElement.dataset.state = 'failed'
  console.error(error)
})
