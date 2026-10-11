<!--
  The state a boot failure draws (M1 shared contracts §3; M1.6 spec §3.6): an ErrorPanel with the
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
} from './boot-failure'
import ErrorPanel from './ErrorPanel.svelte'
import type { ErrorAction } from './error-panel'

interface Props {
  failure: BootFailure
  hostKind: HostKind
  /** The game's copy, merged over the English defaults. */
  copy?: Partial<BootFailureCopy> | undefined
  onRetry: () => void
  /** Required where Continue can appear (standalone). */
  onContinue?: (() => void) | undefined
  onExit: () => void
}

const { failure, hostKind, copy = {}, onRetry, onContinue, onExit }: Props = $props()

const words = $derived({ ...BOOT_FAILURE_COPY_EN, ...copy })
const view = $derived(bootFailureView(failure, hostKind))

const handlerFor = (action: BootFailureAction): (() => void) =>
  action === 'retry' ? onRetry : action === 'exit' ? onExit : (onContinue ?? onExit)

const actions = $derived<ErrorAction[]>(
  view.actions.map((action, index) => ({
    id: action,
    label: words[action],
    kind: index === 0 ? 'primary' : 'secondary',
    onSelect: handlerFor(action),
  })),
)
</script>

<ErrorPanel code={view.state} message={words[view.state]} {actions} final={view.actions.length === 0} testId="boot-failure" />
