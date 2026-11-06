<!--
  The Export view: the profile's
  targets as checkable cards with their sizes, the files they make, the error count, and Download (primary), Share,
  Copy and Write to folder. Errors never stop a download, a share or a copy; only writing into a game folder waits until
  Checks is clear. The list is recomputed from the history after every edit, so an export is always of the
  latest state. A folder write re-checks every file it listed first and, if one changed, asks before writing
  anything (G-m). Where the device keeps no copy, exporting the working file is the save, so it marks the document
  clean (decision 3).
-->
<script lang="ts">
import EditorShell from '../../shared/kit/shell/EditorShell.svelte'
import { type Seen, seenFiles, writeToFolder } from '../../shared/kit/storage/write-folder'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { ViewProps } from '../document/view-props'
import { exportState, exportTargets, sizeLabel } from './export-model'

const { geometry, document: opened, frame, services }: ViewProps = $props()

// svelte-ignore state_referenced_locally
let value = $state.raw<unknown>(opened.history.state)
$effect(() => opened.history.subscribe((history) => (value = history.state)))

const targets = $derived(exportTargets(opened.profile, value, opened.base()))
// svelte-ignore state_referenced_locally
let chosen = $state.raw<ReadonlySet<string>>(new Set(opened.profile.exports.map((target) => target.id)))
const errors = $derived(
  opened.profile.check(value, {}).filter((finding) => finding.severity === 'error').length,
)
const workspace = $derived(services.workspace)
const current = $derived(
  exportState(targets, chosen, errors, {
    kind: workspace?.store.kind ?? 'memory',
    persistent: workspace?.persistent ?? true,
  }),
)
const working = $derived(opened.profile.exports[0]?.id)

let message = $state<string | undefined>()
let problem = $state<string | undefined>()
let busy = $state(false)
let conflict = $state<string | undefined>()

// Each file's version when the list was made, so a folder write can tell what changed since. A newer list wins.
let seen = $state.raw<ReadonlyMap<string, Seen> | undefined>()
let listing = 0
$effect(() => {
  const store = workspace?.store
  const paths = current.files.map((file) => file.path)
  seen = undefined
  if (store === undefined || !current.write.ok) return
  const ticket = ++listing
  void seenFiles(store, paths).then((versions) => {
    if (ticket === listing) seen = versions
  })
})

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

function toggle(id: string): void {
  const next = new Set(chosen)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  chosen = next
}

/** Where Export is the save (no copy on the device), exporting the working file makes the document clean. */
function exported(): void {
  if (workspace?.persistent === false && working !== undefined && chosen.has(working))
    opened.history.markClean()
}

async function run(action: () => Promise<string | undefined>): Promise<void> {
  busy = true
  message = undefined
  problem = undefined
  try {
    message = await action()
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error)
  } finally {
    busy = false
  }
}

const download = () =>
  run(async () => {
    const exports = workspace?.exports
    if (exports === undefined) return undefined
    const files = current.files
    for (const file of files) {
      const result = await exports.write(file.path, file.contents)
      if (!result.ok) throw new Error(`Download stopped at ${file.path}: ${result.message}`)
    }
    exported()
    return `Downloaded ${plural(files.length, 'file')}.`
  })

const share = () =>
  run(async () => {
    const file = current.single
    if (workspace === undefined || file === undefined) return undefined
    const result = await workspace.exports.share(file.path, file.contents)
    if (!result.ok) return result.message
    exported()
    return `Shared ${file.path}.`
  })

const copy = () =>
  run(async () => {
    const file = current.single
    if (workspace === undefined || file === undefined) return undefined
    const result = await workspace.exports.copyText(file.contents)
    if (!result.ok) throw new Error(result.message)
    exported()
    return `Copied ${file.path}.`
  })

const write = (mode: 'guarded' | 'overwrite') =>
  run(async () => {
    const store = workspace?.store
    if (store === undefined || seen === undefined) return undefined
    const files = current.files
    const result = await writeToFolder(store, files, seen, mode)
    if ('conflict' in result) {
      conflict = result.conflict
      return undefined
    }
    if ('failed' in result) throw new Error(`Writing stopped at ${result.failed}: ${result.message}`)
    seen = await seenFiles(
      store,
      files.map((file) => file.path),
    )
    return `Wrote ${plural(result.written, 'file')}.`
  })
