// The cheatsheet: one page, grouped by module, one line per export, rendered from the API
// index's rows. It holds no list of its own: every name, kind, call form and summary comes from `ApiExport`, so
// the page cannot drift from the published `.d.ts` (one contract owner). The full signatures stay in `api.md`.
import ts from 'typescript'
import type { ApiExport } from './rows.ts'

function specifier(row: ApiExport): string {
  return row.entryPoint === '.' ? row.package : `${row.package}${row.entryPoint.slice(1)}`
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function parameterText(parameter: ts.ParameterDeclaration): string {
  const rest = parameter.dotDotDotToken === undefined ? '' : '...'
  const optional = parameter.questionToken === undefined && parameter.initializer === undefined ? '' : '?'
  return `${rest}${collapse(parameter.name.getText())}${optional}`
}

/**
 * A function's call forms, `name(a, b)`, one per distinct parameter list. The signature is the index's
 * declaration text (overloads one after another), parsed as a declaration file to read the parameter names.
 */
function callForms(row: ApiExport): string[] {
  const source = ts.createSourceFile('signature.d.ts', row.signature, ts.ScriptTarget.ES2022, true)
  const forms = source.statements
    .filter(ts.isFunctionDeclaration)
    .map((declaration) => `${row.name}(${declaration.parameters.map(parameterText).join(', ')})`)
  return forms.length === 0 ? [row.name] : [...new Set(forms)]
}

/**
 * The doc comment's first sentence. The description is the text before the first blank line or `@tag`; a
 * sentence ends at `.`, `!` or `?` followed by a space and anything but a lowercase letter, so "e.g. x" does not
 * end one.
 */
function summary(doc: string): string {
  const description: string[] = []
  for (const line of doc.split('\n')) {
    if (line.trim() === '' || line.startsWith('@')) break
    description.push(line)
  }
  const text = collapse(description.join(' '))
  return /^(.+?[.!?])(?=\s+[^a-z]|$)/.exec(text)?.[1] ?? text
}

function exportLine(row: ApiExport): string {
  const name =
    row.kind === 'function'
      ? callForms(row)
          .map((form) => `\`${form}\``)
          .join(', ')
      : `\`${row.name}\` (${row.kind})`
  const deprecated = /^@deprecated\b/m.test(row.doc) ? ' (deprecated)' : ''
  const text = `${summary(row.doc)}${deprecated}`.trim()
  return text === '' ? `- ${name}` : `- ${name}: ${text}`
}

/** The cheatsheet page. It names no version, so only an API or doc-comment change alters it. */
export function cheatsheet(exports: readonly ApiExport[]): string {
  const lines = [
    '# Automata cheatsheet',
    '',
    '> Every export of every published `@mcthaydt/automata-*` entry point, one line each, grouped by module (package). Generated from the API index by `pnpm cheatsheet` after `pnpm build`; do not edit by hand. `pnpm api-index` fails when this page is stale. Full signatures and doc comments: the API reference (`api.md`).',
    '',
  ]
  // A heading closes the list before it with a blank line, as Markdown needs.
  const heading = (text: string) => {
    if (lines.at(-1) !== '') lines.push('')
    lines.push(text, '')
  }
  let lastPackage = ''
  let lastSpecifier = ''
  for (const row of exports) {
    if (row.package !== lastPackage) {
      heading(`## \`${row.package}\``)
      lastPackage = row.package
    }
    if (specifier(row) !== lastSpecifier) {
      heading(`### \`import { … } from '${specifier(row)}'\``)
      lastSpecifier = specifier(row)
    }
    lines.push(exportLine(row))
  }
  return `${lines.join('\n')}\n`
}
