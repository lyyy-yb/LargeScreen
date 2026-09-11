export interface SourceSummaryProps {
  onlineSourceCount: number
}

/** 左下浮层：数据源概况（在线数据源 / 数据总量 / 数据准确性） */
export default function SourceSummary({ onlineSourceCount }: SourceSummaryProps) {
  return (
    <div className="source-summary absolute bottom-56px left-3 z-20 text-11px text-[#b2d9ff]/90 space-y-1 font-mono p-2.5 rounded-6px bg-[rgba(4,22,52,0.45)] border border-[#00d4ff]/25">
      <div>
        数据源总数：<span className="text-[#00ffff] font-bold">{onlineSourceCount}</span>
      </div>
      <div>
        数据总量：<span className="text-[#00ffff] font-bold" title="接口未提供该统计">--</span>
      </div>
      <div>
        数据准确性：<span className="text-[#00ffff] font-bold" title="接口未提供该统计">--</span>
      </div>
    </div>
  )
}

export interface DistributionSummaryProps {
  regionName: string
  airStationCount: number
  radarStationCount: number
  droneStationCount: number
}

/** 右下浮层：监测分布总结 */
export function DistributionSummary({
  regionName,
  airStationCount,
  radarStationCount,
  droneStationCount,
}: DistributionSummaryProps) {
  return (
    <div className="distribution-summary absolute bottom-56px right-3 z-20 p-3 rounded-8px border border-[#00d4ff]/35 bg-[rgba(4,22,52,0.9)] shadow-lg max-w-340px">
      <div className="text-[#00f0ff] text-13px font-bold mb-1">{regionName}环境监测分布</div>
      <div className="text-[#b2d9ff]/80 text-11px leading-relaxed">
        共 <span className="text-[#00f0ff] font-bold font-mono">{airStationCount}</span> 个空气质量检测站
        <br />
        <span className="text-[#00f0ff] font-bold font-mono">{radarStationCount}</span> 个光量子雷达站 |{' '}
        <span className="text-[#00f0ff] font-bold font-mono">{droneStationCount}</span> 个无人机场
      </div>
    </div>
  )
}
