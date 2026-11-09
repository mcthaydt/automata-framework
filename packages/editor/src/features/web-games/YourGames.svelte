<!--
  Your games: the games kept in this browser, newest change first. Each says what it is called, when it last changed and
  where it is kept, and has Open, Save a copy and Remove (which asks first). Above them, New game and Open a copy.
  Signed in with GitHub, it also lists the person's GitHub games this device does not have (Get it) and lets a game
  here be kept on GitHub (Keep this game on GitHub: make an empty repository, say so, and the page checks it can reach it).
  Nothing here talks to storage or the network: the page that mounts it hands in the games and hears what the person chose.
-->
<script lang="ts">
import { newRepoUrl } from '../../shared/kit/sync/github-games'
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { GameEntry } from './games-index'
import { since } from './since'
import { troubleWords } from './trouble-words'

/** What signing in with GitHub adds; absent when the person is not signed in. */
export interface GitHubOffer {
  /** GitHub games this device does not have. */
  readonly remote: readonly { readonly repo: string; readonly title: string }[]
  /** Where the person lets Automata see more of their repositories. */
  readonly installUrl: string
  /** Whether the game's place on GitHub (named for it, in the person's account) can be reached; if it can, the game is linked to it. */
  check(id: string): Promise<boolean>
  /** Gets a GitHub game onto this device; rejects with the reason in words. */
  get(repo: string): Promise<void>
  /** Opens an address in a new tab. */
  open(url: string): void
}

interface Props {
  games: readonly GameEntry[]
  /** The page's clock, in milliseconds: "Changed 5 minutes ago" is read from it. */
  now: number
  /** False when the browser keeps nothing: the games here are in memory and the note says so. */
  kept: boolean
  /** Whether signing in with GitHub is offered: the note then names it as the other way to keep a game safe. */
  canSignIn?: boolean
  /** What went wrong with the last thing the person tried (a zip that is not a game), in words. */
  trouble?: string | undefined
  onopen: (id: string) => void
  onnew: () => void
  oncopy: (id: string) => void
  onimport: (file: File) => void
  onremove: (id: string) => void
  github?: GitHubOffer | undefined
  /** A game was linked to its place on GitHub. */
  onlinked?: (id: string) => void
}

const {
  games,
  now,
  kept,
  canSignIn = false,
  trouble,
  onopen,
  onnew,
  oncopy,
  onimport,
  onremove,
  github,
  onlinked,
}: Props = $props()

let removing = $state<GameEntry | undefined>()
let removeOpen = $state(false)
let picker = $state<HTMLInputElement>()
/** The game being kept on GitHub: first making its place, then (if Automata cannot see it) letting Automata see it. */
let keeping = $state<{ id: string; step: 'make' | 'missing' } | undefined>()
let checking = $state(false)
let letSee = $state(false)
let gettingTrouble = $state<string | undefined>()
let getting = $state<string | undefined>()

const NOTE = $derived(
  github !== undefined
    ? 'Games that say “On this device and GitHub” are kept safe there. The others are only in this browser: save a copy, or press Keep this game on GitHub.'
    : canSignIn
      ? 'Saved in this browser only. Save a copy, or sign in with GitHub, to keep it safe.'
      : 'Saved in this browser only. Save a copy to keep it safe.',
)
const NOT_KEPT = 'Not saved: this browser can’t keep files. Save a copy to keep your work.'

function keep(id: string): void {
  keeping = { id, step: 'make' }
  letSee = false
  github?.open(newRepoUrl(id))
}

async function check(): Promise<void> {
  const mine = keeping
  if (mine === undefined || github === undefined || checking) return
  checking = true
  try {
    if (await github.check(mine.id)) {
      keeping = undefined
      onlinked?.(mine.id)
    } else keeping = { id: mine.id, step: 'missing' }
  } finally {
    checking = false
  }
}

async function get(repo: string): Promise<void> {
  gettingTrouble = undefined
  getting = repo
  try {
    await github?.get(repo)
  } catch (error) {
    gettingTrouble = troubleWords(error, 'press Get it again')
  } finally {
    getting = undefined
  }
}

// Coming back from GitHub's tab is the moment to look again.
$effect(() => {
  const back = () => {
    if (document.visibilityState === 'visible' && keeping?.step === 'missing') void check()
  }
  document.addEventListener('visibilitychange', back)
  return () => document.removeEventListener('visibilitychange', back)
})

function ask(game: GameEntry): void {
  removing = game
  removeOpen = true
}
</script>

