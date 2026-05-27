import './style.css'
import { createCameraController } from './camera-controller.ts'
import { loadCharacterAssets } from './character-assets.ts'
import {
  characterFloor,
  hairPalette,
  jewelPalette,
} from './character-data.ts'
import { buildCharacterDrawData } from './character-draw.ts'
import { triangleAreaSquared } from './character-geometry.ts'
import { updateHairInstances } from './character-hair.ts'
import { createCharacterStyleController } from './character-style.ts'
import { createChatUi } from './chat-ui.ts'
import { readClubState, writeClubState } from './club-state.ts'
import { electricNavy, outsideMotif } from './constants.ts'
import { createDjVideoUi } from './dj-video-ui.ts'
import { getDomElements } from './dom-elements.ts'
import { addRoom, addRoomSmoke, addWallStrips } from './environment-object.ts'
import { bindKeyboardInput } from './input.ts'
import { createLocalCharacter } from './local-character.ts'
import {
  add,
  clamp,
  cross,
  dot,
  normalize,
  normalizeIndex,
  scale,
  setVec3,
  smoothstep,
  subtract,
} from './math.ts'
import { createPlayers, updatePlayers } from './player-system.ts'
import { outsideBounds } from './scene-data.ts'
import {
  isOutside,
  usesSkyBackground,
} from './scene.ts'
import {
  characterBoxFragment,
  characterBoxVertex,
  fragment,
  hairFragment,
  hairVertex,
  lightFragment,
  postFragment,
  postVertex,
  smokeFragment,
  smokeVertex,
  strobeVertex,
  vertex,
} from './shaders.ts'
import { createStrobeLights, strobeLightAmount, strobeRandom, strobeTarget } from './strobe-object.ts'
import { loadOutsideTree } from './tree-world.ts'
import type {
  CharacterRig,
  CircleBounds,
  ClubGlobal,
  HairMesh,
  HairRenderMesh,
  StrobeReflectionLight,
  Vec3,
  Vertex,
} from './types.ts'
import {
  createCharacterBoxGeometry,
  createProgram,
  createSmokeMap,
  createStrobeGeometry,
  createTarget,
  createTreeShadowMap,
  resizeTarget,
} from './webgl.ts'

const clubGlobal = globalThis as ClubGlobal

if (clubGlobal.clubFrameId !== undefined) {
  cancelAnimationFrame(clubGlobal.clubFrameId)
}

const { canvas, djVideo, chatForm, chatInput, chatBubble } = getDomElements()

const gl = canvas.getContext('webgl2', {
  antialias: false,
  alpha: false,
})!

if (!gl) {
  throw new Error('WebGL2 is not available')
}

const vertices: Vertex[] = []
const lights: Vertex[] = []
const smoke: Vertex[] = []
const vertexSize = 11
let characterRig: CharacterRig | undefined
let characterHair: HairMesh | undefined
let characterHairIndex = 0
let characterHairColorIndex = 0
let characterHairMeshes: HairMesh[] = []
let hairRenderMeshes: HairRenderMesh[] = []
let characterRigLoad: Promise<CharacterRig> | undefined
let characterAssetsLoaded = false
let frameId = 0
const saveKey = 'club-state'
const keys = new Set<string>()
const localCharacter = createLocalCharacter(keys)
const characterPosition = localCharacter.position
const styleController = createCharacterStyleController()
const chatUi = createChatUi(chatForm, chatInput, chatBubble, canvas, characterPosition)
const djVideoUi = createDjVideoUi(djVideo, canvas, characterPosition)
const cameraController = createCameraController(canvas, characterPosition)
let outsideTree: CircleBounds = { x: 0, z: 20.5, radius: 0.75 }
let lastStamp = 0
let saveTime = 0

addRoom(vertices)
addWallStrips(lights)
addRoomSmoke(smoke)

