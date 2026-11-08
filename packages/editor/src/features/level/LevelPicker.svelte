<!--
  The level picker, beside the document's name in the top bar (spec 11.4: "the level strip becomes a level picker in
  the top bar"). Its button shows the open level's name; its menu lists the levels of the open level's world in the
  world's order, the open one marked, then "New level". Choosing a level opens it and fits it in view; New level adds
  the first free "Level N" beside the world's levels (the Map view's Add level, `newLevelInput`), as one undo step, and
  opens it. A project already holding the most levels it may keeps New level in the menu, saying why it cannot add one.
-->
<script lang="ts">
import type { History } from '../../shared/kit/history/history'
import Icon from '../../shared/kit/icons/Icon.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import { MAX_LEVELS } from '../../shared/level-2d/model/project.schema'
import { addLevel } from '../../shared/level-2d/model/world/level-edits'
import { newLevelInput } from '../../shared/level-2d/model/world/world-model'
import { levelList } from './level-list'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
}

const { session, history }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)

const NEW = 'new-level'

/** The world the open level is placed in; a level placed nowhere has no neighbours to list. */
const world = $derived(
  level.project.worlds.find((each) =>
    each.placements.some((placement) => placement.level === level.view.level),
  ),
)
const cards = $derived(world === undefined ? [] : levelList(level.project, world.id, level.view.level))
const name = $derived(level.project.levels.find((each) => each.id === level.view.level)?.name ?? '')
const full = $derived(level.project.levels.length >= MAX_LEVELS)

const items = $derived([
  ...cards.map((card) => ({ id: card.id, label: card.name, detail: card.current ? 'Open' : undefined })),
  ...(world === undefined
    ? []
    : [
        'separator' as const,
        {
          id: NEW,
          label: 'New level',
          disabled: full,
          reason: full ? `A game holds at most ${MAX_LEVELS} levels.` : undefined,
        },
      ]),
])

function open(id: string): void {
  session.editor.setLevel(id)
  session.fit()
}

function choose(id: string): void {
  if (id !== NEW) {
    open(id)
    return
  }
  if (world === undefined) return
  const input = newLevelInput(level.project, world.id)
  level.edits.apply('Add level', (current) => addLevel(current, input))
  open(input.id)
}
</script>

<Menu label={`Level: ${name}`} {items} onselect={choose}>
  {#snippet trigger()}
    <span class="picked">
      <span class="name">{name}</span>
      <Icon name="chevron-down" />
    </span>
  {/snippet}
</Menu>

<style>
  .picked {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: min(14rem, 100%);
    min-width: 0;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
