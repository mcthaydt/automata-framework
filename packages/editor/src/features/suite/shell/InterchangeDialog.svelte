<!--
  Export and Import. Export prints the
  listed files as one scene-interchange v2 document, TOML or JSON, in a read-only text; Copy, its one primary, puts it
  on the clipboard. Import takes a pasted or chosen document and shows what it would change before anything is
  written ("See changes"): each file by its name in words with its diff, the reviews it reopens, and each refusal with
  why. Import is enabled only on an applicable plan and writes it as one undo step; a file that moved on since refuses
  it, and "See changes again" plans afresh. One primary at a time: See changes until there is a plan, then Import.
-->
<script lang="ts">
import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import Segmented from '../../../shared/kit/widgets/Segmented.svelte'
import type { ImportPlan } from '../core/interchange'
import DiffView from './DiffView.svelte'
import { fileTitle } from './home-model'

type ApplyOutcome = WriteOutcome | { readonly refused: 'plan' }

interface Props {
  open: boolean
  mode: 'export' | 'import'
  onexport: (format: 'toml' | 'json') => Promise<string>
  onplan: (text: string) => Promise<ImportPlan>
  onapply: (plan: ImportPlan) => Promise<ApplyOutcome>
  onclose: () => void
}

const { open, mode, onexport, onplan, onapply, onclose }: Props = $props()

const uid = $props.id()
let format = $state<'toml' | 'json'>('toml')
let exported = $state('')
let source = $state('')
let plan = $state<ImportPlan>()
let applied = $state<ApplyOutcome>()
let busy = $state(false)
let copied = $state<'yes' | 'no'>()

$effect(() => {
  if (!open || mode !== 'export') return
  const chosen = format
  copied = undefined
  void onexport(chosen).then(
    (text) => (exported = text),
    (error: unknown) =>
      (exported = `Export failed: ${error instanceof Error ? error.message : String(error)}`),
  )
})

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exported)
    copied = 'yes'
  } catch {
    copied = 'no'
  }
}

async function makePlan(): Promise<void> {
  busy = true
  applied = undefined
  plan = await onplan(source)
  busy = false
}

async function apply(): Promise<void> {
  if (plan === undefined) return
  busy = true
  applied = await onapply(plan)
  busy = false
}

let chooser = $state<HTMLInputElement>()

async function choose(event: Event): Promise<void> {
  const file = (event.currentTarget as HTMLInputElement).files?.[0]
  if (file !== undefined) source = await file.text()
}

const canApply = $derived(
  plan !== undefined && !('error' in plan) && plan.applicable && !busy && applied === undefined,
)
const refusal = (outcome: ApplyOutcome): string | undefined => {
  if ('written' in outcome || 'cancelled' in outcome) return undefined
  if (outcome.refused === 'moved')
    return `${fileTitle(outcome.path)} changed since you looked. See the changes again.`
  if (outcome.refused === 'plan') return 'These changes can’t be imported.'
  if (outcome.refused === 'checks') return outcome.findings.map((finding) => finding.message).join('; ')
  if (outcome.refused === 'policy') return outcome.why
  return outcome.message
}
</script>

<Dialog {open} title={mode === 'export' ? 'Export' : 'Import'} width="wide" onclose={() => onclose()}>
  {#if mode === 'export'}
    <Segmented
      label="Format"
      options={[
        { id: 'toml', label: 'TOML' },
        { id: 'json', label: 'JSON' },
      ]}
      value={format}
      onedit={(event) => (format = event.value === 'json' ? 'json' : 'toml')}
    />
    <label for={`${uid}-out`}>Your game as text</label>
    <textarea id={`${uid}-out`} readonly rows="12" value={exported}></textarea>
    {#if copied !== undefined}
      <p class={copied === 'yes' ? 'note' : 'bad'} role="status">
        {copied === 'yes' ? 'Copied. Paste it anywhere to keep it.' : 'Couldn’t copy. Select the text and copy it.'}
      </p>
    {/if}
  {:else}
    <label for={`${uid}-in`}>Paste the text to import</label>
    <textarea id={`${uid}-in`} rows="6" bind:value={source} disabled={busy}></textarea>
    <!-- The browser's own file control is under 44 px and cannot be sized: a kit button opens it instead. -->
    <div class="file">
      <span>Or</span>
      <Button disabled={busy} onclick={() => chooser?.click()}>Choose a file</Button>
      <input bind:this={chooser} class="hidden" type="file" accept=".toml,.json" tabindex="-1" aria-hidden="true" onchange={(event) => void choose(event)} />
    </div>

    {#if plan !== undefined && 'error' in plan}
      <p class="bad" role="alert">{plan.error}</p>
    {:else if plan !== undefined}
      {#if plan.changes.length === 0 && plan.refused.length === 0}
        <p class="note">Nothing to change: the document matches the files.</p>
      {/if}
      {#each plan.changes as change (change.path)}
        <figure>
          <figcaption>{fileTitle(change.path)}{change.before === undefined ? ' (new)' : ''}</figcaption>
          <DiffView hunks={change.hunks} />
          {#if change.gates.length > 0}<p class="note">{`Needs review again: ${change.gates.join(', ')}`}</p>{/if}
        </figure>
      {/each}
      {#if plan.refused.length > 0}
        <h3>Can’t import</h3>
        <ul>
          {#each plan.refused as refused, index (index)}<li>{`${refused.path ?? refused.editor}: ${refused.why}`}</li>{/each}
        </ul>
      {/if}
    {/if}
    {#if applied !== undefined}
      {@const why = refusal(applied)}
      {#if why === undefined}
        <p class="note" role="status">
          {'cancelled' in applied ? 'Nothing was imported.' : 'Imported. Undo takes it back.'}
        </p>
      {:else}
        <p class="bad" role="alert">{why}</p>
      {/if}
    {/if}
  {/if}
  {#snippet actions()}
    <Button onclick={() => onclose()}>Close</Button>
    {#if mode === 'export'}
      <Button variant="primary" disabled={exported === ''} onclick={() => void copy()}>Copy</Button>
    {:else}
      <!-- The primary is the next step: See changes until there is a plan to import, then Import. -->
      {#if applied !== undefined && 'refused' in applied && applied.refused === 'moved'}
        <Button variant="primary" onclick={() => void makePlan()}>See changes again</Button>
      {:else}
        <Button
          variant={plan === undefined ? 'primary' : 'plain'}
          disabled={busy || source.trim() === ''}
          onclick={() => void makePlan()}>See changes</Button
        >
      {/if}
      {#if plan !== undefined}
        <Button variant="primary" disabled={!canApply} onclick={() => void apply()}>Import</Button>
      {/if}
    {/if}
  {/snippet}
</Dialog>

<style>
  label {
    display: block;
    margin-top: var(--space-3);
    margin-bottom: var(--space-1);
    color: var(--muted);
    font: var(--text-label-12);
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-mono-12);
    resize: vertical;
  }
  .file {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-top: var(--space-2);
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  figure {
    margin: var(--space-3) 0 0;
  }
  figcaption {
    margin-bottom: var(--space-1);
    font: var(--text-body-13-medium);
  }
  h3 {
    margin: var(--space-3) 0 0;
    font: var(--text-eyebrow-11);
  }
  ul {
    margin: 0;
    padding-left: var(--space-5);
  }
  .note,
  .bad {
    margin: var(--space-1) 0 0;
  }
  .note {
    color: var(--muted);
  }
  .bad {
    color: var(--color-state-bad);
  }
</style>
