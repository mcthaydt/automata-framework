import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { AUTOMATA_INSTALL, SKILL_PREFLIGHT } from '../../../src/features/start/agent-setup'
import Start from '../../../src/features/start/Start.svelte'

// The site never imports tooling, so what it states about the plugin is read from the same files tooling reads.
const repo = resolve(process.cwd(), '..')

// "Using a coding agent" on Start: the agent setup the old AI and docs pages held.
describe('Start: using a coding agent', () => {
  it('keeps every command copyable while offering an optional readiness checklist', async () => {
    const view = render(Start)
    const copies = () => view.getAllByRole('button', { name: 'Copy command' })
    expect(copies()).toHaveLength(4)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    for (const label of [
      'Superpowers is installed for this agent',
      'The PixiJS v8 skill collection is installed',
      'The Automata skills are installed',
      'My agent reported and loaded the required skills',
    ])
      await fireEvent.click(view.getByLabelText(label))
    expect(view.getByText(/4 of 4 ticked/)).toBeTruthy()
    expect(view.getByRole('group', { name: 'What your agent said' })).toBeTruthy()
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(copies()).toHaveLength(4)
  })
})

// The Automata skills: the framework's own plugin, offered beside Superpowers and PixiJS once the public repository
// holds it. The lines are the ones the install suite runs against the mirror.
describe('Start: the Automata skills', () => {
  it('offers the Automata plugin beside Superpowers and PixiJS', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    expect(view.getByText('The Automata skills')).toBeTruthy()
    expect(AUTOMATA_INSTALL.marketplace).toBe('/plugin marketplace add mcthaydt/automata-skills')
    expect(AUTOMATA_INSTALL.plugin).toBe('/plugin install automata@automata-skills')
    expect(AUTOMATA_INSTALL.skills).toBe('npx skills add mcthaydt/automata-skills')
    // Codex is the default pick, so the card shows the one-line install; Claude Code's two lines follow its pick.
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.skills)
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.marketplace)
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.plugin)
  })

  it('leads with the line for the agent that is picked', async () => {
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    const picker = view.getByLabelText('Your coding agent')
    // Codex is the default: the one-line install, not Claude Code's two plugin lines.
    await fireEvent.change(picker, { target: { value: 'Codex' } })
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.skills)
    expect(view.container.textContent).not.toContain(AUTOMATA_INSTALL.plugin)
    expect(view.container.textContent).not.toContain('In Claude Code, type:')
    await fireEvent.change(picker, { target: { value: 'Claude Code' } })
    expect(view.container.textContent).toContain('In Claude Code, type:')
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.marketplace)
    expect(view.container.textContent).toContain(AUTOMATA_INSTALL.plugin)
  })

  it('says which Claude Code version the lines were tested on', async () => {
    // The pin the install suite runs on, written once, in the root script that validates the plugin.
    const scripts = (
      JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    ).scripts
    const version = /@anthropic-ai\/claude-code@(\d+\.\d+\.\d+)/.exec(scripts['plugin:validate'] ?? '')?.[1]
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(AUTOMATA_INSTALL.testedOn).toBe(`Claude Code ${version}`)
    const view = render(Start)
    await fireEvent.click(view.getByText('Set up your coding agent'))
    // It belongs to the Claude Code lines, so it shows with them.
    await fireEvent.change(view.getByLabelText('Your coding agent'), { target: { value: 'Claude Code' } })
    expect(view.container.textContent).toContain(`Tested on ${AUTOMATA_INSTALL.testedOn}.`)
  })

  it('the preflight lists every skill the plugin has', () => {
    const skills = readdirSync(join(repo, 'agents/automata/skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    expect(skills.length).toBeGreaterThan(0)
    for (const name of skills) expect(SKILL_PREFLIGHT).toContain(name)
    expect(SKILL_PREFLIGHT).toContain('If any of them is missing')
    // The Automata skills have no upstream: their install steps are the card on this page.
    expect(SKILL_PREFLIGHT).toContain(
      'for the Automata skills, ask me for the install steps on the Automata Framework site’s Start page',
    )
  })
})
