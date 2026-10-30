// Redaction (The Last Light's scripts/mcp/tools.ts at 92e6704, guardrail G-5), for the paid providers M3 moves:
// OpenAI and Meshy (plan D7). The audit log is committed by the game and a tool's answer reaches the agent, so a key
// that leaked into an argument, an error or a stage's output must never be written or returned as it was.

/** An environment, as `process.env` is. */
export type Env = Readonly<Record<string, string | undefined>>

/** The variables that hold the providers' keys; their values are replaced wherever they appear. */
const KEY_VARIABLES = ['OPENAI_API_KEY', 'MESHY_API_KEY'] as const

/** Strings shaped like the providers' keys (OpenAI `sk-…`, Meshy `msy_…`), replaced even when no variable holds them. */
const KEY_SHAPES = [/sk-[A-Za-z0-9_-]{10,}/g, /msy_[A-Za-z0-9]{10,}/g]

/**
 * Replaces each key variable's value, and any key-shaped string, with `[redacted]`. A value shorter than four
 * characters is not a key and is left alone, so a test setting a key to `x` does not erase every `x`.
 */
export function redact(text: string, env: Env): string {
  let out = text
  for (const name of KEY_VARIABLES) {
    const value = env[name]
    if (value !== undefined && value.length >= 4) out = out.split(value).join('[redacted]')
  }
  for (const shape of KEY_SHAPES) out = out.replace(shape, '[redacted]')
  return out
}

/** Redacts every string inside a JSON value (through its JSON text, so keys and nested values are covered). */
export function redactValue<T>(value: T, env: Env): T {
  return JSON.parse(redact(JSON.stringify(value ?? null), env)) as T
}
