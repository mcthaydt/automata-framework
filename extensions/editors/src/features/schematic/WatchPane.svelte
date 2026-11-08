<!--
  Watch: the game running beside the diagram. The game is the Tuner's frame, and each saved change restarts it. When the
  game has the debug extension, it tells this page each mode change (`watch-bridge.ts`), and the page lights the mode,
  flashes the arrow and keeps a log in words. Until the game says it is listening the pane says to press Play (a game on its title screen has not started its debug
  extension yet); only after a wait does it say what to add.
-->
<script lang="ts">
import { GameFrame } from '@automata/editor/kit'
import { onDestroy } from 'svelte'
import type { SchematicSession } from './schematic-session.svelte.ts'
import { watchBridge } from './watch-bridge.ts'
import { EMPTY_WATCH, hearWatch, type WatchState } from './watch-log.ts'

interface Props {
  session: SchematicSession
  /** Told every time something is heard, so the diagram can light up. */
  onchange: (state: WatchState) => void
  /** How long a game that is up may stay silent before the pane also asks for the debug extension. */
  waitMs?: number
}

const { session, onchange, waitMs = 8_000 }: Props = $props()

const README = 'https://github.com/mcthaydt/automata-framework/blob/main/extensions/debug/README.md'
const url = $derived(session.facts.gameUrl)

let heard = $state<WatchState>(EMPTY_WATCH)
let silent = $state(false)
let stopBridge: (() => void) | undefined
let timer: ReturnType<typeof setTimeout> | undefined

function onframe(frame: HTMLIFrameElement | undefined): void {
  stopBridge?.()
  stopBridge = undefined
  clearTimeout(timer)
  if (frame === undefined || url === undefined) return
  silent = false
  stopBridge = watchBridge(frame, new URL(url).origin, (event) => {
    heard = hearWatch(heard, event)
    onchange(heard)
  })
  // A game that is up and has said nothing in this long cannot say anything: it has no debug extension.
  timer = setTimeout(() => {
    if (!heard.listening) silent = true
  }, waitMs)
}

onDestroy(() => {
  stopBridge?.()
  clearTimeout(timer)
  onchange(EMPTY_WATCH)
})

const query = { 'af-watch': window.location.origin, events: 'systems.mode' }
const problems = $derived(session.problems.length > 0)
</script>

<section class="watch" aria-label="Watch">
  <div class="game">
    <GameFrame {url} {query} {onframe} />
  </div>
  {#if problems}
    <p class="dim">Your game is still playing the last version that worked. Fix the problems to see this one.</p>
  {/if}
  {#if !heard.listening}
    {#if silent}
      <p class="dim">
        Pressed Play and still nothing? Then the game cannot say which mode each character is in. Ask whoever writes your
        game’s code to add the debug extension. <a href={README}>How to add it</a>
      </p>
    {:else}
      <p class="dim">Press Play in the game. Which mode each character is in shows here once the game is running.</p>
    {/if}
  {/if}
  {#if heard.lines.length > 0}
    <ol class="log" role="log" aria-label="What happened">
      {#each heard.lines as line, i (i)}<li>{line}</li>{/each}
    </ol>
  {/if}
</section>

<style>
  .watch {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .game {
    display: grid;
    min-height: 240px;
    height: min(50vh, 420px);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-md);
    overflow: hidden;
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .log {
    display: grid;
    gap: var(--space-1);
    max-height: 160px;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    overflow: auto;
    list-style: none;
    color: var(--color-text-primary);
    font: var(--text-body-13);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
  }
</style>
