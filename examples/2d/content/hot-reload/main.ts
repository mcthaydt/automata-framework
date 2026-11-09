// examples/content/hot-reload: content that changes while the game runs.
//
// Shows: the room as a content file (content/room.toml) compiled by automata-content, and edited live. Run
// `pnpm --filter @af-examples/content-hot-reload dev`, open the page, change a tile in content/room.toml and
// save: Wick's room is rebuilt in place, on a fresh sim, without reloading the page. Save a mistake (a row of
// the wrong width, a second P) and the compiler's message shows over the room, which stays as it last
// compiled; the next good save clears it. A production build embeds the content and its hash, and never
// reloads.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump; on-screen buttons on touch.
// Base: emberwick (`@af-games/emberwick`: its whole game, built here over this demo's room by `makeEmberwick`).
// Packages: @automataframework/automata-content (its Vite plugin and `virtual:automata/content`),
// @automataframework/automata (`startGame`), and the base's own.
import '@af-games/emberwick/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import '@af-games/emberwick/style.css'
import './content-panel.css'
import { content, contentHash } from 'virtual:automata/content'
import { makeEmberwick } from '@af-games/emberwick/make-game'
import { parseRoom } from '@af-games/emberwick/room'
import { tuning } from '@af-games/emberwick/sim'
import { startGame } from '@automataframework/automata'

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

function showProblems(
  lines: readonly string[],
  heading = "content/room.toml didn't compile. Still playing the last good room.",
): void {
  const title = document.createElement('h2')
  title.textContent = heading
  const list = document.createElement('pre')
  list.textContent = lines.join('\n')
  problems.replaceChildren(title, list)
  problems.hidden = false
  root.dataset.contentProblems = String(lines.length)
}

/** The base's game in the room and tuning the compiler produced: the same game, this demo's room. */
function gameIn(compiled: Pick<typeof import('virtual:automata/content'), 'content'>) {
  return makeEmberwick(
    { room: parseRoom(compiled.content.room), tuning: tuning.tuningFrom(compiled.content.tuning) },
    { id: GAME_ID },
  )
}

// The runtime owns the page from here: the Ruken handshake, nothing drawn before the host says ready, the
// screens, the loop. `handle` is replaced each time a good save brings a new room.
let handle = startGame(gameIn({ content }))
root.append(problems)
showContent(contentHash)

/**
 * In dev, follows content/ as it is saved. The plugin recompiles on each save and sends an HMR update for
 * `virtual:automata/content` once the new content is ready, or `automata:content-error` with the compiler's
 * messages. This module accepts the update, so the page is not reloaded: Vite hands over the new module.
 */
function followSaves(): void {
  // Vite finds what a module accepts by reading `import.meta.hot.accept(...)` as written, so it is never aliased.
  if (import.meta.hot === undefined) return
  // Two quick saves bring two modules, and the older one's restart can finish last: only the newest room plays.
  let newest = ''
  import.meta.hot.accept('virtual:automata/content', async (fresh) => {
    if (fresh === undefined) return
    // Vite hands over the module untyped; it is the same module this file imports at the top.
    const next: Pick<typeof import('virtual:automata/content'), 'content' | 'contentHash'> = {
      content: fresh.content,
      contentHash: fresh.contentHash,
    }
    newest = next.contentHash
    try {
      // Check the room before the old game stops, so a room the game cannot play leaves the last good one running.
      const game = gameIn(next)
      // A new room is a new world: the old game shuts down and the new one starts over in it.
      await handle.shutdown()
      if (next.contentHash !== newest) return
      handle = startGame(game)
      // Shutting down empties the root, the panel with it.
      root.append(problems)
      showContent(next.contentHash)
    } catch (error) {
      // The compiler checked the room, so this is the page failing (a renderer that could not start): the last
      // good room plays on, and the panel says what went wrong.
      showProblems(
        [error instanceof Error ? error.message : String(error)],
        "The new room couldn't start. Still playing the last good room.",
      )
    }
  })
  import.meta.hot.on('automata:content-error', ({ diagnostics }: { diagnostics: readonly string[] }) =>
    showProblems(diagnostics),
  )
}

followSaves()
