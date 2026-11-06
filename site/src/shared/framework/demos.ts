import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { featureDemos } from './examples.ts'
import { repositoryRoot } from './root.ts'

/** A game the site embeds whole: Emberwick and the feature demos, each built by scripts/build-demos.ts. */
export interface Demo {
  readonly slug: string
  /** From the repository root: `games/emberwick`, `examples/2d/content/hot-reload`. */
  readonly path: string
  /** The `main.ts` header's first line, after its path: `content that changes while the game runs.` */
  readonly title: string
  /** The header's `Shows:` paragraph. */
  readonly shows: string
  /** Where the build is served: `/demos/<slug>/index.html`. */
  readonly bundleUrl: string
}

/**
 * The `main.ts` header comment as plain lines: a run of `//` lines (Emberwick, hot-reload) or a leading `/** ... *\/`
 * block (primitives), with the comment markers taken off.
 */
function headerLines(source: string): string[] {
  const lines = source.split('\n')
  if (lines[0]?.startsWith('/**')) {
    const end = lines.findIndex((line) => line.includes('*/'))
    return lines.slice(1, end).map((line) => line.replace(/^\s*\*\s?/, ''))
  }
  const end = lines.findIndex((line) => !line.startsWith('//'))
  return lines.slice(0, end < 0 ? lines.length : end).map((line) => line.replace(/^\/\/\s?/, ''))
}

/**
 * One field of a demo's header: `Shows: ...` (or `What it shows:`) and the lines that continue it, up to a blank line or
 * the next `Field:` line.
 */
export function headerField(lines: readonly string[], field: RegExp): string {
  const start = lines.findIndex((line) => field.test(line))
  if (start < 0) return ''
  const parts = [lines[start].slice(lines[start].indexOf(':') + 1).trim()]
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || /^[A-Z][A-Za-z ]+:/.test(line)) break
    parts.push(line.trim())
  }
  return parts.filter(Boolean).join(' ')
}

function readDemo(root: string, slug: string, path: string): Demo {
  const lines = headerLines(readFileSync(join(root, path, 'main.ts'), 'utf8'))
  // The first line is `<path>: <title>`.
  const title = /^[^:]+: (.+)$/.exec(lines[0] ?? '')?.[1]?.trim() ?? slug
  return { slug, path, title, shows: headerField(lines, /^(What it shows|Shows):/), bundleUrl: `/demos/${slug}/index.html` }
}

/** Emberwick first, then the feature demos by path. */
export function demoList(root: string = repositoryRoot): Demo[] {
  return [
    readDemo(root, 'emberwick', 'games/emberwick'),
    ...featureDemos(root).map((demo) => readDemo(root, demo.slug, `examples/2d/${demo.path}`)),
  ]
}