<main class="games" data-testid="your-games">
  <h1>Your games</h1>
  <p class="note" class:bad={!kept}>{kept ? NOTE : NOT_KEPT}</p>
  <div class="bar">
    <Button variant="primary" onclick={onnew}>New game</Button>
    <Button onclick={() => picker?.click()}>Open a copy</Button>
    <input
      bind:this={picker}
      class="hidden"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a game copy to open"
      tabindex="-1"
      onchange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file !== undefined) onimport(file)
      }}
    />
  </div>
  {#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
  {#if games.length === 0}
    <p class="empty">You haven’t made a game yet. Press New game to start one.</p>
  {:else}
    <ul>
      {#each games as game (game.id)}
        <li>
          <div class="who">
            <strong>{game.title}</strong>
            <span>Changed {since(game.changed, now)}</span>
            <span>{game.github !== undefined ? `On this device and GitHub: ${game.github}` : kept ? 'On this device' : 'In this tab only'}</span>
          </div>
          <div class="acts">
            <Button variant="primary" aria-label={`Open ${game.title}`} onclick={() => onopen(game.id)}>Open</Button>
            <Button aria-label={`Save a copy of ${game.title}`} onclick={() => oncopy(game.id)}>Save a copy</Button>
            {#if github !== undefined && game.github === undefined}
              <Button onclick={() => keep(game.id)}>Keep this game on GitHub</Button>
            {/if}
            <Button variant="danger" aria-label={`Remove ${game.title}`} onclick={() => ask(game)}>Remove</Button>
          </div>
          {#if github !== undefined && keeping?.id === game.id}
            <div class="keep" role="group" aria-label={`Keep ${game.title} on GitHub`}>
              {#if keeping.step === 'make'}
                <p>On GitHub, press Create repository and change nothing else. Leave “Add a README” unticked. Then come back here.</p>
              {:else}
                <p role="status">Automata can’t reach this game on GitHub yet.</p>
                {#if letSee}<p>Choose your games on GitHub, then come back here.</p>{/if}
              {/if}
              <div class="acts">
                {#if keeping.step === 'make'}
                  <Button variant="primary" disabled={checking} onclick={() => void check()}>I made it</Button>
                {:else}
                  <Button
                    variant="primary"
                    onclick={() => {
                      letSee = true
                      github?.open(github.installUrl)
                    }}>Let Automata see this game</Button
                  >
                  <Button disabled={checking} onclick={() => void check()}>Check again</Button>
                {/if}
                <Button variant="quiet" onclick={() => (keeping = undefined)}>Never mind</Button>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if github !== undefined && github.remote.length > 0}
    <h2>Your games on GitHub</h2>
    <ul>
      {#each github.remote as game (game.repo)}
        <li>
          <div class="who">
            <strong>{game.title}</strong>
            <span>On GitHub: {game.repo}</span>
          </div>
          <div class="acts">
            <Button
              variant="primary"
              aria-label={`Get ${game.title}`}
              disabled={getting !== undefined}
              onclick={() => void get(game.repo)}>{getting === game.repo ? 'Getting it…' : 'Get it'}</Button
            >
          </div>
        </li>
      {/each}
    </ul>
    {#if gettingTrouble}<p class="trouble" role="alert">{gettingTrouble}</p>{/if}
  {/if}
</main>

<Dialog bind:open={removeOpen} title={`Remove ${removing?.title ?? 'this game'}?`}>
  <p>
    Remove {removing?.title} from this browser?
    {removing?.github !== undefined ? 'A copy on GitHub stays.' : 'Save a copy first if you want to keep it.'}
  </p>
  {#snippet actions({ close })}
    <Button variant="quiet" onclick={close}>Keep it</Button>
    <Button
      variant="danger"
      onclick={() => {
        if (removing !== undefined) onremove(removing.id)
        close()
      }}>Remove</Button
    >
  {/snippet}
</Dialog>

<style>
  .games {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 40rem;
    margin: 0 auto;
    color: var(--ink);
    font: var(--text-body-13);
  }
  h1,
  h2 {
    margin: 0;
    font: var(--text-title-20);
  }
  .note {
    margin: 0;
    color: var(--muted);
  }
  .note.bad,
  .trouble {
    color: var(--bad);
  }
  .bar,
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  li {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--paper);
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .who span {
    color: var(--muted);
  }
  h2 {
    font: var(--text-title-15);
    margin-top: var(--space-2);
  }
  .keep {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--line);
  }
  .keep p {
    margin: 0;
  }
  .empty {
    margin: 0;
    color: var(--muted);
  }
</style>
