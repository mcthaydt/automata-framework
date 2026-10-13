import { classifyFormFactor } from '@mcthaydt/automata-ui'
import { Container, Graphics } from 'pixi.js'

export const PORTRAIT_FIELD_TOP = 60
export const DEFAULT_BAR_FRACTION = 0.05
export const DEFAULT_BAR_COLOR = 0x2e222f
export const DEFAULT_FIELD_COLOR = 0x000000

export interface LetterboxGeometry {
  scale: number
  x: number
  y: number
  width: number
  height: number
  gameplay: { x: number; y: number; width: number; height: number }
  scenery: { x: number; y: number; width: number; height: number }
  portrait: boolean
  fieldHeight: number
}

export interface LetterboxOptions {
  readonly logicalWidth: number
  readonly logicalHeight: number
  readonly barFraction?: number | undefined
  readonly barColor?: number | undefined
  readonly fieldColor?: number | undefined
}

export function portraitFieldHeight(
  viewHeight: number,
  scale: number,
  band: number,
  baseHeight = 540,
): number {
  return Math.max(baseHeight, Math.floor((viewHeight - PORTRAIT_FIELD_TOP - band) / scale))
}

export class LetterboxFrame {
  readonly scene: Container = new Container()
  readonly backdrop: Container = new Container()
  readonly root: Container = new Container()
  readonly world: Container = new Container()
  readonly ui: Container = new Container()
  readonly field: Graphics = new Graphics()
  readonly mask: Graphics = new Graphics()
  readonly bars: Container = new Container()
  readonly topBar: Graphics = new Graphics()
  readonly bottomBar: Graphics = new Graphics()

  private readonly logicalWidth: number
  private readonly logicalHeight: number
  private readonly barFraction: number
  private readonly barColor: number
  private readonly fieldColor: number

  constructor(options: LetterboxOptions) {
    this.logicalWidth = options.logicalWidth
    this.logicalHeight = options.logicalHeight
    this.barFraction = options.barFraction ?? DEFAULT_BAR_FRACTION
    this.barColor = options.barColor ?? DEFAULT_BAR_COLOR
    this.fieldColor = options.fieldColor ?? DEFAULT_FIELD_COLOR

    this.backdrop.label = 'backdrop'
    this.root.label = 'letterbox'
    this.world.label = 'world'
    this.ui.label = 'ui'
    this.field.label = 'field'
    this.mask.label = 'letterbox-mask'

    this.backdrop.addChild(this.field)
    this.root.addChild(this.world, this.ui)

    this.scene.label = 'scene'
    this.scene.addChild(this.backdrop, this.root, this.mask)

    this.bars.label = 'bars'
    this.bars.addChild(this.topBar, this.bottomBar)

    this.root.mask = this.mask
  }

  layout(viewWidth: number, viewHeight: number): LetterboxGeometry {
    if (viewWidth <= 0 || viewHeight <= 0) {
      this.mask.clear()
      this.field.clear()
      this.topBar.clear()
      this.bottomBar.clear()
      return {
        scale: 1,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        gameplay: { x: 0, y: 0, width: 0, height: 0 },
        scenery: { x: 0, y: 0, width: 0, height: 0 },
        portrait: false,
        fieldHeight: this.logicalHeight,
      }
    }

    const scale = viewWidth / this.logicalWidth
    const width = viewWidth
    const formFactor = classifyFormFactor(viewWidth, viewHeight)
    const portrait = viewHeight > viewWidth

    const band = formFactor === 'phone-portrait' ? 140 : formFactor === 'tablet-portrait' ? 180 : 0
    const fieldHeight =
      formFactor === 'phone-portrait' || formFactor === 'tablet-portrait'
        ? portraitFieldHeight(viewHeight, scale, band, this.logicalHeight)
        : this.logicalHeight

    const height = fieldHeight * scale
    const x = 0
    const centred = Math.round((viewHeight - height) / 2)
    const y = portrait ? Math.min(PORTRAIT_FIELD_TOP, centred) : centred

    this.root.scale.set(scale)
    this.root.position.set(x, y)
    this.backdrop.scale.set(scale)
    this.backdrop.position.set(x, y)

    const clipTop = Math.max(0, y)
    const clipBottom = Math.min(viewHeight, y + height)
    this.mask
      .clear()
      .rect(0, clipTop, viewWidth, Math.max(0, clipBottom - clipTop))
      .fill(0xffffff)

    this.field
      .clear()
      .rect(-x / scale, -y / scale, viewWidth / scale, viewHeight / scale)
      .fill(this.fieldColor)

    const barsVisible = !portrait
    this.bars.visible = barsVisible
    this.topBar.visible = barsVisible
    this.bottomBar.visible = barsVisible

    const cropped = height * this.barFraction
    const bottomEdge = Math.min(viewHeight, y + height - cropped)

    this.topBar
      .clear()
      .rect(0, 0, viewWidth, Math.max(0, y + cropped))
      .fill(this.barColor)
    this.bottomBar
      .clear()
      .rect(0, bottomEdge, viewWidth, Math.max(0, viewHeight - bottomEdge))
      .fill(this.barColor)

    const gameplayTop = barsVisible ? Math.max(clipTop, y + cropped) : clipTop
    const gameplayBottom = barsVisible ? Math.min(clipBottom, y + height - cropped) : clipBottom
    const gameplay = {
      x: 0,
      y: gameplayTop,
      width: viewWidth,
      height: Math.max(0, gameplayBottom - gameplayTop),
    }

    const scenery = {
      x: -x / scale,
      y: -y / scale,
      width: viewWidth / scale,
      height: viewHeight / scale,
    }

    return { scale, x, y, width, height, gameplay, scenery, portrait, fieldHeight }
  }

  setBarBlack(amount: number): void {
    const keep = Math.round(255 * (1 - Math.min(1, Math.max(0, amount))))
    const tint = (keep << 16) | (keep << 8) | keep
    this.topBar.tint = tint
    this.bottomBar.tint = tint
  }

  destroy(): void {
    this.root.mask = null
    this.scene.destroy({ children: true })
    this.bars.destroy({ children: true })
  }
}
