import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import type { EditorTokens } from '#src/shared/kit/tokens/editor-tokens.ts'

// The editors' two looks only work if every colour an editor draws is a token: a literal is the same in both looks, so
// it is right in one and unreadable in the other. This scans the source (the `editor-corners.test.ts` pattern).
const REPO = fileURLToPath(new URL('../../../../../../', import.meta.url))
const ROOTS = ['packages/editor/src', 'packages/editor-3d/src', 'extensions/editors/src']

/**
 * The only lines a literal colour may stay on: each draws on or inside a game picture, or is a fixture (spec §2.1, last
 * row). An entry names the file and the text of the one line, so a new literal in the same file is still caught, and the
 * test below fails when an entry no longer matches anything (a stale exemption).
 */
const ALLOWED_LINES: readonly { readonly file: string; readonly line: string; readonly reason: string }[] = [
  {
    file: 'packages/editor/src/features/level/Palette.svelte',
    line: 'text-shadow: 0 1px 1px rgb(0 0 0 / 0.6)',
    reason: 'text shadow on a tile of the game',
  },
  {
    file: 'packages/editor/src/features/tiles/TilesetSheet.svelte',
    line: 'text-shadow: 0 1px 1px rgb(0 0 0 / 0.6)',
    reason: 'text shadow on a tile of the game',
  },
  {
    file: 'packages/editor-3d/src/features/levels-3d/plan/PlanCanvas.svelte',
    line: 'background: #0c0d10;',
    reason: "the Plan's field, which is the colour the plan draws its clear in (`plan-colors.ts`)",
  },
  {
    file: 'packages/editor-3d/src/features/levels-3d/walk/WalkCanvas.svelte',
    line: 'background: #0c0d10;',
    reason: "Walk's field, the same dark behind the picture in both looks",
  },
  {
    file: 'packages/editor-3d/src/features/levels-3d/dollhouse/DollhouseCanvas.svelte',
    line: 'background: #0c0d10;',
    reason: "the 3D view's field, the same dark behind the picture in both looks",
  },
  {
    file: 'extensions/editors/src/features/sequence/SequencePreview.svelte',
    line: 'fill: black;',
    reason: "the game's letterbox",
  },
  {
    file: 'packages/editor/src/shared/level-2d/canvas/textures.manager.ts',
    line: "strokeStyle = 'rgba(0, 0, 0, 0.35)'",
    reason: "a tile's edge, drawn on the level's own picture",
  },
  {
    file: 'packages/editor/src/features/characters/EntityInspector.svelte',
    line: "def.color ?? '#94a3b8'",
    reason: "a character's default colour is game data",
  },
  {
    file: 'packages/editor/src/testing/kit/JourneyFixture.svelte',
    line: 'background: #222;',
    reason: 'a fixture, not chrome',
  },
  {
    file: 'packages/editor/src/testing/level-2d/png.ts',
    line: "?? '#000000'",
    reason: 'a fixture picture, not chrome',
  },
  {
    file: 'packages/editor/src/app/design/DesignBoard.svelte',
    line: "palette={['#1d278a'",
    reason: 'sample swatches',
  },
]

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

interface Source {
  readonly file: string
  readonly text: string
}

const sources: Source[] = ROOTS.flatMap((root) => walk(join(REPO, root))).map((path) => ({
  file: relative(REPO, path),
  text: readFileSync(path, 'utf8'),
}))

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** What an editor says about colour in CSS: each Svelte `<style>`, each stylesheet but the generated token files. */
const styles: Source[] = sources.flatMap(({ file, text }) => {
  if (file.endsWith('.svelte')) {
    return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => ({
      file,
      text: stripComments(m[1] ?? ''),
    }))
  }
  if (file.endsWith('.css') && !/\/(tokens|tool-theme|fonts)\.css$/.test(file)) {
    return [{ file, text: stripComments(text) }]
  }
  return []
})

/**
 * Colour written where CSS does not reach: Svelte markup (`style="…"`, `style:color={…}`, an SVG `fill="…"`) and the
 * lines of `.ts` that set a style, a fill or a stroke (inline style strings, chrome drawn on a canvas).
 */
