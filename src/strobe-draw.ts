import { uploadFloatBuffer } from './character-gpu.ts'
import { isOutside } from './scene.ts'
import { strobeRandom, strobeReflectionAmount, strobeTarget } from './strobe-object.ts'
import type { CharacterBoxGeometry, StrobeLight, StrobeReflectionLight, Vec3, VideoZone } from './types.ts'

type Camera = { eye: Vec3; center: Vec3 }

type StrobeDrawOptions = {
  array: WebGLVertexArrayObject
  characterPosition: Vec3
  geometry: CharacterBoxGeometry
  gl: WebGL2RenderingContext
  instanceBuffer: WebGLBuffer
  instanceSize: number
  lights: StrobeLight[]
  program: WebGLProgram
  smokeMap: WebGLTexture
  uniforms: {
    cameraCenter: WebGLUniformLocation
    cameraEye: WebGLUniformLocation
    renderZone: WebGLUniformLocation
    resolution: WebGLUniformLocation
    smokeMap: WebGLUniformLocation
    time: WebGLUniformLocation
  }
}

export function createStrobeDrawController(options: StrobeDrawOptions) {
  const instances: number[] = []
  let instanceBuffer = new Float32Array(0)
  const instanceBufferCache = { data: instanceBuffer }
  let instanceCount = 0
  let reflectionFrame = -1
  let reflectionLights: StrobeReflectionLight[] = []
  let frame = 0

  return {
    setFrame(nextFrame: number) {
      frame = nextFrame
    },
    updateInstances(time: number, zone: VideoZone) {
      instances.length = 0

      for (const light of options.lights) {
        if (light.zone !== zone) {
          continue
        }

        const hit = strobeTarget(light, time)
        const outside = light.zone === 'outside'

        instances.push(
          light.x,
          light.top,
          light.z,
          hit[0],
          light.floor,
          hit[2],
          0.07,
          outside ? 1.35 : 0.5,
          outside ? 1.85 : 0.68,
          light.color[0],
          light.color[1],
          light.color[2],
          light.id,
          outside ? 0.7 : 0.42,
        )
      }

      instanceCount = instances.length / options.instanceSize
      if (instanceBuffer.length < instances.length) {
        instanceBuffer = new Float32Array(instances.length)
        instanceBufferCache.data = instanceBuffer
      }

      instanceBuffer.set(instances)
      uploadFloatBuffer(options.gl, options.instanceBuffer, instanceBuffer.length === instances.length
        ? instanceBuffer
        : instanceBuffer.subarray(0, instances.length), instanceBufferCache)
    },
    draw(camera: Camera, width: number, height: number, nextFrame: number) {
      if (instanceCount === 0) {
        return
      }

      options.gl.useProgram(options.program)
      options.gl.uniform1f(options.uniforms.time, nextFrame)
      options.gl.uniform1i(options.uniforms.renderZone, isOutside(options.characterPosition) ? 1 : 0)
      options.gl.uniform2f(options.uniforms.resolution, width, height)
      options.gl.uniform3f(options.uniforms.cameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
      options.gl.uniform3f(options.uniforms.cameraCenter, camera.center[0], camera.center[1], camera.center[2])
      options.gl.activeTexture(options.gl.TEXTURE2)
      options.gl.bindTexture(options.gl.TEXTURE_2D, options.smokeMap)
      options.gl.uniform1i(options.uniforms.smokeMap, 2)
      options.gl.bindVertexArray(options.array)
      options.gl.drawArraysInstanced(options.gl.TRIANGLES, 0, options.geometry.count, instanceCount)
    },
    reflection(point: Vec3, normal: Vec3) {
      let amount = 0

      for (const setup of activeReflectionLights()) {
        amount = Math.max(amount, strobeReflectionAmount(point, normal, setup))
      }

      return amount
    },
  }

  function activeReflectionLights() {
    if (reflectionFrame !== frame) {
      reflectionLights.length = 0
      reflectionFrame = frame

      for (const light of options.lights) {
        const strobe = Math.floor(strobeRandom(light.id, frame) + 0.18)

        if (strobe > 0) {
          const target = strobeTarget(light, frame / 60)

          reflectionLights.push({
            light,
            lightX: light.x,
            lightZ: light.z,
            target,
            targetX: target[0],
            targetZ: target[2],
          })
        }
      }
    }

    return reflectionLights
  }
}
