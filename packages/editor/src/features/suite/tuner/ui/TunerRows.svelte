<!--
  The Tuner's settings, beside the game: one card per setting, in the file's order, named by its label and what a player
  feels when the file gives them (`shownName`, `shownNote`), else by its name in code and its comment. Each card has
  one control and one read-out: a slider for a number with bounds (its read-out is the value in its unit), a number box
  for a number without, On or Off for a toggle, a text field for a string; a table or a list says to change it in the file. A value outside the
  bounds is refused before the write, with the bound named. The states without cards: no file (an offer to create it), a file that does not parse (the
  parser's line), and a code-owned game whose bounds the compiler has not written. A setting with a scale is shown and
  edited in its unit and in a step a person can feel (`tuner-display.ts`); what is set goes back to the file as the
  sim's own number.
-->
<script lang="ts">
import Button from '../../../../shared/kit/widgets/Button.svelte'
import Segmented from '../../../../shared/kit/widgets/Segmented.svelte'
import Slider from '../../../../shared/kit/widgets/Slider.svelte'
import Stepper from '../../../../shared/kit/widgets/Stepper.svelte'
import { shownName, shownNote, type Tunable } from '../tuner-content'
import type { TunerController } from '../tuner-controller'
import { rawValue, shownBounds, shownValue } from '../tuner-display'
import { checkValue } from '../tuner-edits'
import ControlsSection from './ControlsSection.svelte'

const { controller }: { controller: TunerController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const refusal = controller.refusal

const read = $derived.by(() => {
  void $revision
  return controller.all()
})

const rows = $derived.by(() => {
  void $revision
  const read = controller.all()
  return 'tunables' in read ? read.tunables : []
})
const hasFile = $derived.by(() => {
  void $revision
  return controller.session.hasFile()
})
const noBounds = $derived(
  controller.session.boundsUnavailable() &&
    'tunables' in read &&
    read.tunables.some(
      (tunable) => tunable.kind !== 'other' && typeof tunable.value === 'number' && tunable.min === undefined,
    ),
)

const bounded = (tunable: Tunable): boolean => tunable.min !== undefined && tunable.max !== undefined
/** The default step a number without one takes, before it is shown in its unit. */
const withStep = (tunable: Tunable): Tunable =>
  tunable.step === undefined ? { ...tunable, step: tunable.kind === 'int' ? 1 : 0.01 } : tunable
/** The value, its bounds and its step as shown (in its unit when it has a scale). */
const shownOf = (tunable: Tunable) => {
  const stepped = withStep(tunable)
  const raw = typeof tunable.value === 'number' ? tunable.value : 0
  return {
    value: shownValue(stepped, raw),
    ...shownBounds(stepped),
    raw: (shown: number) => rawValue(stepped, shown),
  }
}
</script>

<section class="rows" aria-label="Tunables" data-testid="tuner-rows" data-scroll-region="vertical">
  {#if !hasFile}
    <!-- Nothing here: the offer to make a settings file comes after the controls, which a new game came for. -->
  {:else if 'problem' in read}
    <p class="problem" role="alert">{read.problem}</p>
  {:else}
    {#if noBounds}
      <p class="hint">Run the game's checks once to see how far these settings can go.</p>
    {/if}
    {#each rows as tunable (tunable.name)}
      {@const shown = shownName(tunable)}
      {@const note = shownNote(tunable)}
      <div
        class="row"
        data-testid={`tuner-row-${tunable.name}`}
        role="group"
        aria-label={shown}
      >
        <div class="name">
          <span class="title">{shown}</span>
          {#if note && note !== tunable.unit}<span class="note">{note}</span>{/if}
        </div>
        <div class="control">
          {#if !tunable.editable}
            <span class="in-file">A table or a list: change it in the file.</span>
          {:else if tunable.kind === 'boolean'}
            <Segmented
              label={shown}
              value={tunable.value === true ? 'on' : 'off'}
              options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]}
              onedit={(event) => void controller.set(tunable.name, event.value === 'on')}
            />
          {:else if tunable.kind === 'string'}
            <input
              class="text"
              type="text"
              aria-label={shown}
              value={String(tunable.value)}
              onchange={(event) => void controller.set(tunable.name, event.currentTarget.value)}
              onkeydown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          {:else}
            {@const number = shownOf(tunable)}
            {#if bounded(tunable)}
              <!-- One control and one read-out: the slider's own (a nudge is an arrow key or a drag). -->
              <Slider
                label={shown}
                value={number.value}
                min={number.min ?? 0}
                max={number.max ?? 0}
                step={number.step}
                unit={tunable.unit}
                onedit={(event) => {
                  if (event.phase === 'set') void controller.set(tunable.name, number.raw(event.value))
                  else if (event.phase === 'start') controller.dragStart(tunable.name)
                  else if (event.phase === 'update') controller.dragUpdate(number.raw(event.value))
                  else if (event.phase === 'commit') void controller.dragCommit()
                  else controller.dragCancel()
                }}
              />
            {:else}
            <Stepper
              label={shown}
              value={number.value}
              min={number.min}
              max={number.max}
              step={number.step}
              unit={tunable.unit}
              integer={tunable.kind === 'int' && tunable.scale === undefined}
              validate={(value) => {
                const check = checkValue(tunable, number.raw(value))
                return 'message' in check ? check.message : undefined
              }}
              onedit={(event) => void controller.set(tunable.name, number.raw(event.value))}
            />
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  {/if}
  <ControlsSection {controller} />
  {#if !hasFile}
    <div class="state">
      <p>This game has no settings file yet.</p>
      <Button onclick={() => void controller.create()}>Make one</Button>
    </div>
  {/if}
  {#if $refusal !== undefined}
    <p class="refusal" role="status" data-testid="tuner-refusal">{$refusal}</p>
  {/if}
</section>

<style>
  .rows {
    box-sizing: border-box;
    height: 100%;
    overflow: auto;
    align-content: start;
    container-type: inline-size;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    /* The settings are a page of words beside the game, not a canvas: the tool chrome's light field, so their names
       read in the chrome's ink (they were dark on the near-black cabinet). Only the game keeps the cabinet. */
    background: var(--bg);
  }
  .row {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    /* A white card on the light field, as the mockup's panels. */
    background: var(--paper);
  }
  .name {
    display: grid;
    gap: 2px;
  }
  .title {
    font: var(--text-title-15);
  }
  .note {
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .control {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }
  /* The row's name is printed once, above. The slider's and the number box's own labels stay for assistive technology
     (they name the controls) but are not drawn. */
  .control :global(.label) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .control > :global(*) {
    flex: 1 1 200px;
    max-width: 100%;
    min-width: 0;
  }
  .text {
    flex: 1 1 160px;
    min-width: 0;
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: inherit;
    font: inherit;
  }
  .in-file,
  .hint,
  .state p {
    margin: 0;
    color: var(--color-text-dim);
  }
  .problem,
  .refusal {
    margin: 0;
    color: var(--color-state-bad);
  }
  .state {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
</style>
