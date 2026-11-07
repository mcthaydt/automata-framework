import { describe, expect, it } from 'vitest'
import { GET as llmsIndex } from '../src/routes/llms.txt/+server'
import { GET as llmsGuides } from '../src/routes/llms-guides.txt/+server'

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
    expect(content).toContain('- [Overview & Vision](/docs/overview)')
    expect(content).toContain('- [AI Coding Agent Rules](/docs/ai-rules)')
  })

  it('generates llms-guides.txt with 5 Golden Rules and full markdown', async () => {
    const content = await llmsGuides().text()
    expect(content).toContain('The 5 Golden Rules for LLMs')
    expect(content).toContain('Sub-tick alpha interpolation')
    expect(content).toContain('Zero Eval')
  })
})
