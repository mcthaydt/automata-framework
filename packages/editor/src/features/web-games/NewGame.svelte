<!--
  New game: asks what the game is called and shows the name its files will have, which is the same name made safe for a
  folder ("Lantern Run" gives lantern-run), numbered when another game already has it. The page makes the game.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import { gameId } from './games-index'

interface Props {
  /** The ids already taken, so a name used before is told its number. */
  taken: readonly string[]
  /** Makes the game; the answer is a reason it could not be made, in words, or nothing. */
  onmake: (title: string) => Promise<string | undefined> | string | undefined
  oncancel: () => void
}

const { taken, onmake, oncancel }: Props = $props()

let title = $state('')
let trouble = $state<string | undefined>()
let busy = $state(false)
const id = $derived(gameId(title, taken))

async function make(): Promise<void> {
  if (busy) return
  busy = true
  trouble = await onmake(title.trim() || 'My game')
  busy = false
}
</script>

<main class="new" data-testid="new-game">
  <h1>New game</h1>
  <form
    onsubmit={(event) => {
      event.preventDefault()
      void make()
    }}
  >
    <label>
      <span>What’s your game called?</span>
      <input type="text" autocomplete="off" placeholder="Lantern Run" bind:value={title} />
    </label>
    <p class="id">Its files will be called <code>{id}</code>.</p>
    {#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
    <div class="acts">
      <Button variant="primary" disabled={busy} onclick={() => void make()}>Make my game</Button>
      <Button variant="quiet" onclick={oncancel}>Back</Button>
    </div>
  </form>
</main>

<style>
  .new {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 30rem;
    margin: 0 auto;
    color: var(--ink);
    font: var(--text-body-13);
  }
  h1 {
    margin: 0;
    font: var(--text-title-20);
  }
  form,
  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  input {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: inherit;
    font: var(--text-body-13);
  }
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
  .id {
    margin: 0;
    color: var(--muted);
  }
  .trouble {
    margin: 0;
    color: var(--bad);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
