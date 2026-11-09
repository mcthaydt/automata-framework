/**
 * Loads `@pixi/3d` before the page draws anything. The beta checks as it loads that its own textures took the third
 * texture id on the page; load it after another editor has drawn with Pixi (Levels 3D's plan, a 2D level's pictures) and
 * it refuses, so the next canvas to start says "needs WebGL2" on a browser that has it. The page's `main.ts` waits for this
 * before it starts the suite. It costs the page the 3D engine's download up front, so a visitor can open the editors in any
 * order.
 */
export async function loadPixi3dFirst(): Promise<void> {
  await import('@pixi/3d')
}
