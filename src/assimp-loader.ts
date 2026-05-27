import type { AssimpScene } from './types.ts'

type LoadRequest = {
  id: number
  files: AssimpFileRequest[]
}

export type AssimpFileRequest = {
  path: string
  name: string
}

type LoadResponse = {
  id: number
  scenes?: AssimpScene[]
  error?: string
}

let loadId = 0
let worker: Worker | undefined
const loads = new Map<number, {
  reject: (reason?: unknown) => void
  resolve: (value: AssimpScene[]) => void
}>()

export function loadAssimpScene(path: string, name: string): Promise<AssimpScene> {
  return loadAssimpScenes([{ path, name }]).then(scenes => scenes[0]!)
}

export function loadAssimpScenes(files: AssimpFileRequest[]): Promise<AssimpScene[]> {
  const id = ++loadId
  const nextWorker = assimpWorker()

  return new Promise((resolve, reject) => {
    loads.set(id, { reject, resolve })
    nextWorker.postMessage({ id, files } satisfies LoadRequest)
  })
}

function assimpWorker() {
  worker ??= new Worker(new URL('./assimp-worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<LoadResponse>) => {
    const load = loads.get(event.data.id)

    if (!load) {
      throw new Error(`Unknown Assimp load ${event.data.id}`)
    }

    loads.delete(event.data.id)

    if (event.data.error) {
      load.reject(new Error(event.data.error))
    }
    else {
      load.resolve(event.data.scenes!)
    }
  }
  worker.onerror = event => {
    for (const load of loads.values()) {
      load.reject(new Error(event.message))
    }

    loads.clear()
  }

  return worker
}
