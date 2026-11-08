import { describe, expect, it } from 'vitest'
import { type TemplateOptions, templateFilesOf } from '#src/shared/create-game/template.ts'
import {
  AGENT_FILES_2D,
  AUTOMATA_MARKETPLACE,
  AUTOMATA_SKILLS_REPO,
} from '#src/shared/create-game/template-agent.ts'

// What a coding agent finds in a new game's folder before it reads any code: a page of rules that works with or without
// the Automata plugin, one line for Claude Code, and the settings that offer the plugin as soon as the folder is trusted.

const KINDS = ['2d', 'story', '3d'] as const
type Kind = (typeof KINDS)[number]

const optionsFor = (kind: Kind): TemplateOptions => ({
  id: 'coin-run',
  title: 'Coin Run',
  template: kind === '3d' ? '3d' : '2d',
  story: kind === 'story',
})

const contentOf = (kind: Kind, path: string): string => {
  const file = templateFilesOf(optionsFor(kind)).find((each) => each.path === path)
  if (file === undefined) throw new Error(`${kind} has no ${path}`)
  return file.content(optionsFor(kind))
}

describe('the agent files of a new game', () => {
  it.each(KINDS)('a %s game has the three agent files', (kind) => {
    const paths = templateFilesOf(optionsFor(kind)).map((file) => file.path)
    expect(paths).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', '.claude/settings.json']))
  })

  it('settings name the mirror and turn the plugin on, exactly', () => {
    expect(JSON.parse(contentOf('2d', '.claude/settings.json'))).toEqual({
      extraKnownMarketplaces: {
        automata: { source: { source: 'github', repo: 'mcthaydt/automata-skills' } },
      },
      enabledPlugins: { 'automata@automata': true },
    })
    expect(AUTOMATA_SKILLS_REPO).toBe('mcthaydt/automata-skills')
    expect(AUTOMATA_MARKETPLACE).toBe('automata')
  })

  it('CLAUDE.md is one line', () => {
    expect(contentOf('2d', 'CLAUDE.md')).toBe('@AGENTS.md\n')
  })

  it.each(KINDS)('a %s game’s AGENTS.md works without the plugin and never says stop', (kind) => {
    const text = contentOf(kind, 'AGENTS.md')
    for (const words of [
      'Coin Run',
      'pnpm check',
      'automata-content',
      'npx skills add https://github.com/mcthaydt/automata-skills',
      '/plugin install automata@automata',
      'content/tuning.toml',
      'Math.random',
    ])
      expect(text).toContain(words)
    expect(text).not.toMatch(/\bstop\b/i)
    expect(text.split('\n').length).toBeLessThanOrEqual(80)
  })

  it('the Claude Code line is the only Claude-only line', () => {
    const lines = contentOf('2d', 'AGENTS.md')
      .split('\n')
      .filter((line) => /claude/i.test(line))
    expect(lines.every((line) => line.includes('In Claude Code:'))).toBe(true)
  })

  it('a story game’s AGENTS.md lists the words, scenes and thinking; a plain game’s does not', () => {
    expect(contentOf('story', 'AGENTS.md')).toContain('content/lines/')
    expect(contentOf('2d', 'AGENTS.md')).not.toContain('content/lines/')
  })

  it('a 3D game’s AGENTS.md has the 3D rows; a 2D game’s has none', () => {
    const three = contentOf('3d', 'AGENTS.md')
    expect(three).toContain('af-sector.json')
    expect(three).toContain('content/figure')
    for (const kind of ['2d', 'story'] as const) {
      const text = contentOf(kind, 'AGENTS.md')
      expect(text).not.toMatch(/\b3D\b|af-sector|\bfigures?\b/)
    }
  })

  it('.gitignore keeps a person’s own Claude settings out, and not the shared ones', () => {
    for (const kind of KINDS) {
      const ignore = contentOf(kind, '.gitignore')
      expect(ignore).toContain('.claude/settings.local.json')
      expect(ignore.split('\n')).not.toContain('.claude/')
    }
  })

  it.each(KINDS)('a %s game has a Svelte config', (kind) => {
    expect(contentOf(kind, 'svelte.config.js')).toBe('export default {}\n')
  })

  it('exports the files of a plain 2D game for the other templates to reuse', () => {
    expect(AGENT_FILES_2D.map((file) => file.path)).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
      '.claude/settings.json',
    ])
  })
})