const inline: Source[] = sources.flatMap(({ file, text }) => {
  if (file.endsWith('.svelte')) {
    const markup = text
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
    return [
      {
        file,
        text: markup
          .split('\n')
          .filter((l) => /style|fill|stroke|color/i.test(l) && !l.includes('href="#'))
          .join('\n'),
      },
    ]
  }
  if (file.endsWith('.ts')) {
    return [
      {
        file,
        text: text
          .split('\n')
          .filter((l) => /style|fill|stroke/i.test(l) && !l.trim().startsWith('//'))
          .join('\n'),
      },
    ]
  }
  return []
})

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])(?:white|black)(?![\w-])/
const allowed = (file: string, line: string): boolean =>
  ALLOWED_LINES.some((a) => a.file === file && line.includes(a.line))
const literalsIn = (list: Source[]): string[] =>
  list.flatMap(({ file, text }) =>
    text
      .split('\n')
      .filter((line) => !line.includes('white-space') && LITERAL.test(line) && !allowed(file, line))
      .map((line) => `${file}: ${line.trim()}`),
  )

describe('editor colours are tokens', () => {
  test('no colour literal outside the game pictures', () => {
    expect(literalsIn([...styles, ...inline])).toEqual([])
  })

  test('every allowed line is still there, so an exemption never outlives its line', () => {
    const everything = [...styles, ...inline]
    const stale = ALLOWED_LINES.filter(
      ({ file, line }) => !everything.some((source) => source.file === file && source.text.includes(line)),
    ).map(({ file, line }) => `${file}: ${line}`)
    expect(stale).toEqual([])
  })

  test('no fallback colour: var(--x, <colour>)', () => {
    const found = [...styles, ...inline].flatMap(({ file, text }) =>
      [...text.matchAll(/var\(--[\w-]+,\s*(?:#|rgb|hsl|white|black)/g)].map(() => file),
    )
    expect(found).toEqual([])
  })

  test('every var() an editor reads with no fallback is a token or a property its own component sets', () => {
    // A name nothing defines is a silent `unset`; with a colour fallback it is also the wrong colour in one look (the
    // case above). A fallback to another token still follows the look, so only the bare read is checked.
    const defined = new Set<string>()
    const add = (text: string): void => {
      // `--name:` in CSS or a style attribute, and Svelte's `style:--name={…}`.
      for (const m of text.matchAll(/(?<![\w-])--([\w-]+)\s*:|style:--([\w-]+)/g))
        defined.add((m[1] ?? m[2]) as string)
    }
    const tokensDir = join(REPO, 'packages/editor/src/shared/kit')
    for (const css of ['tokens.css', 'tool-theme.css', 'tool-chrome.css'])
      add(readFileSync(join(tokensDir, css), 'utf8'))
    for (const { file, text } of sources) {
      if (/\.(css|svelte)$/.test(file)) add(text)
      else if (file.endsWith('.ts')) for (const m of text.matchAll(/--([\w-]+)/g)) defined.add(m[1] as string)
    }
    const unknown = [...styles, ...inline].flatMap(({ file, text }) =>
      [...text.matchAll(/var\(--([\w-]+)\s*\)/g)]
        .map((m) => m[1] as string)
        .filter((name) => !defined.has(name))
        .map((name) => `${file}: --${name}`),
    )
    expect(unknown).toEqual([])
  })

  test('words on the lime or the accent are not ink', () => {
    const rules = styles.flatMap(({ file, text }) =>
      [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
        file,
        selector: (m[1] ?? '').trim(),
        body: m[2] ?? '',
      })),
    )
    const bad = rules
      .filter(({ body }) => /background(?:-color)?:\s*var\(--(?:primary|lime|cobalt|accent)\b/.test(body))
      .filter(({ body }) => /(?<![-\w])color:\s*var\(--ink\)/.test(body))
      .map(({ file, selector }) => `${file}: ${selector}`)
    expect(bad).toEqual([])
  })

  test('words and marks on the cabinet are fixed: only --stage-*, --lime and --primary*', () => {
    // The cabinet (`--color-bg-canvas`, `--charcoal`) is the same in both looks, so what is drawn on it must be too.
    // An outer edge that meets the chrome (`--line`, `--color-border-*`) is chrome and follows the look.
    const rules = styles.flatMap(({ file, text }) =>
      [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
        file,
        selector: (m[1] ?? '').trim(),
        body: m[2] ?? '',
      })),
    )
    const drawsColour = /^(?:color|fill|stroke|border(?:-(?:top|right|bottom|left))?(?:-color)?)$/
    const fixed = /^(?:stage-|lime$|primary|kind$|swatch$)/
    const chromeEdge = /^(?:line|line-strong|color-border-\w+|edge-\w+)$/
    const bad = rules
      .filter(({ body }) => /background(?:-color)?:[^;]*var\(--(?:color-bg-canvas|charcoal)\b/.test(body))
      .flatMap(({ file, selector, body }) =>
        body
          .split(';')
          .map((declaration) => declaration.split(/:(.*)/s))
          .filter(([property]) => drawsColour.test((property ?? '').trim()))
          .flatMap(([property, value]) =>
            [...(value ?? '').matchAll(/var\(--([\w-]+)/g)]
              .map((m) => m[1] as string)
              .filter(
                (name) =>
                  !fixed.test(name) && !(property?.trim().startsWith('border') && chromeEdge.test(name)),
              )
              .map((name) => `${file}: ${selector.replace(/\s+/g, ' ')} ${property?.trim()} reads --${name}`),
          ),
      )
    expect(bad).toEqual([])
  })

  test('what is drawn over a game picture reads no chrome colour at all', () => {
    // Walk's HUD and sticks, the Studio's stage, the pose marks and Feel's square sit on the game, which does not change.
    const OVER_THE_GAME = [
      'packages/editor-3d/src/features/levels-3d/walk/WalkHud.svelte',
      'packages/editor-3d/src/features/levels-3d/walk/WalkSticks.svelte',
      'packages/editor-3d/src/features/studio/ui/StudioCanvas.svelte',
    ]
    const chrome =
      /var\(--(?:ink|muted|paper|bg|line|color-text-[\w-]+|color-bg-(?:app|surface|raised|field)|color-border-[\w-]+)\b/
    for (const file of OVER_THE_GAME) {
      const own = styles.filter((style) => style.file === file)
      expect(own.length, file).toBeGreaterThan(0)
      for (const { text } of own) expect(text, file).not.toMatch(chrome)
    }
  })

  test("Feel's stage is a small cabinet: the square is drawn in the on-stage ink", () => {
    const feel = styles.find(({ file }) => file === 'extensions/editors/src/features/feel/FeelStage.svelte')
    const canvas = /canvas\s*\{([^}]*)\}/.exec(feel?.text ?? '')?.[1] ?? ''
    expect(canvas).toMatch(/background:\s*var\(--charcoal\)/)
    expect(canvas).toMatch(/(?<![-\w])color:\s*var\(--stage-ink\)/)
  })

  test('the canvas palette is a plain hex, and not themed', () => {
    const tokens = (
      JSON.parse(
        readFileSync(join(REPO, 'packages/editor/src/shared/kit/tokens/tokens.json'), 'utf8'),
      ) as EditorTokens
    ).tokens
    for (const [name, value] of Object.entries(tokens)) {
      if (/^color-(layer|phase|stage)-/.test(name)) expect(value, name).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  test('every editor entry imports tool-chrome.css after the tokens', () => {
    const entries = sources.filter(
      ({ file }) =>
        /^packages\/editor\/src\/app\/[\w-]+\/main\.ts$/.test(file) ||
        file === 'packages/editor-3d/src/app/suite/suite-main.ts' ||
        file === 'extensions/editors/src/app/suite/main.ts',
    )
    expect(entries.map(({ file }) => file).sort()).toEqual([
      'extensions/editors/src/app/suite/main.ts',
      'packages/editor-3d/src/app/suite/suite-main.ts',
      'packages/editor/src/app/design/main.ts',
      'packages/editor/src/app/suite/main.ts',
    ])
    for (const { file, text } of entries) {
      expect(text.indexOf('tool-chrome.css'), file).toBeGreaterThan(text.indexOf('tokens.css'))
    }
  })
})
