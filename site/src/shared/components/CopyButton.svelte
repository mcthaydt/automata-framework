<script lang="ts">
// A copy icon button named for what it copies (with a `caption`, a text button instead, as the playground's). Pressing it copies `text` and says so in words beside the button (a
// status region, so a screen reader hears it); when the browser refuses, it says how to copy by hand instead of
// failing silently.
import { onDestroy } from 'svelte'
import Icon from './Icon.svelte'

let {
  text,
  label = 'Copy code',
  caption = '',
  copied = 'Copied',
  blocked = "Couldn't copy. Select the text and copy it manually.",
}: {
  text: string
  label?: string
  caption?: string
  copied?: string
  blocked?: string
} = $props()
let message = $state('')
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  clearTimeout(timer)
  try {
    await navigator.clipboard.writeText(text)
    message = copied
  } catch {
    message = blocked
  }
  timer = setTimeout(() => (message = ''), 5000)
}
onDestroy(() => clearTimeout(timer))
</script>
<div class="copy-control">
  <span role="status">{message}</span>
  <button type="button" class:icon={!caption} aria-label={label} onclick={copy}>{#if caption}{caption}{:else}<Icon name={message === copied ? 'check' : 'copy'} size={18} />{/if}</button>
</div>

<style>
  .copy-control {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--step-small);
  }
  .copy-control span:empty {
    display: none;
  }
  .copy-control span {
    color: var(--muted);
  }
  .copy-control button {
    min-height: 44px;
    padding: 0 12px;
    font-size: var(--step-micro);
  }
  /* The icon is a 44 px square tap target, quiet until pointed at. */
  .copy-control button.icon {
    width: 44px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .copy-control button.icon:hover {
    border-color: var(--line-strong);
    color: var(--ink);
  }
</style>
