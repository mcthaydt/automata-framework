// The bundle secret scan (QB spec §4.3, QB-b): a built game is public, so anything in it is published. Before
// `ruken.toml` is written (and in `automata check`), every file of the build is read for three things:
// - known key formats. The rule IDs are gitleaks' (QB.1 runs gitleaks over the repository's history), so the two
//   rule sets can be compared and later share one list. The GitHub and npm formats are also the Plus registry
//   token's (QB spec §4.4);
// - the value of any variable in the game folder's `.env*` files, 8 characters or longer (a shorter value such
//   as `true` or `en` would match by chance). `VITE_` variables are skipped: Vite inlines exactly those into the
//   bundle, so they are public by design (decided 2026-10-16). A known key format in one is still found above;
// - high-entropy strings: a quoted string in a text file whose whole content is 24 to 200 characters of
//   base64/base64url, with an upper-case letter, a lower-case letter and a digit, and at least 4.25 bits of
//   Shannon entropy per character. Tuned on the placeholder and Emberwick builds, which have none: hashed asset
//   names hold a `.` or start with `/`, GL constants have no lower case, data URIs hold `:` and `,`, and an
//   embedded WebAssembly blob is longer than 200.
// A finding never carries the secret itself, only its first four characters and its length, so CI logs stay
// clean.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { walk } from './root-absolute.ts'

/** One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build. */
export interface EnvValue {
  /** The `.env*` file the variable came from, relative to the game folder. */
  readonly file: string
  readonly name: string
  readonly value: string
}

/** A secret the bundle scan found in a built file, located without repeating the secret. */
export interface SecretFound {
  /** Relative to the build, with forward slashes. */
  readonly file: string
  /** Index into the scanned text; a byte offset when the text was read as latin1 (as `findSecretsInBuild` does). */
  readonly offset: number
  /** 1-based. */
  readonly line: number
  readonly col: number
  /** A gitleaks rule ID, `env-value` or `high-entropy`. */
  readonly rule: string
  /** What was found, without the secret. */
  readonly detail: string
}

interface KeyRule {
  readonly id: string
  readonly what: string
  readonly pattern: RegExp
}

