// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import GamesPage from '#src/features/web-games/GamesPage.svelte'
import { openWebGames } from '#src/features/web-games/web-games.ts'
import type { WebGitHubSession } from '#src/shared/kit/sync/web-sign-in.ts'
import { createFakeGitHubRest } from '../shared/kit/sync/fake-github-rest.ts'

// The page of games, signed in: the GitHub games this device lacks, Get it, and Keep this game on GitHub, against a fake
// GitHub that knows one installation and one repository (spec 8.2).

const LIST = 'format = "af-editors/1"\n'
const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

function session(signedIn: boolean): WebGitHubSession {
  return {
    signedIn,
    token: async () => (signedIn ? 'ghu_1' : undefined),
    login: async () => 'mcthaydt',
    signIn: vi.fn(),
    signOut: async () => undefined,
    subscribe: () => () => undefined,
  }
}

/** GitHub's account API over a fake repository; `installed` is what the app was let into. */
function github(installed: string[]) {
  const repo = createFakeGitHubRest({
    repo: 'mcthaydt/night-shift',
    files: { 'content/editors.toml': LIST, 'content/feel/feel.toml': 'flash = 3\n' },
  })
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    if (url.pathname === '/user/installations') return json({ installations: [{ id: 1 }] })
    if (url.pathname === '/user/installations/1/repositories')
      return json({ repositories: installed.map((full_name) => ({ full_name })) })
    if (url.pathname === '/repos/mcthaydt/night-shift/contents/content/editors.toml')
      return new Response('{}', { status: installed.includes('mcthaydt/night-shift') ? 200 : 404 })
    return repo.fetch(input, init)
  }) as typeof fetch
  return { fetchFn }
}

async function page(options: { signedIn: boolean; installed: string[]; existing?: string[] }) {
  const games = await openWebGames({ storage: {}, now: () => 1_000 })
  for (const title of options.existing ?? []) await games.create(title, [])
  const opened = vi.fn()
  render(GamesPage, {
    games,
    mode: 'list',
    starter: () => [],
    navigate: vi.fn(),
    save: vi.fn(),
    now: () => 1_000,
    session: session(options.signedIn),
    app: 'automata',
    fetchFn: github(options.installed).fetchFn,
    openTab: opened,
  })
  return { games, opened }
}

describe('Your games, signed in', () => {
  it('lists the GitHub games this device does not have, and Get it brings one here', async () => {
    const { games } = await page({ signedIn: true, installed: ['mcthaydt/night-shift'] })
    await userEvent.click(await screen.findByRole('button', { name: 'Get night-shift' }))
    await waitFor(async () =>
      expect((await games.list()).map((game) => game.github)).toEqual(['mcthaydt/night-shift']),
    )
    expect(await screen.findByText('On this device and GitHub: mcthaydt/night-shift')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Get night-shift' })).toBeNull()
    const store = await games.store('night-shift')
    expect(new TextDecoder().decode(await store.read('content/feel/feel.toml'))).toBe('flash = 3\n')
  })

  it('shows no GitHub list to someone who is not signed in', async () => {
    await page({ signedIn: false, installed: ['mcthaydt/night-shift'] })
    expect(await screen.findByText('Your games')).toBeInTheDocument()
    expect(screen.queryByText('Your games on GitHub')).toBeNull()
  })

  it('keeps a game here on GitHub once the app can see the empty place made for it', async () => {
    const { games, opened } = await page({
      signedIn: true,
      installed: ['mcthaydt/lantern-run'],
      existing: ['Lantern Run'],
    })
    const row = (await screen.findByText('Lantern Run')).closest('li') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'Keep this game on GitHub' }))
    expect(opened).toHaveBeenCalledWith('https://github.com/new?name=lantern-run&visibility=private')
    await userEvent.click(screen.getByRole('button', { name: 'I made it' }))
    await waitFor(async () => expect((await games.list())[0]?.github).toBe('mcthaydt/lantern-run'))
    expect(await screen.findByText('On this device and GitHub: mcthaydt/lantern-run')).toBeInTheDocument()
  })

  it('says Automata cannot reach it when the app was not let into the new place', async () => {
    await page({ signedIn: true, installed: [], existing: ['Lantern Run'] })
    const row = (await screen.findByText('Lantern Run')).closest('li') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'Keep this game on GitHub' }))
    await userEvent.click(screen.getByRole('button', { name: 'I made it' }))
    expect(await screen.findByText('Automata can’t reach this game on GitHub yet.')).toBeInTheDocument()
  })
})
