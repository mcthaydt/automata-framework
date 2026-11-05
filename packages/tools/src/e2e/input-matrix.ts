// The input × form-factor matrix as data. The matrix spec turns each cell into a Playwright project,
// and a game's own journeys can reuse the cells. Each cell runs one journey per host it lists.

/** The device a matrix cell plays with. */
export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
/** The browser engine a matrix cell runs in. */
export type Engine = 'chromium' | 'webkit' | 'firefox'
/** A matrix cell's form factor, each with one viewport. */
export type MatrixFormFactor =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'compact'
  | 'tablet-portrait'
  | 'desktop'
/** Where a journey runs: under the fake Ruken host, or standalone. */
export type MatrixHost = 'fake-ruken' | 'standalone'

/** One cell of the input × form-factor matrix: a form factor, a device and an engine, and the hosts it runs under. */
export interface MatrixCell {
  /** `<form factor>-<device>-<engine>`, for example `phone-portrait-touch-webkit`. */
  readonly id: string
  readonly formFactor: MatrixFormFactor
  readonly viewport: { readonly width: number; readonly height: number }
  readonly device: InputDevice
  readonly engine: Engine
  readonly hosts: readonly MatrixHost[]
  /** M4-D11: the cells that run locally and in hosted CI; the rest belong to the GPU runner's nightly. */
  readonly local: boolean
}

const VIEWPORTS: Record<MatrixFormFactor, MatrixCell['viewport']> = {
  'phone-portrait': { width: 390, height: 844 },
  'phone-landscape': { width: 844, height: 390 },
  compact: { width: 780, height: 270 },
  'tablet-portrait': { width: 820, height: 1180 },
  desktop: { width: 1280, height: 720 },
}

/** The input matrix: per form factor, the engines each device runs in (none: the device has no cell there). */
const TABLE: Record<MatrixFormFactor, Partial<Record<InputDevice, readonly Engine[]>>> = {
  'phone-portrait': { gamepad: ['chromium'], touch: ['chromium', 'webkit'] },
  'phone-landscape': { gamepad: ['chromium'], touch: ['chromium', 'webkit'] },
  compact: { gamepad: ['chromium'], touch: ['chromium'] },
  'tablet-portrait': { keyboard: ['chromium'], gamepad: ['chromium'], touch: ['chromium', 'webkit'] },
  desktop: { keyboard: ['chromium', 'webkit', 'firefox'], gamepad: ['chromium', 'webkit'] },
}

const DEVICES: readonly InputDevice[] = ['keyboard', 'gamepad', 'touch']

/** The matrix's cells, in table order: 17 cells, 22 journeys (the desktop cells run under both hosts). */
export const INPUT_MATRIX: readonly MatrixCell[] = (Object.keys(TABLE) as MatrixFormFactor[]).flatMap(
  (formFactor) =>
    DEVICES.flatMap((device) =>
      (TABLE[formFactor][device] ?? []).map(
        (engine): MatrixCell => ({
          id: `${formFactor}-${device}-${engine}`,
          formFactor,
          viewport: VIEWPORTS[formFactor],
          device,
          engine,
          hosts: formFactor === 'desktop' ? ['fake-ruken', 'standalone'] : ['fake-ruken'],
          local: engine === 'chromium' && (formFactor === 'desktop' || formFactor === 'phone-portrait'),
        }),
      ),
    ),
)
