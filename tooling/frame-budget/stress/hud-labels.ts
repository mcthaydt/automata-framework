// The labels the probe can ask for (`?hudLabels=N`): N lines of canvas text that change every frame, the way a score and a
// timer do, so the frame budget measures what crisp text costs in a busy HUD. They are drawn through the framework's own
// hud text, the path every game's `ctx.text` and Feel's words take.
import { createHudText, type HudLabel, type PixiStage, type PixiStageHooks } from '@automata/framework'

type MakeText = typeof createHudText

/** A renderer `setup` that draws `count` labels, each saying something new every frame. */
export function hudLabelHooks(
  count: number,
  makeText: MakeText = createHudText,
): (stage: PixiStage) => PixiStageHooks {
  return (stage) => {
    const text = makeText(stage)
    const labels: HudLabel[] = Array.from({ length: count }, () => text.label())
    let frames = 0
    return {
      draw: () => {
        frames += 1
        labels.forEach((label, i) => {
          label.set(`score ${frames * (i + 1)}`, 8, 8 + i * 14, {
            size: 8,
            floor: 12,
            color: 0xffffff,
            shadow: true,
          })
        })
      },
    }
  }
}
