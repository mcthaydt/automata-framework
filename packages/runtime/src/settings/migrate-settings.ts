import type { z } from 'zod'

export interface SettingsDef<S> {
  readonly key: string
  readonly version: number
  readonly schema: z.ZodType<S>
  readonly defaults: S
  readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>
  /**
   * Fields that belong to one device: kept in its `DeviceStorage`, never in the player's saves, and the saves'
   * copy is never read (M5 spec §4.5). The rest of the record is the player's, as for any settings. Names, not
   * `keyof S`, so a `SettingsDef<S>` stays assignable where `SettingsDef<unknown>` is wanted; `makeSettings`
   * refuses a name the defaults do not have.
   */
  readonly deviceFields?: readonly string[]
}

type Fields = Record<string, unknown>

const fieldsOf = (def: { readonly deviceFields?: readonly string[] | undefined }): readonly string[] =>
  def.deviceFields ?? []

const pick = (source: Fields, keys: readonly string[]): Fields =>
  Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]))

const omit = (source: Fields, keys: readonly string[]): Fields =>
  Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)))

/**
 * Serializes settings value with version header. Flat record: { version, ...fields }.
 */
export function writeSettings<S>(def: SettingsDef<S>, value: S): string {
  return JSON.stringify({
    version: def.version,
    ...(value as Fields),
  })
}

/** The record the player's saves hold: every field but the device's. The same as `writeSettings` with none. */
export function writeAccountSettings<S>(def: SettingsDef<S>, value: S): string {
  return JSON.stringify({ version: def.version, ...omit(value as Fields, fieldsOf(def)) })
}

/** The record this device holds: the device's fields alone, under the same version header. */
export function writeDeviceSettings<S>(def: SettingsDef<S>, value: S): string {
  return JSON.stringify({ version: def.version, ...pick(value as Fields, fieldsOf(def)) })
}

/**
 * Deserializes and migrates settings from storage.
 * Missing, unparseable, non-object or future-version records fall back to defaults.
 * Migrations execute step by step (version: n + 1 after step n). Missing migration falls back to defaults.
 * Bad fields fall back via Zod schema .catch(default).
 */
export function readSettings<S>(def: SettingsDef<S>, raw: string | null, deviceRaw: string | null = null): S {
  const device = fieldsOf(def)
  if (device.length === 0) return readPart(def, raw, (record) => record)

  // The saves' record and the device's are read apart, each through the same migrations and per-field fallbacks,
  // then joined. Each part is padded with the other's defaults first, so a schema that requires every field still
  // reads a record that was split in two. The saves' copy of a device field is overwritten by its default.
  const defaults = def.defaults as Fields
  const account = readPart(def, raw, (record) => ({ ...record, ...pick(defaults, device) })) as Fields
  const own =
    deviceRaw === null
      ? defaults
      : (readPart(def, deviceRaw, (record) => ({ ...defaults, ...pick(record, device) })) as Fields)
  return { ...account, ...pick(own, device) } as S
}

/** One stored record read as settings; `shape` adjusts the migrated record before the schema sees it. */
function readPart<S>(def: SettingsDef<S>, raw: string | null, shape: (record: Fields) => Fields): S {
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

  const result = def.schema.safeParse(shape(record))
  if (!result.success) {
    return def.defaults
  }
  return result.data
}
