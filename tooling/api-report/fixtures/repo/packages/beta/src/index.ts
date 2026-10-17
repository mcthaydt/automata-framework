export interface Shape {
  readonly w: number
  readonly h: number
}

export function shapeArea(shape: Shape): number {
  return shape.w * shape.h
}
