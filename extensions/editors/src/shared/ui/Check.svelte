<!--
  A switch in a sentence editor: the whole row is the press target (44 px with a finger), and the box drawn at its start is
  only what the eye sees, so the native input can stay what a screen reader and the keyboard already know.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  checked: boolean
  disabled?: boolean
  onchange: (checked: boolean) => void
  children: Snippet
}

const { checked, disabled = false, onchange, children }: Props = $props()
</script>

<label class="check">
  <input type="checkbox" {checked} {disabled} onchange={(event) => onchange(event.currentTarget.checked)} />
  {@render children()}
</label>

<style>
  .check {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--size-hit);
    padding-inline-start: calc(18px + var(--space-2));
    color: var(--color-text-primary);
    font: var(--text-body-13);
    cursor: pointer;
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .check::before {
    position: absolute;
    top: 50%;
    left: 0;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    content: '';
    translate: 0 -50%;
  }
  .check:has(input:checked)::before {
    border-color: var(--color-text-primary);
    background: var(--color-text-primary);
  }
  .check:has(input:checked)::after {
    position: absolute;
    top: 50%;
    left: 6px;
    width: 4px;
    height: 9px;
    border: solid var(--color-bg-field);
    border-width: 0 2px 2px 0;
    content: '';
    translate: 0 -60%;
    rotate: 45deg;
  }
  .check:has(input:focus-visible)::before {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .check:has(input:disabled) {
    opacity: 0.5;
  }
</style>