let points = new Float32Array(vertices.flat())
let lightPoints = new Float32Array(lights.flat())
const smokePoints = new Float32Array(smoke.flat())
const program = createProgram(gl, vertex, fragment)
const lightProgram = createProgram(gl, vertex, lightFragment)
const strobeProgram = createProgram(gl, strobeVertex, lightFragment)
const characterBoxProgram = createProgram(gl, characterBoxVertex, characterBoxFragment)
const hairProgram = createProgram(gl, hairVertex, hairFragment)
const smokeProgram = createProgram(gl, smokeVertex, smokeFragment)
const postProgram = createProgram(gl, postVertex, postFragment)
const smokeMap = createSmokeMap(gl)
const treeShadowMap = createTreeShadowMap(gl)
const resolution = gl.getUniformLocation(program, 'resolution')
const cameraEye = gl.getUniformLocation(program, 'cameraEye')
const cameraCenter = gl.getUniformLocation(program, 'cameraCenter')
const renderZone = gl.getUniformLocation(program, 'renderZone')
const treeShadowSampler = gl.getUniformLocation(program, 'treeShadowMap')
const characterBoxResolution = gl.getUniformLocation(characterBoxProgram, 'resolution')
const characterBoxCameraEye = gl.getUniformLocation(characterBoxProgram, 'cameraEye')
const characterBoxCameraCenter = gl.getUniformLocation(characterBoxProgram, 'cameraCenter')
const characterBoxRenderZone = gl.getUniformLocation(characterBoxProgram, 'renderZone')
const lightTime = gl.getUniformLocation(lightProgram, 'time')
const lightSmokeMap = gl.getUniformLocation(lightProgram, 'smokeMap')
const lightRenderZone = gl.getUniformLocation(lightProgram, 'renderZone')
const lightResolution = gl.getUniformLocation(lightProgram, 'resolution')
const lightCameraEye = gl.getUniformLocation(lightProgram, 'cameraEye')
const lightCameraCenter = gl.getUniformLocation(lightProgram, 'cameraCenter')
const strobeTime = gl.getUniformLocation(strobeProgram, 'time')
const strobeSmokeMap = gl.getUniformLocation(strobeProgram, 'smokeMap')
const strobeRenderZone = gl.getUniformLocation(strobeProgram, 'renderZone')
const strobeResolution = gl.getUniformLocation(strobeProgram, 'resolution')
const strobeCameraEye = gl.getUniformLocation(strobeProgram, 'cameraEye')
const strobeCameraCenter = gl.getUniformLocation(strobeProgram, 'cameraCenter')
const hairResolution = gl.getUniformLocation(hairProgram, 'resolution')
const hairCameraEye = gl.getUniformLocation(hairProgram, 'cameraEye')
const hairCameraCenter = gl.getUniformLocation(hairProgram, 'cameraCenter')
const hairRenderZone = gl.getUniformLocation(hairProgram, 'renderZone')
const roomSmokeTime = gl.getUniformLocation(smokeProgram, 'time')
const roomSmokeMap = gl.getUniformLocation(smokeProgram, 'smokeMap')
const roomSmokeResolution = gl.getUniformLocation(smokeProgram, 'resolution')
const roomSmokeCameraEye = gl.getUniformLocation(smokeProgram, 'cameraEye')
const roomSmokeCameraCenter = gl.getUniformLocation(smokeProgram, 'cameraCenter')
const postScene = gl.getUniformLocation(postProgram, 'scene')
const postBloom = gl.getUniformLocation(postProgram, 'bloom')
const postBloomResolution = gl.getUniformLocation(postProgram, 'bloomResolution')
const array = gl.createVertexArray()
const buffer = gl.createBuffer()
const lightArray = gl.createVertexArray()
const lightBuffer = gl.createBuffer()
const strobeArray = gl.createVertexArray()
const strobeGeometryBuffer = gl.createBuffer()
const strobeInstanceBuffer = gl.createBuffer()
const smokeArray = gl.createVertexArray()
const smokeBuffer = gl.createBuffer()
const characterArray = gl.createVertexArray()
const characterBuffer = gl.createBuffer()
const characterBoxArray = gl.createVertexArray()
const characterBoxGeometryBuffer = gl.createBuffer()
const characterBoxInstanceBuffer = gl.createBuffer()
const postArray = gl.createVertexArray()
const postBuffer = gl.createBuffer()
const target = createTarget(gl, 1, 1)
const bloomTarget = createTarget(gl, 1, 1)
const stride = vertexSize * Float32Array.BYTES_PER_ELEMENT
const strobeGeometry = createStrobeGeometry()
const strobeInstanceSize = 14
const strobeInstanceStride = strobeInstanceSize * Float32Array.BYTES_PER_ELEMENT
const characterBoxGeometry = createCharacterBoxGeometry()
const characterBoxInstanceSize = 17
const characterBoxInstanceStride = characterBoxInstanceSize * Float32Array.BYTES_PER_ELEMENT
let characterBoxInstances: number[] = []
let characterBoxInstanceCount = 0
let strobeInstances: number[] = []
let strobeInstanceCount = 0

