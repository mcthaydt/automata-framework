import { describe, expect, it } from 'vitest'
import { GET as llmsIndex } from '#src/routes/llms.txt/+server.ts'
import { GET as llmsGuides } from '#src/routes/llms-guides.txt/+server.ts'

describe('LLMs.txt & Docs Pipeline', () => {
  it('links no page the site cut', async () => {
    for (const text of [await llmsIndex().text(), await llmsGuides().text()])
      expect(text).not.toMatch(/\]\((?:\/ai|\/cheatsheet|\/showcase)\b/)
  })

  it('generates llms.txt matching llmstxt.org specification', async () => {
    const content = await llmsIndex().text()
    expect(content).toContain('# Automata Framework')
    expect(content).toContain('> Automata is a deterministic')
    expect(content).toContain('## Documentation')
    expect(content).toContain('- [How it works](/docs/how-it-works)')
    expect(content).toContain('- [Open the editors on your game](/docs/editor)')
  })

  it('names the plugin and both install lines, so an agent can get the skills', async () => {
    const content = await llmsIndex().text()
    expect(content).toContain('/plugin marketplace add mcthaydt/automata-skills')
    expect(content).toContain('/plugin install automata@automata')
    expect(content).toContain('npx skills add https://github.com/mcthaydt/automata-skills')
  })

  it('says what the editor guide is, not the first words of its steps', async () => {
    expect(await llmsIndex().text()).toContain(
      '- [Open the editors on your game](/docs/editor): How to open the editors on your game and change what is in it.',
    )
  })

  it('describes the full file by what a reader gets: every guide and Reference page in one file', async () => {
    expect(await llmsIndex().text()).toContain(
      '[Full documentation](/llms-full.txt): Every guide and Reference page in one file',
    )
  })

  it('generates llms-guides.txt with every guide in full, How it works first', async () => {
    const content = await llmsGuides().text()
    expect(content.indexOf('## Document: How it works')).toBeLessThan(
      content.indexOf('## Document: Publish to the web'),
    )
    expect(content).toContain('## The same game every time')
    expect(content).not.toMatch(/Effect outside|Golden Rules/)
  })
})
