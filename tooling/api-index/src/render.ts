// The API index's outputs (DX spec §3.8): `api.json` (data), the Markdown reference written as `api.md` (the
// automata-api skill, §3.7) and `llms-api.txt` (the website), and `llms-full.txt` (the corpus, then the reference).
import { readCorpus } from './corpus.ts'
import type { ApiExport } from './rows.ts'

/** The one version the exports describe. A mixed set is refused: an index covers exactly one version. */
export function indexVersion(exports: readonly ApiExport[]): string {
  const versions = [...new Set(exports.map((row) => row.version))].sort()
  if (versions.length !== 1) {
    throw new Error(
      `the API index describes one version, but the exports have ${versions.join(', ') || 'none'}`,
    )
  }
  return versions[0] as string
}

export function apiJson(exports: readonly ApiExport[]): string {
  return `${JSON.stringify({ version: indexVersion(exports), exports }, null, 2)}\n`
}

function specifier(row: ApiExport): string {
  return row.entryPoint === '.' ? row.package : `${row.package}${row.entryPoint.slice(1)}`
}

/** The reference body: one section per package, one per entry point, one per export. */
function referenceBody(exports: readonly ApiExport[]): string[] {
  const lines: string[] = []
  let lastPackage = ''
  let lastSpecifier = ''
  for (const row of exports) {
    if (row.package !== lastPackage) {
      lines.push(`## \`${row.package}\``, '')
      lastPackage = row.package
    }
    if (specifier(row) !== lastSpecifier) {
      lines.push(`### \`import { … } from '${specifier(row)}'\``, '')
      lastSpecifier = specifier(row)
    }
    lines.push(`#### \`${row.name}\` (${row.kind})`, '')
    lines.push(row.doc === '' ? '_No doc comment._' : row.doc, '')
    lines.push('```ts', row.signature, '```', '')
  }
  return lines
}

/**
 * The Markdown reference, written as both `api.md` (the automata-api skill's `reference/api.md`) and
 * `llms-api.txt` (the website's API file; llms.txt files are Markdown). One text, so the two never differ.
 */
export function apiReference(exports: readonly ApiExport[]): string {
  const version = indexVersion(exports)
  return [
    `# Automata API reference, version ${version}`,
    '',
    `> Every export of every published \`@mcthaydt/automata-*\` entry point at version ${version}, generated from the published \`.d.ts\` files. An export that is not listed here does not exist in this version.`,
    '',
    ...referenceBody(exports),
  ].join('\n')
}

/** `llms-full.txt`: each corpus file in order, then the API reference. */
export function llmsFullText(root: string, corpus: readonly string[], exports: readonly ApiExport[]): string {
  const version = indexVersion(exports)
  const parts = [
    `# Automata Framework ${version}: full documentation`,
    '',
    `> The documents below, in this order, followed by the API reference for version ${version}.`,
    '',
  ]
  for (const { path, text } of readCorpus(root, corpus)) {
    parts.push('---', '', `Source: \`${path}\``, '', text, '')
  }
  parts.push('---', '', apiReference(exports))
  return parts.join('\n')
}
