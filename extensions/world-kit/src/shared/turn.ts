// A mesh turned about an axis (degrees) and moved: a panel tipped up, an awning, a wheel on its side.
import { axisAngle, type MeshData, placed, type V3 } from '@automata/3d/props-kit'

/** A mesh turned about y (degrees) and moved. */
export const turnY = (mesh: MeshData, degrees: number, at: V3 = [0, 0, 0]): MeshData =>
  placed(mesh, at, axisAngle([0, 1, 0], (degrees * Math.PI) / 180))

/** A mesh turned about x (degrees): a panel tipped up, an awning. */
export const turnX = (mesh: MeshData, degrees: number, at: V3 = [0, 0, 0]): MeshData =>
  placed(mesh, at, axisAngle([1, 0, 0], (degrees * Math.PI) / 180))