if (!resolution || !cameraEye || !cameraCenter || !renderZone || !treeShadowSampler || !characterBoxResolution
  || !characterBoxCameraEye || !characterBoxCameraCenter || !characterBoxRenderZone || !lightTime || !lightSmokeMap
  || !lightRenderZone || !lightResolution || !lightCameraEye || !lightCameraCenter || !strobeTime || !strobeSmokeMap
  || !strobeRenderZone || !strobeResolution || !strobeCameraEye || !strobeCameraCenter || !hairResolution
  || !hairCameraEye
  || !hairCameraCenter || !hairRenderZone || !roomSmokeTime || !roomSmokeMap || !roomSmokeResolution
  || !roomSmokeCameraEye || !roomSmokeCameraCenter || !postScene || !postBloom || !postBloomResolution || !array
  || !buffer || !lightArray || !lightBuffer || !strobeArray || !strobeGeometryBuffer || !strobeInstanceBuffer
  || !smokeArray || !smokeBuffer || !characterArray || !characterBuffer
  || !characterBoxArray || !characterBoxGeometryBuffer || !characterBoxInstanceBuffer || !postArray || !postBuffer)
{
  throw new Error('Failed to initialize WebGL resources')
}

gl.bindVertexArray(array)
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(5)
gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 10 * Float32Array.BYTES_PER_ELEMENT)
gl.bindVertexArray(null)

function refreshRoomBuffer() {
  points = new Float32Array(vertices.flat())
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW)
}

gl.bindVertexArray(lightArray)
gl.bindBuffer(gl.ARRAY_BUFFER, lightBuffer)
gl.bufferData(gl.ARRAY_BUFFER, lightPoints, gl.DYNAMIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(5)
gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 10 * Float32Array.BYTES_PER_ELEMENT)
gl.bindVertexArray(null)

gl.bindVertexArray(strobeArray)
gl.bindBuffer(gl.ARRAY_BUFFER, strobeGeometryBuffer)
gl.bufferData(gl.ARRAY_BUFFER, strobeGeometry.data, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 8 * Float32Array.BYTES_PER_ELEMENT, 4 * Float32Array.BYTES_PER_ELEMENT)
gl.bindBuffer(gl.ARRAY_BUFFER, strobeInstanceBuffer)
gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 3, gl.FLOAT, false, strobeInstanceStride, 0)
gl.vertexAttribDivisor(2, 1)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 3, gl.FLOAT, false, strobeInstanceStride, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(3, 1)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 3, gl.FLOAT, false, strobeInstanceStride, 6 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(4, 1)
gl.enableVertexAttribArray(5)
gl.vertexAttribPointer(5, 3, gl.FLOAT, false, strobeInstanceStride, 9 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(5, 1)
gl.enableVertexAttribArray(6)
gl.vertexAttribPointer(6, 2, gl.FLOAT, false, strobeInstanceStride, 12 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(6, 1)
gl.bindVertexArray(null)

gl.bindVertexArray(smokeArray)
gl.bindBuffer(gl.ARRAY_BUFFER, smokeBuffer)
gl.bufferData(gl.ARRAY_BUFFER, smokePoints, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(5)
gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 10 * Float32Array.BYTES_PER_ELEMENT)
gl.bindVertexArray(null)

gl.bindVertexArray(characterArray)
gl.bindBuffer(gl.ARRAY_BUFFER, characterBuffer)
gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(3)
gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(4)
gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT)
gl.enableVertexAttribArray(5)
gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 10 * Float32Array.BYTES_PER_ELEMENT)
gl.bindVertexArray(null)

