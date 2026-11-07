import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { z } from 'zod'

// The agent package's layout rules: the marketplace at the repo root lists
// plugins by a `./` source; each plugin has `.claude-plugin/plugin.json`, `skills/<name>/SKILL.md` and
// `hooks/hooks.json`. `claude plugin validate --strict` checks the manifests too (pnpm plugin:validate), but it
// needs the CLI and the network; these checks run in every unit run and also cover the Agent Skills standard,
// which Claude Code is looser about (it only recommends `description`).

const Owner = z.object({ name: z.string().min(1) })

export interface Marketplace {
  readonly name: string
  readonly description: string
  readonly owner: { readonly name: string }
  readonly plugins: ReadonlyArray<{ readonly name: string; readonly source: string }>
}

const Marketplace: z.ZodType<Marketplace> = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  owner: Owner,
  plugins: z
    .array(
      z.object({
        name: z.string().min(1),
        source: z.string().startsWith('./', 'a relative plugin source must start with ./'),
      }),
    )
    .min(1),
})

/** `--strict` validation fails without version, description and author (Claude Code 2.1.301). */
export interface PluginManifest {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author: { readonly name: string }
}

const PluginManifest: z.ZodType<PluginManifest> = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver x.y.z'),
  description: z.string().min(1),
  author: Owner,
})

/** Claude Code's plugin-folder variable, as written in a hook command (a template escape, not a placeholder). */
export const PLUGIN_ROOT = `\${CLAUDE_PLUGIN_ROOT}`

const HookCommand = z.object({
  type: z.literal('command'),
  command: z.string().includes(`${PLUGIN_ROOT}/`, {
    message: `hook commands must run a script under ${PLUGIN_ROOT}`,
  }),
  timeout: z.number().int().positive().optional(),
})

export interface HookGroup {
  readonly matcher?: string | undefined
  readonly hooks: ReadonlyArray<{
    readonly type: 'command'
    readonly command: string
    readonly timeout?: number | undefined
  }>
}

/** The event map must sit under a top-level `hooks` key, or Claude Code does not load the file. */
export interface HooksFile {
  readonly hooks: Readonly<Record<string, readonly HookGroup[]>>
}

const HooksFile: z.ZodType<HooksFile> = z.object({
  hooks: z.record(
    z.string(),
    z.array(z.object({ matcher: z.string().optional(), hooks: z.array(HookCommand).min(1) })),
  ),
})

/** Agent Skills standard: 1–64 lowercase letters, digits and single hyphens. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_DESCRIPTION = 1024

export interface SkillInfo {
  readonly name: string
  readonly description: string
  /** The skill folder, absolute. */
  readonly dir: string
}

export interface AgentPackage {
  readonly marketplace?: Marketplace | undefined
  readonly plugin?: PluginManifest | undefined
  readonly hooks?: HooksFile | undefined
  /** The plugin folder, absolute (the marketplace's first plugin). */
  readonly pluginDir?: string | undefined
  readonly skills: readonly SkillInfo[]
  /** One line per problem, `<path relative to root>: <message>`; empty means the package is valid. */
  readonly problems: readonly string[]
}

