import { dirname, posix } from 'node:path'
import { PLAN_MESSAGE, PLAN_REFERENCE } from './plan-comments.ts'
import type { StyleFinding } from './style.ts'

// The two rules for the text around the code: the workflows, config and docs a reader opens say why in plain words
// (no plan IDs), and every relative link in the docs leads to a file that is there. Both read prose only: a value in
// YAML, a fenced code block and an inline code span are what the text shows, not what it says.

/** Folders and files that are records by design: they cite plans and name sources as evidence, so neither rule edits them. */
// The vendored packages' READMEs record where each tarball came from, as provenance does.
const RECORDS = [
  /^docs\/(archive|refactor|provenance|adr)\//,
  /(^|\/)PROVENANCE\.md$/,
  /^vendor\//,
  /(^|\/)fixtures\//,
]
const GENERATED_OR_LOGS = [/(^|\/)CHANGELOG\.md$/, /^\.changeset\//, /(^|\/)node_modules\//]

const isMarkdown = (file: string): boolean => file.endsWith('.md')
const isHashCommented = (file: string): boolean => /\.ya?ml$/.test(file) || file.endsWith('.npmrc')

/** True for a file whose prose the plan-ID rule reads: Markdown, YAML and `.npmrc` outside the records and logs. */
export function checksPlanIds(file: string): boolean {
  if (!isMarkdown(file) && !isHashCommented(file)) return false
  return ![...RECORDS, ...GENERATED_OR_LOGS].some((pattern) => pattern.test(file))
}

/** True for a Markdown file whose links the links rule follows: everything outside the archive and the logs. */
export function checksLinks(file: string): boolean {
  return (
    isMarkdown(file) &&
    !/^docs\/archive\//.test(file) &&
    !GENERATED_OR_LOGS.some((pattern) => pattern.test(file))
  )
}

/** Markdown prose by line number: lines inside a fenced block become empty, and inline code spans are blanked. */
function markdownProse(text: string): string[] {
  let fenced = false
  return text.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      return ''
    }
    return fenced ? '' : line.replace(/`[^`]*`/g, '')
  })
}

/** The comment part of a `#`-commented line: from the first `#` outside quotes that starts the line or follows a space. */
function hashComment(line: string): string {
  let quote: string | undefined
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (quote !== undefined) {
      if (char === quote) quote = undefined
    } else if (char === '"' || char === "'") quote = char
    else if (char === '#' && (index === 0 || /\s/.test(line[index - 1] ?? ''))) return line.slice(index + 1)
  }
  return ''
}

/** One finding per line of prose (Markdown) or comment (YAML, `.npmrc`) that cites a plan. */
export function docPlanIdFindings(file: string, text: string): StyleFinding[] {
  const readable = isMarkdown(file) ? markdownProse(text) : text.split('\n').map(hashComment)
  return readable.flatMap((line, index) =>
    PLAN_REFERENCE.test(line)
      ? [{ file, rule: 'plan-comment' as const, message: PLAN_MESSAGE, line: index + 1 }]
      : [],
  )
}

const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/** One finding per relative link whose target `exists` does not find; paths are relative to the repository root. */
export function linkFindings(file: string, text: string, exists: (path: string) => boolean): StyleFinding[] {
  const findings: StyleFinding[] = []
  markdownProse(text).forEach((line, index) => {
    for (const match of line.matchAll(LINK)) {
      const target = match[1] ?? ''
      // A web address, mail, another scheme, a same-page anchor or a site path is not a file in this repository.
      if (/^[a-z][\w+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) continue
      const path = posix
        .normalize(posix.join(dirname(file), decodeURI(target.replace(/[#?].*$/, ''))))
        .replace(/\/$/, '')
      if (!exists(path))
        findings.push({
          file,
          rule: 'broken-link',
          message: `${target} leads nowhere: fix or remove the link.`,
          line: index + 1,
        })
    }
  })
  return findings
}
