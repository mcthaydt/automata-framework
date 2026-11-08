<!--
  The Checks view (plan ED2D.7a step 5; 2D editor spec §8, the Checks row): every finding of the profile, grouped
  Errors, Warnings, Info with counts, each with the object it names, Locate (when the screen can locate) and the
  repair the finding names. A repair is one undo step through `commitEdit`; a refusal (a stale finding) shows as the
  view's message and adds no step. The list is recomputed from the history after every edit, undo included.
-->
<script lang="ts">
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import Button from '../../shared/kit/widgets/Button.svelte'
import { commitEdit } from '../../shared/level-2d/editor/field-commit'
import type { Diagnostic, TargetChoice } from '../../shared/level-2d/profiles/profile'
import type { ViewProps } from '../../shared/level-2d/session/view-props'
import { checkGroups, fixLabel, objectLabel } from './checks-model'
import TargetDialog from './TargetDialog.svelte'

const { geometry, document: opened, frame, services }: ViewProps = $props()

// svelte-ignore state_referenced_locally
let value = $state.raw<unknown>(opened.history.state)
$effect(() => opened.history.subscribe((history) => (value = history.state)))

const groups = $derived(checkGroups(opened.profile.check(value, {})))
let message = $state<string | undefined>()
let picking = $state<Diagnostic | undefined>()
let picker = $state(false)
const choices = $derived(picking === undefined ? [] : (opened.profile.choices?.(value, picking) ?? []))

/** A repair shows only when the profile can carry it out. */
function canFix(finding: Diagnostic): boolean {
  if (finding.fix === undefined) return false
  return finding.fix === 'choose-target'
    ? opened.profile.choices !== undefined && opened.profile.choose !== undefined
    : opened.profile.fix !== undefined
}

function repair(finding: Diagnostic): void {
  const { fix } = opened.profile
  if (finding.fix === 'choose-target') {
    picking = finding
    picker = true
    return
  }
  if (fix === undefined) return
  const result = commitEdit(opened.history, fixLabel(finding) ?? 'Fix', (current) =>
    fix(current, finding, {}),
  )
  message = result.ok ? undefined : result.message
}

function choose(choice: TargetChoice): void {
  const { choose: pointAt } = opened.profile
  const finding = picking
  if (pointAt === undefined || finding === undefined) return
  const result = commitEdit(opened.history, 'Choose target', (current) => pointAt(current, finding, choice))
  message = result.ok ? undefined : result.message
}
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  testId="checks-view"
>
  {#snippet canvas()}
    <div class="checks" data-scroll-region>
      {#if message !== undefined}
        <p class="message" role="alert">{message}</p>
      {/if}
      {#if groups.length === 0}
        <p class="empty" role="status">No problems</p>
      {/if}
      {#each groups as group (group.severity)}
        {@const heading = `checks-${group.severity}`}
        <section aria-labelledby={heading} data-severity={group.severity}>
          <h2 id={heading}>{group.label}</h2>
          <ul>
            {#each group.rows as finding (finding.code + finding.path + finding.message)}
              <li class="row">
                <div class="text">
                  <span class="object">{objectLabel(finding.path)}</span>
                  <span class="what">{finding.message}</span>
                </div>
                <div class="actions">
                  {#if services.locate !== undefined}
                    {@const locate = services.locate}
                    <Button onclick={() => locate(finding.path)}>Locate</Button>
                  {/if}
                  {#if canFix(finding)}
                    <Button variant="primary" onclick={() => repair(finding)}>{fixLabel(finding)}</Button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
    <TargetDialog
      bind:open={picker}
      name={picking === undefined ? '' : objectLabel(picking.path)}
      {choices}
      onchoose={choose}
    />
  {/snippet}
</EditorShell>

<style>
  .checks {
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-4);
    overflow-y: auto;
  }
  .empty,
  .message {
    margin: 0 0 var(--space-3);
    font: var(--text-body-13);
  }
  .empty {
    color: var(--color-text-dim);
  }
  .message {
    color: var(--color-state-bad);
  }
  section + section {
    margin-top: var(--space-4);
  }
  h2 {
    margin: 0 0 var(--space-2);
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  [data-severity='error'] h2 {
    color: var(--color-state-bad);
  }
  [data-severity='warning'] h2 {
    color: var(--color-state-warn);
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-raised);
  }
  .text {
    display: grid;
    flex: 1 1 16rem;
    gap: var(--space-1);
    min-width: 0;
  }
  .object {
    color: var(--color-text-primary);
    font: var(--text-label-12);
  }
  .what {
    color: var(--color-text-dim);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
