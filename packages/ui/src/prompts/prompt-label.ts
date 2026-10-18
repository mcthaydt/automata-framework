// Device prompts (M4 spec §4.6): what to show for an action on the device in the player's hand. The pad labels follow
// FloorFifty `apps/client/src/ui/glyphs.ts` at `ac72660`: a label printed on the pad itself (A, B, ✕, ○, LB, L1) is
// the same in every language, and a button known by a word (a generic pad's buttons, Start, Home) comes from the
// game's words, so it follows a language switch. `ui` cannot read runtime's `Input`, so a prompt is told the binding
// and the device; the screen that shows it passes the Input's live values.

/** What drives one action (runtime's `InputBinding`, the fields a prompt reads). */
export interface PromptBinding {
  readonly keys: readonly string[]
  readonly pad: readonly number[]
  readonly touch: boolean
}
export type PromptDevice = 'keyboard' | 'gamepad' | 'touch'
/** The labels a pad's buttons carry (runtime's `GlyphFamily`). */
export type PromptGlyphs = 'xbox' | 'playstation' | 'generic'

/** The pad buttons known by a word, for a pad whose labels are not known. */
export type PadWord =
  | 'bottom'
  | 'right'
  | 'left'
  | 'top'
  | 'leftBumper'
  | 'rightBumper'
  | 'leftTrigger'
  | 'rightTrigger'
  | 'select'
  | 'start'
  | 'leftStick'
  | 'rightStick'
  | 'home'

/** Every word a prompt shows, in the game's language. */
export interface PromptCopy {
  /** An action with nothing on the active device. */
  readonly unbound: string
  /** An action with an on-screen button, on touch. */
  readonly touch: string
  readonly pad: Readonly<Record<PadWord, string>>
}

export type PromptView = { readonly kind: 'key' | 'pad' | 'touch' | 'unbound'; readonly label: string }

const ARROWS: Readonly<Record<string, string>> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

/**
 * A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there
 * is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.
 */
export function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string {
  const own = layout?.get(code)
  if (own !== undefined && own !== '') return [...own].length === 1 ? own.toUpperCase() : own
  return ARROWS[code] ?? code.replace(/^(Key|Digit)/, '')
}

// The standard mapping's buttons 0–16 (W3C Gamepad): faces, shoulders, triggers, select and start, the sticks'
// clicks, the D-pad, home. A string is printed on the pad; a `PadWord` is said in words.
type PadLabel = string | { readonly word: PadWord }
const word = (name: PadWord): PadLabel => ({ word: name })
const DPAD: readonly PadLabel[] = ['↑', '↓', '←', '→']
const PAD_LABELS: Readonly<Record<PromptGlyphs, readonly PadLabel[]>> = {
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    word('select'),
    word('start'),
    'LS',
    'RS',
    ...DPAD,
    word('home'),
  ],
  playstation: [
    '✕',
    '○',
    '□',
    '△',
    'L1',
    'R1',
    'L2',
    'R2',
    word('select'),
    word('start'),
    'L3',
    'R3',
    ...DPAD,
    word('home'),
  ],
  generic: [
    word('bottom'),
    word('right'),
    word('left'),
    word('top'),
    word('leftBumper'),
    word('rightBumper'),
    word('leftTrigger'),
    word('rightTrigger'),
    word('select'),
    word('start'),
    word('leftStick'),
    word('rightStick'),
    ...DPAD,
    word('home'),
  ],
}

/** A standard-mapping pad button's label on a pad of `glyphs`. */
export function padLabel(button: number, glyphs: PromptGlyphs, copy: PromptCopy): string {
  const label = PAD_LABELS[glyphs][button]
  if (label === undefined) return String(button)
  return typeof label === 'string' ? label : copy.pad[label.word]
}

/** What a prompt shows for `binding` on `device`: its first input there, or Unbound. */
export function promptView(
  binding: PromptBinding,
  device: PromptDevice,
  glyphs: PromptGlyphs,
  copy: PromptCopy,
  layout?: ReadonlyMap<string, string>,
): PromptView {
  const unbound: PromptView = { kind: 'unbound', label: copy.unbound }
  if (device === 'touch') return binding.touch ? { kind: 'touch', label: copy.touch } : unbound
  if (device === 'keyboard') {
    const key = binding.keys[0]
    return key === undefined ? unbound : { kind: 'key', label: keyLabel(key, layout) }
  }
  const button = binding.pad[0]
  return button === undefined ? unbound : { kind: 'pad', label: padLabel(button, glyphs, copy) }
}

interface KeyboardWithLayout {
  readonly keyboard?: { getLayoutMap?(): Promise<ReadonlyMap<string, string>> }
}

/**
 * The keyboard's layout map where the browser has one (`navigator.keyboard`, Chromium), or undefined: where the
 * browser has none or refuses (a cross-origin frame may), prompts name keys by their `code` (M4 spec §6).
 */
export async function readKeyboardLayout(nav: Navigator): Promise<ReadonlyMap<string, string> | undefined> {
  try {
    return (await (nav as KeyboardWithLayout).keyboard?.getLayoutMap?.()) ?? undefined
  } catch {
    return undefined
  }
}
