import { createRoot } from 'react-dom/client'
import 'uno.css'
import '@/assets/css/global.less'
import '@/assets/css/scrollbar.less'
import App from './App'

// dayjs 中文
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

createRoot(document.getElementById('root')!).render(<App />)
