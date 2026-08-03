import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import Router from './router'

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#03fbfd',
          colorInfo: '#01c2ff',
          colorBgBase: '#062B64',
          colorBgContainer: '#3669A4',
          colorBgElevated: '#062B64',
          colorBorder: 'rgba(255, 255, 255, 0.2)',
          colorText: '#ffffff',
          colorTextSecondary: 'rgba(255, 255, 255, 0.85)',
          colorTextPlaceholder: 'rgba(255, 255, 255, 0.55)',
          borderRadius: 4,
          controlOutline: 'rgba(3, 251, 253, 0.2)',
        },
        components: {
          Select: {
            selectorBg: '#3669A4',
            colorBgElevated: '#0A2F63',
            colorText: '#D5F9F9',
            colorBorderDisabled: 'rgba(255, 255, 255, 0.15)',
            colorBgContainerDisabled: 'rgba(30, 65, 110, 0.6)',
            colorTextDisabled: 'rgba(255, 255, 255, 0.4)',
            optionActiveBg: '#2470B0',
            optionSelectedBg: '#087FA7',
            optionSelectedColor: '#03FBFD',
            optionSelectedFontWeight: 500,
            controlItemBgActiveHover: '#087FA7',
            optionHeight: 32,
            borderRadiusLG: 6,
            boxShadowSecondary: '0 12px 28px rgba(0, 15, 48, 0.48)',
          },
          Dropdown: {
            colorBgElevated: '#0A2F63',
            colorText: '#D5F9F9',
            colorPrimary: '#03FBFD',
            controlItemBgHover: '#2470B0',
            controlItemBgActive: '#087FA7',
            controlItemBgActiveHover: '#087FA7',
            paddingBlock: 8,
            borderRadiusLG: 6,
            boxShadowSecondary: '0 12px 28px rgba(0, 15, 48, 0.48)',
          },
          Modal: {
            contentBg: '#062B64',
            headerBg: 'transparent',
            footerBg: 'transparent',
          },
          Input: {
            colorBgContainer: '#3669A4',
            colorBorder: 'rgba(255, 255, 255, 0.2)',
            colorText: '#ffffff',
          },
          InputNumber: {
            colorBgContainer: '#3669A4',
            colorBorder: 'rgba(255, 255, 255, 0.2)',
            colorText: '#ffffff',
          },
          Table: {
            headerBg: 'rgba(20, 65, 120, 0.9)',
            headerColor: '#03FBFD',
            rowHoverBg: 'rgba(3, 251, 253, 0.12)',
          },
          Switch: {
            colorPrimary: '#1890ff',
          },
        },
      }}
    >
      <AntdApp>
        <Router />
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
