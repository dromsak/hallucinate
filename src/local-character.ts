import { characterFloor } from './character-data.ts'
import { readMoveInput } from './input.ts'
import {
  lengthSq,
  mix,
  normalizeInto,
  smoothAngle,
} from './math.ts'
import { collideRoom, seatAt, walkHeight } from './scene.ts'
import type { BottomMode, CharacterMode, CircleBounds, Vec3 } from './types.ts'

export function createLocalCharacter(keys: Set<string>) {
  const position: Vec3 = [-2.2, -1.95, -6.8]
  const input: Vec3 = [0, 0, 0]
  const forward: Vec3 = [0, 0, 0]
  const right: Vec3 = [0, 0, 0]
  const direction: Vec3 = [0, 0, 0]
  let turn = 0
  let motionBlend = 0
  let mode: CharacterMode = 'stand'
  let velocityY = 0
  let seated = false
  let couchRelease = 0
  let seat = ''

  return {
    position,
    input,
    get turn() {
      return turn
    },
    set turn(value: number) {
      turn = value
    },
    get motionBlend() {
      return motionBlend
    },
    get mode() {
      return mode
    },
    get velocityY() {
      return velocityY
    },
    set velocityY(value: number) {
      velocityY = value
    },
    readInput() {
      return readMoveInput(keys, input)
    },
    update(
      delta: number,
      cameraTurn: number,
      outsideTree: CircleBounds,
      bottomMode: BottomMode,
      occupiedSeats: Set<string>,
    ) {
      this.readInput()
      const moving = lengthSq(input) > 0
      couchRelease = Math.max(0, couchRelease - delta)

      if (seated) {
        if (input[2] > 0) {
          seated = false
          couchRelease = 0.35
          occupiedSeats.delete(seat)
          seat = ''
          mode = 'run'
          motionBlend = 1
          position[0] += Math.sin(turn) * 0.46
          position[2] += Math.cos(turn) * 0.46
        }
        else {
          motionBlend = 0
          mode = bottomMode === 'pants' ? 'manSitting' : 'womanSitting'

          return
        }
      }

      motionBlend = mix(motionBlend, moving ? 1 : 0, 1 - Math.exp(-8 * delta))
      mode = motionBlend > 0.5 ? 'run' : 'stand'

      if (moving) {
        normalizeInto(input)
        const sin = Math.sin(cameraTurn)
        const cos = Math.cos(cameraTurn)

        forward[0] = sin
        forward[1] = 0
        forward[2] = cos
        right[0] = -cos
        right[1] = 0
        right[2] = sin
        direction[0] = forward[0] * input[2] + right[0] * input[0]
        direction[1] = 0
        direction[2] = forward[2] * input[2] + right[2] * input[0]
        normalizeInto(direction)

        position[0] += direction[0] * delta * 5
        position[2] += direction[2] * delta * 5
        const nextSeat = couchRelease <= 0 ? seatAt(position, occupiedSeats) : undefined

        if (nextSeat) {
          seated = true
          seat = nextSeat.id
          occupiedSeats.add(seat)
          position[0] = nextSeat.position[0]
          position[1] = nextSeat.position[1]
          position[2] = nextSeat.position[2]
          turn = nextSeat.turn
          motionBlend = 0
          mode = bottomMode === 'pants' ? 'manSitting' : 'womanSitting'
          velocityY = 0

          return
        }

        collideRoom(position, outsideTree)
        turn = smoothAngle(turn, Math.atan2(direction[0], direction[2]), 10, delta)
      }

      const floorY = walkHeight(position[0], position[1], position[2])

      if (floorY > position[1]) {
        position[1] = floorY
        velocityY = 0
      }
      else {
        velocityY -= 12 * delta
        position[1] += velocityY * delta

        if (position[1] < floorY) {
          position[1] = floorY
          velocityY = 0
        }
      }

      collideRoom(position, outsideTree)
    },
  }
}
