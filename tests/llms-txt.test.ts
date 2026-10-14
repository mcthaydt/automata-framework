import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LLMs.txt & Docs Pipeline', () => {
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

  it('generates llms-full.txt with 5 Golden Rules and full markdown', () => {
    const filePath = resolve(__dirname, '../static/llms-full.txt')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('The 5 Golden Rules for LLMs')
    expect(content).toContain('Sub-tick alpha interpolation')
    expect(content).toContain('Zero Eval')
  })
})
