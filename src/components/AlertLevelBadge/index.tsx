import './index.less'

/** 与预警中心一致的描边四色等级标签。 */
export default function AlertLevelBadge({ level }: { level: string }) {
  const entries: Record<string, [number, string]> = {
    level1: [1, '一级预警'], level2: [2, '二级预警'], level3: [3, '三级预警'], level4: [4, '四级预警'],
    '1': [1, '一级预警'], '2': [2, '二级预警'], '3': [3, '三级预警'], '4': [4, '四级预警'],
    red: [1, '一级预警'], orange: [2, '二级预警'], yellow: [3, '三级预警'], blue: [4, '四级预警'],
  }
  const [number, label] = entries[level] ?? [0, level || '未知等级']
  return <span className={`alert-level-badge level-${number}`}><span className="alert-level-dot" />{label}</span>
}
