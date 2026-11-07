<script lang="ts">
// The audio board: every cue on a button grouped by bus, the beds as toggles. Pressing plays through the game's mixer.
import { getContext } from 'svelte'
import { type DebugHost, HOST_CONTEXT } from '../host'

const board = getContext<DebugHost | undefined>(HOST_CONTEXT)?.audio
const cues = board?.cues() ?? []
const beds = board?.beds() ?? []
const buses = [...new Set(cues.map((c) => c.bus))].sort()
let playing: readonly string[] = $state(board?.playing() ?? [])

const toggle = (id: string): void => {
  if (board === undefined) return
  if (playing.includes(id)) board.stopBed(id)
  else board.startBed(id)
  playing = board.playing()
}
const hint = (about: string | undefined, events: readonly string[]): string =>
  `${about ?? ''}\nEvents: ${events.join(', ') || '(none)'}`.trimStart()
</script>

{#if board === undefined}
  <p>No audio board installed.</p>
{:else}
  {#each buses as bus (bus)}
    <h3>Cues · {bus}</h3>
    <div class="row">
      {#each cues.filter((c) => c.bus === bus) as cue (cue.id)}
        <button type="button" title={hint(cue.about, cue.events)} onclick={() => board.play(cue.id)}>
          {cue.id}{cue.draft ? ' (draft)' : ''}
        </button>
      {/each}
    </div>
  {/each}
  {#if beds.length > 0}
    <h3>Beds</h3>
    <div class="row">
      {#each beds as bed (bed.id)}
        <button
          type="button"
          aria-pressed={playing.includes(bed.id)}
          title={bed.about ?? ''}
          onclick={() => toggle(bed.id)}>
          {bed.id}{bed.draft ? ' (draft)' : ''}
        </button>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    color: inherit;
    background: rgb(255 255 255 / 0.12);
    border: 1px solid rgb(255 255 255 / 0.3);
  }
  button[aria-pressed='true'] {
    background: rgb(255 255 255 / 0.3);
  }
</style>
