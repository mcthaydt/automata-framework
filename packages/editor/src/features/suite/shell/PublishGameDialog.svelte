<!--
  Publish on a game's own folder: one press builds the game and checks it is ready for the web (on the computer that
  runs `automata editor`), then the person downloads one zip to upload. While it builds, the dialog says so and cannot
  be closed by accident; a build that fails says what to do in a sentence, shows the build's last lines and offers
  Try again. The change-set Publish (a sample's or a branch's) is `ShipDialog`.
-->
<script lang="ts">
import type { GamePublish, PublishResult } from '../../../shared/kit/storage/publish-client'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  publish: GamePublish
}

let { open = $bindable(), publish }: Props = $props()

let phase = $state<'ready' | 'building' | 'done'>('ready')
let result = $state<PublishResult>()
let saving = $state(false)

async function build(): Promise<void> {
  phase = 'building'
  result = await publish.publish()
  phase = 'done'
}

async function download(name: string): Promise<void> {
  saving = true
  try {
    await publish.download(name)
  } finally {
    saving = false
  }
}

function close(): void {
  open = false
  phase = 'ready'
  result = undefined
}
</script>

<Dialog {open} title="Make your game ready to upload" width="wide" dismissible={phase !== 'building'} onclose={close}>
  {#if phase === 'building'}
    <p class="result" role="status">Building your game… this can take a minute.</p>
  {:else if phase === 'done' && result?.ok === true}
    <p class="result" role="status">Your game is ready to upload.</p>
    <p class="note">On itch.io, make a new project, choose HTML as its kind, and upload this zip. Any website host takes it too.</p>
  {:else if phase === 'done' && result?.ok === false}
    <p class="result" role="alert">{result.problem}</p>
    {#if result.detail !== ''}<pre>{result.detail}</pre>{/if}
  {:else}
    <p>This builds your game and checks it is ready for the web. Nothing goes online yet: you get one zip file to upload to itch.io or any website host.</p>
  {/if}
  {#snippet actions()}
    {#if phase === 'done' && result?.ok === true}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" disabled={saving} onclick={() => result?.ok === true && void download(result.name)}>Download the zip</Button>
    {:else if phase === 'done'}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" onclick={() => void build()}>Try again</Button>
    {:else}
      <Button onclick={close} disabled={phase === 'building'}>Cancel</Button>
      <Button variant="primary" disabled={phase === 'building'} onclick={() => void build()}
        >{phase === 'building' ? 'Building…' : 'Build my game'}</Button
      >
    {/if}
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0;
  }
  .note {
    color: var(--color-text-dim);
  }
  pre {
    max-height: 16rem;
    margin: 0;
    overflow: auto;
    padding: var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    font: var(--text-mono-12);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
