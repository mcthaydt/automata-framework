<!--
  Where an opened document goes until the Level view fills its canvas (ED2D.4c4a; plans ED2D.4c2a decision 10 and
  ED2D.4c2b decisions 5 to 8). The top bar has Back, the document's title, Undo, Redo and Save; the status line shows
  how the document stands on saving; an autosave on offer is asked about first, and a save that found the file
  changed opens the conflict dialog. Everything it does goes through the document controller, so this file only
  draws and forwards. The canvas edits nothing yet.
-->
<script lang="ts">
import { EditorShell, StatusLine, shellModeOf, ToastRegion } from '@mcthaydt/automata-editor-kit'
import type { ToastStore } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import ConflictDialog from './document/ConflictDialog.svelte'
import DocumentBar from './document/DocumentBar.svelte'
import type { DocumentController, DocumentState } from './document/document-controller'
import RecoveryDialog from './document/RecoveryDialog.svelte'

interface Props {
  geometry: GeometryState
  controller: DocumentController
  toasts: ToastStore
  /** The time an autosave's age is told against. */
  clock: { now(): number }
  onback: () => void
}

const { geometry, controller, toasts, clock, onback }: Props = $props()

/** The controller's state right now (its store answers at once). */
function snapshot(source: DocumentController): DocumentState {
  let current: DocumentState | undefined
  source.state.subscribe((value) => {
    current = value
  })()
  if (current === undefined) throw new Error('the document controller gave no state')
  return current
}

const compact = $derived(shellModeOf(geometry.current.formFactor) === 'compact')

// svelte-ignore state_referenced_locally
let view = $state.raw<DocumentState>(snapshot(controller))
$effect(() => controller.state.subscribe((next) => (view = next)))
</script>

<EditorShell {geometry} testId="document-frame">
  {#snippet topbar()}
    <DocumentBar
      heading={view.heading}
      profileLabel={view.document.profile.label}
      canUndo={view.canUndo}
      canRedo={view.canRedo}
      undoLabel={view.undoLabel}
      redoLabel={view.redoLabel}
      busy={view.busy !== undefined}
      {compact}
      {onback}
      onundo={() => controller.undo()}
      onredo={() => controller.redo()}
      onsave={() => controller.save()}
    />
  {/snippet}

  {#snippet canvas()}
    <p class="placeholder">The editing views arrive with ED2D.4c4. This file is open and safe.</p>
  {/snippet}

  {#snippet status()}
    <StatusLine save={view.save} />
  {/snippet}

  {#snippet sheets()}
    <RecoveryDialog
      path={view.document.path}
      recovery={view.recovery}
      now={clock.now()}
      busy={view.busy !== undefined}
      onrestore={() => controller.restore()}
      ondiscard={() => controller.discard()}
    />
    <ConflictDialog
      open={view.conflict}
      path={view.document.path}
      busy={view.busy !== undefined}
      onkeep={() => controller.keepMine()}
      ontake={() => controller.takeTheirs()}
      oncopy={() => controller.saveCopy()}
      oncancel={() => controller.dismissConflict()}
    />
    <ToastRegion {toasts} />
  {/snippet}
</EditorShell>

<style>
  .placeholder {
    margin: 0;
    padding: var(--space-5);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
