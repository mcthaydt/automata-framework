import { describe, expect, it } from 'vitest'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { checkProject } from '#src/shared/level-2d/profiles/level-project/project-checks.ts'
import { blankTemplate } from '#src/shared/level-2d/profiles/level-project/templates/blank.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { createProfileRegistry, type ProfileSummary } from '#src/shared/level-2d/profiles/profile.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'

const canonical = printProject(platformerTemplate.create(counterIds()))

describe('the level-project profile', () => {
  it('registers, and is a Profile of the registry', () => {
    const registry = createProfileRegistry()
    registry.register(levelProject)
    expect(registry.get('level-project')).toBe(levelProject)
    expect(levelProject.label).toBe('Level project')
  })

  describe('sniff', () => {
    it('claims a file named .af2d.json whatever it holds', () => {
      expect(levelProject.sniff('mossgate.af2d.json', '')).toBe(true)
      expect(levelProject.sniff('MOSSGATE.AF2D.JSON', 'not json')).toBe(true)
    })

    it('claims other names whose text opens with the af2d format', () => {
      expect(levelProject.sniff('game.json', canonical)).toBe(true)
    })

    it('leaves other files alone', () => {
      expect(levelProject.sniff('stage.toml', 'name = "Dawn"')).toBe(false)
      expect(levelProject.sniff('data.json', '{ "format": "other" }')).toBe(false)
      expect(levelProject.sniff('data.json', `${' '.repeat(5000)}{ "format": "af2d" }`)).toBe(false)
    })
  })

  describe('parse and print', () => {
    it('reads a canonical file and prints it back byte for byte (G-b)', () => {
      const parsed = levelProject.parse(canonical)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      expect(levelProject.print(canonical, parsed.value)).toBe(canonical)
    })

    it('reports text that is not JSON with its position (G-n)', () => {
      const parsed = levelProject.parse('{\n  "format": \n')
      expect(parsed).toEqual({
        ok: false,
        error: [
          expect.objectContaining({ code: 'notJson', line: expect.any(Number), column: expect.any(Number) }),
        ],
      })
    })

    it('reports a file that is not an af2d project (G-n)', () => {
      expect(levelProject.parse('{ "format": "other" }')).toEqual({
        ok: false,
        error: [expect.objectContaining({ code: 'notAProject' })],
      })
    })

    it('reports a newer version (G-o)', () => {
      const newer = canonical.replace('"version": 1', '"version": 2')
      expect(levelProject.parse(newer)).toEqual({
        ok: false,
        error: [expect.objectContaining({ code: 'newerVersion' })],
      })
    })

    it('reports each unknown key with its path (G-p)', () => {
      const text = canonical.replace('"format": "af2d",', '"format": "af2d",\n  "extra": 1,\n  "more": 2,')
      const parsed = levelProject.parse(text)
      expect(parsed).toEqual({
        ok: false,
        error: [
          expect.objectContaining({ code: 'unknownKeys', path: 'extra' }),
          expect.objectContaining({ code: 'unknownKeys', path: 'more' }),
        ],
      })
    })

    it('reports schema errors with their paths', () => {
      const parsed = levelProject.parse(canonical.replace('"w": 512', '"w": "wide"'))
      expect(parsed.ok).toBe(false)
      if (parsed.ok) return
      expect(parsed.error[0]).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          path: expect.stringContaining('levels[level-1].size'),
        }),
      )
    })
  })

  it('checks with the project checks', () => {
    const project = platformerTemplate.create(counterIds())
    expect(levelProject.check(project, {})).toEqual(checkProject(project, {}))
  })

  describe('preview', () => {
    it('shows the first level on Home’s card', () => {
      const project = mossgate()
      expect(levelProject.preview?.(project)).toEqual({ project, level: project.levels[0]?.id })
    })

    it('shows nothing for a project with no level', () => {
      expect(levelProject.preview?.({ ...mossgate(), levels: [] })).toBeUndefined()
    })
  })

  describe('summary', () => {
    const summaryOf = (project: Project): ProfileSummary => {
      const summary = levelProject.summary?.(project)
      if (summary === undefined) throw new Error('the profile has no summary')
      return summary
    }

    it('names the project and counts what Home shows, in order', () => {
      expect(summaryOf(mossgate())).toEqual({
        title: 'Mossgate',
        facts: [
          { label: 'Levels', value: '2' },
          { label: 'Layers', value: '4' },
          { label: 'Entities', value: '6 definitions' },
          { label: 'Tilesets', value: '1 placeholder' },
        ],
      })
    })

    it('says a count of one in the singular and a missing count as none', () => {
      const project = platformerTemplate.create(counterIds())
      const factsOf = (p: Project): Map<string, string> =>
        new Map(summaryOf(p).facts.map((fact) => [fact.label, fact.value]))
      expect(factsOf(blankTemplate.create(counterIds())).get('Levels')).toBe('1')
      const bare = { ...project, defs: { ...project.defs, entities: [], tilesets: [] } }
      expect(factsOf(bare).get('Entities')).toBe('None')
      expect(factsOf(bare).get('Tilesets')).toBe('None')
      const one = { ...project, defs: { ...project.defs, entities: project.defs.entities.slice(0, 1) } }
      expect(factsOf(one).get('Entities')).toBe('1 definition')
    })

    it('marks tilesets that have no image yet as placeholders', () => {
      const project = platformerTemplate.create(counterIds())
      const [first] = project.defs.tilesets
      if (first === undefined) throw new Error('the template has a tileset')
      const withImage = (image: string | undefined, count: number): Project => ({
        ...project,
        defs: {
          ...project.defs,
          tilesets: Array.from({ length: count }, (_, i) => ({ ...first, id: `set-${i}`, image })),
        },
      })
      const tilesets = (p: Project): string | undefined =>
        new Map(summaryOf(p).facts.map((fact) => [fact.label, fact.value])).get('Tilesets')
      expect(tilesets(withImage(undefined, 1))).toBe('1 placeholder')
      expect(tilesets(withImage(undefined, 3))).toBe('3 placeholders')
      expect(tilesets(withImage('assets/tiles.png', 2))).toBe('2')
      const mixed: Project = {
        ...project,
        defs: {
          ...project.defs,
          tilesets: [
            { ...first, id: 'a', image: 'assets/tiles.png' },
            { ...first, id: 'b', image: undefined },
            { ...first, id: 'c', image: 'assets/more.png' },
          ],
        },
      }
      expect(tilesets(mixed)).toBe('3 (1 placeholder)')
    })
  })

  it('gives every template a hint for its card', () => {
    expect(levelProject.templates.map((t) => [t.id, t.hint])).toEqual([
      ['platformer', 'jump between platforms'],
      ['topdown-rpg', 'walk around a map'],
      ['blank', 'start from nothing'],
    ])
  })

  it('offers the three templates, each creating a project that opens', () => {
    expect(levelProject.templates.map((t) => [t.id, t.label])).toEqual([
      ['platformer', 'Platformer'],
      ['topdown-rpg', 'Top-down'],
      ['blank', 'Blank'],
    ])
    for (const template of levelProject.templates) {
      const text = printProject(template.create(counterIds()))
      expect(levelProject.parse(text).ok).toBe(true)
    }
  })

  it('has the rail of the spec, each view naming a component', () => {
    expect(levelProject.views.map((view) => [view.id, view.label])).toEqual([
      ['level', 'Level'],
      ['world', 'World'],
      ['tilesets', 'Tilesets'],
      ['entities', 'Entities'],
      ['checks', 'Checks'],
      ['export', 'Export'],
    ])
    expect(new Set(levelProject.views.map((view) => view.component)).size).toBe(6)
  })

  describe('exports', () => {
    const project = platformerTemplate.create(counterIds())

    it('has the working file and the AF content, named in plain words (APP §5b)', () => {
      expect(levelProject.exports.map((target) => [target.id, target.label])).toEqual([
        ['af2d-json', 'Project file'],
        ['af-content', 'Game files'],
      ])
    })

    it('writes the working file named after the project', () => {
      const [file] = levelProject.exports[0]?.files(project, '') ?? []
      expect(file?.path).toBe('untitled-platformer.af2d.json')
      expect(file?.contents).toBe(printProject(project))
    })

    it('names a working file from any project name', () => {
      const name = (value: string): string | undefined =>
        levelProject.exports[0]?.files({ ...project, name: value }, '')[0]?.path
      expect(name('Moss Gate: Part 1!')).toBe('moss-gate-part-1.af2d.json')
      expect(name('  ')).toBe('project.af2d.json')
      expect(name('Éclair')).toBe('eclair.af2d.json')
    })

    it('writes the AF content files', () => {
      const files = levelProject.exports[1]?.files(project, '') ?? []
      expect(files.map((file) => file.path)).toEqual(['project.toml', 'levels/level-1.toml', 'world.toml'])
    })
  })
})
