/** 仪表盘中央动图：无人机/雷达 旋转 GIF */
export default function DialGraphic({ gifSrc, alt }: { gifSrc: string; alt: string }) {
  return (
    <div className="monitor-dial-gif relative w-96px h-96px shrink-0 flex items-center justify-center">
      <img src={gifSrc} alt={alt} className="w-full h-full object-contain" draggable={false} />
    </div>
  )
}
