import { describe, expect, it } from 'vitest'
import { unpublishedProblems } from '../../../scripts/check-launch'

// The site's first command is `npx @automata/tools create-game my-game`; the deploy must not go out while the package
// is not on npmjs.org, or the command fetches nothing.
describe('the packages the site tells a visitor to install', () => {
  it('is quiet when every one is on the registry', async () => {
    expect(await unpublishedProblems(['@automata/tools'], async () => true)).toEqual([])
  })

  it('names each package the registry does not have, in plain words', async () => {
    expect(
      await unpublishedProblems(
        ['@automata/tools', '@automata/framework'],
        async (name) => name === '@automata/framework',
      ),
    ).toEqual([
      '@automata/tools is not on npmjs.org yet, so the site’s first command (npx @automata/tools create-game) would fetch nothing.',
    ])
  })

  it('says so when the registry cannot be asked, rather than letting the site launch', async () => {
    const problems = await unpublishedProblems(['@automata/tools'], async () => {
      throw new Error('offline')
    })
    expect(problems).toEqual(['Could not ask npmjs.org about @automata/tools (offline).'])
  })
})