gl.bindVertexArray(characterBoxArray)
gl.bindBuffer(gl.ARRAY_BUFFER, characterBoxGeometryBuffer)
gl.bufferData(gl.ARRAY_BUFFER, characterBoxGeometry.data, gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)
gl.enableVertexAttribArray(1)
gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT)
gl.bindBuffer(gl.ARRAY_BUFFER, characterBoxInstanceBuffer)
gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW)
for (let i = 0; i < 5; i++) {
  const location = 2 + i

  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, 3, gl.FLOAT, false, characterBoxInstanceStride,
    i * 3 * Float32Array.BYTES_PER_ELEMENT)
  gl.vertexAttribDivisor(location, 1)
}
gl.enableVertexAttribArray(7)
gl.vertexAttribPointer(7, 1, gl.FLOAT, false, characterBoxInstanceStride, 15 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(7, 1)
gl.enableVertexAttribArray(8)
gl.vertexAttribPointer(8, 1, gl.FLOAT, false, characterBoxInstanceStride, 16 * Float32Array.BYTES_PER_ELEMENT)
gl.vertexAttribDivisor(8, 1)
gl.bindVertexArray(null)

gl.bindVertexArray(postArray)
gl.bindBuffer(gl.ARRAY_BUFFER, postBuffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
gl.enableVertexAttribArray(0)
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
gl.bindVertexArray(null)

gl.enable(gl.DEPTH_TEST)
gl.clearColor(0.01, 0.01, 0.014, 1.0)

restoreState()
djVideoUi.setZoneFromPosition()
djVideoUi.load()

bindKeyboardInput({
  activeInput: chatInput,
  keys,
  openChatInput,
  cycleHair,
  cycleHairColor,
  cycleShirt,
  cyclePants,
})

chatForm.addEventListener('submit', event => {
  event.preventDefault()
  chatUi.submit()
})

const resize = () => {
  const ratio = window.devicePixelRatio
  const width = Math.floor(canvas.clientWidth * ratio)
  const height = Math.floor(canvas.clientHeight * ratio)

  canvas.width = width
  canvas.height = height
  resizeTarget(gl, target, width, height)
  resizeTarget(gl, bloomTarget, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)))
  gl.viewport(0, 0, width, height)
}

