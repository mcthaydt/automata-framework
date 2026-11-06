import { parseSync } from 'oxc-parser'
import type { StyleFinding } from './style.ts'

// A comment should say why, not which plan asked for the code. This reads every comment in a .ts, .svelte or .css file
// (strings and values are never read, so a URL or a CSS `content` that looks like a code passes).

/**
 * The ways a plan is cited: a milestone number with an optional decision (an M, digits, a dot and more digits, a
 * dash and a letter with digits), a plan code with an upper-case prefix and a number, a numbered task, or a section
 * sign. They say which plan, not why.
 */
const PLAN_REFERENCE = new RegExp(
  [
    String.raw`\bM\d{1,2}(?:\.\d+[a-z]?)?(?:-[A-Z]\d+[a-z]?)?(?![\w-])`,
    String.raw`\b(?:DX|EX|QB|PUB|DIST|PRODUCT|APP|GAME|GL|CI|ED2D|ED3D)[.-][\w.-]+`,
    String.raw`\b[A-Z]{2,}(?:\.[A-Z]+)*\.\d`,
    String.raw`\b[Tt]asks?\s+\d+\.\d+`,
    String.raw`§\s?\d`,
  ].join('|'),
)
const MESSAGE = 'A comment should say why, not which plan asked for it. Explain the reason in plain words.'

const lineAt = (code: string, offset: number): number => code.slice(0, offset).split('\n').length

/** One finding per line of a comment's text that cites a plan; `firstLine` is the line the text starts on. */
function citingLines(file: string, text: string, firstLine: number): StyleFinding[] {
  const out: StyleFinding[] = []
  text.split('\n').forEach((line, offset) => {
    if (PLAN_REFERENCE.test(line))
      out.push({ file, rule: 'plan-comment', message: MESSAGE, line: firstLine + offset })
  })
  return out
}

/** Comments in code the parser reads: the parser lists them, so a string is never mistaken for one. */
function scriptFindings(file: string, code: string, lineOffset: number): StyleFinding[] {
  // A Svelte file's script is TypeScript, whatever the file is called.
  return parseSync(file.endsWith('.svelte') ? 'script.ts' : file, code).comments.flatMap((comment) =>
    citingLines(file, comment.value, lineAt(code, comment.start) + lineOffset),
  )
}

/** The block comments of a stylesheet (CSS has no other kind). */
function blockFindings(file: string, css: string, lineOffset: number): StyleFinding[] {
  return [...css.matchAll(/\/\*([\s\S]*?)\*\//g)].flatMap((match) =>
    citingLines(file, match[1] ?? '', lineAt(css, match.index) + lineOffset),
  )
}

/** A Svelte file's `<script>` and `<style>` blocks, then its `<!-- -->` comments with those blocks blanked. */
function svelteFindings(file: string, code: string): StyleFinding[] {
  const out: StyleFinding[] = []
  let markup = code
  for (const block of code.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const body = block[2] ?? ''
    const bodyStart = block.index + block[0].indexOf('>') + 1
    const lineOffset = lineAt(code, bodyStart) - 1
    out.push(
      ...(block[1] === 'script'
        ? scriptFindings(file, body, lineOffset)
        : blockFindings(file, body, lineOffset)),
    )
    markup = markup.replace(block[0], block[0].replace(/[^\n]/g, ' '))
  }
  for (const comment of markup.matchAll(/<!--([\s\S]*?)-->/g))
    out.push(...citingLines(file, comment[1] ?? '', lineAt(markup, comment.index)))
  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
}

/** The comments in `code` that cite a plan; the file's extension says which comment syntax to read. */
export function planCommentFindings(file: string, code: string): StyleFinding[] {
  if (file.endsWith('.css')) return blockFindings(file, code, 0)
  if (file.endsWith('.svelte')) return svelteFindings(file, code)
  return scriptFindings(file, code, 0)
}
