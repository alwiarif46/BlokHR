/** Shared Assembly / HeroMosaic color language for Apex widget shells. */

export const MOSAIC = {
  mint: '#7CE3A2',
  gold: '#EDC457',
  coral: '#DE695A',
  blue: '#5D87ED',
  /** Softer blue for widget shells — better contrast with dark text. */
  blueSoft: '#A8C2F7',
  charcoal: '#2D2F31',
  midGray: '#53565C',
  darkFace: '#121314',
  radiusPx: 14,
} as const

export type MosaicTone = 'light' | 'dark'

export interface MosaicShell {
  bg: string
  tone: MosaicTone
}

/** Cycle of fills matching HeroMosaic blocks (order stable for hashing). */
export const MOSAIC_FILLS: readonly MosaicShell[] = [
  { bg: MOSAIC.mint, tone: 'light' },
  { bg: MOSAIC.gold, tone: 'light' },
  { bg: MOSAIC.coral, tone: 'light' },
  { bg: MOSAIC.blueSoft, tone: 'light' },
  { bg: MOSAIC.charcoal, tone: 'dark' },
  { bg: MOSAIC.midGray, tone: 'dark' },
  { bg: MOSAIC.darkFace, tone: 'dark' },
] as const

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

/** Stable mosaic fill for a widget id. */
export function mosaicShellForId(id: string): MosaicShell {
  return MOSAIC_FILLS[hashId(id) % MOSAIC_FILLS.length]!
}

export const DARK_FACE: MosaicShell = { bg: MOSAIC.darkFace, tone: 'dark' }
