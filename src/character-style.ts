import { hairPalette, jewelPalette, pants, shirt, shirtLight, shoe } from './character-data.ts'
import { normalizeIndex, scale, setVec3 } from './math.ts'
import type { BottomMode, PlayerStyle, ResolvedPlayerStyle, TopMode } from './types.ts'

export function applyTopStyle(topStyleIndex: number) {
  const style = topStyleData(topStyleIndex)

  setVec3(shirt, jewelPalette[style.colorIndex]!)
  setVec3(shirtLight, scale(jewelPalette[style.colorIndex]!, 1.35))

  return style
}

export function applyBottomStyle(bottomStyleIndex: number) {
  const bottomMode = bottomStyleIndex < jewelPalette.length ? 'pants' : 'skirt'
  const pantsColorIndex = bottomStyleIndex % jewelPalette.length

  setVec3(pants, jewelPalette[pantsColorIndex]!)
  setVec3(shoe, scale(jewelPalette[pantsColorIndex]!, 0.72))

  return {
    mode: bottomMode as BottomMode,
    colorIndex: pantsColorIndex,
  }
}

export function resolvePlayerStyle(style: PlayerStyle): ResolvedPlayerStyle {
  const topIndex = normalizeIndex(style.topStyleIndex, jewelPalette.length * 2 + 2)
  const bottomIndex = normalizeIndex(style.bottomStyleIndex, jewelPalette.length * 2)
  const top = topStyleData(topIndex)
  const bottomMode = bottomIndex < jewelPalette.length ? 'pants' : 'skirt'
  const pantsColor = jewelPalette[bottomIndex % jewelPalette.length]!

  return {
    topMode: top.mode,
    bottomMode,
    shirt: jewelPalette[top.colorIndex]!,
    shirtLight: scale(jewelPalette[top.colorIndex]!, 1.35),
    pants: pantsColor,
    shoe: scale(pantsColor, 0.72),
    hairColor: hairPalette[normalizeIndex(style.hairColorIndex, hairPalette.length)]!,
  }
}

function topStyleData(topStyleIndex: number) {
  const colorIndex = topStyleIndex < jewelPalette.length
    ? topStyleIndex
    : topStyleIndex < jewelPalette.length * 2
    ? topStyleIndex - jewelPalette.length
    : 0
  const mode = topStyleIndex < jewelPalette.length
    ? 'shirt'
    : topStyleIndex < jewelPalette.length * 2
    ? 'sleeveless'
    : topStyleIndex === jewelPalette.length * 2
    ? 'skin'
    : 'chest'

  return {
    mode: mode as TopMode,
    colorIndex,
  }
}
