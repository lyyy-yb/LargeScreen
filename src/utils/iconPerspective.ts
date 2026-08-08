/**
 * 将地图圆形图标预渲染成清晰的轻量浮雕效果。
 * 只保留轮廓、高光和内阴影，不再绘制底座或落地投影，避免小尺寸标记互相遮挡。
 */

const iconCache = new Map<string, Promise<HTMLImageElement>>()

export const ICON_TILT_X = 24
export const ICON_TILT_Y = 8

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`加载图标失败: ${url}`))
    image.src = url
  })
}

async function renderBevelIcon(url: string): Promise<HTMLCanvasElement> {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D 上下文不可用')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  // 原图保持正视角，优先保证污染等级和设备符号在 14~18px 下仍然清楚。
  context.drawImage(image, 3, 3, 58, 58)

  context.save()
  context.beginPath()
  context.arc(32, 32, 27.5, 0, Math.PI * 2)
  context.clip()

  const highlight = context.createRadialGradient(22, 17, 1, 25, 23, 31)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.34)')
  highlight.addColorStop(0.34, 'rgba(255, 255, 255, 0.09)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = highlight
  context.fillRect(4, 4, 56, 56)

  const innerShade = context.createLinearGradient(0, 12, 0, 59)
  innerShade.addColorStop(0, 'rgba(0, 15, 38, 0)')
  innerShade.addColorStop(0.72, 'rgba(0, 15, 38, 0.03)')
  innerShade.addColorStop(1, 'rgba(0, 15, 38, 0.22)')
  context.fillStyle = innerShade
  context.fillRect(4, 4, 56, 56)
  context.restore()

  // 双层细描边带来正面的徽章质感，但不增加图标占地面积。
  context.strokeStyle = 'rgba(224, 255, 255, 0.78)'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(32, 32, 27.8, Math.PI * 1.05, Math.PI * 1.9)
  context.stroke()
  context.strokeStyle = 'rgba(0, 18, 48, 0.3)'
  context.lineWidth = 1.25
  context.beginPath()
  context.arc(32, 32, 27.8, Math.PI * 0.06, Math.PI * 0.94)
  context.stroke()

  return canvas
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图标转换失败'))
    image.src = canvas.toDataURL('image/png')
  })
}

export async function getPerspectiveIcon(
  url: string,
  rotateXDeg: number = ICON_TILT_X,
  rotateYDeg: number = ICON_TILT_Y,
): Promise<HTMLImageElement> {
  const key = `${url}|bevel-v2|${rotateXDeg}|${rotateYDeg}`
  let cached = iconCache.get(key)
  if (!cached) {
    cached = renderBevelIcon(url).then(canvasToImage)
    iconCache.set(key, cached)
  }
  return cached
}
