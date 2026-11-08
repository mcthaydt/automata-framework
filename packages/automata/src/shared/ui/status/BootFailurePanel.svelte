<!--
  @component
  The state a boot failure draws: an ErrorPanel with the
  failure's copy and its ways forward. The runtime passes its `BootError` and the handlers; this
  component decides nothing beyond `bootFailureView`.
-->
<script lang="ts">
import {
  BOOT_FAILURE_COPY_EN,
  type BootFailure,
  type BootFailureAction,
  type BootFailureCopy,
  bootFailureView,
  type HostKind,
  withFileName,
  withHostName,
} from './boot-failure'
import ErrorPanel from './ErrorPanel.svelte'
import type { ErrorAction } from './error-panel'

interface Props {
  failure: BootFailure
  hostKind: HostKind
  /** `Hosting.hostName` ('Ruken', 'itch.io' …): fills "Back to {host}". */
  hostName: string
  /** Whether the host granted `exit`. Without it "Back to …" is never drawn. */
  canExit: boolean
  /** The game's copy, merged over the English defaults. */
  copy?: Partial<BootFailureCopy> | undefined
  onRetry: () => void
  /** Required where Continue can appear (standalone). */
  onContinue?: (() => void) | undefined
  onExit: () => void
}

const { failure, hostKind, hostName, canExit, copy = {}, onRetry, onContinue, onExit }: Props = $props()

const words = $derived({ ...BOOT_FAILURE_COPY_EN, ...copy })
const view = $derived(bootFailureView(failure, hostKind, canExit))
// A failure that names a file (a damaged 3D model) fills the copy's `{file}` slot.
const message = $derived(
  failure._tag === 'ModelInvalid' ? withFileName(words[view.state], failure.file) : words[view.state],
)

const handlerFor = (action: BootFailureAction): (() => void) =>
  action === 'retry' ? onRetry : action === 'exit' ? onExit : (onContinue ?? onExit)

const actions = $derived<ErrorAction[]>(
  view.actions.map((action, index) => ({
    id: action,
    label: action === 'exit' && hostKind === 'tauri' ? words.quit : withHostName(words[action], hostName),
    kind: index === 0 ? 'primary' : 'secondary',
    onSelect: handlerFor(action),
  })),
)
</script>

<ErrorPanel code={view.state} message={message} {actions} final={view.actions.length === 0} testId="boot-failure" />
