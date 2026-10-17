import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The automata-api skill's `reference/api.md` is DX.4's generated `api.md`, committed so a plugin installed from
// git has it. It must be that file byte for byte, and the plugin's version must be the API version the file
// states (Claude Code refreshes an installed plugin when its version changes).

export const GENERATED_API = 'tooling/api-index/dist/api.md'
export const SKILL_API = 'agents/automata/skills/automata-api/reference/api.md'
export const PLUGIN_MANIFEST = 'agents/automata/.claude-plugin/plugin.json'

export type ApiReferenceStatus = 'in-sync' | 'written' | 'differs' | 'version-mismatch' | 'missing-build'

export interface ApiReferenceCheck {
  readonly status: ApiReferenceStatus
  readonly message: string
}

/** The version in api.md's first line, `# Automata API reference, version <x.y.z>` (tooling/api-index render). */
function apiVersion(text: string): string | undefined {
  return /^# .*, version (\S+)\s*$/m.exec(text.split('\n', 1)[0] ?? '')?.[1]
}

/** Compares the committed copy and the plugin version with the generated file; `write` makes them match. */
export function checkApiReference(root: string, options: { readonly write: boolean }): ApiReferenceCheck {
  const generatedPath = join(root, GENERATED_API)
  if (!existsSync(generatedPath)) {
    return {
      status: 'missing-build',
      message: `${GENERATED_API} is missing: run pnpm build && pnpm api-index`,
    }
  }
  const generated = readFileSync(generatedPath, 'utf8')
  const version = apiVersion(generated)
  if (version === undefined) {
    return { status: 'differs', message: `${GENERATED_API} does not state its version on its first line` }
  }

  const pluginPath = join(root, PLUGIN_MANIFEST)
  const manifest = JSON.parse(readFileSync(pluginPath, 'utf8')) as { version?: string }
  const skillPath = join(root, SKILL_API)
  const committed = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : undefined
  const versionMatches = manifest.version === version
  const copyMatches = committed === generated

  if (options.write) {
    if (versionMatches && copyMatches)
      return { status: 'in-sync', message: `${SKILL_API} is current (${version})` }
    if (!versionMatches) writeFileSync(pluginPath, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
    if (!copyMatches) {
      mkdirSync(dirname(skillPath), { recursive: true })
      writeFileSync(skillPath, generated)
    }
    return { status: 'written', message: `wrote ${SKILL_API} and the plugin version (${version})` }
  }
  if (!versionMatches) {
    return {
      status: 'version-mismatch',
      message: `${PLUGIN_MANIFEST} says version ${manifest.version} but the API is ${version}: run pnpm agent-skills --write`,
    }
  }
  if (!copyMatches) {
    return {
      status: 'differs',
      message: `${SKILL_API} differs from ${GENERATED_API}: run pnpm agent-skills --write and commit it`,
    }
  }
  return { status: 'in-sync', message: `${SKILL_API} is current (${version})` }
}
