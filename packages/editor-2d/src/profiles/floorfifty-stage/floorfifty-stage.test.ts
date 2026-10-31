import { describe, expect, it } from 'vitest'
import { counterIds } from '../../model/ids'
import { createProfileRegistry } from '../profile'
import { renameStage } from './commands/identity-edits'
import { moveLayer } from './commands/layer-edits'
import { floorFiftyStage } from './floorfifty-stage'
import { NEW_STAGE_TEXT } from './new-stage'
import { printStage } from './stage-codec'
import { emptyTemplate, simpleCityTemplate } from './templates/stage-templates'
import { artAliases, minimal } from './testing/check-docs'
import { SHIPPED_STAGE_IDS, shippedStage } from './testing/shipped-stages'
import { documentOf, MINIMAL_STAGE } from './testing/stage-texts'

// The profile object (EDFF.1d step 8, spec §7 and §10): the codec, the checks and the repairs under the editor's interface.

describe('the floorfifty-stage profile', () => {
  it('registers in a registry, once', () => {
    const registry = createProfileRegistry()
    registry.register(floorFiftyStage)
    expect(registry.get('floorfifty-stage')).toBe(floorFiftyStage)
    expect(floorFiftyStage.label).toBe('FloorFifty stage')
    expect(() => registry.register(floorFiftyStage)).toThrow('already registered')
  })

  describe('sniff', () => {
    it('claims the four shipped stages, whatever the file is called', () => {
      for (const id of SHIPPED_STAGE_IDS) {
        expect(floorFiftyStage.sniff(`${id}.toml`, shippedStage(id)), id).toBe(true)
        expect(floorFiftyStage.sniff('whatever.txt', shippedStage(id)), id).toBe(true)
      }
    })

    it('claims a stage the parser will refuse, so the editor can say where (FF-j)', () => {
      const broken = shippedStage('dawn').replace('[theme]', '[theme')
      expect(floorFiftyStage.sniff('dawn.toml', broken)).toBe(true)
      const noRootKey = MINIMAL_STAGE.replace('platformAlias = "world.platform"\n', '')
      expect(floorFiftyStage.sniff('tiny.toml', noRootKey)).toBe(true)
      expect(floorFiftyStage.sniff('tiny.txt', noRootKey)).toBe(false)
      expect(floorFiftyStage.sniff('layers.toml', '[[theme.layers]]\nalias = "a"')).toBe(true)
      expect(floorFiftyStage.sniff('theme.toml', '[theme.presentation]\nprofile = "aquarian"')).toBe(true)
      expect(floorFiftyStage.sniff('theme.toml', '[themed]\nkey = 1')).toBe(false)
    })

    it('leaves other files alone', () => {
      expect(floorFiftyStage.sniff('project.af2d.json', '{ "format": "af2d" }')).toBe(false)
      expect(floorFiftyStage.sniff('levels.toml', 'name = "moss"\n[[layers]]\nid = "a"')).toBe(false)
      expect(floorFiftyStage.sniff('empty.toml', '')).toBe(false)
      expect(floorFiftyStage.sniff('note.toml', 'a platformAlias = "x" in the middle of a line')).toBe(false)
    })
  })

  describe('parse and print', () => {
    it('opens and prints each shipped stage back byte for byte (FF-a)', () => {
      for (const id of SHIPPED_STAGE_IDS) {
        const text = shippedStage(id)
        const parsed = floorFiftyStage.parse(text)
        expect(parsed.ok, id).toBe(true)
        if (parsed.ok) expect(floorFiftyStage.print(text, parsed.value), id).toBe(text)
      }
    })

    it('reports a syntax error with its position (FF-j)', () => {
      const parsed = floorFiftyStage.parse('id = \n')
      expect(parsed).toEqual({
        ok: false,
        error: [
          expect.objectContaining({
            code: 'tomlSyntax',
            line: expect.any(Number),
            column: expect.any(Number),
          }),
        ],
      })
    })

    it('prints a document that was never loaded against the text of a new stage', () => {
      const document = simpleCityTemplate.create(counterIds())
      const text = floorFiftyStage.print('', document)
      expect(text).toBe(printStage(NEW_STAGE_TEXT, document))
      expect(floorFiftyStage.parse(text)).toEqual({
        ok: true,
        value: expect.objectContaining({ value: document.value }),
      })
    })

    it('the text of a new stage is a stage', () => {
      expect(floorFiftyStage.parse(NEW_STAGE_TEXT).ok).toBe(true)
      expect(floorFiftyStage.print(NEW_STAGE_TEXT, documentOf(NEW_STAGE_TEXT))).toBe(NEW_STAGE_TEXT)
    })

    it('prints an edit as the lines it changed', () => {
      const text = shippedStage('rooftops')
      const edited = renameStage(documentOf(text), 'Roofs')
      expect(floorFiftyStage.print(text, edited)).toBe(
        text.replace('displayName = "Rooftops"', 'displayName = "Roofs"'),
      )
    })
  })

  describe('check', () => {
    it('finds nothing wrong with the shipped stages, with their manifest loaded', () => {
      const assets = [...artAliases()]
      for (const id of SHIPPED_STAGE_IDS) {
        expect(floorFiftyStage.check(documentOf(shippedStage(id)), { assets }), id).toEqual([])
      }
    })

    it('says aliases are unchecked when there is no manifest', () => {
      const findings = floorFiftyStage.check(documentOf(shippedStage('dawn')), {})
      expect(findings.map((finding) => finding.code)).toEqual(['aliasesUnchecked'])
    })

    it('reads the assets as the manifest’s aliases (FF-e)', () => {
      const document = renameStage(documentOf(shippedStage('dawn')), 'Dawn')
      const wrong = { ...document, value: { ...document.value, platformAlias: 'world.platfrom' } }
      const findings = floorFiftyStage.check(wrong, { assets: [...artAliases()] })
      expect(findings).toEqual([
        expect.objectContaining({
          code: 'unknownAssetAlias',
          path: 'platformAlias',
          message: expect.stringContaining('world.platform'),
        }),
      ])
    })
  })

  describe('fix', () => {
    it('applies the repair a finding names, and the finding goes (FF-d)', () => {
      const before = documentOf(shippedStage('rooftops'))
      const layers = before.value.theme.layers
      const broken = moveLayer(
        before,
        layers.findIndex((layer) => layer.alias === 'world.cityMid'),
        layers.findIndex((layer) => layer.alias === 'world.cityNear'),
      )
      const reported = floorFiftyStage.check(broken, {}).find((finding) => finding.code === 'layerOrder')
      expect(reported?.fix).toBe('reorder-layers')
      const fixed = floorFiftyStage.fix?.(broken, reported as NonNullable<typeof reported>, {})
      expect(fixed).toEqual(before)
    })
  })

  describe('templates, views and exports', () => {
    it('offers Empty, Sky only and Simple city, in that order', () => {
      expect(floorFiftyStage.templates.map((template) => template.label)).toEqual([
        'Empty',
        'Sky only',
        'Simple city',
      ])
      expect(floorFiftyStage.templates[0]).toBe(emptyTemplate)
    })

    it('has the rail of the spec', () => {
      expect(floorFiftyStage.views.map((view) => [view.id, view.label, view.component])).toEqual([
        ['compose', 'Scene', 'ComposeView'],
        ['course', 'Course', 'CourseView'],
        ['pieces', 'Pieces', 'PiecesView'],
        ['stage', 'Stage', 'StageView'],
        ['assets', 'Assets', 'AssetsView'],
        ['checks', 'Checks', 'ChecksView'],
        ['export', 'Export', 'ExportView'],
      ])
    })

    it('exports the stage file, with its comments, under the game’s folder', () => {
      const [target, ...others] = floorFiftyStage.exports
      expect(others).toEqual([])
      expect(target?.id).toBe('stage-toml')
      const text = shippedStage('rooftops')
      expect(target?.files(documentOf(text), text)).toEqual([
        { path: 'content/stages/rooftops.toml', contents: text },
      ])
    })

    it('exports a stage that was never loaded against a new stage', () => {
      const document = emptyTemplate.create(counterIds())
      const [file] = floorFiftyStage.exports[0]?.files(document, '') ?? []
      expect(file).toEqual({
        path: 'content/stages/new-stage.toml',
        contents: floorFiftyStage.print('', document),
      })
    })

    it('names the file by the stage’s id as it is now', () => {
      const document = documentOf(MINIMAL_STAGE)
      expect(floorFiftyStage.exports[0]?.files(document, MINIMAL_STAGE)[0]?.path).toBe(
        'content/stages/tiny.toml',
      )
      expect(minimal().value.id).toBe('tiny')
    })
  })
})
