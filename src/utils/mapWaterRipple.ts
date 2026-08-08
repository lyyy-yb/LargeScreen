import { PolygonLayer, type ILayer, type Scene } from '@antv/l7'

/** 美工提供的高清无缝水面纹理（2048×2048 tileable PNG） */
export const WATER_TEXTURE_URL = '/water-texture.png'

/**
 * 在区域面上叠加一层水波纹表面层。
 * 使用美工提供的 2048×2048 高清无缝贴图，通过 L7 PolygonLayer extrude 的
 * mapTexture 直接贴到顶面，UV 按数据包围盒归一化整幅映射，呈现清晰无缝的水面质感。
 */
export function addWaterRippleSurface(
  scene: Scene,
  geojson: unknown,
  topHeight: number,
  zIndex = 3,
): ILayer {
  const layer = new PolygonLayer({
    zIndex,
    name: 'water-ripple-surface',
    enablePicking: false,
    autoFit: false,
  })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .source(geojson as any)
    .shape('extrude')
    .size(topHeight + 500)
    .color('#5DDDFF')
    .style({
      mapTexture: WATER_TEXTURE_URL,
      topsurface: true,
      sidesurface: false,
      heightfixed: true,
      raisingHeight: 0,
      opacity: 0.85,
    })
  scene.addLayer(layer)
  return layer
}
