import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { SKILL_PREFLIGHT } from '#src/features/start/agent-setup.ts'
import Start from '#src/features/start/Start.svelte'
import { AGENT_PROMPT, AUTOMATA_PLUGIN_INSTALL } from '#src/shared/content/agent-prompt.ts'

// "Using a coding agent" on Start, and the prompt Home copies: Automata's own skills first, because they are what know
// how a game here is built; Superpowers and the PixiJS skills are useful beside them.

const REPO = resolve(import.meta.dirname, '../../../..')
const mirror = JSON.parse(
  readFileSync(resolve(REPO, 'agents/automata/.claude-plugin/marketplace.json'), 'utf8'),
) as {
  name: string
  plugins: { name: string }[]
}

describe('the prompt a visitor copies to their agent', () => {
  it('asks for the Automata skills first and never says stop', () => {
    expect(AGENT_PROMPT.indexOf('automata-skills')).toBeGreaterThan(-1)
    expect(AGENT_PROMPT.indexOf('automata-skills')).toBeLessThan(AGENT_PROMPT.indexOf('Superpowers'))
    expect(AGENT_PROMPT).not.toMatch(/\bstop\b/i)
  })

  it('installs the plugin the mirror says it has', () => {
    const plugin = mirror.plugins[0]?.name
    expect(AUTOMATA_PLUGIN_INSTALL.claudeCode[1]).toBe(`/plugin install ${plugin}@${mirror.name}`)
    expect(AUTOMATA_PLUGIN_INSTALL.claudeCode[0]).toBe('/plugin marketplace add mcthaydt/automata-skills')
    expect(AUTOMATA_PLUGIN_INSTALL.other).toBe('npx skills add https://github.com/mcthaydt/automata-skills')
  })

  it('has the agent read the game’s AGENTS.md, which create-game writes, and says the other skills are only useful', () => {
    expect(SKILL_PREFLIGHT).toContain('AGENTS.md')
    expect(SKILL_PREFLIGHT).toMatch(/also useful/i)
    expect(SKILL_PREFLIGHT).not.toMatch(/\bstop\b/i)
  })
})

describe('Start: using a coding agent', () => {
  it('keeps every command copyable and has no checkbox and no counter', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    const commands = () =>
      view.container.querySelectorAll('.agent-setup [aria-label="Copy command"], .agent-setup button')
    expect(commands().length).toBeGreaterThan(0)
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(view.container.textContent).not.toMatch(/\d of 3 ticked/)
  })

  it('lists Automata’s skills first, then the check, then what is also useful', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    const steps = [...view.container.querySelectorAll('.agent-setup ol > li')].map(
      (li) => li.querySelector('h3')?.textContent,
    )
    expect(steps).toEqual(['Install Automata’s skills', 'Ask your agent to check'])
    const headings = [...view.container.querySelectorAll('.agent-setup h2, .agent-setup h3')].map(
      (h) => h.textContent,
    )
    expect(headings.indexOf('Install Automata’s skills')).toBeLessThan(headings.indexOf('Also useful'))
    expect(headings).toEqual(expect.arrayContaining(['Superpowers', 'The PixiJS skills']))
  })

  it('gives Claude Code two commands and another agent one', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    const text = view.container.textContent ?? ''
    for (const line of AUTOMATA_PLUGIN_INSTALL.claudeCode) expect(text).toContain(line)
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Cursor' } })
    expect(view.container.textContent).toContain(AUTOMATA_PLUGIN_INSTALL.other)
  })
})
