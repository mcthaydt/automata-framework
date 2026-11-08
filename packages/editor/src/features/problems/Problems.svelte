<!--
  Problems, in the top bar: a button that says how many there are ("2 problems") and opens a sheet that lists them.
  With none the button is not there: a level with nothing wrong shows nothing about it. The sheet groups the
  findings (Needs fixing, Worth a look; notes are left out), names what each is about, and offers Show, which closes the
  sheet and opens the level on it, and the repair the finding names. A repair is one undo step through `commitEdit`;
  a refusal (a stale finding) shows in the sheet and adds no step. The list follows the history, undo included.
  It replaces the old Checks view.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import type { OpenDocument } from '../../shared/level-2d/documents/editor-app'
import { commitEdit } from '../../shared/level-2d/model/field-commit'
import type { Diagnostic, TargetChoice } from '../../shared/level-2d/profiles/profile'
import { checkGroups, fixLabel, objectLabel } from './checks-model'
import TargetDialog from './TargetDialog.svelte'

interface Props {
  document: OpenDocument
  /** Opens the level on what a finding's path names. */
  onshow: (path: string) => void
}

const { document: opened, onshow }: Props = $props()

// svelte-ignore state_referenced_locally
let value = $state.raw<unknown>(opened.history.state)
$effect(() => opened.history.subscribe((history) => (value = history.state)))

// Notes ("has nothing in it yet", "not used anywhere") are not problems: a fresh template has them, and a level that
// needs nothing should show nothing. The sheet lists what needs fixing and what is worth a look.
const found = $derived(opened.profile.check(value, {}).filter((finding) => finding.severity !== 'info'))
const groups = $derived(checkGroups(found))
const count = $derived(found.length)

let open = $state(false)
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

function show(path: string): void {
  open = false
  onshow(path)
}
</script>

{#if count > 0}
  <IconButton
    icon="alert"
    label={`${count} ${count === 1 ? 'problem' : 'problems'}`}
    showLabel
    data-testid="problems"
    onclick={() => {
      message = undefined
      open = true
    }}
  />
{/if}

<Dialog bind:open title="Problems" width="wide">
  <div class="problems" data-scroll-region>
    {#if message !== undefined}
      <p class="message" role="alert">{message}</p>
    {/if}
    {#if groups.length === 0}
      <p class="empty" role="status">Nothing to fix.</p>
    {/if}
    {#each groups as group (group.severity)}
      {@const heading = `problems-${group.severity}`}
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
                <Button onclick={() => show(finding.path)}>Show</Button>
                {#if canFix(finding)}
                  <Button onclick={() => repair(finding)}>{fixLabel(finding)}</Button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  {#snippet actions({ close })}
    <Button onclick={close}>Done</Button>
  {/snippet}
</Dialog>
<TargetDialog
  bind:open={picker}
  name={picking === undefined ? '' : objectLabel(picking.path)}
  {choices}
  onchoose={choose}
/>

<style>
  .problems {
    max-height: min(60vh, 32rem);
    overflow-y: auto;
  }
  .empty,
  .message {
    margin: 0 0 var(--space-3);
    font: var(--text-body-13);
  }
  .empty {
    color: var(--muted);
  }
  .message {
    color: var(--bad);
  }
  section + section {
    margin-top: var(--space-4);
  }
  h2 {
    margin: 0 0 var(--space-2);
    color: var(--ink);
    font: var(--text-title-15);
  }
  [data-severity='error'] h2 {
    color: var(--bad);
  }
  [data-severity='warning'] h2 {
    color: var(--warn);
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
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--surface);
  }
  .text {
    display: grid;
    flex: 1 1 14rem;
    gap: var(--space-1);
    min-width: 0;
  }
  .object {
    color: var(--ink);
    font: var(--text-label-12);
  }
  .what {
    color: var(--muted);
    font: var(--text-body-13);
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
