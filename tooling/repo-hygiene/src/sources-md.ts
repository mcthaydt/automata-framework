// Checks docs/provenance/sources.md against the manifest of the two builders' files (docs/provenance/builders-manifest.json,
// written from `git ls-files` at the commits recorded there). The record is the one place that names where ported code
// came from, so it has to be whole: each builder has a section with its full commit and how to pull again, and each
// row says where one source file went. With `complete`, a file with no row is an error: the port is not finished
// until every file is a row.

/** One builder: the commit the port reads and every file `git ls-files` lists there. */
export interface Builder {
  readonly commit: string
  readonly files: readonly string[]
}

export interface Manifest {
  readonly figure: Builder
  readonly environment: Builder
}

export interface CheckOptions {
  /** A missing row is an error. */
  readonly complete?: boolean
  /** Whether an AF path exists; the default believes every path, which is what a unit test of the rules wants. */
  readonly exists?: (path: string) => boolean
}

const SECTIONS = [
  { title: 'The figure source', key: 'figure' },
  { title: 'The environment source', key: 'environment' },
] as const

const WAYS = /^(ported(: .+)?|rewritten: .+|left out: .+)$/

/** The text of the `## title` section, up to the next `## ` heading, or undefined when there is none. */
function sectionOf(md: string, title: string): string | undefined {
  const lines = md.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  if (start < 0) return undefined
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return (end < 0 ? rest : rest.slice(0, end)).join('\n')
}

/**
 * `| \`source\` | af | how |` rows: the source path, the AF paths it names (backticked) and how it was taken. The
 * source cell may go on after the path with a note on which names of the file the row covers.
 */
function rowsOf(text: string): { source: string; af: string[]; how: string }[] {
  return text.split('\n').flatMap((line) => {
    const cells = line.split('|').map((cell) => cell.trim())
    const source = /^`([^`]+)`(?:\s.*)?$/.exec(cells[1] ?? '')?.[1]
    if (source === undefined || cells.length < 5) return []
    const af = [...(cells[2] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '')
    return [{ source, af, how: cells[3] ?? '' }]
  })
}

/** Every problem with the record, in section order, each starting with the section it is in. */
export function checkSources(md: string, manifest: Manifest, options: CheckOptions = {}): string[] {
  const exists = options.exists ?? (() => true)
  const problems: string[] = []
  for (const { title, key } of SECTIONS) {
    const text = sectionOf(md, title)
    if (text === undefined) {
      problems.push(`${title}: section missing`)
      continue
    }
    const builder = manifest[key]
    const commit = /\b[0-9a-f]{40}\b/.exec(text)?.[0]
    if (commit === undefined) problems.push(`${title}: no 40-character commit`)
    else if (commit !== builder.commit)
      problems.push(`${title}: commit ${commit} is not the manifest's (${builder.commit})`)
    if (!/git diff/.test(text)) problems.push(`${title}: no pull procedure (a \`git diff\` line)`)
    const known = new Set(builder.files)
    const rowed = new Set<string>()
    for (const { source, af, how } of rowsOf(text)) {
      rowed.add(source)
      if (!known.has(source)) {
        problems.push(`${title}: \`${source}\` is not a file of the manifest`)
        continue
      }
      if (!WAYS.test(how)) {
        problems.push(`${title}: \`${source}\` says "${how}": use ported, rewritten: what, or left out: why`)
        continue
      }
      if (how.startsWith('left out')) continue
      if (af.length === 0)
        problems.push(`${title}: \`${source}\` is ${how.split(':')[0]} but names no AF file`)
      for (const path of af)
        if (!exists(path)) problems.push(`${title}: \`${source}\` goes to \`${path}\`, which does not exist`)
    }
    if (options.complete)
      for (const file of builder.files)
        if (!rowed.has(file)) problems.push(`${title}: \`${file}\` has no row`)
  }
  return problems
}
