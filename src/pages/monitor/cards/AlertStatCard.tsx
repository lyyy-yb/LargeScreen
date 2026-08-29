interface AlertStatCardProps {
  label: string
  count: number
  /** 背景色（如 "rgba(239,68,68,0.75)"），完全靠背景色区分状态 */
  bg: string
}

/** 预警处置统计卡片：重背景色块 + 纯白文字 */
export default function AlertStatCard({ label, count, bg }: AlertStatCardProps) {
  return (
    <div
      className="flex items-center gap-2 rounded-6px px-2.5 py-1.5"
      style={{ background: bg, border: '1px solid rgba(255,255,255,0.18)' }}
    >
      <b className="font-mono text-18px leading-none text-white">{count}</b>
      <span className="text-white text-10px">{label}</span>
    </div>
  )
}
