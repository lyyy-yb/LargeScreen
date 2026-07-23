import { ConfigProvider, theme } from 'antd'
import Router from './router'

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#03fbfd',
          colorInfo: '#01c2ff',
          colorBgBase: '#071b36',
          colorBgContainer: '#123f76',
          colorBgElevated: '#0d376d',
          colorBorder: '#50739a',
          colorText: '#d5f9f9',
          colorTextSecondary: '#a8d6ff',
          borderRadius: 6,
          controlOutline: 'rgba(3, 251, 253, 0.18)',
        },
        components: {
          Select: {
            optionActiveBg: 'rgba(53, 136, 255, 0.45)',
            optionSelectedBg: 'rgba(3, 251, 253, 0.16)',
            optionSelectedColor: '#03fbfd',
            selectorBg: 'rgba(0, 56, 129, 0.86)',
          },
          Modal: {
            contentBg: 'rgba(8, 47, 94, 0.97)',
            headerBg: 'transparent',
          },
          Table: {
            headerBg: 'rgba(35, 104, 174, 0.82)',
            rowHoverBg: 'rgba(3, 251, 253, 0.08)',
          },
        },
      }}
    >
      <Router />
    </ConfigProvider>
  )
}

export default App
