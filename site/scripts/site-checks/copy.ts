/// <reference path="../jsdom.d.ts" />
// The built site's words: phrases it must never use, the reference projects it never names, and the four targets it
// names wherever it says where a game goes.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'

/**
 * Placeholder and AI-filler phrases (quality-bar spec §4.2). Matched on whole words in each page's text, title and
 * description; TODO is matched in capitals only, so prose about a "todo list" is not flagged.
 */
export const BANNED_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: 'lorem', pattern: /\blorem\b/i },
  { label: 'TODO', pattern: /\bTODO\b/ },
  { label: 'coming soon', pattern: /\bcoming soon\b/i },
  { label: 'seamless', pattern: /\bseamless(ly)?\b/i },
  { label: 'cutting-edge', pattern: /\bcutting[- ]edge\b/i },
  { label: 'unleash', pattern: /\bunleash(es|ed|ing)?\b/i },
  { label: 'supercharge', pattern: /\bsupercharg(e|es|ed|ing)\b/i },
  { label: 'revolutionize', pattern: /\brevolutioni[sz](e|es|ed|ing)\b/i },
  { label: 'game-changer', pattern: /\bgame[- ]?changer(s)?\b/i },
]

/**
 * STANDALONE.1 (Owner, 2026-10-31: "automata framework is standalone"): the reference projects the framework was
 * extracted from are not named on the site. Their record is the framework's private provenance file (STANDALONE.2).
 */
export const STANDALONE_NAMES: { label: string; pattern: RegExp }[] = [
  { label: 'FloorFifty', pattern: /\bfloor\s?fifty\b/i },
  { label: 'The Last Light', pattern: /\blast\s+light\b/i },
  { label: 'PixiJS3D_Experiment_001', pattern: /\bpixijs3d[_-]experiment/i },
]

/**
 * Wording that casts one distribution target as the framework's own host (ADR 0006: web, itch.io, Ruken and desktop
 * are peers). Ruken named as one target, or a Ruken-only fact scoped to it ("On Ruken, …"), is not framing.
 */
export const FRAMING_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: 'the reference host', pattern: /\breference\s+(gaming\s+)?host\b/i },
  { label: 'web browsers and Ruken', pattern: /\bweb\s+browsers\s+and\s+(the\s+)?Ruken\b/i },
  { label: 'the Ruken platform', pattern: /\bthe\s+Ruken\s+(gaming\s+)?platform\b/i },
  { label: 'Ruken first', pattern: /\bRuken[\s-]first\b/i },
  { label: 'the Ruken SDK owns', pattern: /\bthe\s+Ruken\s+SDK\s+owns\b/i },
]

/** Where the site says where a game goes: each names all four targets (ADR 0006). */
export const TARGETS_SENTENCE_PAGES = ['index.html', 'docs/how-it-works.html', 'llms.txt']
const TARGETS: { label: string; pattern: RegExp }[] = [
  { label: 'the web', pattern: /\bweb\b/i },
  { label: 'itch.io', pattern: /\bitch\.io\b/i },
  { label: 'Ruken', pattern: /\bRuken\b/ },
  { label: 'desktop (Tauri)', pattern: /\bTauri\b/ },
]

/** The plain-text files the site publishes. The framework's two (its API index) are copies it owns (DX.10a). */
export const SITE_TEXT_FILES = ['llms.txt', 'llms-guides.txt']

/** A page's words, leaving out text the site shows verbatim from the framework (`data-framework-copy`). */
export function ownText(doc: Document): string {
  const parts = [doc.title, doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '']
  const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!node.parentElement?.closest('[data-framework-copy]')) parts.push(node.textContent ?? '')
  }
  return parts.join('\n')
}

/** STANDALONE.1: no reference project's name and no target cast as the host. */
export function checkStandalone(file: string, text: string): string[] {
  const failures: string[] = []
  for (const name of STANDALONE_NAMES)
    if (name.pattern.test(text)) failures.push(`${file}: names a reference project ("${name.label}")`)
  for (const phrase of FRAMING_PHRASES)
    if (phrase.pattern.test(text)) failures.push(`${file}: casts one target as the host ("${phrase.label}")`)
  return failures
}

/** STANDALONE.1: where the site says where a game goes, it names all four targets (ADR 0006). */
export function checkTargets(root: string): string[] {
  const failures: string[] = []
  for (const file of TARGETS_SENTENCE_PAGES) {
    const path = join(root, file)
    if (!existsSync(path)) {
      failures.push(`${file}: missing, so it cannot name the distribution targets`)
      continue
    }
    const raw = readFileSync(path, 'utf8')
    const text = file.endsWith('.html') ? ownText(new JSDOM(raw).window.document) : raw
    const missing = TARGETS.filter((target) => !target.pattern.test(text)).map((target) => target.label)
    if (missing.length > 0)
      failures.push(`${file}: does not name every distribution target (missing ${missing.join(', ')})`)
  }
  return failures
}
