<!--
  The Tilesets view's inspector: tabs Rule and Group.
  Rule: on or off, what it looks at, the pattern editor with the kind of tile its cycle uses, the tiles it draws (each
  removable; "Draw the tiles I picked" takes the sheet's selection), how often, the three switches (`rule-words.ts`),
  what is read beyond the level edge, Duplicate and Delete. Group: its name, on or off, Delete group. Each change is one undo step;
  a refusal shows its message and changes nothing.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Picker from '../../shared/kit/widgets/Picker.svelte'
import Segmented from '../../shared/kit/widgets/Segmented.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'
import Tabs from '../../shared/kit/widgets/Tabs.svelte'
import type { FieldCommit } from '../../shared/level-2d/model/field-commit'
import type { Project } from '../../shared/level-2d/model/project-types'
import { spriteStyle } from '../../shared/level-2d/tiles/tile-sprite'
import PatternEditor from './PatternEditor.svelte'
import { FLAG_WORDS, ruleTitle } from './rule-words'
import { autoLayersOf, type ResolvedSelection, ruleInspector } from './tilesets-model'
import type { TilesetsSession } from './tilesets-session'

interface Props {
  project: Project
  selection: ResolvedSelection
  session: TilesetsSession
  images: ReadonlySet<string>
  imageUrl: (path: string) => string | undefined
}

const { project, selection, session, images, imageUrl }: Props = $props()

const OUTPUT = 42
const inspector = $derived(
  selection.layer === undefined || selection.rule === undefined
    ? undefined
    : ruleInspector(project, selection.layer, selection.rule, images),
)
const group = $derived(
  autoLayersOf(project)
    .find((def) => def.id === selection.layer)
    ?.groups.find((each) => each.id === selection.group),
)
let tab = $state('rule')
let message = $state<string | undefined>()
/** Bumped after a refusal so the stepper shows the stored value again. */
let revision = $state(0)

function show(result: FieldCommit): void {
  message = result.ok ? undefined : result.message
  if (!result.ok) revision++
}

const flags = [
  { key: 'flipX', label: FLAG_WORDS.flipX },
  { key: 'flipY', label: FLAG_WORDS.flipY },
  { key: 'breakOnMatch', label: FLAG_WORDS.breakOnMatch },
] as const

function rename(event: Event): void {
  const box = event.currentTarget as HTMLInputElement
  const label = box.value.trim()
  if (label === '' || label === group?.label) {
    box.value = group?.label ?? ''
    return
  }
  show(session.editGroup({ label }))
}
</script>

<section class="inspector" aria-label="Inspector" data-testid="tilesets-inspector">
  <Tabs
    label="Inspector"
    tabs={[
      { id: 'rule', label: 'Rule' },
      { id: 'group', label: 'Group' },
    ]}
    value={tab}
    onselect={(id) => (tab = id)}
  >
    {#snippet panel(id)}
      {#if id === 'rule'}
        {#if inspector === undefined}
          <p class="empty">Choose a rule, or add one to this group.</p>
        {:else}
          {@const rule = inspector.rule}
          <div class="fields">
            <div class="title">
              <h2>{ruleTitle(rule.id)}</h2>
              <button
                type="button"
                class="toggle"
                aria-pressed={rule.active}
                onclick={() => show(session.setRule({ active: !rule.active }))}>{rule.active ? 'On' : 'Off'}</button
              >
            </div>
            <Segmented
              label="Looks at"
              options={[
                { id: '1', label: 'This tile' },
                { id: '3', label: 'Next to it' },
                { id: '5', label: 'Further out' },
              ]}
              value={String(rule.size)}
              onedit={(event) => show(session.resize(Number(event.value) as 1 | 3 | 5))}
            />
            <PatternEditor size={rule.size} cells={inspector.cells} oncycle={(index) => show(session.cycleCell(index))} />
            <p class="hint">Tap a square to say what has to be there: anything, nothing, something, only one kind, or anything but one kind. The outlined square is the tile being drawn.</p>
            {#if inspector.values.length > 0}
              <div class="values" role="radiogroup" aria-label="Which kind of tile">
                {#each inspector.values as value (value.value)}
                  <button
                    type="button"
                    role="radio"
                    class="value"
                    aria-checked={value.value === selection.value}
                    onclick={() => session.select({ value: value.value })}
                  >
                    <span class="swatch" style:background-color={value.color}></span>{value.label}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="outputs" role="group" aria-label="Tiles it draws">
              <span class="label">Tiles it draws</span>
              {#each inspector.outputs as output, at (at)}
                <button
                  type="button"
                  class="output"
                  aria-label={`Remove ${output.label}`}
                  style={spriteStyle(output, output.image === undefined ? undefined : imageUrl(output.image.path), OUTPUT)}
                  onclick={() => show(session.removeOutput(at))}
                  >{output.image !== undefined && imageUrl(output.image.path) !== undefined ? '' : output.tile}</button
                >
              {/each}
              {#if inspector.outputs.length === 0}
                <span class="hint">No tiles picked yet, so it draws nothing.</span>
              {/if}
            </div>
            {#if selection.tileset !== inspector.tileset}
              <p class="hint">Pick this layer’s tiles from its picture.</p>
            {:else}
              <Button disabled={selection.tiles.length === 0} onclick={() => show(session.addOutputs())}
                >Draw the tiles I picked{selection.tiles.length === 0 ? '' : ` (${selection.tiles.length})`}</Button
              >
            {/if}

            {#key revision}
              <Stepper
                label="How often"
                value={inspector.chance}
                min={0}
                max={100}
                unit="%"
                onedit={(event) => {
                  if (event.phase === 'set' || event.phase === 'commit') show(session.setChance(event.value))
                }}
              />
            {/key}
            <div class="flags" role="group" aria-label="More choices">
              {#each flags as flag (flag.key)}
                <button
                  type="button"
                  class="toggle"
                  aria-pressed={rule[flag.key]}
                  onclick={() => show(session.setRule({ [flag.key]: !rule[flag.key] }))}>{flag.label}</button
                >
              {/each}
            </div>
            <Picker
              label="Beyond the edge of the level"
              options={inspector.outsideOptions}
              value={inspector.outside}
              onpick={(choice) => show(session.setOutside(choice))}
            />
            {#if message !== undefined}
              <p class="message" role="alert">{message}</p>
            {/if}
          </div>
          <div class="footer">
            <Button onclick={() => show(session.duplicateRule())}>Duplicate</Button>
            <Button variant="danger" onclick={() => show(session.deleteRule())}>Delete</Button>
          </div>
        {/if}
      {:else if group === undefined}
        <p class="empty">This layer has no rule groups yet.</p>
      {:else}
        <div class="fields">
          <label class="outside">
            <span class="label">Group name</span>
            {#key group.label}
              <input
                type="text"
                value={group.label}
                onchange={rename}
                onkeydown={(event) => {
                  if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
                }}
              />
            {/key}
          </label>
          <button
            type="button"
            class="toggle"
            aria-pressed={group.active}
            onclick={() => show(session.editGroup({ active: !group.active }))}
            >{group.active ? 'Group on' : 'Group off'}</button
          >
          <p class="hint">{group.rules.length} rules. Groups run in order; a rule that breaks ends its cell.</p>
          {#if message !== undefined}
            <p class="message" role="alert">{message}</p>
          {/if}
        </div>
        <div class="footer">
          <Button onclick={() => show(session.addRule())}>Add rule</Button>
          <Button variant="danger" onclick={() => show(session.deleteGroup())}>Delete group</Button>
        </div>
      {/if}
    {/snippet}
  </Tabs>
</section>

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
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  h2 {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font: var(--text-title-15);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label,
  .hint {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
  .hint,
  .empty,
  .message {
    margin: 0;
  }
  .empty {
    padding: var(--space-3);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .message {
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
  .values,
  .flags,
  .outputs,
  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .footer {
    padding: 0 var(--space-3) var(--space-3);
  }
  .footer > :global(*) {
    flex: 1 1 0;
  }
  .toggle,
  .value {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: var(--size-hit);
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--color-text-dim);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .toggle[aria-pressed='true'],
  .value[aria-checked='true'] {
    border-color: color-mix(in srgb, var(--color-accent-default) 70%, transparent);
    background: var(--color-accent-soft);
    color: var(--color-accent-default);
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: var(--edge-sm);
  }
  .output {
    width: var(--size-hit);
    height: var(--size-hit);
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background-repeat: no-repeat;
    image-rendering: pixelated;
    color: var(--color-text-primary);
    font: var(--text-label-12);
    cursor: pointer;
  }
  .toggle:focus-visible,
  .value:focus-visible,
  .output:focus-visible {
    outline: 2px solid var(--color-accent-default);
    outline-offset: 2px;
  }
  .outside {
    display: grid;
    gap: var(--space-1);
  }
  input {
    min-height: var(--size-hit);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
