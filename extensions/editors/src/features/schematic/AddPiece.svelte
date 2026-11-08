<!-- The menu that adds a condition or an action: one list, grouped by what the pieces are for. -->
<script lang="ts" generics="V">
import type { Names, Piece, PieceGroup } from './pieces/piece.ts'

const {
  label,
  pieces,
  names,
  onadd,
}: {
  label: string
  pieces: readonly Piece<V>[]
  names: Names
  onadd: (value: V) => void
} = $props()

const GROUP_WORDS: Readonly<Record<PieceGroup, string>> = {
  notices: 'What it notices',
  where: 'Where it is',
  true: 'What is true',
  time: 'How long',
  move: 'Moving',
  change: 'Changing',
  tell: 'Telling the game',
}
const ORDER: readonly PieceGroup[] = ['notices', 'where', 'true', 'time', 'move', 'change', 'tell']
const groups = $derived(
  ORDER.map((group) => ({ group, items: pieces.filter((piece) => piece.group === group) })).filter(
    (g) => g.items.length > 0,
  ),
)
</script>

<label class="add">
  <span>{label}</span>
  <select
    value=""
    onchange={(event) => {
      const piece = pieces.find((p) => p.kind === event.currentTarget.value)
      event.currentTarget.value = ''
      if (piece !== undefined) onadd(piece.fresh(names))
    }}
  >
    <option value="">Choose…</option>
    {#each groups as g (g.group)}
      <optgroup label={GROUP_WORDS[g.group]}>
        {#each g.items as piece (piece.kind)}<option value={piece.kind}>{piece.menu}</option>{/each}
      </optgroup>
    {/each}
  </select>
</label>

<style>
  .add {
    display: grid;
    gap: var(--space-1);
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  select {
    min-height: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
