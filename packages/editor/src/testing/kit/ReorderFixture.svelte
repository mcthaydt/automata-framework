<!-- A ReorderList that does what an editor does: applies each reorder to its own items, so tests see the new order. -->
<script lang="ts">
import ReorderList from '../../shared/kit/widgets/ReorderList.svelte'
import { moveRow } from '../../shared/kit/widgets/reorder-model'

interface Item {
  id: string
  label: string
  locked?: boolean
  reason?: string
}

interface Move {
  id: string
  from: number
  to: number
}

interface Props {
  initial: readonly Item[]
  onreorder?: ((move: Move) => void) | undefined
  onblocked?: ((reason: string | undefined) => void) | undefined
}

const { initial, onreorder, onblocked }: Props = $props()

// svelte-ignore state_referenced_locally
let items = $state.raw(initial)

function apply(move: Move): void {
  items = moveRow(items, (item) => item.locked === true, move.from, move.to)
  onreorder?.(move)
}
</script>

<ReorderList label="Layers" {items} onreorder={apply} {onblocked} />
