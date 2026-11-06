<!--
  The Tuner's game pane: the game's dev page (`pnpm dev`, the address `automata editor` was given) in a frame, beside
  the settings. Each change the Tuner writes to content/tuning.toml reaches the running game through the content
  plugin, which restarts it on the new tuning, so the pane shows the change without reloading. The frame is shown only
  once something answers at that address; until then the pane says how to start the game, and looks again every two
  seconds. The sample game has no dev page, so the pane says where a game comes from.
-->
<script lang="ts">
import { onDestroy } from 'svelte'

interface Props {
  /** The game's dev page, or none for the sample game. */
  url: string | undefined
  /** Whether anything answers at the address; a real request unless a test says otherwise. */
  answers?: (url: string) => Promise<boolean>
}

/**
 * A request the browser can make to any address: a cross-origin page answers with an opaque response, which is
 * enough to know a server is there; nothing listening rejects.
 */
const pageAnswers = (url: string): Promise<boolean> =>
  fetch(url, { mode: 'no-cors', cache: 'no-store' }).then(
    () => true,
    () => false,
  )

const { url, answers = pageAnswers }: Props = $props()

/** How long the pane waits between two looks at an address that did not answer. */
const LOOK_AGAIN_MS = 2_000

let running = $state(false)
let timer: ReturnType<typeof setTimeout> | undefined
let stopped = false

/** Looks once; while nothing answers, looks again after a pause. */
async function look(address: string): Promise<void> {
  const up = await answers(address)
  if (stopped) return
  if (up) running = true
  else timer = setTimeout(() => void look(address), LOOK_AGAIN_MS)
}

// svelte-ignore state_referenced_locally
if (url !== undefined) void look(url)

onDestroy(() => {
  stopped = true
  clearTimeout(timer)
})
</script>

<section class="game" aria-label="Your game" data-testid="tuner-game">
  {#if url === undefined}
    <p class="note">Your game shows here when you open the editors in your game's folder.</p>
  {:else if running}
    <iframe title="Your game" src={url}></iframe>
  {:else}
    <p class="note">Start your game with pnpm dev to see your changes here.</p>
  {/if}
</section>

<style>
  .game {
    display: grid;
    place-items: center;
    min-height: 0;
    background: var(--color-surface-base);
  }
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
  .note {
    max-width: 32ch;
    margin: 0;
    padding: var(--space-3);
    color: var(--color-text-dim);
    font: var(--text-body-13);
    text-align: center;
  }
</style>