/** Reads and checks the marketplace at `root` and the plugin it lists. */
export function readAgentPackage(root: string): AgentPackage {
  const problems: string[] = []
  const rel = (path: string) => relative(root, path).split('\\').join('/')
  const parse = <T>(path: string, schema: z.ZodType<T>): T | undefined => {
    if (!existsSync(path)) {
      problems.push(`${rel(path)}: missing`)
      return undefined
    }
    let json: unknown
    try {
      json = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      problems.push(`${rel(path)}: not JSON (${(error as Error).message})`)
      return undefined
    }
    const result = schema.safeParse(json)
    if (result.success) return result.data
    for (const issue of result.error.issues) {
      problems.push(`${rel(path)}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    return undefined
  }

  const marketplace = parse(join(root, '.claude-plugin/marketplace.json'), Marketplace)
  const source = marketplace?.plugins[0]?.source
  if (source === undefined) return { marketplace, skills: [], problems }

  const pluginDir = join(root, source)
  const plugin = parse(join(pluginDir, '.claude-plugin/plugin.json'), PluginManifest)
  if (plugin !== undefined && plugin.name !== marketplace?.plugins[0]?.name) {
    problems.push(
      `${rel(join(pluginDir, '.claude-plugin/plugin.json'))}: name differs from the marketplace entry`,
    )
  }
  const hooks = parse(join(pluginDir, 'hooks/hooks.json'), HooksFile)
  for (const script of hookScripts(hooks)) {
    if (!existsSync(join(pluginDir, script)))
      problems.push(`${rel(join(pluginDir, 'hooks/hooks.json'))}: ${script} does not exist`)
  }
  const skills = readSkills(join(pluginDir, 'skills'), rel, problems)
  return { marketplace, plugin, hooks, pluginDir, skills, problems }
}

/** The plugin-relative script each hook command runs (`${CLAUDE_PLUGIN_ROOT}/<script>`). */
function hookScripts(hooks: HooksFile | undefined): string[] {
  const scripts = new Set<string>()
  for (const groups of Object.values(hooks?.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        const match = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"'\s]+)/.exec(hook.command)
        if (match?.[1] !== undefined) scripts.add(match[1])
      }
    }
  }
  return [...scripts].sort()
}

function readSkills(skillsDir: string, rel: (path: string) => string, problems: string[]): SkillInfo[] {
  if (!existsSync(skillsDir)) {
    problems.push(`${rel(skillsDir)}: missing`)
    return []
  }
  const skills: SkillInfo[] = []
  for (const folder of readdirSync(skillsDir).sort()) {
    const dir = join(skillsDir, folder)
    if (!statSync(dir).isDirectory()) continue
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) {
      problems.push(`${rel(dir)}: no SKILL.md`)
      continue
    }
    const fields = frontMatter(readFileSync(file, 'utf8'))
    const name = scalar(fields.get('name') ?? '')
    const rawDescription = fields.get('description') ?? ''
    const description = scalar(rawDescription)
    if (!isSafePlainScalar(rawDescription)) {
      problems.push(`${rel(file)}: description has ": " or " #" or a YAML indicator first; quote it with "…"`)
    }
    if (!SKILL_NAME.test(name) || name.length > 64) {
      problems.push(`${rel(file)}: name "${name}" must be 1–64 lowercase letters, digits and hyphens`)
    } else if (name !== folder) {
      problems.push(`${rel(file)}: name "${name}" must match its folder "${folder}"`)
    }
    if (description === '' || description.length > MAX_DESCRIPTION) {
      problems.push(`${rel(file)}: description must be 1–${MAX_DESCRIPTION} characters`)
    }
    skills.push({ name, description, dir })
  }
  return skills
}

/** A quoted value without its quotes (double quotes with JSON escapes, single quotes with '' for '). */
function scalar(raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    try {
      return JSON.parse(raw) as string
    } catch {
      return raw
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
    return raw.slice(1, -1).split("''").join("'")
  return raw
}

/**
 * Whether an unquoted value reads back as the same string in YAML. Claude Code and the Agent Skills tools parse the
 * front matter as YAML, where `a: b` inside a plain value starts a mapping and ` #` starts a comment.
 */
function isSafePlainScalar(raw: string): boolean {
  if (raw.startsWith('"') || raw.startsWith("'")) return true
  return !raw.includes(': ') && !raw.includes(' #') && !/^[-?:,[\]{}#&*!|>%@`]/.test(raw)
}

/**
 * The `key: value` lines between the leading `---` lines. SKILL.md front matter here is single-line keys only;
 * the value is everything after the first `: `, so a description may contain colons.
 */
export function frontMatter(text: string): Map<string, string> {
  const fields = new Map<string, string>()
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  if (match?.[1] === undefined) return fields
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (pair?.[1] !== undefined) fields.set(pair[1], (pair[2] ?? '').trim())
  }
  return fields
}
