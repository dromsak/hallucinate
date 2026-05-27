import assimpjs from 'assimpjs'
import { loadAssimpScene } from './assimp-loader.ts'
import { characterFloor } from './character-data.ts'
import { triangleAreaSquared } from './character-geometry.ts'
import { outsideMotif } from './constants.ts'
import { add } from './math.ts'
import { landscapeBounds, roomBounds } from './scene-data.ts'
import { addTreeShadowReceiver, createTreeMeshes, treeCollision, uploadTreeShadowMap } from './tree-object.ts'
import type { CircleBounds, Vec3, Vertex } from './types.ts'

export async function loadOutsideTree(
  gl: WebGL2RenderingContext,
  treeShadowMap: WebGLTexture,
  vertices: Vertex[],
  outsideTree: CircleBounds,
  addSunLitTriangle: (target: Vertex[], a: Vec3, b: Vec3, c: Vec3, color: Vec3, tree: CircleBounds) => void,
) {
  const ajs = await assimpjs({
    locateFile(path) {
      return path.endsWith('.wasm') ? '/assimpjs.wasm' : path
    },
  })
  const trees = await loadAssimpScene(ajs, '/trees.fbx', 'trees.fbx')
  const meshes = createTreeMeshes(trees)
  const position: Vec3 = [outsideTree.x, characterFloor + 3.7, outsideTree.z]
  const collision = treeCollision(meshes, position)

  if (outsideMotif !== 'night') {
    uploadTreeShadowMap(gl, treeShadowMap, meshes, position, characterFloor, landscapeBounds, roomBounds.front)
    addTreeShadowReceiver(vertices, characterFloor, landscapeBounds)
  }

  for (const mesh of meshes) {
    for (const face of mesh.faces) {
      const a = add(position, mesh.points[face[0]!]!)
      const b = add(position, mesh.points[face[1]!]!)
      const c = add(position, mesh.points[face[2]!]!)

      if (triangleAreaSquared(a, b, c) > 0.00000001) {
        addSunLitTriangle(vertices, a, b, c, mesh.color, collision)
      }
    }
  }

  return collision
}
