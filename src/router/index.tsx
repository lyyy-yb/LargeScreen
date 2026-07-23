import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App, theme } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import RouterPage from './RouterPage'

const { defaultAlgorithm } = theme

export default function Router() {
  return (
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: [defaultAlgorithm],
        }}
      >
        <App>
          <RouterPage />
        </App>
      </ConfigProvider>
    </BrowserRouter>
  )
}