const draw = (stamp: number) => {
  const delta = lastStamp === 0 ? 0 : Math.min((stamp - lastStamp) / 1000, 0.05)
  const frame = Math.floor(stamp / 16.6667)

  lightFrame = frame
  lastStamp = stamp
  resize()
  localCharacter.update(delta, cameraController.turn, outsideTree)
  updatePlayers(players, delta, stamp * 0.001, outsideTree)
  updateCamera(delta)
  updateSave(delta)
  const camera = getCamera()
  const lightCount = updateLightBuffer(stamp * 0.001)

  djVideoUi.update(camera)
  chatUi.update(camera, stamp)

  const outside = isOutside(characterPosition)
  const sky = usesSkyBackground(camera)

  gl.bindFramebuffer(gl.FRAMEBUFFER, target.frame)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.enable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  gl.clearColor(sky ? 0.28 : 0.01, sky ? 0.55 : 0.01, sky ? 0.92 : 0.014, 0.0)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.useProgram(program)
  gl.uniform2f(resolution, canvas.width, canvas.height)
  gl.uniform3f(cameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(cameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.uniform1i(renderZone, outside ? 1 : 0)
  gl.activeTexture(gl.TEXTURE4)
  gl.bindTexture(gl.TEXTURE_2D, treeShadowMap)
  gl.uniform1i(treeShadowSampler, 4)
  gl.bindVertexArray(array)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.enable(gl.POLYGON_OFFSET_FILL)
  gl.polygonOffset(1, 1)
  gl.drawArrays(gl.TRIANGLES, 0, points.length / vertexSize)
  gl.disable(gl.POLYGON_OFFSET_FILL)
  gl.disable(gl.BLEND)
  const characterCount = updateCharacterMesh(stamp * 0.001)

  if (characterCount > 0) {
    gl.bindVertexArray(characterArray)
    gl.drawArrays(gl.TRIANGLES, 0, characterCount)
  }
  drawCharacterBoxes(camera, canvas.width, canvas.height, outside)
  drawNpcHair(camera, canvas.width, canvas.height, outside)

  drawRoomDepth(camera, canvas.width, canvas.height, outside)
  gl.enable(gl.BLEND)
  gl.depthMask(false)
  if (!outside) {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    useRoomSmokeProgram(camera, canvas.width, canvas.height, stamp * 0.001)
    gl.bindVertexArray(smokeArray)
    gl.drawArrays(gl.TRIANGLES, 0, smokePoints.length / vertexSize)
  }
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  useLightProgram(camera, canvas.width, canvas.height, frame)
  gl.bindVertexArray(lightArray)
  gl.drawArrays(gl.TRIANGLES, 0, lightCount)
  drawStrobes(camera, canvas.width, canvas.height, frame)
  gl.depthMask(true)
  gl.disable(gl.BLEND)

  gl.bindFramebuffer(gl.FRAMEBUFFER, bloomTarget.frame)
  gl.viewport(0, 0, bloomTarget.width, bloomTarget.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.useProgram(program)
  gl.uniform2f(resolution, bloomTarget.width, bloomTarget.height)
  gl.uniform3f(cameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(cameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.uniform1i(renderZone, outside ? 1 : 0)
  gl.activeTexture(gl.TEXTURE4)
  gl.bindTexture(gl.TEXTURE_2D, treeShadowMap)
  gl.uniform1i(treeShadowSampler, 4)
  gl.colorMask(false, false, false, false)
  gl.bindVertexArray(array)
  gl.enable(gl.POLYGON_OFFSET_FILL)
  gl.polygonOffset(1, 1)
  gl.drawArrays(gl.TRIANGLES, 0, points.length / vertexSize)
  gl.disable(gl.POLYGON_OFFSET_FILL)

  if (characterCount > 0) {
    gl.bindVertexArray(characterArray)
    gl.drawArrays(gl.TRIANGLES, 0, characterCount)
  }
  drawCharacterBoxes(camera, bloomTarget.width, bloomTarget.height, outside)
  drawNpcHair(camera, bloomTarget.width, bloomTarget.height, outside)

  drawRoomDepth(camera, bloomTarget.width, bloomTarget.height, outside)
  gl.colorMask(true, true, true, true)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.depthMask(false)
  useLightProgram(camera, bloomTarget.width, bloomTarget.height, frame)
  gl.bindVertexArray(lightArray)
  gl.drawArrays(gl.TRIANGLES, 0, lightCount)
  drawStrobes(camera, bloomTarget.width, bloomTarget.height, frame)
  gl.depthMask(true)
  gl.disable(gl.BLEND)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  gl.clearColor(sky ? 0.28 : 0.01, sky ? 0.55 : 0.01, sky ? 0.92 : 0.014, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(postProgram)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, target.color)
  gl.uniform1i(postScene, 0)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, bloomTarget.color)
  gl.uniform1i(postBloom, 1)
  gl.uniform2f(postBloomResolution, bloomTarget.width, bloomTarget.height)
  gl.bindVertexArray(postArray)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  frameId = requestAnimationFrame(draw)
  clubGlobal.clubFrameId = frameId
}

frameId = requestAnimationFrame(draw)
clubGlobal.clubFrameId = frameId

loadCharacterRigOnce()
  .then(next => {
    characterRig = next
  })
  .catch((error: unknown) => {
    console.error(error)
  })

function loadCharacterRigOnce() {
  characterRigLoad ??= loadCharacterRig()

  return characterRigLoad
}

import.meta.hot?.dispose(() => {
  cancelAnimationFrame(frameId)
})

function drawRoomDepth(
  camera: { eye: [number, number, number]; center: [number, number, number] },
  width: number,
  height: number,
  outside: boolean,
) {
  gl.useProgram(program)
  gl.uniform2f(resolution, width, height)
  gl.uniform3f(cameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(cameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.uniform1i(renderZone, outside ? 1 : 0)
  gl.activeTexture(gl.TEXTURE4)
  gl.bindTexture(gl.TEXTURE_2D, treeShadowMap)
  gl.uniform1i(treeShadowSampler, 4)
  gl.colorMask(false, false, false, false)
  gl.depthMask(true)
  gl.bindVertexArray(array)
  gl.drawArrays(gl.TRIANGLES, 0, points.length / vertexSize)
  gl.colorMask(true, true, true, true)
}

function useRoomSmokeProgram(
  camera: { eye: [number, number, number]; center: [number, number, number] },
  width: number,
  height: number,
  time: number,
) {
  gl.useProgram(smokeProgram)
  gl.uniform1f(roomSmokeTime, time)
  gl.uniform2f(roomSmokeResolution, width, height)
  gl.uniform3f(roomSmokeCameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(roomSmokeCameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.activeTexture(gl.TEXTURE3)
  gl.bindTexture(gl.TEXTURE_2D, smokeMap)
  gl.uniform1i(roomSmokeMap, 3)
}

function useLightProgram(
  camera: { eye: [number, number, number]; center: [number, number, number] },
  width: number,
  height: number,
  frame: number,
) {
  gl.useProgram(lightProgram)
  gl.uniform1f(lightTime, frame)
  gl.uniform1i(lightRenderZone, isOutside(characterPosition) ? 1 : 0)
  gl.uniform2f(lightResolution, width, height)
  gl.uniform3f(lightCameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(lightCameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, smokeMap)
  gl.uniform1i(lightSmokeMap, 2)
}

function useStrobeProgram(
  camera: { eye: [number, number, number]; center: [number, number, number] },
  width: number,
  height: number,
  frame: number,
) {
  gl.useProgram(strobeProgram)
  gl.uniform1f(strobeTime, frame)
  gl.uniform1i(strobeRenderZone, isOutside(characterPosition) ? 1 : 0)
  gl.uniform2f(strobeResolution, width, height)
  gl.uniform3f(strobeCameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(strobeCameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, smokeMap)
  gl.uniform1i(strobeSmokeMap, 2)
}

function updateLightBuffer(time: number) {
  updateStrobeInstances(time)

  return lightPoints.length / vertexSize
}

function updateStrobeInstances(time: number) {
  strobeInstances.length = 0

  for (const light of strobeLights) {
    if (light.zone !== djVideoUi.zone) {
      continue
    }

    const hit = strobeTarget(light, time)
    const outside = light.zone === 'outside'

    strobeInstances.push(
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

  strobeInstanceCount = strobeInstances.length / strobeInstanceSize
  gl.bindBuffer(gl.ARRAY_BUFFER, strobeInstanceBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strobeInstances), gl.DYNAMIC_DRAW)
}

function drawStrobes(camera: ReturnType<typeof getCamera>, width: number, height: number, frame: number) {
  if (strobeInstanceCount === 0) {
    return
  }

  useStrobeProgram(camera, width, height, frame)
  gl.bindVertexArray(strobeArray)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, strobeGeometry.count, strobeInstanceCount)
}

const wallLightZ = [-2, -6, -10, -14, -18, -22]
const backLightX = [-4.5, 0, 4.5]
const strobeLights = createStrobeLights()
const players = createPlayers(100, outsideTree)
let lightFrame = 0
let strobeReflectionFrame = -1
let strobeReflectionLights: StrobeReflectionLight[] = []
async function loadCharacterRig(): Promise<CharacterRig> {
  const assets = await loadCharacterAssets(gl, characterHairIndex)

  characterHairMeshes = assets.hairMeshes
  hairRenderMeshes = assets.hairRenderMeshes
  characterHairIndex = assets.hairIndex
  characterAssetsLoaded = true
  setCharacterHair()
  logCurrentHair()
  loadOutsideTree(gl, treeShadowMap, vertices, outsideTree, addSunLitTriangle)
    .then(nextTree => {
      outsideTree = nextTree
      refreshRoomBuffer()
    })
    .catch((error: unknown) => {
      console.error(error)
    })

  return assets.rig
}

function updateCharacterMesh(time: number) {
  if (!characterRig) {
    return 0
  }

  const data = buildCharacterDrawData({
    cameraPosition: cameraController.position,
    cameraTarget: cameraController.target,
    character: {
      position: characterPosition,
      turn: localCharacter.turn,
      motionBlend: localCharacter.motionBlend,
      style: {
        topStyleIndex: styleController.topStyleIndex,
        bottomStyleIndex: styleController.bottomStyleIndex,
        hairIndex: characterHairIndex,
        hairColorIndex: characterHairColorIndex,
      },
    },
    hairMeshes: characterHairMeshes,
    height: canvas.height,
    light: addLocalReflection,
    players,
    rig: characterRig,
    time,
    width: canvas.width,
  })

  characterBoxInstances = data.boxInstances
  updateHairInstances(gl, hairRenderMeshes, data.hairInstances)
  updateCharacterBoxInstances()

  gl.bindBuffer(gl.ARRAY_BUFFER, characterBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW)

  return data.vertices.length / vertexSize
}

function updateCharacterBoxInstances() {
  characterBoxInstanceCount = characterBoxInstances.length / characterBoxInstanceSize
  gl.bindBuffer(gl.ARRAY_BUFFER, characterBoxInstanceBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(characterBoxInstances), gl.DYNAMIC_DRAW)
}

function drawCharacterBoxes(camera: ReturnType<typeof getCamera>, width: number, height: number, outside: boolean) {
  if (characterBoxInstanceCount === 0) {
    return
  }

  gl.useProgram(characterBoxProgram)
  gl.uniform2f(characterBoxResolution, width, height)
  gl.uniform3f(characterBoxCameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(characterBoxCameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.uniform1i(characterBoxRenderZone, outside ? 1 : 0)
  gl.bindVertexArray(characterBoxArray)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, characterBoxGeometry.count, characterBoxInstanceCount)
  gl.bindVertexArray(null)
}

function drawNpcHair(camera: ReturnType<typeof getCamera>, width: number, height: number, outside: boolean) {
  gl.useProgram(hairProgram)
  gl.uniform2f(hairResolution, width, height)
  gl.uniform3f(hairCameraEye, camera.eye[0], camera.eye[1], camera.eye[2])
  gl.uniform3f(hairCameraCenter, camera.center[0], camera.center[1], camera.center[2])
  gl.uniform1i(hairRenderZone, outside ? 1 : 0)

  for (const mesh of hairRenderMeshes) {
    if (mesh.instanceCount > 0) {
      gl.bindVertexArray(mesh.array)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, mesh.vertexCount, mesh.instanceCount)
    }
  }

  gl.bindVertexArray(null)
}

function addSunLitTriangle(
  target: Vertex[],
  a: Vec3,
  b: Vec3,
  c: Vec3,
  color: Vec3,
  tree = outsideTree,
) {
  const center = scale(add(add(a, b), c), 1 / 3)
  const normal = normalize(cross(subtract(c, a), subtract(b, a)))
  const sun = normalize(subtract([10.5, 6.8, outsideBounds.front], center))
  const diffuse = Math.abs(dot(normal, sun))
  const lift = clamp((normal[1] + 1) * 0.5, 0, 1)
  const night = outsideMotif === 'night'
  const treeLights: Vec3[] = [
    [tree.x - tree.radius * 2.5, characterFloor - 0.35, tree.z + tree.radius * 0.85],
    [tree.x + tree.radius * 2.5, characterFloor - 0.35, tree.z + tree.radius * 0.85],
    [tree.x, characterFloor - 0.35, tree.z - tree.radius * 2.5],
  ]
  let uplight = 0

  for (const light of treeLights) {
    const toLight = subtract(light, center)
    const distance = Math.hypot(toLight[0], toLight[1], toLight[2])
    const fromLight = normalize(subtract(center, light))
    const vertical = clamp(dot(fromLight, [0, 1, 0]), 0, 1)
    const facing = clamp(dot(normal, scale(fromLight, -1)), 0, 1)
    const cone = smoothstep(0.58, 0.96, vertical)

    uplight += facing * cone * clamp(1 - distance / 8, 0, 1)
  }

  const light = 0.34 + diffuse * 0.86 + lift * 0.18
  const warmth: Vec3 = [1.1, 1.03, 0.86]
  const baseLight = night ? light * 0.22 + lift * 0.04 : light
  const blueLight = night ? uplight * 2.1 : 0
  const shade: Vec3 = [
    clamp(color[0] * baseLight * warmth[0] + blueLight * electricNavy[0], 0, 1),
    clamp(color[1] * baseLight * warmth[1] + blueLight * electricNavy[1], 0, 1),
    clamp(color[2] * baseLight * warmth[2] + blueLight * electricNavy[2], 0, 1),
  ]

  target.push(
    [a[0], a[1], a[2], shade[0], shade[1], shade[2], 0, 0, 0, 0, 0],
    [b[0], b[1], b[2], shade[0], shade[1], shade[2], 0, 0, 0, 0, 0],
    [c[0], c[1], c[2], shade[0], shade[1], shade[2], 0, 0, 0, 0, 0],
  )
}

function addLocalReflection(color: Vec3, point: Vec3, normal: Vec3): Vec3 {
  const red = redReflection(point, normal)
  const white = strobeReflection(point, normal)

  return [
    clamp(color[0] + red * 1.45 + white * 2.85, 0, 1),
    clamp(color[1] + red * 0.06 + white * 2.7, 0, 1),
    clamp(color[2] + red * 0.03 + white * 2.25, 0, 1),
  ]
}

function redReflection(point: Vec3, normal: Vec3) {
  if (Math.abs(normal[0]) > Math.abs(normal[2])) {
    const x = normal[0] > 0 ? 6.98 : -6.98
    const z = nearestValue(wallLightZ, point[2])

    return redLightAmount(point, normal, x, point[1], z)
  }

  const z = normal[2] > 0 ? 3.98 : -23.98
  const x = nearestValue(backLightX, point[0])

  return redLightAmount(point, normal, x, point[1], z)
}

function nearestValue(values: number[], target: number) {
  let next = values[0]!
  let distance = Math.abs(target - next)

  for (let i = 1; i < values.length; i++) {
    const value = values[i]!
    const nextDistance = Math.abs(target - value)

    if (nextDistance < distance) {
      next = value
      distance = nextDistance
    }
  }

  return next
}

function redLightAmount(point: Vec3, normal: Vec3, x: number, y: number, z: number) {
  const dx = x - point[0]
  const dy = y - point[1]
  const dz = z - point[2]
  const distance = Math.hypot(dx, dz)
  const length = Math.hypot(dx, dy, dz)
  const facing = Math.max(0, (normal[0] * dx + normal[1] * dy + normal[2] * dz) / length)
  const height = 0.8 + Math.max(0, point[1] + 1.95) * 0.18

  return Math.exp(-distance * 0.95) * facing * Math.sqrt(facing) * height * 1.65
}

function strobeReflection(point: Vec3, normal: Vec3) {
  let amount = 0
  const active = activeStrobeReflectionLights()

  for (const setup of active) {
    amount = Math.max(amount, strobeLightAmount(point, normal, setup.light, setup.target))
  }

  return amount
}

function activeStrobeReflectionLights() {
  if (strobeReflectionFrame !== lightFrame) {
    strobeReflectionLights = []
    strobeReflectionFrame = lightFrame

    for (const light of strobeLights) {
      const strobe = Math.floor(strobeRandom(light.id, lightFrame) + 0.18)

      if (strobe > 0) {
        strobeReflectionLights.push({
          light,
          target: strobeTarget(light, lightFrame / 60),
        })
      }
    }
  }

  return strobeReflectionLights
}

function restoreState() {
  const state = readClubState(saveKey)

  if (state) {
    setVec3(characterPosition, state.character)
    setVec3(cameraController.position, state.camera)
    cameraController.turn = state.cameraTurn
    localCharacter.turn = state.characterTurn
    localCharacter.velocityY = state.velocityY
    characterHairIndex = state.characterHairIndex ?? characterHairIndex
    characterHairColorIndex = normalizeIndex(state.characterHairColorIndex ?? characterHairColorIndex,
      hairPalette.length)
    styleController.topStyleIndex = normalizeIndex(state.topStyleIndex ?? state.shirtColorIndex
      ?? styleController.topStyleIndex, jewelPalette.length * 2 + 2)
    styleController.bottomStyleIndex = normalizeIndex(state.bottomStyleIndex ?? state.pantsColorIndex
      ?? styleController.bottomStyleIndex, jewelPalette.length * 2)
    djVideoUi.times.inside = state.videoTimes?.inside ?? djVideoUi.times.inside
    djVideoUi.times.outside = state.videoTimes?.outside ?? djVideoUi.times.outside
    styleController.setTopStyle()
    styleController.setBottomStyle()
  }
}

function saveState() {
  if (!characterAssetsLoaded) {
    return
  }

  djVideoUi.syncCurrentTime()

  writeClubState(saveKey, {
    character: characterPosition,
    camera: cameraController.position,
    cameraTurn: cameraController.turn,
    characterTurn: localCharacter.turn,
    velocityY: localCharacter.velocityY,
    characterHairIndex,
    characterHairColorIndex,
    shirtColorIndex: styleController.shirtColorIndex,
    topStyleIndex: styleController.topStyleIndex,
    pantsColorIndex: styleController.pantsColorIndex,
    bottomStyleIndex: styleController.bottomStyleIndex,
    videoTimes: djVideoUi.times,
  })
}

function updateSave(delta: number) {
  saveTime += delta

  if (saveTime >= 0.5) {
    saveState()
    saveTime = 0
  }
}

function updateCamera(delta: number) {
  localCharacter.readInput()
  cameraController.update(delta, localCharacter.input, localCharacter.turn)
}

function getCamera() {
  return cameraController.get()
}

function openChatInput() {
  chatUi.open()
}

function cycleHair(direction: number) {
  if (characterHairMeshes.length === 0) {
    return
  }

  characterHairIndex = normalizeIndex(characterHairIndex + direction, characterHairMeshes.length + 1)
  setCharacterHair()
  logCurrentHair()
}

function setCharacterHair() {
  characterHair = characterHairIndex === 0 ? undefined : characterHairMeshes[characterHairIndex - 1]!
}

function logCurrentHair() {
  console.log(`Current hair ${characterHairIndex}: ${characterHair?.name ?? 'no hair'}`)
}

function cycleHairColor(direction: number) {
  characterHairColorIndex = normalizeIndex(characterHairColorIndex + direction, hairPalette.length)
}

function cycleShirt(direction: number) {
  styleController.cycleShirt(direction)
}

function cyclePants(direction: number) {
  styleController.cyclePants(direction)
}
