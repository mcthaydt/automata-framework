<!--
  The page of the person's own games: the list (Your games) or the one question of a new game. It does what the person
  chose against the games kept in this browser, then moves the page to the address that shows the result, so a
  reload lands in the same place. Everything the page's globals do (moving, saving a file) is handed in.
-->
<script lang="ts">
import { onMount } from 'svelte'
import {
  type GitHubGame,
  getGame,
  installUrl,
  listGitHubGames,
  repoReachable,
} from '../../shared/kit/sync/github-games'
import type { WebGitHubSession } from '../../shared/kit/sync/web-sign-in'
import { openCopy, saveCopy } from './game-copy'
import NewGame from './NewGame.svelte'
import SignIn from './SignIn.svelte'
import { troubleWords } from './trouble-words'
import type { GameEntry, GameFile, WebGames } from './web-games'
import YourGames, { type GitHubOffer } from './YourGames.svelte'

interface Props {
  games: WebGames
  mode: 'list' | 'new'
  /** The files a new game starts from. */
  starter: () => readonly GameFile[]
  /** Moves the page to `?…` of its own address. */
  navigate: (search: string) => void
  /** Hands the person a file to keep. */
  save: (name: string, bytes: Uint8Array) => void
  now: () => number
  /** Signing in with GitHub, when the site has it set up; without it no sign-in is offered. */
  session?: WebGitHubSession | undefined
  /** GitHub was refused on the way back (`?github=denied`). */
  denied?: boolean
  /** The name of the GitHub App the site signs in with; it is where "Let Automata see this game" goes. */
  app?: string | undefined
  /** The network for GitHub's API. */
  fetchFn?: typeof fetch
  /** Opens an address in a new tab. */
  openTab?: (url: string) => void
}

const {
  games,
  mode,
  starter,
  navigate,
  save,
  now,
  session,
  denied = false,
  app,
  fetchFn = (input, init) => fetch(input, init),
  openTab = (url) => void window.open(url, '_blank', 'noopener'),
}: Props = $props()

let list = $state.raw<readonly GameEntry[]>([])
let trouble = $state<string | undefined>()

async function reload(): Promise<void> {
  list = await games.list()
}
onMount(() => void reload())

// The person's games on GitHub that this device does not have, once they are signed in.
// svelte-ignore state_referenced_locally
let signedIn = $state<boolean | undefined>(session?.signedIn)
let onGitHub = $state.raw<readonly GitHubGame[]>([])
async function loadGitHub(): Promise<void> {
  const token = signedIn === true ? await session?.token() : undefined
  if (token === undefined) {
    onGitHub = []
    return
  }
  try {
    onGitHub = await listGitHubGames(fetchFn, token)
  } catch (error) {
    onGitHub = []
    trouble = troubleWords(error, 'open this page again')
  }
}
$effect(() => {
  if (session === undefined) return
  const read = () => {
    signedIn = session.signedIn
    void loadGitHub()
  }
  const stop = session.subscribe(read)
  void session.token().then(read)
  return stop
})

const offer = $derived.by((): GitHubOffer | undefined => {
  if (session === undefined || app === undefined || signedIn !== true) return undefined
  return {
    remote: onGitHub
      .filter((found) => !list.some((game) => game.github?.toLowerCase() === found.repo.toLowerCase()))
      .map(({ repo, title }) => ({ repo, title })),
    installUrl: installUrl(app),
    open: openTab,
    async check(id) {
      const [token, login] = [await session.token(), await session.login()]
      if (token === undefined || login === undefined) return false
      const repo = `${login}/${id}`
      if (!(await repoReachable(fetchFn, token, repo))) return false
      await games.link(id, repo)
      return true
    },
    async get(repo) {
      const token = await session.token()
      if (token === undefined) throw new Error('Sign in to GitHub again to get this game.')
      await getGame(fetchFn, token, repo, games)
      await reload()
    },
  }
})

async function make(title: string): Promise<string | undefined> {
  try {
    const game = await games.create(title, starter())
    await games.remember(game.id)
    navigate(`?game=${game.id}`)
    return undefined
  } catch (error) {
    return `Could not make the game: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function open(id: string): Promise<void> {
  await games.remember(id)
  navigate(`?game=${id}`)
}

async function copy(id: string): Promise<void> {
  trouble = undefined
  const game = list.find((entry) => entry.id === id)
  if (game === undefined) return
  save(`${game.id}.zip`, await saveCopy(await games.store(id)))
}

async function importCopy(file: File): Promise<void> {
  trouble = undefined
  const opened = await openCopy(
    new Uint8Array(await file.arrayBuffer()),
    games,
    file.name.replace(/\.zip$/i, ''),
  )
  if (!opened.ok) {
    trouble = opened.why
    return
  }
  await games.remember(opened.game.id)
  navigate(`?game=${opened.game.id}`)
}

async function removeAll(): Promise<void> {
  for (const game of await games.list()) await games.remove(game.id)
  await reload()
}

async function remove(id: string): Promise<void> {
  await games.remove(id)
  await reload()
}
</script>

{#if mode === 'new'}
  <NewGame taken={list.map((game) => game.id)} onmake={make} oncancel={() => navigate('?games')} />
{:else}
  {#if session}
    <div class="sign-in"><SignIn {session} back="/editor/app/?games" {denied} onremoveall={() => void removeAll()} /></div>
  {/if}
  <YourGames
    games={list}
    now={now()}
    kept={games.kept}
    canSignIn={session !== undefined}
    {trouble}
    onopen={(id) => void open(id)}
    onnew={() => navigate('?new=2d')}
    oncopy={(id) => void copy(id)}
    onimport={(file) => void importCopy(file)}
    onremove={(id) => void remove(id)}
    github={offer}
    onlinked={() => void reload()}
  />
{/if}

<style>
  .sign-in {
    max-width: 40rem;
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) 0;
  }
</style>
