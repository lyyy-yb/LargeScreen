import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, message } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons'
import { useAppStore, useAuthStore } from '@/stores'
import { login as loginApi, captchaImage } from '@/servers/api'
import { loadSessionContext, takeFallbackMessage } from '@/services/session'
import loginBg from '@/assets/images/login-bg.png'

export default function Login() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { token, initialized, setToken, setSession, logout } = useAuthStore()
  const { setRegionContext, resetRegionContext } = useAppStore()
  const [isLoading, setLoading] = useState(false)
  const [captchaImg, setCaptchaImg] = useState('')
  const [captchaUuid, setCaptchaUuid] = useState('')

  const loadCaptcha = async () => {
    try {
      const res = await captchaImage()
      if (res?.code === 200 || res?.resultCode === 0) {
        setCaptchaImg((res as any).img || '')
        setCaptchaUuid((res as any).uuid || '')
      }
    } catch {
      /* 验证码获取失败不影响页面渲染，登录时后端会提示 */
    }
  }

  useEffect(() => {
    if (token && initialized) {
      navigate('/monitor')
    }
  }, [token, initialized, navigate])

  useEffect(() => {
    queueMicrotask(() => void loadCaptcha())
  }, [])

  const handleLogin = async (values: { username: string; password: string; code: string }) => {
    setLoading(true)
    try {
      const res = await loginApi({
        username: values.username,
        password: values.password,
        code: values.code,
        uuid: captchaUuid,
      })
      if (res?.code === 200) {
        const tokenVal = res.token
        if (!tokenVal) throw new Error('登录成功但后台未返回 token')
        setToken(tokenVal)
        const { info, regionContext } = await loadSessionContext()
        const roles = info.roles || info.user.roles?.map(role => role.roleKey) || []
        setSession(info.user, roles, info.permissions || [], regionContext.roleLevel)
        setRegionContext(regionContext)
        const fallbackMessage = takeFallbackMessage(regionContext, tokenVal, true)
        if (fallbackMessage) message.warning(fallbackMessage)
        navigate('/monitor')
      } else {
        throw new Error(res?.msg || res?.message || '登录失败')
      }
    } catch (error) {
      logout()
      resetRegionContext()
      message.error(error instanceof Error ? error.message : '登录失败，请稍后重试')
      form.setFieldValue('code', '')
      await loadCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <img src={loginBg} alt="" className="login-page__background" draggable={false} />
      <div className="login-page__shade" />

      <section className="login-card">
        <div className="login-card__eyebrow">欢迎登陆</div>
        <h1 className="login-card__title">
          颗粒物量子溯源管控平台
        </h1>

        <Form
          form={form}
          name="login"
          className="login-form"
          autoComplete="on"
          onFinish={handleLogin}
          initialValues={{
            username: 'admin',
            password: 'admin123',
          }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input
              className="login-s-input"
              allowClear
              placeholder="请输入账号"
              prefix={<UserOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              className="login-s-input"
              placeholder="请输入密码"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="code"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <Input
              className="login-s-input"
              placeholder="请输入验证码"
              prefix={<SafetyOutlined />}
              suffix={captchaImg ? (
                <img
                  src={`data:image/jpeg;base64,${captchaImg}`}
                  alt="验证码"
                  onClick={loadCaptcha}
                  className="login-captcha"
                />
              ) : <span className="login-captcha__loading">验证码加载中</span>}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-submit"
              loading={isLoading}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </section>
    </div>
  )
}
