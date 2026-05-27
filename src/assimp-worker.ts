import assimpjs from 'assimpjs'
import type { AssimpScene } from './types.ts'

type LoadRequest = {
  id: number
  files: {
    path: string
    name: string
  }[]
}

type LoadResponse = {
  id: number
  scenes?: AssimpScene[]
  error?: string
}

let assimp: ReturnType<typeof assimpjs> | undefined

self.onmessage = (event: MessageEvent<LoadRequest>) => {
  loadAssimpScenes(event.data)
    .then(scenes => {
      self.postMessage({ id: event.data.id, scenes } satisfies LoadResponse)
    })
    .catch((error: unknown) => {
      self.postMessage({
        id: event.data.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies LoadResponse)
    })
}

async function loadAssimpScenes(request: LoadRequest) {
  const ajs = await assimpModule()

  return Promise.all(request.files.map(async file => {
    const response = await fetch(file.path)

    if (!response.ok) {
      throw new Error(`Failed to load ${file.path}: ${response.status}`)
    }

    const files = new ajs.FileList()

    files.AddFile(file.name, new Uint8Array(await response.arrayBuffer()))

    const result = ajs.ConvertFileList(files, 'assjson')

    if (!result.IsSuccess() || result.FileCount() === 0) {
      throw new Error(`Assimp failed to convert ${file.name}: ${result.GetErrorCode()}`)
    }

    return JSON.parse(new TextDecoder().decode(result.GetFile(0).GetContent())) as AssimpScene
  }))
}

function assimpModule() {
  assimp ??= assimpjs({
    locateFile(path) {
      return path.endsWith('.wasm') ? '/assimpjs.wasm' : path
    },
  })

  return assimp
}
