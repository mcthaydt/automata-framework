<!--
  The selected field's definition (plan ED2D.5c decisions 3 and 4; mockup `entities`, the field editor): id, label,
  type as one chip per kit type, list, required, the default (the Level inspector's `FieldEditor`, so a default is
  edited as an instance's value is), the bounds and step of a number, the options of an enum, multiline text and the
  targets of a ref. Every change but the id goes through the session's `changeField`, so the retype rule decides what
  it breaks; `guard` shows a message or opens the refusal dialog.
-->
<script lang="ts">
import type { EditEvent } from '@mcthaydt/automata-editor-kit'
import { Button, Stepper } from '@mcthaydt/automata-editor-kit'
import {
  defaultFieldValue,
  FIELD_TYPES,
  type FieldDef,
  type FieldType,
  type FieldValue,
} from '@mcthaydt/automata-editor-kit/fields'
import type { Project } from '../../model/project-types'
import FieldEditor from '../level/FieldEditor.svelte'
import type { FieldCommit } from '../level/field-commit'
import { fieldRow } from '../level/inspector-model'
import type { EntitiesSession, GuardedCommit } from './entities-session'

interface Props {
  project: Project
  field: FieldDef
  session: EntitiesSession
  palette: readonly string[]
  guard: (title: string, action: string, attempt: (anyway: boolean) => GuardedCommit) => void
}

const { project, field, session, palette, guard }: Props = $props()

const numeric = $derived(field.type === 'int' || field.type === 'float')
const title = $derived(`Change ${field.id}?`)

function change(next: FieldDef): void {
  guard(title, 'Change anyway', (anyway) => session.changeField(next, { anyway }))
}
function setType(type: FieldType): void {
  guard(title, 'Change anyway', (anyway) => session.setType(type, { anyway }))
}
/** The default commits like an instance's value: a message goes back to the field; uses open the dialog. */
function commitDefault(value: FieldValue): FieldCommit {
  const next = { ...field, default: value }
  const result = session.changeField(next)
  if (result.ok || 'message' in result) return result
  change(next)
  return { ok: true }
}
const committed = (event: EditEvent<unknown>): boolean => event.phase === 'set' || event.phase === 'commit'
const onText = (event: Event): string => (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value
const toggleTarget = (target: string): readonly string[] => {
  const to = field.to ?? []
  return to.includes(target) ? to.filter((each) => each !== target) : [...to, target]
}
</script>

<div class="editor" data-testid="field-def-editor">
  <label class="text">
    <span class="label">Id</span>
    <input
      value={field.id}
      onchange={(event) => guard(title, 'Change anyway', () => session.renameField(onText(event).trim()))}
    />
  </label>
  <label class="text">
    <span class="label">Label</span>
    <input
      value={field.label ?? ''}
      onchange={(event) => {
        const label = onText(event).trim()
        const { label: _old, ...rest } = field
        change(label === '' ? rest : { ...field, label })
      }}
    />
  </label>
  <div class="group">
    <span class="label" id="field-type-label">Type <span class="note">changing it checks every value first</span></span>
    <div class="chips" role="radiogroup" aria-labelledby="field-type-label">
      {#each FIELD_TYPES as type (type)}
        <button
          type="button"
          role="radio"
          class="chip"
          aria-checked={field.type === type}
          aria-label={type}
          onclick={() => setType(type)}>{type}</button
        >
      {/each}
    </div>
  </div>
  <div class="chips">
    <button
      type="button"
      class="chip"
      aria-pressed={field.list === true}
      onclick={() => change({ ...field, list: field.list !== true, default: undefined })}>List</button
    >
    <button
      type="button"
      class="chip"
      aria-pressed={field.required === true}
      onclick={() =>
        change(field.required === true ? { ...field, required: false } : { ...field, required: true, default: undefined })}
      >Required</button
    >
    {#if field.type === 'text'}
      <button
        type="button"
        class="chip"
        aria-pressed={field.multiline === true}
        onclick={() => change({ ...field, multiline: field.multiline !== true })}>Multiline</button
      >
    {/if}
  </div>
  {#if numeric}
    <div class="pair">
      <Stepper label="Min" value={field.min ?? 0} onedit={(event) => committed(event) && change({ ...field, min: event.value })} />
      <Stepper label="Max" value={field.max ?? 0} onedit={(event) => committed(event) && change({ ...field, max: event.value })} />
      <Stepper
        label="Step"
        value={field.step ?? 1}
        min={0}
        onedit={(event) => committed(event) && change({ ...field, step: event.value })}
      />
    </div>
  {/if}
  {#if field.type === 'enum'}
    <label class="text">
      <span class="label">Options, one per line</span>
      <textarea
        rows="4"
        value={(field.options ?? []).join('\n')}
        onchange={(event) =>
          change({
            ...field,
            options: onText(event)
              .split('\n')
              .map((option) => option.trim())
              .filter((option) => option !== ''),
          })}
      ></textarea>
    </label>
  {/if}
  {#if field.type === 'ref'}
    <div class="group">
      <span class="label" id="field-to-label">Points at <span class="note">none chosen means any</span></span>
      <div class="chips" role="group" aria-labelledby="field-to-label">
        {#each [...project.defs.entities.map((def) => def.id), '$level'] as target (target)}
          <button
            type="button"
            class="chip"
            aria-pressed={(field.to ?? []).includes(target)}
            onclick={() => change({ ...field, to: toggleTarget(target) })}>{target}</button
          >
        {/each}
      </div>
    </div>
  {/if}
  {#if field.required !== true && field.type !== 'ref'}
    <FieldEditor
      row={{ ...fieldRow(field, field.default ?? defaultFieldValue(field)), label: 'Default' }}
      {palette}
      oncommit={commitDefault}
    />
  {/if}
  <div class="footer">
    <Button
      variant="danger"
      onclick={() =>
        guard(`Delete ${field.id}?`, 'Delete anyway', (anyway) => session.deleteField({ anyway }))}
    >
      Delete field
    </Button>
  </div>
</div>

<style>
  .editor {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-accent-default) 50%, transparent);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
  }
  .text,
  .group {
    display: grid;
    gap: var(--space-1);
  }
  .label {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .note {
    color: var(--color-text-faint, var(--color-text-dim));
    font: var(--text-mono-11);
  }
  input,
  textarea {
    min-height: 44px;
    padding: var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface, var(--color-bg-field));
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .chip {
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .chip[aria-checked='true'],
  .chip[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 70%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .chip:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .pair {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
    gap: var(--space-2);
  }
  .footer {
    display: flex;
  }
  .footer > :global(*) {
    flex: 1 1 0;
  }
</style>
