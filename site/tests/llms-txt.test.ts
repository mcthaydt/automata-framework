import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import { AI_PROJECT_PROMPT, AI_TASKS } from '../src/data/ai-guidance'

describe('LLMs.txt & Docs Pipeline', () => {
  it('publishes the same API examples and task prompts that people read on the site', () => {
    const full = readFileSync(resolve(__dirname, '../static/llms-guides.txt'), 'utf8')
    const index = readFileSync(resolve(__dirname, '../static/llms.txt'), 'utf8')
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

  it('generates llms.txt matching llmstxt.org specification', () => {
    const filePath = resolve(__dirname, '../static/llms.txt')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('# Automata Framework')
    expect(content).toContain('> Automata is a deterministic')
    expect(content).toContain('## Documentation')
    expect(content).toContain('- [Overview & Vision](/docs/overview)')
    expect(content).toContain('- [AI Coding Agent Rules](/docs/ai-rules)')
  })

  it('generates llms-guides.txt with 5 Golden Rules and full markdown', () => {
    const filePath = resolve(__dirname, '../static/llms-guides.txt')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('The 5 Golden Rules for LLMs')
    expect(content).toContain('Sub-tick alpha interpolation')
    expect(content).toContain('Zero Eval')
  })
})
