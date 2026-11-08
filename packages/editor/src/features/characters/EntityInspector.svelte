<!--
  The Entities view's inspector (plan ED2D.5c; mockup `entities`): tabs Definition and Fields. Definition edits the
  selected entity definition (id, label, colour, shape, size, pivot, single, tile) and offers Duplicate and Delete;
  Fields lists the owner's fields, adds one, and edits the selected one (`FieldDefEditor.svelte`). For the level fields
  only the Fields tab has content. A refused value shows its message; a delete or a field change in use opens the
  refusal dialog, whose "anyway" is one undo step (G-f).
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import ColorField from '../../shared/kit/widgets/ColorField.svelte'
import type { EditEvent } from '../../shared/kit/widgets/edit-event'
import Picker from '../../shared/kit/widgets/Picker.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import Tabs from '../../shared/kit/widgets/Tabs.svelte'
import type { FieldCommit } from '../../shared/level-2d/editor/field-commit'
import type { EntityDef2D, Project } from '../../shared/level-2d/model/project-types'
import { fieldRows, type ResolvedEntitiesSelection } from './entities-model'
import type { EntitiesSession, GuardedCommit } from './entities-session'
import FieldDefEditor from './FieldDefEditor.svelte'
import RefusalDialog from './RefusalDialog.svelte'

interface Props {
  project: Project
  selection: ResolvedEntitiesSelection
  session: EntitiesSession
}

const { project, selection, session }: Props = $props()

const SHAPES = ['rect', 'ellipse', 'point', 'tile'] as const
const NO_TILE = 'none'

let chosenTab = $state('definition')
let message = $state<string | undefined>()
let refusal = $state<{
  title: string
  action: string
  uses: GuardedRefusal['uses']
  run: () => GuardedCommit
}>()
let refusalOpen = $state(false)

type GuardedRefusal = Extract<GuardedCommit, { uses: unknown }>

const def = $derived(selection.def)
const tab = $derived(def === undefined ? 'fields' : chosenTab)
const palette = $derived([
  ...new Set(project.defs.entities.flatMap((each) => (each.color === undefined ? [] : [each.color]))),
])

function show(result: GuardedCommit): void {
  message = result.ok || !('message' in result) ? undefined : result.message
}

/** Tries a guarded change; a change in use opens the refusal dialog, which runs it again `anyway`. */
function guard(title: string, action: string, attempt: (anyway: boolean) => GuardedCommit): void {
  const result = attempt(false)
  if (!result.ok && 'uses' in result) {
    refusal = { title, action, uses: result.uses, run: () => attempt(true) }
    refusalOpen = true
    message = undefined
    return
  }
  show(result)
}

const committed = (event: EditEvent<unknown>): boolean => event.phase === 'set' || event.phase === 'commit'
const edit = (patch: Parameters<EntitiesSession['editDefinition']>[0]): FieldCommit => {
  const result = session.editDefinition(patch)
  show(result)
  return result
}
const onText = (event: Event): string => (event.currentTarget as HTMLInputElement).value.trim()

function tileChoice(current: EntityDef2D, id: string): void {
  if (id === NO_TILE) edit({ tile: undefined })
  else edit({ tile: { tileset: id, index: current.tile?.tileset === id ? current.tile.index : 0 } })
}
</script>

