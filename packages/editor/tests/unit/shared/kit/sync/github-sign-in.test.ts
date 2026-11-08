import { describe, expect, it } from 'vitest'
import { githubToken, SIGN_IN_WORDS, type SignInStep, signIn } from '#src/shared/kit/sync/github-sign-in.ts'
import { FakeClock, FakeGithub, type FakeGithubOptions, FakeKeychain } from './fake-github'

const CLIENT_ID = 'Iv1.test'
const SLUG = 'automata-app'

async function steps(
  github: FakeGithub,
  secrets: FakeKeychain,
  clock: FakeClock,
  onStep?: (step: SignInStep) => void,
): Promise<SignInStep[]> {
  const seen: SignInStep[] = []
  for await (const step of signIn(github, secrets, CLIENT_ID, clock, { appSlug: SLUG })) {
    seen.push(step)
    onStep?.(step)
  }
  return seen
}

const world = (options?: FakeGithubOptions) => {
  const clock = new FakeClock()
  return { clock, github: new FakeGithub(clock, options), secrets: new FakeKeychain() }
}

describe('signIn', () => {
  it('shows the code to type, then says who signed in', async () => {
    const { github, secrets, clock } = world({ pendingPolls: 2, login: 'dana' })
    const seen = await steps(github, secrets, clock)
    expect(seen).toEqual([
      { kind: 'code', userCode: 'WDJB-MJHT', url: 'https://github.com/login/device' },
      { kind: 'done', login: 'dana' },
    ])
    expect(SIGN_IN_WORDS.code('WDJB-MJHT')).toBe('Type this code on GitHub: WDJB-MJHT')
    expect(SIGN_IN_WORDS.open).toBe('Open GitHub')
    expect(SIGN_IN_WORDS.copy).toBe('Copy code')
  })

  it('waits the interval GitHub gave between polls, and longer after slow_down', async () => {
    const { github, secrets, clock } = world({ pendingPolls: 3, slowDownAt: 2 })
    await steps(github, secrets, clock)
    // 4 polls: pending, slow_down (the interval becomes 10 s), pending, then the token.
    expect(clock.slept).toEqual([5000, 5000, 10_000, 10_000])
  })

  it('asks the person to install the app when it is not on their account, then goes on', async () => {
    const { github, secrets, clock } = world({ installed: false })
    const seen: SignInStep[] = []
    for await (const step of signIn(github, secrets, CLIENT_ID, clock, { appSlug: SLUG })) {
      seen.push(step)
      if (step.kind === 'install') github.installed = true
    }
    expect(seen.map((step) => step.kind)).toEqual(['code', 'install', 'done'])
    expect(seen[1]).toEqual({ kind: 'install', url: `https://github.com/apps/${SLUG}/installations/new` })
  })

  it('keeps the token in the keychain and nowhere else', async () => {
    const { github, secrets, clock } = world()
    await steps(github, secrets, clock)
    expect([...secrets.values.keys()]).toEqual(['github'])
    expect(await githubToken(github, secrets, clock)).toBe('token-1')
  })

  it('fails in plain words when the keychain refuses, and writes nothing', async () => {
    const { github, secrets, clock } = world()
    secrets.refuse = true
    const seen = await steps(github, secrets, clock)
    expect(seen.at(-1)).toEqual({
      kind: 'failed',
      message: "Automata can't keep your GitHub sign-in on this device.",
    })
    expect(secrets.values.size).toBe(0)
  })

  it('fails in plain words when the person says no, or the code runs out', async () => {
    for (const [outcome, message] of [
      ['denied', 'GitHub said no. Start again if you want to connect.'],
      ['expired', 'That code ran out. Start again to get a new one.'],
    ] as const) {
      const { github, secrets, clock } = world({ outcome })
      expect((await steps(github, secrets, clock)).at(-1)).toEqual({ kind: 'failed', message })
    }
  })

  it('does not ask for a code again after a restart: the kept sign-in is used', async () => {
    const { github, secrets, clock } = world({ login: 'dana' })
    await steps(github, secrets, clock)
    // A new sign-in over the same keychain, as after the app is opened again.
    const again = await steps(new FakeGithub(clock, { login: 'dana' }), secrets, clock)
    expect(again).toEqual([{ kind: 'done', login: 'dana' }])
  })
})

describe('githubToken', () => {
  it('is nothing when nobody has signed in', async () => {
    const { github, secrets, clock } = world()
    expect(await githubToken(github, secrets, clock)).toBeUndefined()
  })

  it('gives the kept token while it is good', async () => {
    const { github, secrets, clock } = world()
    await steps(github, secrets, clock)
    clock.time += 7 * 3600 * 1000
    expect(await githubToken(github, secrets, clock)).toBe('token-1')
  })

  it('refreshes an expired token with the refresh token, and keeps the new one', async () => {
    const { github, secrets, clock } = world()
    await steps(github, secrets, clock)
    clock.time += 9 * 3600 * 1000
    expect(await githubToken(github, secrets, clock)).toBe('token-2')
    expect(await githubToken(github, secrets, clock)).toBe('token-2')
    const refresh = github.requests.filter((request) => request.body?.grant_type === 'refresh_token')
    expect(refresh).toHaveLength(1)
    expect(refresh[0]?.body).toEqual({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
    })
  })

  it('is nothing when the refresh token has run out too, so the app asks to sign in again', async () => {
    const { github, secrets, clock } = world()
    await steps(github, secrets, clock)
    clock.time += 200 * 24 * 3600 * 1000
    expect(await githubToken(github, secrets, clock)).toBeUndefined()
  })
})
