<!--
  The level picker, beside the document's name in the top bar, in place of a strip of level cards. Its button shows the open level's name; its menu lists the levels of the open level's world in the
  world's order, the open one marked, then "New level". Choosing a level opens it and fits it in view; New level adds
  the first free "Level N" beside the world's levels (the Map view's Add level, `newLevelInput`), as one undo step, and
  opens it. A project already holding the most levels it may keeps New level in the menu, saying why it cannot add one.
-->
<script lang="ts">
import type { History } from '../../shared/kit/history/history'
import Icon from '../../shared/kit/icons/Icon.svelte'
import Menu from '../../shared/kit/widgets/Menu.svelte'
import { chooseLevel, levelName, pickerItems } from './level-picker-model'
import type { LevelSession } from './level-session'
import { levelState } from './level-state.svelte'

interface Props {
  session: LevelSession
  history: History<unknown>
}

const { session, history }: Props = $props()

// svelte-ignore state_referenced_locally
const level = levelState(session, history)

const name = $derived(levelName(level.project, level.view.level))
const items = $derived(pickerItems(level.project, level.view.level))

function open(id: string): void {
  session.editor.setLevel(id)
  session.fit()
}

function choose(id: string): void {
  chooseLevel(id, level.project, level.view.level, level.edits, open)
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
