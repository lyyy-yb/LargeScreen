# 大屏视觉优化方案（借鉴改造，不改代码）

> 修订说明（2026-08-07）：本版已对全部结论与当前代码逐一核对。重点修正：
> 1. 地图现状描述——四级地图（ZJ3DMap / CityDistrictMap / CountyBoundaryMap）**已具备**科技纹理顶面、霓虹描边、选中蚂蚁线、飞线弧、扩散涟漪，原"纯色拉伸面、无飞线"的诊断已过时；
> 2. `PanelCard` 组件当前**无任何页面引用**（死代码），monitor 页面板为"行内 UnoCSS 原子类 + index.less `!important` 覆盖"的混合写法，面板改造策略需据此调整；
> 3. `src/utils/mapWaterRipple.ts` 是孤儿工具：指向的 `/water-texture.jpg` 在 public/ 中**不存在**（实际为 `water-texture.png` / `water-texture.orig.png`），当前无任何调用方；
> 4. 工作区根目录新增三张美工素材图（水面纹理 / 深蓝网格背景 / 无人机插画），已纳入本方案。

## 一、现状诊断（基于当前代码核实）

| 区域 | 现状 | 问题 |
|---|---|---|
| 页头 [Header.tsx](file:///d:/csss/LargeScreen/src/layouts/ScreenLayout/Header.tsx) | `h-bg.png` 标题图居中（h-86px，溢出 52px 头栏）+ `#3d8ad4→#1a5ab0→#3d8ad4` 亮蓝渐变底 | 依赖切图；底色偏亮偏紫，与深邃大屏风格不符；左右信息位（时间/管理/用户）为纯白文字，无装饰容器 |
| 底部导航 [BottomTabs.tsx](file:///d:/csss/LargeScreen/src/layouts/ScreenLayout/BottomTabs.tsx) | `com.png/active.png` 切图 tab，激活态文字反色为 `#173b62` | 切图风格与霓虹面板不统一；hover 仅有 -2px 位移，无光效；激活态依赖切图换色 |
| 面板 [PanelCard](file:///d:/csss/LargeScreen/src/components/PanelCard/index.tsx) / [monitor/index.less](file:///d:/csss/LargeScreen/src/pages/monitor/index.less)（635 行） | PanelCard 封装了基础圆角卡片但**零调用**；monitor 实际面板（`station-panel`/`status-card`/`map-legend-card`）= tsx 行内原子类 + less 大量 `!important` 覆盖，同一面板样式两处定义、互相对抗 | 缺"科技边框"（角标、标题装饰、流光）；颜色值硬编码且重复（rgba 蓝至少 6 种变体）；`!important` 泛滥导致后续不可维护 |
| 地图 [ZJ3DMap](file:///d:/csss/LargeScreen/src/components/ZJ3DMap/index.tsx) 等 | **已具备**：`map-tech-texture.svg` 顶面纹理、深藏青顶面+侧面渐变、霓虹双线描边、选中描边+光晕+流动蚂蚁线、市→杭州飞线弧（animate）、中心涟漪（省/市/县三级一致） | 顶面纹理为抽象网格 SVG，质感偏"线框"而非"水面/材质"；纹理与描边样式在四套组件中各自复制、未收敛为公共工具；`mapWaterRipple.ts` 孤儿文件路径失效 |
| 字体与数字 | 部分数字用 Bahnschrift/Consolas（如页头时间 `font-mono`），未统一 | 关键指标数字缺"仪表盘字体"冲击力 |

## 二、新增素材整合（根目录三张图）

| 文件 | 内容 | 计划用途 |
|---|---|---|
| 微信图片_20260806113245 | 可平铺水面纹理（亮蓝） | 地图顶面纹理候选——需**压暗/降饱和**后替换 `map-tech-texture.svg`，落盘 `public/map-water-texture.jpg` |
| 微信图片_20260806114149 | 深蓝光斑+网格背景 | 大屏全局背景候选，替换/叠加现有 `monitor-bg`，落盘 `public/screen-bg-deep.jpg` |
| 微信图片_20260806114358 | 无人机巡航插画（带雷达扫描/轨迹线） | drone/patrol 页装饰或页头侧位点缀（可选，P3） |

- 素材统一移入 `public/` 并重命名为语义化文件名；**禁止从正式环境请求外部 HTTPS 资源**的约束不变。

## 三、设计令牌（先定义，所有改造引用它）

新增全局 token 定义（less 变量 + uno.config theme 双写），统一以下值，替换现有硬编码色：

- **底色**：`--bg-deep #020b1e` → `--bg-panel rgba(4,22,52,0.9)`（向深邃黑蓝靠拢，替代当前偏亮的 `#1a5ab0` 系）
- **面板底**：收敛现有 `rgba(10,60,130,0.8)` / `rgba(6,30,70,0.65)` / `rgba(8,55,119,0.62)` 为 1~2 个标准值
- **主色**：青蓝 `#1eeaff`（强调/数字）、`#36a3ff`（信息）、`#78b8e8`（次级文字）
- **警示**：橙 `#ffad37`、黄 `#f7e642`、红 `#ff5d5d`（复用现有状态点色）
- **边框**：`rgba(0,212,255,0.35~0.48)` 已在使用，统一为 `--border-tech`；角标亮色 `#20e8ff`
- **数字字体**：Bahnschrift/Consolas 已有，统一为 `--font-digit`，正文用现有字体

## 四、分项改造

### 1. 页头重做（去切图依赖）
- 用 CSS 重建标题区：居中主标题 + 两侧对称斜切装饰条（`transform: skewX(-20deg)` 渐变条）+ 底部发光分割线；头栏底色从亮蓝渐变改为 `--bg-deep` 系
- 左右信息位保留现有功能（时间 / 管理下拉 / 用户下拉），外包一层半透明装饰容器
- 参考：iDataV、BigDataView 模板页头，纯 CSS 可实现
- 注意：现 `h-bg.png` h-86px 溢出 52px 头栏是有意的视觉穿透，重做时需决定保留穿透还是收进头栏

### 2. 底部导航升级
- 弃用 `com.png/active.png`，改 CSS 六边形/梯形 tab：激活态青蓝渐变填充 + 底部发光条 + 上沿流光动画
- 保留 hover 上浮（现有 -2px）+ 新增 glow；激活态文字不再依赖切图反色

### 3. 面板科技边框（收益最高的一项）
- **路线选择（已确认：A）**：增强 PanelCard 为 `TechPanel`（角标 + 标题装饰 + 顶部流光），monitor 页 `station-panel`/`status-card`/`map-legend-card` 逐步切换，同步**删除 less 中对应的 `!important` 覆盖块**（635 行 less 预计可砍半）。
  - ~~B：不动组件结构，只在 less 中给现有类加角标伪元素~~（不采用）
- **四角角标**：`::before/::after` + 2 个 span（或 4 span）画 L 形亮角
- **标题栏装饰**：左侧竖向发光条 + 标题下渐隐细线（替代现有 dashed 边框）
- **背景**：深底 + 顶部 1px 流光（`background-position` 动画，4~6s，低调）
- **毛玻璃保留**但透明度略降，增强与地图背景的对比

### 4. 地图质感升级（核心，但起点比原判断高）
现有基础：四级地图均有纹理顶面、霓虹描边、选中蚂蚁线；省/市/县三级有飞线+涟漪。改造聚焦"质感"而非"补功能"：
- **顶面纹理替换**：用压暗版新水面纹理（见第二节）替换 `map-tech-texture.svg`，opacity 0.5~0.6；四套组件统一引用同一个 `MAP_TEXTURE_URL` 常量（收敛到 `mapTechTexture.ts`）
- **ocean 水波面试验（新增，P2 先行验证）**：在区域面叠加 L7 水模型层，参考形态——
  ```ts
  new PolygonLayer({ zIndex, enablePicking: false })
    .source(geojson)
    .shape('ocean')
    .color('#1E90FF')                 // 基准色，需按整体深青蓝基调下调（候选：#1a5fae / #0e5092）
    .style({ watercolor: '#6D99A8' }) // 水波高亮色，需压暗（候选：#2e7fa8 / #3fa9c9）
    .animate(true)
  ```
  - L7 2.29.1 已验证 water/ocean 模型可用（此前备用未用，config 支持 `{ waterTexture, speed }`）
  - 试验要点：① 与现有 `mapTexture` 纹理顶面**二选一或叠加顺序**需实测（避免双层顶面互相遮挡）；② 颜色必须压暗至与深藏青地块协调，验收标准是不盖过霓虹描边、不降低城市名可读性；③ 确认 `animate(true)` 的动效频率克制、不掉帧
  - 先在 ZJ3DMap 单组件试做，效果确认后再推广到其余三级
- **纹理工具收敛**：删除或修复孤儿 `mapWaterRipple.ts`（其 `/water-texture.jpg` 路径已失效；若保留则修正为实际文件名并接入）
- **边界线**：现有霓虹双线已足够；可选加选中区沿边界跑高亮光段（LineLayer animate 扫光），作为 P2 可选项
- **飞线**：省/市/县三级已有；检查乡镇级（HangzhouMap/四级下钻）是否缺失，缺失则补齐
- **侧面渐变**：维持现有 `sourceColor→targetColor` 方案不动

### 5. 动效点缀（少量、克制）
- 关键指标数字加 count-up 缓动（数据轮询已有，加过渡即可）
- 预警点位涟漪动画已有，保留；避免全屏多动效导致视觉疲劳
- 路由切换已有 `route-page-enter`，可加轻微 fade+scale

## 五、实施分期与优先级

| 期 | 内容 | 涉及文件 | 预估改动 |
|---|---|---|---|
| P0 | 设计令牌统一 + TechPanel 组件 + monitor 页面板切换与 less 清理 | PanelCard、monitor/index.tsx、monitor/index.less、uno.config.ts | 中（含 less 删减），当天可验 |
| P1 | 页头 CSS 化重做 + 底部导航换 CSS tab | Header.tsx、BottomTabs.tsx | 小 |
| P2 | 素材落盘（纹理压暗处理）+ 四级地图纹理统一替换 + 纹理工具收敛 + **ocean 水波面试验（先在 ZJ3DMap 验证）** + 乡镇级飞线补齐 | mapTechTexture.ts、四个地图组件、mapWaterRipple.ts（删除/修复）、public/ | 中 |
| P3 | 选中区扫光（可选）、数字 count-up、无人机插画装饰、整体走查微调 | 按需 | 小 |

## 六、验收方式
每期完成后本地起 dev server，用浏览器在 1920×1080 下截图对比改造前后；重点检查：面板与地图的对比层级、文字可读性（正文 ≥ #78b8e8 亮度）、动效是否掉帧、less 体积是否如期下降（P0 验收项）。

## 七、参考清单（借鉴来源）
- 面板/配色：[iDataV](https://github.com/yyhsong/iDataV)、[BigDataView](https://github.com/iGaoWei/BigDataView)
- 地图扫光/2.5D：[MF-2.5DMap](https://github.com/fengtianxi001/MF-2.5DMap)、[three-cesium-examples](https://github.com/z2586300277/three-cesium-examples)
- L7 动效：L7 官方 examples（water、mask、飞线）

## 八、注意事项
- 正式环境禁止请求外部 HTTPS 资源：所有纹理/字体必须本地化，继续走 public/ 目录
- 坐标系统一 GCJ-02 的既有约定不变
- 管理界面（manage/* 页）不在本次范围，仅大屏页面
- 根目录三张 `微信图片_*.jpg` 为素材源文件，P2 时移入 public/ 并语义化重命名，根目录不保留副本
- dist/ 下存在 dist-measure、dist-old 等多份历史构建产物，验收截图时注意确认预览的是最新构建
