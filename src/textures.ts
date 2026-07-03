import { Texture, type Scene } from '@babylonjs/core'

// Hand-drawn gouache surface textures (generated via rezona-pgc-tools-gen-image,
// gpt-5.4-image-2). These "wrap" the furniture geometry — wood grain, cardboard,
// woven fabric and ceramic glaze — so pieces read as painted objects rather than
// flat-shaded primitives. Deliberately FLAT and minimal in the A-Little-to-the-Left
// picture-book register: soft even fills with only a few gentle drawn strokes, no
// photoreal detail — that stylised softness is what makes the scene soothing.
// Files live in this project's own src/assets so the game ships self-contained.
const URLS = {
  wood_warm: new URL('./assets/sprite/sprite_tex-wood-warm-flat_72c8d7.webp', import.meta.url).href,
  wood_deep: new URL('./assets/sprite/sprite_tex-wood-deep-flat_58d4ad.webp', import.meta.url).href,
  cardboard: new URL('./assets/sprite/sprite_tex-cardboard-flat_55c6f5.webp', import.meta.url).href,
  fabric_cream: new URL('./assets/sprite/sprite_tex-fabric-cream-flat_884ff6.webp', import.meta.url).href,
  fabric_rose: new URL('./assets/sprite/sprite_tex-fabric-rose-flat_694d6d.webp', import.meta.url).href,
  ceramic: new URL('./assets/sprite/sprite_tex-ceramic-flat_f45292.webp', import.meta.url).href,
  // Painted "skins" (2026-07-04): Minecraft-style face wraps with drawn detail —
  // borders, seams, labels — so plain primitives read as painted objects. Each
  // wraps 0..1 per box face, so the drawn border frames every face.
  skin_cardboard: new URL('./assets/sprite/sprite_skin-cardboard-label_0f9e5b.webp', import.meta.url).href,
  skin_wood_plank: new URL('./assets/sprite/sprite_skin-wood-plank_907e7b.webp', import.meta.url).href,
  skin_wood_deep: new URL('./assets/sprite/sprite_skin-wood-deep_3d0463.webp', import.meta.url).href,
  skin_fabric_rose: new URL('./assets/sprite/sprite_skin-fabric-rose_447efc.webp', import.meta.url).href,
  skin_fabric_cream: new URL('./assets/sprite/sprite_skin-fabric-cream_66924a.webp', import.meta.url).href,
  skin_book_cover: new URL('./assets/sprite/sprite_skin-book-cover_42d34a.webp', import.meta.url).href,
  skin_vanity_door: new URL('./assets/sprite/sprite_skin-vanity-door_2b5e5d.webp', import.meta.url).href,
  skin_picture_art: new URL('./assets/sprite/sprite_skin-picture-art_7a7f27.webp', import.meta.url).href,
  skin_floor: new URL('./assets/sprite/sprite_skin-floor-plank_344a2e.webp', import.meta.url).href,
  skin_wall: new URL('./assets/sprite/sprite_skin-wall-wash_bc3055.webp', import.meta.url).href,
  // Surface skins added 2026-07-03 for previously flat-colour architecture.
  // (skin_tile / skin_path / skin_hedge pending — their gen jobs were blocked
  // on an exhausted image-gen credit; wire them in once generated.)
  skin_wall_deep: new URL('./assets/sprite/sprite_skin-wall-deep_f071e5.webp', import.meta.url).href,
  skin_ceiling: new URL('./assets/sprite/sprite_skin-ceiling_35765e.webp', import.meta.url).href,
  skin_trim: new URL('./assets/sprite/sprite_skin-trim_599f44.webp', import.meta.url).href,
  skin_rug: new URL('./assets/sprite/sprite_skin-rug_4acf45.webp', import.meta.url).href,
  skin_grass: new URL('./assets/sprite/sprite_skin-grass_bf65ad.webp', import.meta.url).href,
} as const

export type TexKey = keyof typeof URLS

// One Texture per (key, tiling) — Babylon shares the decoded image across
// instances by URL, so distinct uScale/vScale variants are cheap. Cached so
// every material asking for the same wrap reuses the same GPU texture.
const cache = new Map<string, Texture>()

export function surfaceTexture(scene: Scene, key: TexKey, u = 1, v = 1): Texture {
  const ck = `${key}:${u}:${v}`
  const hit = cache.get(ck)
  if (hit) return hit
  const t = new Texture(URLS[key], scene, { invertY: false })
  t.wrapU = Texture.WRAP_ADDRESSMODE
  t.wrapV = Texture.WRAP_ADDRESSMODE
  t.uScale = u
  t.vScale = v
  cache.set(ck, t)
  return t
}

export function disposeTextureCache(): void {
  for (const t of cache.values()) t.dispose()
  cache.clear()
}
