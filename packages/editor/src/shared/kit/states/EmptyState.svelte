<!--
  What a list shows when it has nothing in it: an icon in a tile, what is missing, one line on why it matters, and the one
  button that fixes it. It never offers two ways: a person with nothing to look at should not also have to choose.
-->
<script lang="ts">
import Icon from '../icons/Icon.svelte'
import type { IconName } from '../icons/paths'
import Button from '../widgets/Button.svelte'

interface Props {
  icon: IconName
  /** What is missing, as the list would name it ("No characters yet"). */
  title: string
  /** One line on what to do or why: "Add one to place it in your levels." */
  why: string
  action: { label: string; onclick: () => void }
}

const { icon, title, why, action }: Props = $props()
</script>

<div class="empty" data-widget="empty-state">
  <span class="tile"><Icon name={icon} size={20} /></span>
  <h3>{title}</h3>
  <p>{why}</p>
  <Button onclick={action.onclick}>{action.label}</Button>
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }
  .tile {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--raise);
    color: var(--muted);
  }
  h3 {
    margin: 0;
    color: var(--ink);
    font: var(--text-title-15);
  }
  p {
    max-width: 24ch;
    margin: 0 0 var(--space-2);
    color: var(--muted);
    font: var(--text-body-13);
  }
</style>
