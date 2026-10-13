import type { z } from 'zod'

export interface SettingsDef<S> {
  readonly key: string
  readonly version: number
  readonly schema: z.ZodType<S>
  readonly defaults: S
  readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>
}

/**
 * Serializes settings value with version header. Flat record: { version, ...fields }.
 */
export function writeSettings<S>(def: SettingsDef<S>, value: S): string {
  return JSON.stringify({
    version: def.version,
    ...(value as Record<string, unknown>),
  })
}

/**
 * Deserializes and migrates settings from storage.
 * Missing, unparseable, non-object or future-version records fall back to defaults.
 * Migrations execute step by step (version: n + 1 after step n). Missing migration falls back to defaults.
 * Bad fields fall back via Zod schema .catch(default).
 */
export function readSettings<S>(def: SettingsDef<S>, raw: string | null): S {
  if (raw === null || typeof raw !== 'string') {
    return def.defaults
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return def.defaults
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return def.defaults
  }

  let record = parsed as Record<string, unknown>
  const version = record.version
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return def.defaults
  }

  if (version > def.version) {
    // Future version falls back to defaults
    return def.defaults
  }

  if (version < def.version) {
    let currentVersion = version
    while (currentVersion < def.version) {
      const step = def.migrations?.[currentVersion]
      if (typeof step !== 'function') {
        // Missing migration step falls back to defaults
        return def.defaults
      }
      try {
        record = step(record)
        currentVersion++
        record.version = currentVersion
      } catch {
        return def.defaults
      }
    }
  }

  const result = def.schema.safeParse(record)
  if (!result.success) {
    return def.defaults
  }
  return result.data
}
