<!--
  A button that opens the system file picker. It is a `<label>`
  around a file input that is transparent and covers the label, so it stays focusable and a screen reader finds it,
  and a tap opens the picker with no scripted click (iPad Safari allows only that). The input is cleared afterwards, so
  choosing the same file again still fires a change. `directory` picks a whole folder (each file carries its path from
  the folder down); `accept` only hints the picker, since a tablet greys out the types it does not know, and the editor
  decides what it keeps.
-->
<script lang="ts">
import type { PickedFile } from './picked-file'

interface Props {
  label: string
  /** Another action is running: the picker waits. */
  busy: boolean
  multiple?: boolean | undefined
  /** Pick a folder: every file in it, each with its path from the folder's name down. */
  directory?: boolean | undefined
  accept?: string | undefined
  testId?: string | undefined
  onpick: (files: readonly PickedFile[]) => void
}

const { label, busy, multiple = false, directory = false, accept, testId, onpick }: Props = $props()

/** The folder picker is the `webkitdirectory` attribute itself, set where Svelte would set a property no engine has. */
function folderPicker(input: HTMLInputElement): void {
  input.toggleAttribute('webkitdirectory', directory)
}

async function picked(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
  const input = event.currentTarget
  const chosen = [...(input.files ?? [])]
  // Read first, then clear: clearing empties `input.files`.
  const files = await Promise.all(
    chosen.map(async (file) => ({
      name: file.name,
      // No folder picked: the path is the name (an engine without folder picking leaves the field out).
      path: file.webkitRelativePath || file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  )
  input.value = ''
  if (files.length > 0) onpick(files)
}
</script>

<label class="pick" aria-disabled={busy} data-testid={testId}>
  {label}
  <input
    type="file"
    {multiple}
    {@attach folderPicker}
    {accept}
    disabled={busy}
    onchange={picked}
  />
</label>

<style>
  .pick {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--paper);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
  .pick[aria-disabled='true'] {
    opacity: 0.45;
    cursor: default;
  }
  .pick:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  /* Transparent and over the whole label: pressing anywhere on it presses the input itself, which stays focusable,
     announced and a full-size target. */
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  input:disabled {
    cursor: default;
  }
</style>
