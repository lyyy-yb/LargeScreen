// 污染源类型 → 图标前缀映射
export const wuLeixingObj: Record<string, string> = {
  '餐饮': 'cy',
  '道路扬尘': 'dlyc',
  '高架': 'gj',
  '工业': 'gy',
  '加油站': 'jyz',
  '建筑工地': 'jzyd',
  '交通': 'jt',
  '汽修': 'qx',
}

// 污染源图标列表（按等级3/2/1排列）
export const wuImgList = [
  'cy3', 'cy2', 'cy1',
  'dlyc3', 'dlyc2', 'dlyc1',
  'gj3', 'gj2', 'gj1',
  'gy3', 'gy2', 'gy1',
  'jyz3', 'jyz2', 'jyz1',
  'jzyd3', 'jzyd2', 'jzyd1',
  'jt3', 'jt2', 'jt1',
  'qx3', 'qx2', 'qx1',
  'w3', 'w2', 'w1',
]

// 城市Popup字段
const cityFields = [
  { field: 'leida', alias: '雷达' },
  { field: 'wurenji', alias: '无人机' },
  { field: 'zouhangche', alias: '走航车' },
]

// 组装城市信息Popup HTML
export const assemblePopupHtml = (item: {
  name: string
  level: string
  adcode: number
  lng: number
  lat: number
  childrenNum: number
  parent: number
  bg: string
  leida: number
  wurenji: number
  zouhangche: number
}) => {
  return `
    <ul class="city-popup-ul">
      ${cityFields.map(cityItem => `
        <li class="city-popup-li">
          <div class="city-popup-li-title">${cityItem.alias || ''}</div>
          <div class="city-popup-li-value">${(item as any)[cityItem.field] || 0}</div>
        </li>`).join('')}
    </ul>
  `
}

// 自定义Marker Popup DIV
export const customDiv = (feature: any, isFlag = false) => {
  const div = document.createElement('div')
  div.classList.add('marker_popup_div')
  if (['warn', 'error'].includes(feature.imgName)) {
    div.innerHTML = `
      <div class="marker_popup_warn_title">${isFlag ? '是否推送高值点位问题' : '是否确认为污染源'}</div>
      <p class="marker_popup_p">位置：${feature.address}</p>
      <p class="marker_popup_p">经纬度：${feature.dapLng}，${feature.dapLat}</p>
      <p class="marker_popup_p">次数：${feature.times}</p>
      <div class="marker_popup_btn_g_t">
        <button id="I_W_QUXIAO" class="marker_popup_btn">取消</button>
        <button id="I_W_QUEREN" class="marker_popup_btn">确认</button>
      </div>
    `
  } else if (wuImgList.includes(feature.imgName)) {
    div.innerHTML = isFlag ? `
      <div class="marker_popup_title">${feature.name}</div>
      <p class="marker_popup_p">类型：${feature.leixing}</p>
      <p class="marker_popup_p">街道：${feature.xiangzhen}</p>
      <p class="marker_popup_p">位置：${feature.weizhi}</p>
    ` : `
      <div class="marker_popup_title">${feature.name}</div>
      <p class="marker_popup_p">位置：${feature.weizhi}</p>
      <p class="marker_popup_p">类型：${feature.leixing}</p>
      <p class="marker_popup_p">创建时间：${feature.createTime}</p>
      <div class="marker_popup_btn_g">
        <button id="I_W_CKSXT" class="marker_popup_btn">查看摄像头</button>
      </div>
    `
  } else if ('drone-on' === feature.imgName) {
    div.innerHTML = `
      <div class="marker_popup_title">${feature.dockName}</div>
      <p class="marker_popup_p">机场地市：${feature.dockCode}</p>
      <p class="marker_popup_p">机场编码：${feature.dockCity}</p>
    `
  } else if ('wtbh' === feature.imgName) {
    div.innerHTML = `
      <div class="marker_popup_title">${feature.name}</div>
      <p class="marker_popup_p">类型：${feature.leixing}</p>
      <p class="marker_popup_p">街道：${feature.xiangzhen}</p>
      <p class="marker_popup_p">位置：${feature.weizhi}</p>
      <p class="marker_popup_p">发现时间：${feature.createTime}</p>
      <div class="marker_popup_btn_g">
        <button id="I_W_WTBHGC" class="marker_popup_btn">处置过程</button>
      </div>
    `
  }
  return div
}

// 雷达Popup DIV
export const customLeiDiv = (feature: any) => {
  const div = document.createElement('div')
  div.id = 'chat_popup'
  div.classList.add('marker_popup_div')
  div.innerHTML = `
    <div class="marker_popup_title">${feature.bsiName}</div>
    <p class="marker_popup_p">位置：${feature.bsiLocation}</p>
    <p class="marker_popup_p">经纬度：${feature.bsiLng}，${feature.bsiLat}</p>
    <p class="marker_popup_p">运行时长：${feature.bsiDeployTime}天</p>
    <div class="marker_popup_radar_div">
      <div class="marker_popup_radar"><div class="scan-line"></div></div>
      正在运行
    </div>
    <div class="marker_popup_btn_g">
      <button id="C_K_Chat" class="marker_popup_btn">查看历史动图</button>
    </div>
  `
  return div
}
