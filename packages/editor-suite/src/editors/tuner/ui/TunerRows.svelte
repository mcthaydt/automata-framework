<!--
  The Tuner's canvas (EDS.4a; editor suite spec §6.1): one row per tunable, in the file's order. A number with bounds is a
  slider and a number box, a number without is the box alone, a toggle is On or Off, a string a text field, and a table
  or a list says "Ask only". A value outside the bounds is refused before the write, with the bound named; a lock makes a
  row refuse until it is unlocked. The states without rows: no file (an offer to create it), a file that does not parse
  (the parser's line), and a code-owned game whose bounds the compiler has not written.
-->
<script lang="ts">
import { Button, Segmented, Slider, Stepper } from '@mcthaydt/automata-editor-kit'
import type { Tunable } from '../tuner-content'
import type { TunerController } from '../tuner-controller'
import { checkValue } from '../tuner-edits'

const { controller }: { controller: TunerController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const refusal = controller.refusal
// svelte-ignore state_referenced_locally
const selected = controller.selected
// svelte-ignore state_referenced_locally
const filter = controller.filter

const read = $derived.by(() => {
  void $revision
  void $filter
  return controller.all()
})
/** Whether a tunable is locked; reads the revision so a lock redraws the rows. */
const isLocked = (name: string): boolean => {
  void $revision
  return controller.isLocked(name)
}

const rows = $derived.by(() => {
  void $revision
  void $filter
  return controller.visible()
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
const stepOf = (tunable: Tunable): number => tunable.step ?? (tunable.kind === 'int' ? 1 : 0.01)
const numberOf = (tunable: Tunable): number => (typeof tunable.value === 'number' ? tunable.value : 0)
</script>

<section class="rows" aria-label="Tunables" data-testid="tuner-rows" data-scroll-region="vertical">
  {#if !hasFile}
    <div class="state">
      <p>This game has no content/tuning.toml yet.</p>
      <Button variant="primary" onclick={() => void controller.create()}>Create tuning.toml</Button>
    </div>
  {:else if 'problem' in read}
    <p class="problem" role="alert">{read.problem}</p>
  {:else}
    {#if noBounds}
      <p class="hint">Run checks to read bounds: these numbers have none until the compiler has written tuning-meta.json.</p>
    {/if}
    {#each rows as tunable (tunable.name)}
      {@const locked = isLocked(tunable.name)}
      <div
        class="row"
        class:chosen={$selected === tunable.name}
        class:locked
        data-testid={`tuner-row-${tunable.name}`}
        role="group"
        aria-label={tunable.name}
      >
        <div class="head">
          <div class="name">
            <button type="button" class="pick" onclick={() => controller.select(tunable.name)}>{tunable.name}</button>
            {#if tunable.note && tunable.note !== tunable.unit}<span class="note">{tunable.note}</span>{/if}
          </div>
          {#if tunable.editable}
            <Button
              aria-label={`${locked ? 'Unlock' : 'Lock'} ${tunable.name}`}
              aria-pressed={locked}
              onclick={() => controller.toggleLock(tunable.name)}
            >
              {locked ? 'Locked' : 'Lock'}
            </Button>
          {/if}
        </div>
        <div class="control">
          {#if !tunable.editable}
            <span class="ask-only">Ask only: a table or a list is changed with Ask.</span>
          {:else if tunable.kind === 'boolean'}
            <Segmented
              label={tunable.name}
              value={tunable.value === true ? 'on' : 'off'}
              options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]}
              disabled={locked}
              reason={`${tunable.name} is locked: unlock it to change it`}
              onedit={(event) => void controller.set(tunable.name, event.value === 'on')}
            />
          {:else if tunable.kind === 'string'}
            <input
              class="text"
              type="text"
              aria-label={tunable.name}
              value={String(tunable.value)}
              disabled={locked}
              onchange={(event) => void controller.set(tunable.name, event.currentTarget.value)}
              onkeydown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          {:else}
            {#if bounded(tunable)}
              <Slider
                label={tunable.name}
                value={numberOf(tunable)}
                min={tunable.min ?? 0}
                max={tunable.max ?? 0}
                step={stepOf(tunable)}
                unit={tunable.unit}
                disabled={locked}
                reason={`${tunable.name} is locked: unlock it to change it`}
                onedit={(event) => {
                  if (event.phase === 'set') void controller.set(tunable.name, event.value)
                  else if (event.phase === 'start') controller.dragStart(tunable.name)
                  else if (event.phase === 'update') controller.dragUpdate(event.value)
                  else if (event.phase === 'commit') void controller.dragCommit()
                  else controller.dragCancel()
                }}
              />
            {/if}
            <Stepper
              label={tunable.name}
              value={numberOf(tunable)}
              min={tunable.min}
              max={tunable.max}
              step={stepOf(tunable)}
              unit={tunable.unit}
              integer={tunable.kind === 'int'}
              validate={(value) => {
                const check = checkValue(tunable, value)
                return 'message' in check ? check.message : undefined
              }}
              disabled={locked}
              reason={`${tunable.name} is locked: unlock it to change it`}
              onedit={(event) => void controller.set(tunable.name, event.value)}
            />
          {/if}
        </div>
      </div>
    {/each}
    {#if $refusal !== undefined}
      <p class="refusal" role="status" data-testid="tuner-refusal">{$refusal}</p>
    {/if}
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
  }
  .row {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 1px solid var(--color-border-default, #3a3f48);
    border-radius: 8px;
  }
  .head {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    justify-content: space-between;
  }
  .row.chosen {
    border-color: var(--color-accent, #d9a441);
  }
  .row.locked {
    opacity: 0.8;
  }
  .name {
    display: grid;
    gap: 2px;
  }
  .pick {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: var(--text-title-15);
    text-align: left;
    cursor: pointer;
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
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-default, #3a3f48);
    border-radius: 8px;
    background: var(--color-surface-base, #14161a);
    color: inherit;
    font: inherit;
  }
  .ask-only,
  .hint,
  .state p {
    margin: 0;
    color: var(--color-text-dim);
  }
  .problem,
  .refusal {
    margin: 0;
    color: var(--color-state-error, #e5534b);
  }
  .state {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
</style>
