// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SignIn from '#src/features/web-games/SignIn.svelte'
import type { WebGitHubSession } from '#src/shared/kit/sync/web-sign-in.ts'

function fakeSession(state: { signedIn: boolean | undefined; login?: string }) {
  const listeners = new Set<() => void>()
  const session = {
    get signedIn() {
      return state.signedIn
    },
    token: vi.fn(async () => (state.signedIn === true ? 'ghu' : undefined)),
    login: vi.fn(async () => state.login),
    signIn: vi.fn(),
    signOut: vi.fn(async () => {
      state.signedIn = false
      for (const listener of listeners) listener()
    }),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } satisfies WebGitHubSession
  return session
}

describe('the sign-in card', () => {
  it('signed out, says what signing in is for and offers it', async () => {
    const session = fakeSession({ signedIn: false })
    render(SignIn, { session, back: '/editor/app/?games', onremoveall: () => undefined })
    expect(await screen.findByText('Keep your games on all your devices')).toBeInTheDocument()
    expect(
      screen.getByText('Your games are kept in your own GitHub account. Automata keeps nothing.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub (free)' }))
    expect(session.signIn).toHaveBeenCalledWith('/editor/app/?games')
  })

  it('shows nothing until it knows, so a card never flashes the wrong thing', () => {
    render(SignIn, {
      session: fakeSession({ signedIn: undefined }),
      back: '/editor/app/',
      onremoveall: () => undefined,
    })
    expect(screen.queryByTestId('sign-in')).toBeNull()
  })

  it('says GitHub was refused when the address says so', async () => {
    render(SignIn, {
      session: fakeSession({ signedIn: false }),
      back: '/editor/app/',
      denied: true,
      onremoveall: () => undefined,
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'GitHub said no. Start again if you want to connect.',
    )
  })

  it('signed in, names the person, says the games stay here, and signs out', async () => {
    const session = fakeSession({ signedIn: true, login: 'mcthaydt' })
    render(SignIn, { session, back: '/editor/app/', onremoveall: () => undefined })
    expect(await screen.findByText('Signed in as mcthaydt.')).toBeInTheDocument()
    expect(
      screen.getByText('Your games stay on this device until you keep one on GitHub.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(session.signOut).toHaveBeenCalled()
  })

  it('asks before it signs out and removes the games, and does not if the person keeps them', async () => {
    const session = fakeSession({ signedIn: true, login: 'mcthaydt' })
    const onremoveall = vi.fn()
    render(SignIn, { session, back: '/editor/app/', onremoveall })
    await userEvent.click(
      await screen.findByRole('button', { name: 'Sign out and remove my games from this browser' }),
    )
    expect(screen.getByText(/A copy on GitHub stays/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Keep them' }))
    expect(onremoveall).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign out and remove my games from this browser' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign out and remove' }))
    await vi.waitFor(() => expect(onremoveall).toHaveBeenCalled())
  })
})
