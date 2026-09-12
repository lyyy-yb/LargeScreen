import { createRoot } from 'react-dom/client'
import 'uno.css'
import '@/assets/css/global.less'
import '@/assets/css/scrollbar.less'
import App from './App'
import { applyNologinToken } from '@/utils/deepLink'

// dayjs 中文
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

// 跨平台免登录 deep-link：URL 含 ?type=nologin 时，在 React 渲染前注入固定 token，
// 这样 AuthGuard 首屏拿到的 token 已就绪，不会被重定向到 /login。
// 必须在 createRoot 之前调用。
applyNologinToken()

createRoot(document.getElementById('root')!).render(<App />)
