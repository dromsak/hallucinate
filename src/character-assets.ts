import { loadAssimpScenes } from './assimp-loader.ts'
import { characterBones } from './character-data.ts'
import { createHairMeshes, createHairRenderMeshes } from './character-hair.ts'
import {
  createCharacterClip,
  createRigNodes,
  validateCharacterRig,
} from './character-rig.ts'
import { normalizeIndex } from './math.ts'

export const idleClipNames = ['stand.fbx', ...Array.from({ length: 19 }, (_, i) => `dance${i + 1}.fbx`)]

export async function loadCharacterAssets(gl: WebGL2RenderingContext, hairIndex: number) {
  const [stand, run, manSitting, womanSitting, manHair, womanHair] = await loadAssimpScenes([
    { path: '/stand.fbx', name: 'stand.fbx' },
    { path: '/run.fbx', name: 'run.fbx' },
    { path: '/man-sitting.fbx', name: 'man-sitting.fbx' },
    { path: '/woman-sitting.fbx', name: 'woman-sitting.fbx' },
    { path: '/man-hair.fbx', name: 'man-hair.fbx' },
    { path: '/woman-hair.fbx', name: 'woman-hair.fbx' },
  ])
  const rig = {
    root: stand!.rootnode,
    nodes: createRigNodes(stand!.rootnode),
    clips: {
      stand: createCharacterClip(stand!, 'stand.fbx'),
      run: createCharacterClip(run!, 'run.fbx'),
      manSitting: createCharacterClip(manSitting!, 'man-sitting.fbx'),
      womanSitting: createCharacterClip(womanSitting!, 'woman-sitting.fbx'),
      dances: [],
    },
  }
  const hairMeshes = [...createHairMeshes(manHair!, 'man'), ...createHairMeshes(womanHair!, 'woman')]

  for (let i = 0; i < hairMeshes.length; i++) {
    hairMeshes[i]!.index = i
  }

  validateCharacterRig(rig.root, characterBones)

  return {
    rig,
    hairMeshes,
    hairRenderMeshes: createHairRenderMeshes(gl, hairMeshes),
    hairIndex: normalizeIndex(hairIndex, hairMeshes.length + 1),
  }
}

export async function loadCharacterDances(rig: Awaited<ReturnType<typeof loadCharacterAssets>>['rig']) {
  const dances = await loadAssimpScenes(idleClipNames.slice(1).map(name => ({ path: `/${name}`, name })))

  rig.clips.dances = dances.map((dance, index) => createCharacterClip(dance, idleClipNames[index + 1]!))
}
