<!--
  Your games: the games kept in this browser, newest change first. Each says what it is called, when it last changed and
  where it is kept, and has Open, Save a copy and Remove (which asks first). Above them, New game and Open a copy.
  Nothing here talks to storage: the page that mounts it hands in the games and hears what the person chose.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { GameEntry } from './games-index'
import { since } from './since'

interface Props {
  games: readonly GameEntry[]
  /** The page's clock, in milliseconds: "Changed 5 minutes ago" is read from it. */
  now: number
  /** False when the browser keeps nothing: the games here are in memory and the note says so. */
  kept: boolean
  /** Whether signing in with GitHub is offered: the note then names it as the other way to keep a game safe. */
  canSignIn?: boolean
  /** What went wrong with the last thing the person tried (a zip that is not a game), in words. */
  trouble?: string | undefined
  onopen: (id: string) => void
  onnew: () => void
  oncopy: (id: string) => void
  onimport: (file: File) => void
  onremove: (id: string) => void
}

const {
  games,
  now,
  kept,
  canSignIn = false,
  trouble,
  onopen,
  onnew,
  oncopy,
  onimport,
  onremove,
}: Props = $props()

let removing = $state<GameEntry | undefined>()
let removeOpen = $state(false)
let picker = $state<HTMLInputElement>()

const NOTE = $derived(
  canSignIn
    ? 'Saved in this browser only. Save a copy, or sign in with GitHub, to keep it safe.'
    : 'Saved in this browser only. Save a copy to keep it safe.',
)
const NOT_KEPT = 'Not saved: this browser can’t keep files. Save a copy to keep your work.'

function ask(game: GameEntry): void {
  removing = game
  removeOpen = true
}
</script>

<main class="games" data-testid="your-games">
  <h1>Your games</h1>
  <p class="note" class:bad={!kept}>{kept ? NOTE : NOT_KEPT}</p>
  <div class="bar">
    <Button variant="primary" onclick={onnew}>New game</Button>
    <Button onclick={() => picker?.click()}>Open a copy</Button>
    <input
      bind:this={picker}
      class="hidden"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a game copy to open"
      tabindex="-1"
      onchange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file !== undefined) onimport(file)
      }}
    />
  </div>
  {#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
  {#if games.length === 0}
    <p class="empty">You haven’t made a game yet. Press New game to start one.</p>
  {:else}
    <ul>
      {#each games as game (game.id)}
        <li>
          <div class="who">
            <strong>{game.title}</strong>
            <span>Changed {since(game.changed, now)}</span>
            <span>{game.github !== undefined ? `On GitHub: ${game.github}` : kept ? 'On this device' : 'In this tab only'}</span>
          </div>
          <div class="acts">
            <Button variant="primary" aria-label={`Open ${game.title}`} onclick={() => onopen(game.id)}>Open</Button>
            <Button aria-label={`Save a copy of ${game.title}`} onclick={() => oncopy(game.id)}>Save a copy</Button>
            <Button variant="danger" aria-label={`Remove ${game.title}`} onclick={() => ask(game)}>Remove</Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<Dialog bind:open={removeOpen} title={`Remove ${removing?.title ?? 'this game'}?`}>
  <p>
    Remove {removing?.title} from this browser?
    {removing?.github !== undefined ? 'A copy on GitHub stays.' : 'Save a copy first if you want to keep it.'}
  </p>
  {#snippet actions({ close })}
    <Button variant="quiet" onclick={close}>Keep it</Button>
    <Button
      variant="danger"
      onclick={() => {
        if (removing !== undefined) onremove(removing.id)
        close()
      }}>Remove</Button
    >
  {/snippet}
</Dialog>

<style>
  .games {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 40rem;
    margin: 0 auto;
    color: var(--ink);
    font: var(--text-body-13);
  }
  h1 {
    margin: 0;
    font: var(--text-title-20);
  }
  .note {
    margin: 0;
    color: var(--muted);
  }
  .note.bad,
  .trouble {
    color: var(--bad);
  }
  .bar,
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  li {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .who span {
    color: var(--muted);
  }
  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>
