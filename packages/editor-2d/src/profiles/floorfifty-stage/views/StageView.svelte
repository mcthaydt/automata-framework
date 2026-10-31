<!--
  The Stage view (plan EDFF.2a-1; 2D editor spec §10.6, the Stage row; mockup `ff-settings`): the stage's identity,
  its presentation block and the course tuning it overrides, as a form in three sections. Each change is one undo step
  through the stage's commands. The commands never judge a range (§10.6), so a value the game would refuse is kept and
  the Checks view reports it; the form shows each tunable's range and base value beside it.
-->
<script lang="ts">
import type { EditEvent } from '@mcthaydt/automata-editor-kit'
import { Button, EditorShell, Stepper } from '@mcthaydt/automata-editor-kit'
import type { ViewProps } from '../../../app/views/view-props'
import {
  renameStage,
  setCourseTuning,
  setPlatformAlias,
  setStageId,
  setUnlock,
} from '../commands/identity-edits'
import { type PresentationField, removePresentation, setPresentation } from '../commands/presentation-edits'
import type { StageDocument } from '../stage-document'
import { TUNABLES } from '../tunables'
import { stageForm } from './stage-form'

const { geometry, document: opened, frame }: ViewProps = $props()

// svelte-ignore state_referenced_locally
let value = $state.raw(opened.history.state as StageDocument)
$effect(() => opened.history.subscribe((history) => (value = history.state as StageDocument)))

const form = $derived(stageForm(value))
let adding = $state('')

function edit(label: string, update: (document: StageDocument) => StageDocument): void {
  opened.history.apply(label, (state) => update(state as StageDocument))
}

const committed = (event: EditEvent<number>): boolean => event.phase === 'set' || event.phase === 'commit'

/** A text field commits on Enter or when it loses focus; nothing changes when the text is what the stage holds. */
function text(
  label: string,
  current: string,
  update: (document: StageDocument, next: string) => StageDocument,
) {
  return (event: Event): void => {
    const next = (event.currentTarget as HTMLInputElement).value.trim()
    if (next !== current) edit(label, (document) => update(document, next))
  }
}

function presentation(field: PresentationField, next: number | boolean | undefined): void {
  edit('Set presentation', (document) => setPresentation(document, field, next as never))
}

function addOverride(): void {
  const name = adding === '' ? form.available[0] : adding
  if (name === undefined) return
  const base = TUNABLES[name]?.default ?? 0
  edit('Add override', (document) => setCourseTuning(document, name, base))
  adding = ''
}
</script>

{#snippet textField(label: string, current: string, update: (document: StageDocument, next: string) => StageDocument, undoLabel: string, mono: boolean)}
  <label class="field">
    <span>{label}</span>
    <input
      type="text"
      class:mono
      value={current}
      onchange={text(undoLabel, current, update)}
      onkeydown={(event) => {
        if (event.key === 'Enter') text(undoLabel, current, update)(event)
      }}
    />
  </label>
{/snippet}

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  testId="stage-view"
>
  {#snippet canvas()}
    <div class="stage" data-scroll-region>
      <section aria-labelledby="stage-identity">
        <h2 id="stage-identity">Identity</h2>
        {@render textField('Id', form.identity.id, setStageId, 'Set stage id', true)}
        {@render textField('Name', form.identity.name, renameStage, 'Rename stage', false)}
        {@render textField(
          'Unlock',
          form.identity.unlock,
          (document, next) => setUnlock(document, next === '' ? undefined : next),
          'Set unlock',
          true,
        )}
        {@render textField('Platform', form.identity.platformAlias, setPlatformAlias, 'Set platform', true)}
      </section>

      <section aria-labelledby="stage-presentation">
        <h2 id="stage-presentation">Presentation</h2>
        {#if form.presentation === undefined}
          <p class="note">This stage uses the game's default look.</p>
          <Button onclick={() => presentation('refractionIntensity', 0)}>Use presentation</Button>
        {:else}
          {@const shown = form.presentation}
          <Stepper
            label="Refraction"
            value={shown.refraction}
            step={0.05}
            onedit={(event) => {
              if (committed(event)) presentation('refractionIntensity', event.value)
            }}
          />
          <Stepper
            label="Horizon lift"
            value={shown.horizonLift}
            onedit={(event) => {
              if (committed(event)) presentation('horizonLift', event.value)
            }}
          />
          <label class="check">
            <input
              type="checkbox"
              checked={shown.lightHeight !== undefined}
              onchange={(event) => presentation('lightHeight', event.currentTarget.checked ? 0 : undefined)}
            />
            <span>Set the light height</span>
          </label>
          {#if shown.lightHeight !== undefined}
            <Stepper
              label="Light height"
              value={shown.lightHeight}
              onedit={(event) => {
                if (committed(event)) presentation('lightHeight', event.value)
              }}
            />
          {/if}
          <label class="check">
            <input
              type="checkbox"
              checked={shown.lightShimmer}
              onchange={(event) => presentation('lightShimmer', event.currentTarget.checked || undefined)}
            />
            <span>Light shimmer</span>
          </label>
          <label class="check">
            <input
              type="checkbox"
              checked={shown.silhouette}
              onchange={(event) => presentation('silhouette', event.currentTarget.checked || undefined)}
            />
            <span>Silhouette</span>
          </label>
          <Button onclick={() => edit('Remove presentation', removePresentation)}>Remove presentation</Button>
        {/if}
      </section>

      <section aria-labelledby="stage-tuning">
        <h2 id="stage-tuning">Course tuning</h2>
        {#each form.overrides as override (override.name)}
          <div class="override">
            <Stepper
              label={override.name}
              value={override.value}
              integer={override.declared?.type === 'int'}
              onedit={(event) => {
                if (committed(event))
                  edit('Set override', (document) => setCourseTuning(document, override.name, event.value))
              }}
            />
            <p class="note">
              {override.declared === undefined
                ? 'The game does not declare this name.'
                : `${override.declared.min} to ${override.declared.max}, base ${override.declared.default}`}
            </p>
            <Button
              aria-label={`Remove ${override.name}`}
              onclick={() => edit('Remove override', (document) => setCourseTuning(document, override.name, undefined))}
              >Remove</Button
            >
          </div>
        {:else}
          <p class="note">No overrides. The race runs on the base layer alone.</p>
        {/each}
        {#if form.available.length > 0}
          <div class="add">
            <label class="field">
              <span>Tunable</span>
              <select bind:value={adding} class="mono">
                {#each form.available as name (name)}<option value={name}>{name}</option>{/each}
              </select>
            </label>
            <Button onclick={addOverride}>Add override</Button>
          </div>
        {/if}
      </section>
    </div>
  {/snippet}
</EditorShell>

<style>
  .stage {
    box-sizing: border-box;
    display: grid;
    align-content: start;
    gap: var(--space-5);
    height: 100%;
    padding: var(--space-4);
    overflow-y: auto;
  }
  section {
    display: grid;
    gap: var(--space-3);
    max-width: 32rem;
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .field {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  input[type='text'],
  select {
    box-sizing: border-box;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .mono {
    font: var(--text-mono-12);
  }
  .check {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    min-height: var(--size-hit);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .check input {
    width: 20px;
    height: 20px;
    margin: 0;
  }
  .override {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }
  .add {
    display: grid;
    gap: var(--space-2);
  }
  .note {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
