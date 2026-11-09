// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CREATE_COMMAND } from '#src/features/home/home-content.ts'
import {
  installedPackage,
  mailboxProblems,
  pixiPublicProblems,
  repositoryProblems,
} from '../../../scripts/check-launch'

describe('check:launch', () => {
  it('asks about the package the Home command names, read from home-content.ts so a rename follows it', () => {
    expect(CREATE_COMMAND).toContain(installedPackage())
    expect(installedPackage()).toMatch(/^@[a-z-]+\/[a-z-]+$/)
  })

  it('fails while @pixi/3d is not on npmjs.org, and says what that means', async () => {
    const asked: string[] = []
    const problems = await pixiPublicProblems(async (name) => {
      asked.push(name)
      return false
    })
    expect(asked).toEqual(['@pixi/3d'])
    expect(problems).toEqual(['Pixi 3D is not public yet. Automata launches the day it is.'])
  })

  it('passes once @pixi/3d is on the registry', async () => {
    expect(await pixiPublicProblems(async () => true)).toEqual([])
  })

  it('fails while the repository is private, and passes once it is public', () => {
    expect(repositoryProblems(false)).toEqual([
      'The framework’s repository is still private. Open it on launch day, then set REPOSITORY_PUBLIC in site.js.',
    ])
    expect(repositoryProblems(true)).toEqual([])
  })

  it('fails when the domain has no mail record, because hello@ would bounce', async () => {
    expect(await mailboxProblems('automataframework.com', async () => [])).toEqual([
      'automataframework.com has no mail record, so mail to hello@automataframework.com would bounce.',
    ])
    expect(
      await mailboxProblems('automataframework.com', async () => {
        throw new Error('the network is down')
      }),
    ).toEqual(['Could not look up the mail record for automataframework.com (the network is down).'])
    // A name with no MX (ENODATA) or no address at all (ENOTFOUND) is the finding, not a failure to look.
    for (const code of ['ENODATA', 'ENOTFOUND']) {
      expect(
        await mailboxProblems('automataframework.com', async () => {
          throw Object.assign(new Error(`queryMx ${code} automataframework.com`), { code })
        }),
      ).toEqual([
        'automataframework.com has no mail record, so mail to hello@automataframework.com would bounce.',
      ])
    }
  })

  it('passes with a mail record', async () => {
    expect(
      await mailboxProblems('automataframework.com', async () => [
        { exchange: 'mx.example.com', priority: 10 },
      ]),
    ).toEqual([])
  })
})
