import { describe, expect, it } from 'vitest'
import { unpublishedProblems } from '../../../scripts/check-launch'

// The site's first command is `npx @automataframework/tools create-game my-game`; the deploy must not go out while the package
// is not on npmjs.org, or the command fetches nothing.
describe('the packages the site tells a visitor to install', () => {
  it('is quiet when every one is on the registry', async () => {
    expect(await unpublishedProblems(['@automataframework/tools'], async () => true)).toEqual([])
  })

  it('names each package the registry does not have, in plain words', async () => {
    expect(
      await unpublishedProblems(
        ['@automataframework/tools', '@automataframework/framework'],
        async (name) => name === '@automataframework/framework',
      ),
    ).toEqual([
      '@automataframework/tools is not on npmjs.org yet, so the site’s first command (npx @automataframework/tools create-game) would fetch nothing.',
    ])
  })

  it('says so when the registry cannot be asked, rather than letting the site launch', async () => {
    const problems = await unpublishedProblems(['@automataframework/tools'], async () => {
      throw new Error('offline')
    })
    expect(problems).toEqual(['Could not ask npmjs.org about @automataframework/tools (offline).'])
  })
})