</script>

<EditorShell
  {geometry}
  topbar={frame.topbar}
  rail={frame.rail}
  status={frame.status}
  sheets={frame.sheets}
  testId="export-view"
>
  {#snippet canvas()}
    <div class="export">
        <div class="body" data-scroll-region>
        <h1>Export</h1>
        <fieldset>
          <legend>What to export</legend>
          {#each targets as target (target.id)}
            <label class="target" data-chosen={chosen.has(target.id)}>
              <input type="checkbox" checked={chosen.has(target.id)} onchange={() => toggle(target.id)} />
              <span class="name">{target.label}</span>
              <span class="size">{sizeLabel(target.bytes)}</span>
            </label>
          {/each}
        </fieldset>

        <p class="summary">{`${plural(current.files.length, 'file')} · ${sizeLabel(current.bytes)}`}</p>
        <ul class="files" aria-label="Files">
          {#each current.files as file (file.path)}
            <li><span class="path" data-path>{file.path}</span><span class="size">{sizeLabel(file.bytes)}</span></li>
          {/each}
        </ul>

        {#if errors > 0}
          <div class="callout">
            <strong>{plural(errors, 'error')}</strong>
            <span>The game may reject them. You can still export; writing into a folder waits until Checks is clear.</span>
          </div>
        {/if}
      </div>
      <div class="foot">
        <div class="actions">
          <Button variant="primary" disabled={busy || !current.download || workspace === undefined} onclick={download}>
            Download
          </Button>
          <Button
            disabled={busy || current.single === undefined || workspace?.exports.canShare !== true}
            onclick={share}>Share</Button
          >
          <Button disabled={busy || current.single === undefined || workspace === undefined} onclick={copy}>Copy</Button>
          <Button disabled={busy || !current.write.ok || seen === undefined} onclick={() => write('guarded')}>
            Write to folder
          </Button>
        </div>
        {#if current.files.length > 1}
          <p class="note">Share and Copy take one file; Download takes them all.</p>
        {/if}
        {#if !current.write.ok}
          <p class="note">{current.write.why}</p>
        {/if}
        {#if message !== undefined}
          <p class="message" role="status">{message}</p>
        {/if}
        {#if problem !== undefined}
          <p class="problem" role="alert">{problem}</p>
        {/if}
      </div>
    </div>
    <Dialog
      open={conflict !== undefined}
      title={`${conflict ?? ''} changed since the list was made`}
      onclose={() => (conflict = undefined)}
    >
      <p>Something else wrote it after the files were listed. Nothing was written. Keep mine writes every file over it.</p>
      {#snippet actions({ close })}
        <Button onclick={close}>Cancel</Button>
        <Button
          variant="danger"
          onclick={() => {
            close()
            void write('overwrite')
          }}>Keep mine</Button
        >
      {/snippet}
    </Dialog>
  {/snippet}
</EditorShell>

<style>
  /* The files scroll in their own region; the actions stay in view at the foot at every height. */
  .export {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
  }
  .body {
    display: grid;
    align-content: start;
    gap: var(--space-3);
    min-height: 0;
    padding: var(--space-4);
    overflow-y: auto;
  }
  .body > *,
  .foot > * {
    max-width: 40rem;
  }
  .foot {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border-default);
    background: var(--color-bg-app);
  }
  h1 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  fieldset {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-2);
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
  }
  .target {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    min-height: 48px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    cursor: pointer;
  }
  .target[data-chosen='true'] {
    border-color: var(--color-accent-default);
  }
  .target input {
    width: 24px;
    height: 24px;
    margin: 0;
  }
  .name {
    flex: 1;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .size,
  .summary,
  .note {
    color: var(--color-text-dim);
    font: var(--text-mono-12);
  }
  .summary,
  .note,
  .message,
  .problem {
    margin: 0;
  }
  .files {
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    background: var(--color-bg-field);
    list-style: none;
  }
  .files li {
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
    padding: var(--space-1) 0;
  }
  .path {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--color-text-primary);
    font: var(--text-mono-12);
  }
  .callout {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-state-warn);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .callout strong {
    color: var(--color-state-warn);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .message {
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .problem {
    color: var(--color-state-bad);
    font: var(--text-body-13);
  }
</style>
