<!--
  Publish on a game's own folder: one press makes the zip (on the computer that runs `automata editor`: the game is put
  together and checked for the web), then the person downloads it to upload. While it works, the dialog says so and cannot
  be closed by accident; a failure says what to do in a sentence, shows the last lines the tools printed and offers
  Try again. The words are for someone who is not a programmer: the dialog never says "build". The change-set Publish
  (a sample's or a branch's) is `ShipDialog`.
-->
<script lang="ts">
import type { GamePublish, PublishResult } from '../../../shared/kit/storage/publish-client'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'

interface Props {
  open: boolean
  publish: GamePublish
}

/** The guide the site renders from `docs/guides/publish-to-itch.md`: a person on a tablet has no repository to open. */
const ITCH_GUIDE = 'https://automataframework.com/docs/publish-to-itch'

let { open = $bindable(), publish }: Props = $props()

let phase = $state<'ready' | 'making' | 'done'>('ready')
let result = $state<PublishResult>()
let saving = $state(false)

async function makeZip(): Promise<void> {
  phase = 'making'
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

<Dialog {open} title="Make your game ready to upload" width="wide" dismissible={phase !== 'making'} onclose={close}>
  {#if phase === 'making'}
    <p class="result" role="status">Making your game’s zip… this can take a minute.</p>
  {:else if phase === 'done' && result?.ok === true}
    <p class="result" role="status">Your game is ready to upload.</p>
    <p class="note">On itch.io, make a new project, choose HTML as its kind, and upload this zip. Any website host takes it too.</p>
    <p><a href={ITCH_GUIDE} target="_blank" rel="noreferrer">How to put it on itch.io</a></p>
  {:else if phase === 'done' && result?.ok === false}
    <p class="result" role="alert">{result.problem}</p>
    {#if result.detail !== ''}<pre>{result.detail}</pre>{/if}
  {:else}
    <p>This gets your game ready for the web and makes one zip file. Nothing goes online yet: you get one zip file to upload to itch.io or any website host.</p>
  {/if}
  {#snippet actions()}
    {#if phase === 'done' && result?.ok === true}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" disabled={saving} onclick={() => result?.ok === true && void download(result.name)}>Download the zip</Button>
    {:else if phase === 'done'}
      <Button onclick={close}>Close</Button>
      <Button variant="primary" onclick={() => void makeZip()}>Try again</Button>
    {:else}
      <Button onclick={close} disabled={phase === 'making'}>Cancel</Button>
      <Button variant="primary" disabled={phase === 'making'} onclick={() => void makeZip()}
        >{phase === 'making' ? 'Making…' : 'Make my zip'}</Button
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
