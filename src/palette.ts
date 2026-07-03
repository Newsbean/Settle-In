import { Color3, Color4 } from '@babylonjs/core'

// Warm, soft, hand-drawn color language borrowed from A Little to the Left and
// the project's rose organizer-tray reference. Everything is muted and cozy —
// no pure whites, no glossy saturated primaries.

function hex(h: string): Color3 {
  return Color3.FromHexString(h)
}

export const PALETTE = {
  // Shell / architecture
  wallRose: hex('#e7a9a0'),
  wallRoseDeep: hex('#d98b82'),
  wallCream: hex('#f3e6cf'),
  floorCream: hex('#efdcc0'),
  floorPlank: hex('#e2c69f'),
  trim: hex('#c98964'),
  ceiling: hex('#f6ecdd'),

  // Props
  woodWarm: hex('#cf9a6f'),
  woodDeep: hex('#a9744c'),
  book1: hex('#e88b7d'),
  book2: hex('#f0c55f'),
  book3: hex('#8bb8c7'),
  book4: hex('#b98bbf'),
  book5: hex('#e5a85a'),
  plum: hex('#5c3b48'),
  bolt: hex('#6b4a54'),
  cardboard: hex('#d8a86f'),
  mug: hex('#8bb8c7'),
  plant: hex('#7ba36b'),
  plantPot: hex('#d98b82'),
  appliance: hex('#f5efe0'),

  // Named accents (used by UI/props)
  gold: hex('#f0c55f'),
  sky: hex('#8bb8c7'),

  // Outside the front door
  grass: hex('#aab883'),
  path: hex('#dcc6a3'),
  hedge: hex('#8ba36b'),

  // Light / mood
  skinHand: hex('#f0b091'),
  glowWarm: hex('#ffd9a0'),
  sparkle: hex('#fff2cf'),
} as const

// Scene clear color — a soft warm cream, like sun through curtains.
export const CLEAR_COLOR = new Color4(0.96, 0.9, 0.82, 1)

// Highlight tints for interactable states.
export const HIGHLIGHT = {
  idle: hex('#ffdca8'),
  active: hex('#ffcaa0'),
  ghost: hex('#c9a98f'),
  correct: hex('#bfe0b0'),
  wrong: hex('#e7b0a0'),
} as const