<section class="inspector" aria-label="Inspector" data-testid="entities-inspector">
  <Tabs
    label="Inspector"
    tabs={[
      ...(def === undefined ? [] : [{ id: 'definition', label: 'Definition' }]),
      { id: 'fields', label: `Fields ${selection.fields.length}` },
    ]}
    value={tab}
    onselect={(id) => (chosenTab = id)}
  >
    {#snippet panel(id)}
      {#if id === 'definition' && def !== undefined}
        {#key def.id}
          <div class="fields">
            <label class="text">
              <span class="label">Id</span>
              <input value={def.id} onchange={(event) => show(session.renameDefinition(onText(event)))} />
            </label>
            <label class="text">
              <span class="label">Label</span>
              <input value={def.label ?? ''} onchange={(event) => edit({ label: onText(event) || undefined })} />
            </label>
            <ColorField
              label="Colour"
              value={def.color ?? '#94a3b8'}
              {palette}
              onedit={(event) => committed(event) && edit({ color: event.value })}
            />
            <Segmented
              label="Shape"
              options={SHAPES.map((shape) => ({ id: shape, label: shape }))}
              value={def.shape}
              onedit={(event) => committed(event) && edit({ shape: event.value as EntityDef2D['shape'] })}
            />
              <Stepper
                label="Width"
                value={def.size.w}
                min={1}
                integer
                onedit={(event) => committed(event) && edit({ size: { ...def.size, w: event.value } })}
              />
              <Stepper
                label="Height"
                value={def.size.h}
                min={1}
                integer
                onedit={(event) => committed(event) && edit({ size: { ...def.size, h: event.value } })}
              />
              <Stepper
                label="Pivot x"
                value={def.pivot.x}
                min={0}
                max={1}
                step={0.5}
                onedit={(event) => committed(event) && edit({ pivot: { ...def.pivot, x: event.value } })}
              />
              <Stepper
                label="Pivot y"
                value={def.pivot.y}
                min={0}
                max={1}
                step={0.5}
                onedit={(event) => committed(event) && edit({ pivot: { ...def.pivot, y: event.value } })}
              />
            <button
              type="button"
              class="toggle"
              aria-pressed={def.single === true}
              onclick={() => edit({ single: def.single !== true })}>Single per level</button
            >
            <Picker
              label="Tile"
              options={[
                { id: NO_TILE, label: 'No tile' },
                ...project.defs.tilesets.map((set) => ({ id: set.id, label: set.label })),
              ]}
              value={def.tile?.tileset ?? NO_TILE}
              onpick={(id) => tileChoice(def, id)}
            />
            {#if def.tile !== undefined}
              {@const tile = def.tile}
              <Stepper
                label="Tile index"
                value={tile.index}
                min={0}
                integer
                onedit={(event) => committed(event) && edit({ tile: { ...tile, index: event.value } })}
              />
            {/if}
            {#if message !== undefined}<p class="message" role="alert">{message}</p>{/if}
          </div>
          <div class="footer">
            <Button onclick={() => show(session.duplicateDefinition())}>Duplicate</Button>
            <Button
              variant="danger"
              onclick={() =>
                guard(`Delete ${def.id}?`, 'Delete anyway', (anyway) => session.deleteDefinition({ anyway }))}
            >
              Delete
            </Button>
          </div>
        {/key}
      {:else}
        <div class="fields">
          <div class="head">
            <h2 id="field-list-heading">{def === undefined ? 'Level fields' : `Fields of ${def.id}`}</h2>
            <Button onclick={() => show(session.addField())}>Add field</Button>
          </div>
          <div class="choices" role="radiogroup" aria-labelledby="field-list-heading">
            {#each fieldRows(selection.fields) as row (row.id)}
              <button
                type="button"
                role="radio"
                class="row"
                aria-checked={row.id === selection.field?.id}
                onclick={() => session.select({ field: row.id })}
              >
                <span class="name">{row.id}{#if row.required}<span class="required">required</span>{/if}</span>
                <span class="sub">{row.summary}</span>
              </button>
            {:else}
              <p class="empty">No fields yet.</p>
            {/each}
          </div>
          {#if selection.field !== undefined}
            {#key `${selection.field.id}:${selection.field.type}`}
              <FieldDefEditor {project} field={selection.field} {session} {palette} {guard} />
            {/key}
          {/if}
          {#if message !== undefined}<p class="message" role="alert">{message}</p>{/if}
        </div>
      {/if}
    {/snippet}
  </Tabs>
</section>

{#if refusal !== undefined}
  {@const asked = refusal}
  <RefusalDialog
    bind:open={refusalOpen}
    title={asked.title}
    action={asked.action}
    uses={asked.uses}
    onconfirm={() => show(asked.run())}
  />
{/if}

<style>
  .inspector {
    display: grid;
    align-content: start;
    min-width: 0;
  }
  .fields {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .text {
    display: grid;
    gap: var(--space-1);
  }
  .label {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  input {
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .toggle {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .toggle[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 70%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .choices {
    display: grid;
    gap: 2px;
  }
  .row {
    display: grid;
    align-content: center;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    text-align: start;
    cursor: pointer;
  }
  .row[aria-checked='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 60%, transparent);
    background: var(--color-accent-soft);
  }
  .row:focus-visible,
  .toggle:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .name {
    display: flex;
    gap: var(--space-2);
    font: var(--text-body-13-medium);
  }
  .required {
    color: var(--color-state-warn, var(--color-text-dim));
    font: var(--text-mono-11);
  }
  .sub {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty,
  .message {
    margin: 0;
    font: var(--text-body-13);
  }
  .empty {
    color: var(--color-text-dim);
  }
  .message {
    color: var(--color-state-bad);
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0 var(--space-3) var(--space-3);
  }
  .footer > :global(*) {
    flex: 1 1 0;
  }
</style>