const KEY_RULES: readonly KeyRule[] = [
  {
    id: 'stripe-access-token',
    what: 'a Stripe key',
    pattern: /\b(?:sk|rk)_(?:live|test|prod)_[A-Za-z0-9]{10,99}\b/g,
  },
  {
    id: 'aws-access-token',
    what: 'an AWS access key ID',
    pattern: /\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
  },
  { id: 'github-pat', what: 'a GitHub token', pattern: /\bghp_[0-9A-Za-z]{36}\b/g },
  { id: 'github-fine-grained-pat', what: 'a GitHub token', pattern: /\bgithub_pat_\w{82}\b/g },
  { id: 'github-oauth', what: 'a GitHub token', pattern: /\bgho_[0-9A-Za-z]{36}\b/g },
  { id: 'github-app-token', what: 'a GitHub token', pattern: /\b(?:ghu|ghs)_[0-9A-Za-z]{36}\b/g },
  { id: 'github-refresh-token', what: 'a GitHub token', pattern: /\bghr_[0-9A-Za-z]{36}\b/g },
  { id: 'npm-access-token', what: 'an npm token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  {
    id: 'private-key',
    what: 'a private key',
    pattern: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/g,
  },
  { id: 'slack-token', what: 'a Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g },
  { id: 'gcp-api-key', what: 'a Google API key', pattern: /\bAIza[\w-]{35}\b/g },
  {
    id: 'anthropic-api-key',
    what: 'an Anthropic API key',
    pattern: /\bsk-ant-(?:api03|admin01)-[\w-]{20,}/g,
  },
  { id: 'openai-api-key', what: 'an OpenAI API key', pattern: /\bsk-(?:proj|svcacct|admin)-[\w-]{20,}/g },
]

/** Files a browser reads as text; only these are read for high-entropy strings. */
const TEXT_FILE = /\.(?:js|mjs|cjs|css|html|htm|svg|json|webmanifest|map|txt|xml|toml)$/i
const QUOTED = /(["'`])([A-Za-z0-9+/=_-]{24,200})\1/g
const SRI_HASH = /^sha(?:256|384|512)-/
const MIN_ENTROPY = 4.25
const MIN_ENV_VALUE_LENGTH = 8
/** Vite's public prefix: only these variables reach the bundle through `import.meta.env`. */
const PUBLIC_ENV_PREFIX = 'VITE_'

/** Shannon entropy in bits per character. */
function entropy(text: string): number {
  const counts = new Map<string, number>()
  for (const character of text) counts.set(character, (counts.get(character) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const p = count / text.length
    bits -= p * Math.log2(p)
  }
  return bits
}

const looksRandom = (text: string): boolean =>
  !text.startsWith('/') &&
  !SRI_HASH.test(text) &&
  /[a-z]/.test(text) &&
  /[A-Z]/.test(text) &&
  /[0-9]/.test(text) &&
  entropy(text) >= MIN_ENTROPY

const redacted = (secret: string): string => `${secret.slice(0, 4)}…, ${secret.length} characters`

/** Every secret in one file's text. */
export function scanTextForSecrets(
  file: string,
  text: string,
  envValues: readonly EnvValue[],
): SecretFound[] {
  const spans: { start: number; end: number; rule: string; detail: string }[] = []
  for (const rule of KEY_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        rule: rule.id,
        detail: `${rule.what} (${redacted(match[0])})`,
      })
    }
  }
  for (const env of envValues) {
    if (env.value.length < MIN_ENV_VALUE_LENGTH || env.name.startsWith(PUBLIC_ENV_PREFIX)) continue
    for (let at = text.indexOf(env.value); at !== -1; at = text.indexOf(env.value, at + 1)) {
      spans.push({
        start: at,
        end: at + env.value.length,
        rule: 'env-value',
        detail: `the value of ${env.name} from ${env.file}`,
      })
    }
  }
  if (TEXT_FILE.test(file)) {
    for (const match of text.matchAll(QUOTED)) {
      const content = match[2] ?? ''
      const start = match.index + 1
      const end = start + content.length
      // A string already reported as a key or an .env value is not reported twice.
      if (spans.some((span) => span.start < end && start < span.end)) continue
      if (looksRandom(content)) {
        spans.push({
          start,
          end,
          rule: 'high-entropy',
          detail: `a high-entropy string (${redacted(content)})`,
        })
      }
    }
  }
  return spans
    .sort((a, b) => a.start - b.start)
    .map((span) => {
      const before = text.slice(0, span.start)
      const line = before.split('\n').length
      return {
        file,
        offset: span.start,
        line,
        col: span.start - before.lastIndexOf('\n'),
        rule: span.rule,
        detail: span.detail,
      }
    })
}

/** The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed. */
export function parseEnvFile(file: string, text: string): EnvValue[] {
  const values: EnvValue[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/.exec(line)
    if (match === null) continue
    const raw = (match[2] ?? '').trim()
    const quoted = /^(["'])(.*)\1$/.exec(raw)
    const value = quoted === null ? raw.replace(/\s+#.*$/, '') : (quoted[2] ?? '')
    values.push({ file, name: match[1] ?? '', value })
  }
  return values
}

/** The variables of every top-level `.env*` file in the game folder; none when the folder does not exist. */
export function readEnvValues(gameDir: string): EnvValue[] {
  let names: string[]
  try {
    names = readdirSync(gameDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.startsWith('.env'))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
  return names.flatMap((name) => parseEnvFile(name, readFileSync(join(gameDir, name), 'utf8')))
}

/**
 * Every secret in a built folder. Files are read as latin1, one character per byte, so offsets are byte offsets;
 * each `.env` value is encoded the same way so it matches its UTF-8 bytes.
 */
export function findSecretsInBuild(distDir: string, envValues: readonly EnvValue[]): SecretFound[] {
  const asBytes = envValues.map((env) => ({
    ...env,
    value: Buffer.from(env.value, 'utf8').toString('latin1'),
  }))
  return walk(distDir).flatMap((path) =>
    scanTextForSecrets(relative(distDir, path).split(sep).join('/'), readFileSync(path, 'latin1'), asBytes),
  )
}
