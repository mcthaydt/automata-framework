// The header every example opens with: a `//` comment block before the first import. The catalog,
// the runner, the smoke test and the parity test all read it from here.

/** Fake-host settings for the example (`Host: grant=saves; saves=best:12.5; offline`). */
export interface HostSettings {
  /** Grant exactly these capabilities (`grant=` alone denies all). */
  readonly grant?: readonly string[]
  /** The player's server saves, seeded before the example boots. */
  readonly saves?: Readonly<Record<string, string>>
  /** The saves server is unreachable. */
  readonly offline?: boolean
}

export interface Header {
  /** `<module>-<name>`, from the title line. */
  readonly name: string
  readonly title: string
  readonly shows: string
  readonly controls: string
  readonly packages: readonly string[]
  /** One to four stars. */
  readonly difficulty: 1 | 2 | 3 | 4
  readonly tier: 'core' | 'plus'
  readonly host?: HostSettings
  /** Ticks the parity test replays. */
  readonly golden?: number
  /** The open task IDs whose verbs this example waits for, as written, comma-separated. */
  readonly pending?: string
  /** How many lines the header takes, so the catalog counts only the code after it. */
  readonly lines: number
}

export interface HeaderError {
  /** 1-based line in the file. */
  readonly line: number
  readonly field: string
  readonly message: string
}

const REQUIRED = ['Shows', 'Controls', 'Packages', 'Difficulty', 'Tier'] as const
const OPTIONAL = ['Host', 'Golden', 'Pending'] as const
const KNOWN: ReadonlySet<string> = new Set<string>([...REQUIRED, ...OPTIONAL])

const TITLE = /^\/\/ ([a-z0-9]+(?:-[a-z0-9]+)+): (\S.*)$/
const FIELD = /^\/\/ ([A-Z][A-Za-z]*): ?(.*)$/
const CONTINUATION = /^\/\/\s+(\S.*)$/
const DIFFICULTY = /^(★{1,4})(☆{0,3})$/u

/** The header's comment lines: every line from the top that starts with `//`. */
function headerLines(source: string): string[] {
  const lines: string[] = []
  for (const line of source.split('\n')) {
    if (!line.startsWith('//')) break
    lines.push(line.trimEnd())
  }
  return lines
}

function parseHost(text: string): HostSettings | string {
  const host: { grant?: string[]; saves?: Record<string, string>; offline?: boolean } = {}
  for (const part of text.split(';').map((entry) => entry.trim())) {
    if (part === 'offline') host.offline = true
    else if (part.startsWith('grant='))
      host.grant = part
        .slice(6)
        .split(',')
        .filter((name) => name !== '')
    else if (part.startsWith('saves=')) {
      const saves: Record<string, string> = {}
      for (const pair of part.slice(6).split(',')) {
        const colon = pair.indexOf(':')
        if (colon <= 0) return `Host: saves must be key:value pairs, got "${pair}"`
        saves[pair.slice(0, colon)] = pair.slice(colon + 1)
      }
      host.saves = saves
    } else return `Host: unknown setting "${part}" (grant=, saves=, offline)`
  }
  return host
}

/** The header of an example's source, or every problem with it. */
export function parseHeader(source: string): Header | HeaderError[] {
  const lines = headerLines(source)
  const errors: HeaderError[] = []
  const title = TITLE.exec(lines[0] ?? '')
  if (title === null)
    errors.push({ line: 1, field: 'title', message: 'the first line must be `// <module>-<name>: <title>`' })

  // Each field's text (continuation lines joined with a space) and its line.
  const fields = new Map<string, { text: string; line: number }>()
  let current: { text: string; line: number } | undefined
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index] as string
    const field = FIELD.exec(line)
    if (field !== null) {
      const [, key = '', text = ''] = field
      current = { text: text.trim(), line: index + 1 }
      if (!KNOWN.has(key))
        errors.push({ line: index + 1, field: key, message: `${key}: is not a header field` })
      else fields.set(key, current)
      continue
    }
    const continuation = CONTINUATION.exec(line)
    if (continuation !== null && current !== undefined) current.text = `${current.text} ${continuation[1]}`
    else current = undefined
  }

  for (const key of REQUIRED) {
    if (!fields.get(key)?.text)
      errors.push({ line: lines.length, field: key, message: `${key}: is required` })
  }

  const difficultyField = fields.get('Difficulty')
  const stars = DIFFICULTY.exec(difficultyField?.text ?? '')
  if (difficultyField?.text && (stars === null || (stars[1] ?? '').length + (stars[2] ?? '').length !== 4))
    errors.push({
      line: difficultyField.line,
      field: 'Difficulty',
      message: `Difficulty: must be four of ★/☆ with 1–4 filled, got "${difficultyField.text}"`,
    })

  const tierField = fields.get('Tier')
  if (tierField?.text && tierField.text !== 'core' && tierField.text !== 'plus')
    errors.push({
      line: tierField.line,
      field: 'Tier',
      message: `Tier: must be core or plus, got "${tierField.text}"`,
    })

  const goldenField = fields.get('Golden')
  const golden = goldenField === undefined ? undefined : Number(goldenField.text)
  if (goldenField !== undefined && !(Number.isInteger(golden) && (golden as number) > 0))
    errors.push({
      line: goldenField.line,
      field: 'Golden',
      message: `Golden: must be a whole number of ticks, got "${goldenField.text}"`,
    })

  const hostField = fields.get('Host')
  const host = hostField === undefined ? undefined : parseHost(hostField.text)
  if (typeof host === 'string' && hostField !== undefined)
    errors.push({ line: hostField.line, field: 'Host', message: host })

  if (errors.length > 0) return errors.sort((a, b) => a.line - b.line)
  // Every required field is present here: a missing one returned its error above.
  const text = (key: string): string => fields.get(key)?.text ?? ''
  const pending = text('Pending')
  return {
    name: title?.[1] as string,
    title: title?.[2] as string,
    shows: text('Shows'),
    controls: text('Controls'),
    packages: text('Packages')
      .split(',')
      .map((name) => name.trim()),
    difficulty: (stars?.[1] ?? '').length as Header['difficulty'],
    tier: text('Tier') as Header['tier'],
    ...(host === undefined ? {} : { host: host as HostSettings }),
    ...(golden === undefined ? {} : { golden }),
    ...(pending ? { pending } : {}),
    lines: lines.length,
  }
}
