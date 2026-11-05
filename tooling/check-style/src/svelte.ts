import { parse } from 'svelte/compiler'
import type { StyleFinding } from './style.ts'

// Svelte rules. Read from Svelte's own parse, so comments are never
// read and markup text, attribute values and script strings are all seen.
// - no-html: `{@html}` renders a string as markup, with no escaping. `ui` renders text through Svelte's escaping only.
// - platform-chrome: a game draws only inside its frame. The host (Ruken) draws its own chrome, sign-in and
//   payment UI around it, so a kit that draws any of them could pass for the platform:
//   - a password field, or an `autocomplete` that asks the browser for a credential or a card;
//   - the host's name written into the kit. A "Back to …" label takes `hostName` from the host;
//   - sign-in or payment wording.

type Node = { type: string; start: number; [key: string]: unknown }

const HOST_NAME = /\bRuken\b/i
const CHROME_WORDING =
  /\b(?:sign[\s-]?in|log[\s-]?in|sign[\s-]?up|create (?:an )?account|password|card number|cvv|cvc|billing|checkout)\b/i
const CREDENTIAL_AUTOCOMPLETE = /^(?:current-password|new-password|one-time-code|cc-[a-z-]+)$/
/** Keys that hold comments, styles or positions: nothing a player sees. */
const SKIPPED_KEYS = new Set(['comments', 'leadingComments', 'trailingComments', 'css', 'loc', 'name_loc'])

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'

/** The value of an attribute written as plain text; undefined when it has an expression. */
function staticValue(attribute: Node): string | undefined {
  const value = attribute.value
  if (!Array.isArray(value)) return undefined
  if (!value.every((part: Node) => part.type === 'Text')) return undefined
  return value.map((part: Node) => part.data as string).join('')
}

export function checkSvelte(file: string, code: string): StyleFinding[] {
  let root: unknown
  try {
    root = parse(code, { modern: true })
  } catch (error) {
    return [
      { file, rule: 'parse-error', line: 0, message: error instanceof Error ? error.message : String(error) },
    ]
  }
  const findings: StyleFinding[] = []
  const lineOf = (offset: number) => code.slice(0, offset).split('\n').length
  const chrome = (node: Node, what: string) =>
    findings.push({
      file,
      rule: 'platform-chrome',
      line: lineOf(node.start),
      message: `draws platform chrome: ${what}`,
    })
  const readText = (node: Node, text: string) => {
    const host = HOST_NAME.exec(text)
    if (host !== null) chrome(node, `the host's name ("${host[0]}"); take it from hostName`)
    const wording = CHROME_WORDING.exec(text)
    if (wording !== null) chrome(node, `sign-in or payment wording ("${wording[0]}")`)
  }

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child)
      return
    }
    if (typeof value !== 'object' || value === null) return
    if (isNode(value)) {
      const node = value
      if (node.type === 'Comment') return
      if (node.type === 'HtmlTag') {
        findings.push({
          file,
          rule: 'no-html',
          line: lineOf(node.start),
          message: '{@html} renders a string as markup without escaping; render text with {expression}',
        })
      }
      if (node.type === 'Text') readText(node, node.data as string)
      if (node.type === 'Literal' && typeof node.value === 'string') readText(node, node.value)
      if (node.type === 'TemplateElement')
        readText(node, (node.value as { cooked: string | null }).cooked ?? '')
      if (node.type === 'Attribute') {
        const name = (node.name as string).toLowerCase()
        const text = staticValue(node)
        if (name === 'type' && text?.toLowerCase() === 'password') {
          chrome(node, 'a password field (<input type="password">)')
          return
        }
        if (name === 'autocomplete' && text !== undefined) {
          const credential = text
            .toLowerCase()
            .split(/\s+/)
            .find((token) => CREDENTIAL_AUTOCOMPLETE.test(token))
          if (credential !== undefined)
            chrome(node, `a card or credential field (autocomplete="${credential}")`)
          return // an autocomplete token is not wording a player reads
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (!SKIPPED_KEYS.has(key) && typeof child === 'object') visit(child)
    }
  }
  visit(root)
  return findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
}
