# LargeScreen · 数字大屏 / 智慧环保可视化平台

基于 React 19 + TypeScript + Vite + AntV L7 的城市级数据可视化大屏，覆盖无人机巡查、空气质量、污染源、雷达告警、报警中心、数据管理、年度报告等多个业务模块。

## 功能模块

| 路由 | 模块 | 说明 |
| --- | --- | --- |
| `/login` | 登录 | 用户登录页 |
| `/overview` | 总览驾驶舱 | 多指标综合态势总览 |
| `/monitor` | 实时监控 | 站点 / 排口 / 设备实时态势 |
| `/air-quality` | 空气质量 | 国控站 / 微站 + 浓度热力 + 时间回放 |
| `/pollution` | 污染源 | 排口 / 企业 / 排放清单 |
| `/radar` | 雷达 | 雷达扫描 + 告警点位 |
| `/alert` | 报警中心 | 报警规则 / 报警任务 / 趋势分析 / 手工创建 |
| `/drone` | 无人机管理 | 无人机机场 / 飞行任务 / 航线回放 / 视频采集 / 传感器数据 |
| `/manage` | 数据管理 | 数据源 / 清洗规则 / 无人机任务（导入 + API）三页签 |
| `/patrol` | 巡查 | 巡查任务管理 |
| `/report` | 报告 | 年度 / 周期报告生成 |

## 技术栈

- **构建**: Vite 8 + TypeScript 6
- **UI**: React 19 + Ant Design 6 + UnoCSS（原子化）+ Less（兼容样式）
- **地图**: AntV L7 2.29（地图引擎 + 矢量瓦片）
- **图表**: AntV G2 5
- **状态**: Zustand 5
- **路由**: React Router 7
- **请求**: Axios
- **时间**: Day.js
- **进度条**: NProgress
- **兼容性**: `@vitejs/plugin-legacy` + Terser 压缩

## 快速开始

```bash
# 安装依赖（推荐 pnpm）
npm install   # 或 pnpm install

# 启动 dev server (http://localhost:5556)
npm run dev

# 类型检查
npm run typecheck

# 生产构建（输出 dist/）
npm run build

# 预览构建产物
npm run preview
```

> 构建产物使用 Brotli 压缩（`vite-plugin-compression`），剔除 `console.log / debug / info`，保留 `error / warn` 用于生产排障。

## 项目结构

```
src/
├── assets/         # 静态资源（背景图 / icon）
├── components/     # 通用业务组件
├── config/         # 全局配置
├── features/       # 横切特性（业务无关工具）
├── hooks/          # 自定义 React Hook
├── layouts/        # 页面 Layout 框架
├── pages/          # 业务页面（每个子目录一个模块）
│   ├── air-quality/
│   ├── alert/      # 含 components / data / modals / tabs
│   ├── drone/      # 含 useTrajectoryPlayback 钩子 + shared 类型
│   ├── login/
│   ├── manage/     # 含 components/ 子目录（Modal / Preview 等）
│   ├── monitor/
│   ├── overview/
│   ├── patrol/
│   ├── pollution/
│   ├── radar/      # 含 modals/
│   └── report/
├── router/         # 路由表 + 守卫
├── servers/        # 接口层（按业务域分文件）
├── services/       # 服务层
├── stores/         # Zustand 全局 store
├── types/          # 全局类型定义
└── utils/          # 工具函数 + 共用 hook
```

## 后端联调（Vite Dev Proxy）

`vite.config.ts` 配置了以下代理前缀（开发期使用，生产部署需在 Nginx 等反向代理里同步转发）：

| 前缀 | 目标 | 备注 |
| --- | --- | --- |
| `/offMap` | `http://218.244.154.247:5555/offMap` | 离线地图瓦片 |
| `/data-manage` | `http://218.244.154.247:8089` | 数据管理服务（直传） |
| `/dpSys` | `http://218.244.154.247:8089` | 巡查 / 无人机服务（`/dpSys/` 会被剥成 `/`） |
| `/upImg` | `http://218.244.154.247:5555/upImg` | 图片上传 |
| `/prod-api` | `http://218.244.154.247:7089` | 业务后端（RuoYi 系） |
| `/profile` | `http://218.244.154.247:7089/prod-api` | 资源访问 |
| `/gaodeservice` | `https://gaode.com/service` | 高德 Web 服务 API |

> `/dpSys` 走的是带前缀的代理（`rewrite` 把 `/dpSys/` 替换为 `/`），所以**接口路径必须保留 `/dpSys` 前缀**才能命中后端真实路由。

## 约定

- 接口文件按业务域拆分在 `src/servers/`，统一在 `request.ts` 注入 token / 错误处理
- 类型集中在 `src/types/`（如 `dataManage.ts` 定义数据管理域 VO）；模块内部类型放 `shared.ts`
- 通用 hook 抽到 `src/utils/`（如 `useResourceBlobUrl` 处理 token 鉴权资源预览）
- 列表渲染优先用 antd Table + 全局 `.tech-action-btn` 按钮样式（`src/assets/css/global.less`）
- Modal 缩略图统一高度 `h-300px` + `object-cover`；视频加 `PlayCircle` 角标

## 浏览器兼容

现代浏览器（Chrome 100+ / Edge 100+ / Firefox 100+ / Safari 15+）。如需 IE 11 / 老 Edge 兼容，构建时会自动注入 `@vitejs/plugin-legacy` 的 polyfill。

## License

Internal use only.