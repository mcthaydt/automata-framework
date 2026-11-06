import { describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import { AI_PROJECT_PROMPT, AI_TASKS } from '../src/data/ai-guidance'
import { GET as llmsGuides } from '../src/routes/llms-guides.txt/+server'
import { GET as llmsIndex } from '../src/routes/llms.txt/+server'

describe('LLMs.txt & Docs Pipeline', () => {
  it('publishes the same API examples and task prompts that people read on the site', async () => {
    const full = await llmsGuides().text()
    const index = await llmsIndex().text()
    expect(full).toContain(AI_PROJECT_PROMPT)
    for (const task of AI_TASKS) expect(full).toContain(task.prompt)
    for (const mod of CHEATSHEET_MODULES) {
      expect(index).toContain(`/cheatsheet#${mod.id}`)
      expect(full).toContain(mod.example)
      for (const entry of mod.entries) {
        expect(full).toContain(entry.signature)
        for (const parameter of entry.parameters ?? []) expect(full).toContain(parameter.desc)
      }
    }
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
