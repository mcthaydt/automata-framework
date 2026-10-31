<!--
  Export and Import (editor suite spec §4.8, §9 `interchange` and `interchange-export`, §11). Export prints the
  listed files as one scene-interchange v2 document, TOML or JSON, in a read-only text to copy. Import takes a pasted
  or chosen document and shows its plan before anything is written: each change with its diff, the gates it reopens
  and the checks it runs, and each refusal with why. Apply is enabled only on an applicable plan and writes it as one
  undo step; a file that moved on since the plan refuses the apply, and Plan again plans afresh.
-->
<script lang="ts">
import { Button, Dialog } from '@mcthaydt/automata-editor-kit'
import type { ImportPlan } from '../core/interchange'
import type { WriteOutcome } from '../core/write-path'
import DiffView from './DiffView.svelte'

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

$effect(() => {
  if (!open || mode !== 'export') return
  const chosen = format
  void onexport(chosen).then(
    (text) => (exported = text),
    (error: unknown) =>
      (exported = `Export failed: ${error instanceof Error ? error.message : String(error)}`),
  )
})

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

async function choose(event: Event): Promise<void> {
  const file = (event.currentTarget as HTMLInputElement).files?.[0]
  if (file !== undefined) source = await file.text()
}

const canApply = $derived(
  plan !== undefined && !('error' in plan) && plan.applicable && !busy && applied === undefined,
)
const refusal = (outcome: ApplyOutcome): string | undefined => {
  if ('written' in outcome || 'cancelled' in outcome) return undefined
  if (outcome.refused === 'moved') return `${outcome.path} changed since the plan.`
  if (outcome.refused === 'plan') return 'This plan cannot apply.'
  if (outcome.refused === 'checks') return outcome.findings.map((finding) => finding.message).join('; ')
  if (outcome.refused === 'policy') return outcome.why
  return outcome.message
}
</script>

<Dialog {open} title={mode === 'export' ? 'Export' : 'Import'} width="wide" onclose={() => onclose()}>
  {#if mode === 'export'}
    <fieldset class="formats">
      <legend>Format</legend>
      <label><input type="radio" bind:group={format} value="toml" /> TOML</label>
      <label><input type="radio" bind:group={format} value="json" /> JSON</label>
    </fieldset>
    <label for={`${uid}-out`}>Exported document</label>
    <textarea id={`${uid}-out`} readonly rows="12" value={exported}></textarea>
  {:else}
    <label for={`${uid}-in`}>Document to import</label>
    <textarea id={`${uid}-in`} rows="6" bind:value={source} disabled={busy}></textarea>
    <label class="file">Or choose a file <input type="file" accept=".toml,.json" onchange={(event) => void choose(event)} /></label>

    {#if plan !== undefined && 'error' in plan}
      <p class="bad" role="alert">{plan.error}</p>
    {:else if plan !== undefined}
      {#if plan.changes.length === 0 && plan.refused.length === 0}
        <p class="note">Nothing to change: the document matches the files.</p>
      {/if}
      {#each plan.changes as change (change.path)}
        <figure>
          <figcaption><code>{change.path}</code>{change.before === undefined ? ' (new)' : ''}</figcaption>
          <DiffView hunks={change.hunks} />
          <p class="note">{change.gates.length === 0 ? 'No gates' : `Reopens ${change.gates.join(', ')}`}</p>
          <p class="note">{`Checks: ${change.checks.join(', ')}`}</p>
        </figure>
      {/each}
      {#if plan.refused.length > 0}
        <h3>Refused</h3>
        <ul>
          {#each plan.refused as refused, index (index)}<li>{`${refused.path ?? refused.editor}: ${refused.why}`}</li>{/each}
        </ul>
      {/if}
    {/if}
    {#if applied !== undefined}
      {@const why = refusal(applied)}
      {#if why === undefined}
        <p class="note" role="status">
          {'cancelled' in applied ? 'Nothing was imported: no change set was started.' : 'Imported as one step; Undo takes it back.'}
        </p>
      {:else}
        <p class="bad" role="alert">{why}</p>
      {/if}
    {/if}
  {/if}
  {#snippet actions()}
    <Button onclick={() => onclose()}>Close</Button>
    {#if mode === 'import'}
      {#if applied !== undefined && 'refused' in applied && applied.refused === 'moved'}
        <Button onclick={() => void makePlan()}>Plan again</Button>
      {:else}
        <Button disabled={busy || source.trim() === ''} onclick={() => void makePlan()}>Plan</Button>
      {/if}
      <Button variant="primary" disabled={!canApply} onclick={() => void apply()}>Apply</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  label {
    display: block;
    margin-top: var(--space-2);
  }
  .formats {
    display: flex;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .formats label {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 44px;
    margin: 0;
  }
  .formats input {
    width: 20px;
    height: 20px;
  }
  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-mono-12);
    resize: vertical;
  }
  .file {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    min-height: 44px;
  }
  figure {
    margin: var(--space-3) 0 0;
  }
  code {
    overflow-wrap: anywhere;
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
    color: var(--color-text-dim);
  }
  .bad {
    color: var(--color-state-bad);
  }
</style>
