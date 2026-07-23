export const TOKEN = 'TOKEN'
export const USERNAME = 'USERNAME'
export const USER_PERMISSION = 'USER_PERMISSION'

// 走航因子选项
export const wageOptions = [
  { label: '总悬浮颗粒物 TSP（纳克/立方米）', value: 'a34001' },
  { label: '可吸入颗粒物 PM10', value: 'a34002' },
  { label: '细微颗粒物 PM2.5', value: 'a34004' },
  { label: '细微颗粒物(通道2)(a34006)', value: 'a34006' },
  { label: '可吸入颗粒物(a34007)', value: 'a34007' },
  { label: '总悬浮颗粒物(通道2)(a34008)', value: 'a34008' },
  { label: '道路尘负荷(a40051)', value: 'a40051' },
]

// 默认颜色配置
export const colorCfgDefault = [
  { color: '#7ed321', sNum: 0, eNum: 35 },
  { color: '#f8e71c', sNum: 35, eNum: 75 },
  { color: '#f5a623', sNum: 75, eNum: 115 },
  { color: '#d0021b', sNum: 115, eNum: 150 },
  { color: '#9013fe', sNum: 150, eNum: 500 },
]
