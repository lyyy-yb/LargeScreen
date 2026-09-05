import { Spin } from 'antd'
import { CloseOutlined, SearchOutlined } from '@ant-design/icons'
import type { GlobalSearchItem } from '@/servers/mapBox'

export interface GlobalMapSearchProps {
  keyword: string
  results: GlobalSearchItem[]
  loading: boolean
  open: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onClear: () => void
  onSelect: (item: GlobalSearchItem) => void
  onFocus: () => void
  onClose: () => void
}

/** 地图底部全局搜索：输入框 + 结果下拉，点击结果定位地图 */
export default function GlobalMapSearch({
  keyword,
  results,
  loading,
  open,
  onChange,
  onSubmit,
  onClear,
  onSelect,
  onFocus,
  onClose,
}: GlobalMapSearchProps) {
  return (
    <div className="global-map-search absolute bottom-112px left-1/2 -translate-x-1/2 z-30 w-460px">
      {open && (
        <div className="global-map-search__results">
          {results.length ? (
            results.map((item, index) => {
              const lng = Number(item.longitude)
              const lat = Number(item.latitude)
              return (
                <button
                  type="button"
                  key={`${item.type ?? 'item'}-${item.sourceId ?? index}-${lng}-${lat}`}
                  className="global-map-search__option"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onSelect(item)}
                >
                  <span className="global-map-search__name">{item.name?.trim() || '未命名地址'}</span>
                </button>
              )
            })
          ) : (
            <div className="global-map-search__empty">未找到匹配位置</div>
          )}
        </div>
      )}
      <div className="global-map-search__input-wrap">
        <SearchOutlined className="global-map-search__icon" />
        <input
          value={keyword}
          className="global-map-search__input"
          placeholder="请输入要搜索的名称"
          aria-label="全局地图搜索"
          onChange={event => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={event => {
            if (event.key === 'Enter') onSubmit()
            if (event.key === 'Escape') onClose()
          }}
        />
        {loading ? (
          <Spin size="small" />
        ) : keyword ? (
          <button type="button" className="global-map-search__clear" aria-label="清空搜索" onClick={onClear}>
            <CloseOutlined />
          </button>
        ) : null}
      </div>
    </div>
  )
}
