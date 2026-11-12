<!--
  A repeated item with fields of its own (one effect in a feel, one tone in a sound): a 44 px head with its icon, its name
  and Remove, then its fields, split by hairlines. A block never holds a block: a second level of boxes is what made the
  old editors read as forms inside forms, so a block inside a block is a mistake and throws while the code is being
  written.
-->
<script lang="ts">
import { getContext, type Snippet, setContext } from 'svelte'
import Icon from '../icons/Icon.svelte'
import type { IconName } from '../icons/paths'
import IconButton from '../widgets/IconButton.svelte'

interface Props {
  title: string
  icon: IconName
  onremove?: (() => void) | undefined
  children: Snippet
}

const { title, icon, onremove, children }: Props = $props()

const INSIDE = Symbol.for('automata.block')
if (getContext(INSIDE) === true && import.meta.env.DEV) throw new Error('A Block never holds a Block.')
setContext(INSIDE, true)
</script>

<section class="block" aria-label={title}>
  <header class="head">
    <span class="icon"><Icon name={icon} size={16} /></span>
    <h3 class="title">{title}</h3>
    {#if onremove !== undefined}
      <span class="remove"><IconButton icon="trash" label={`Remove ${title}`} onclick={onremove} /></span>
    {/if}
  </header>
  <div class="fields">{@render children()}</div>
</section>

<style>
  .block {
    --field-pad: 14px;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
  }
  :global(.block + .block) {
    margin-top: var(--space-3);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 var(--space-2) 0 14px;
    border-bottom: 1px solid var(--line);
  }
  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--line);
    border-radius: var(--edge-sm);
    background: var(--raise);
    color: var(--muted);
  }
  .title {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    font: var(--text-title-15);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove {
    margin-left: auto;
  }
  .fields > :global(* + *) {
    border-top: 1px solid var(--line);
  }
</style>
