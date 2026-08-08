import type { Scene } from '@antv/l7'

export const MAP_WALL_GLOW_IMAGE = 'monitor-map-wall-glow'
export const MAP_WALL_GLOW_URL = '/map-wall-glow.svg?v=2'

export function ensureMapWallGlowTexture(scene: Scene) {
  if (!scene.hasImage(MAP_WALL_GLOW_IMAGE)) {
    scene.addImage(MAP_WALL_GLOW_IMAGE, MAP_WALL_GLOW_URL)
  }
}

export const MAP_WALL_GLOW_STYLE = {
  heightfixed: true,
  lineTexture: true,
  iconStep: 72,
  iconStepCount: 1,
  textureBlend: 'replace' as const,
  opacity: 0.94,
}
