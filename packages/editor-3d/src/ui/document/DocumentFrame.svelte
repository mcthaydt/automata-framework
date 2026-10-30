<!--
  Where an opened level goes until the Plan view fills its canvas (ED3D.5d; plan ED3D.5c, decisions 6 to 8). The top
  bar has Back, the level's file, Undo, Redo and Save; the status line shows how the level stands on saving; an autosave
  on offer is asked about first; a save that found the file changed opens the kit's conflict dialog, and one the patch
  refused opens the held Save. Everything it does goes through the document controller, so this file only draws and
  forwards.
-->
<script lang="ts">
import {
  ConflictDialog,
  EditorShell,
  RecoveryDialog,
  StatusLine,
  shellModeOf,
  ToastRegion,
} from '@mcthaydt/automata-editor-kit'
import type { ToastStore } from '@mcthaydt/automata-editor-kit/core'
import type { GeometryState } from '@mcthaydt/automata-ui'
import type { DocumentController, DocumentState } from '../../app/document/document-controller'
import DocumentBar from './DocumentBar.svelte'
import HeldSaveDialog from './HeldSaveDialog.svelte'

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
      profile={view.level.profile.id}
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
    <p class="placeholder">Plan and Dollhouse arrive with ED3D.5d. This level is open and safe.</p>
  {/snippet}

  {#snippet status()}
    <StatusLine save={view.save} />
  {/snippet}

  {#snippet sheets()}
    <RecoveryDialog
      path={view.level.path}
      recovery={view.recovery}
      now={clock.now()}
      busy={view.busy !== undefined}
      onrestore={() => controller.restore()}
      ondiscard={() => controller.discard()}
    />
    <ConflictDialog
      open={view.conflict}
      path={view.level.path}
      busy={view.busy !== undefined}
      onkeep={() => controller.keepMine()}
      ontake={() => controller.takeTheirs()}
      oncopy={() => controller.saveCopy()}
      oncancel={() => controller.dismissConflict()}
    />
    <HeldSaveDialog
      open={view.heldOpen}
      path={view.level.path}
      refused={view.held}
      busy={view.busy !== undefined}
      onreformat={() => controller.saveReformatted()}
      onexport={() => controller.exportCopy()}
      oncancel={() => controller.dismissHeld()}
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
