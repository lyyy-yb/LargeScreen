import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SendOutlined, AlertOutlined, CompassOutlined, MessageOutlined, ArrowRightOutlined, ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons'

interface Message {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: Date
}

interface QuickQuestion {
  label: string
  question: string
}

interface DirectoryItem {
  label: string
  icon: React.ReactNode
  path: string
}

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: '您好！我是环境监测智能助手。我可以为您提供空气质量信息、检测站分布、光量子雷达、无人机机场、走航车辆、污染源等信息的智能查询服务。',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'alert' | 'directory'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickQuestions: QuickQuestion[] = [
    { label: '空气质量概况', question: '杭州各区县空气质量情况如何？' },
    { label: '检测站在线', question: '空气质量检测站在线情况？' },
    { label: '光量子雷达', question: '光量子雷达分布和在线情况？' },
    { label: '无人机机场', question: '无人机机场分布和飞行任务情况？' },
    { label: '走航车辆', question: '走航车辆分布和在线情况？' },
    { label: '污染源', question: '污染源分布与分类信息？' },
  ]

  const directoryItems: DirectoryItem[] = [
    { label: '实时预警监控', icon: <AlertOutlined className="text-orange-400" />, path: '/alert' },
    { label: '光量子雷达', icon: <CompassOutlined className="text-purple-400" />, path: '/radar' },
    { label: '无人机机场', icon: <MessageOutlined className="text-cyan-400" />, path: '/drone' },
    { label: '走航巡查', icon: <ReloadOutlined className="text-yellow-400" />, path: '/patrol' },
    { label: '污染源管理', icon: <AlertOutlined className="text-red-400" />, path: '/pollution' },
    { label: '年度管理', icon: <ClockCircleOutlined className="text-green-400" />, path: '/report' },
  ]

  const recentAlerts = [
    { id: 'ALT001', ruleName: 'PM2.5浓度超标预警', level: '二级预警', location: '西湖区', time: '14:30' },
    { id: 'ALT002', ruleName: 'PM2.5严重超标预警', level: '一级预警', location: '萧山区', time: '13:45' },
    { id: 'ALT003', ruleName: '走航车TSP超标预警', level: '二级预警', location: '余杭区', time: '12:20' },
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const getBotResponse = (question: string): string => {
    if (question.includes('空气质量') || question.includes('PM2.5') || question.includes('各区县')) {
      return `杭州各区县空气质量情况：
西湖区：PM2.5 5.8μg/m³，优
萧山区：PM2.5 12.5μg/m³，良
余杭区：PM2.5 8.3μg/m³，优
滨江区：PM2.5 6.2μg/m³，优
富阳区：PM2.5 9.1μg/m³，良

整体空气质量良好，主要污染物为PM2.5和O3。`
    }
    if (question.includes('检测站') || question.includes('在线')) {
      return `空气质量检测站在线情况：
总数量：5个
在线：4个（西湖区、萧山区、余杭区、滨江区）
离线：1个（富阳区，维护中）

检测站分布覆盖杭州主要城区，实时监测空气质量数据。`
    }
    if (question.includes('光量子雷达') || question.includes('雷达')) {
      return `光量子雷达信息：
总数：8台
在线：6台
离线：2台

分布区域：西湖区3台、萧山区2台、余杭区2台、滨江区1台

近1小时告警：3次
近3小时告警：8次
近24小时告警：25次`
    }
    if (question.includes('无人机') || question.includes('机场') || question.includes('飞行')) {
      return `无人机机场情况：
总数：5个
在线：4个
离线：1个

待飞任务：12个
飞行中：3个

机场分布：临平、萧山、余杭、富阳、临安各1个`
    }
    if (question.includes('走航车') || question.includes('车辆')) {
      return `走航车辆情况：
总数：12辆
在线：8辆
离线：4辆

覆盖区域：萧山区、西湖区、余杭区、滨江区

主要监测指标：TSP、PM2.5、尘负荷、湿度`
    }
    if (question.includes('污染源') || question.includes('污染')) {
      return `污染源统计：
总数：90家

分类分布：
工业源：25家（红色标识）
交通源：18家（橙色标识）
建筑施工：12家（黄色标识）
餐饮：35家（绿色标识）

主要分布在萧山区和余杭区工业园区。`
    }
    if (question.includes('预警') || question.includes('告警')) {
      return `当前预警情况：
总预警数：6条
待处置：3条
处置中：2条
已完成：1条

最新预警：
1. PM2.5浓度超标预警 - 西湖区 - 14:30
2. PM2.5严重超标预警 - 萧山区 - 13:45
3. 走航车TSP超标预警 - 余杭区 - 12:20`
    }
    return '抱歉，我暂时无法回答这个问题。您可以尝试询问：\n- 空气质量情况\n- 检测站在线情况\n- 光量子雷达信息\n- 无人机机场情况\n- 走航车辆情况\n- 污染源分布'
  }

  const handleSend = () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: window.crypto.randomUUID(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsThinking(true)

    setTimeout(() => {
      const botMessage: Message = {
        id: window.crypto.randomUUID(),
        type: 'bot',
        content: getBotResponse(inputValue),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMessage])
      setIsThinking(false)
    }, 1500)
  }

  const handleQuickQuestion = (question: string) => {
    setInputValue(question)
    handleSend()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      <div
        className={`fixed top-[60px] right-0 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-[calc(100%-50px)]'
        }`}
      >
        <div
          className="w-96 h-[calc(100vh-60px)] bg-gradient-to-br from-[#001a33]/98 to-[#002a5c]/98 border-l border-cyan-500/40 backdrop-blur-md shadow-2xl shadow-cyan-500/10 flex flex-col"
        >
          <div
            className="flex items-center px-4 py-3 bg-gradient-to-r from-cyan-500/20 to-transparent border-b border-cyan-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.6)]">
                <MessageOutlined className="text-white text-sm" />
              </div>
              <span className="text-cyan-400 text-sm font-medium">智能助手</span>
            </div>
          </div>

          <div className="flex border-b border-white/10">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-all ${
                activeTab === 'chat'
                  ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                  : 'text-white/50 hover:text-white/70 bg-black/20 hover:bg-black/30'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageOutlined className="text-xs" />
              <span>智能问答</span>
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-all relative ${
                activeTab === 'alert'
                  ? 'text-orange-400 bg-orange-500/10 border-b-2 border-orange-400'
                  : 'text-white/50 hover:text-white/70 bg-black/20 hover:bg-black/30'
              }`}
              onClick={() => setActiveTab('alert')}
            >
              <AlertOutlined className="text-xs" />
              <span>预警通知</span>
              {recentAlerts.length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-all ${
                activeTab === 'directory'
                  ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-400'
                  : 'text-white/50 hover:text-white/70 bg-black/20 hover:bg-black/30'
              }`}
              onClick={() => setActiveTab('directory')}
            >
              <CompassOutlined className="text-xs" />
              <span>目录导航</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'chat' && (
              <>
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.type === 'bot' && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <MessageOutlined className="text-white text-[10px]" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-lg text-xs ${
                          msg.type === 'user'
                            ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 text-white/90 rounded-tr-none'
                            : 'bg-black/40 text-white/80 rounded-tl-none'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <MessageOutlined className="text-white text-[10px]" />
                      </div>
                      <div className="bg-black/40 px-3 py-2 rounded-lg rounded-tl-none">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-white/50 text-[10px] mb-2">快捷提问</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickQuestions.map((q, index) => (
                      <button
                        key={index}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] text-white/60 hover:text-white/80 transition-all border border-white/10"
                        onClick={() => handleQuickQuestion(q.question)}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'alert' && (
              <div className="space-y-2">
                <div className="text-white/50 text-[10px] mb-1">实时预警推送</div>
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-black/40 rounded-lg p-2.5 hover:bg-black/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/alert')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-medium ${
                        alert.level === '一级预警' ? 'text-red-400' :
                        alert.level === '二级预警' ? 'text-orange-400' : 'text-yellow-400'
                      }`}>
                        {alert.level}
                      </span>
                      <span className="text-white/40 text-[9px]">{alert.time}</span>
                    </div>
                    <div className="text-white/80 text-xs mb-1">{alert.ruleName}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-[10px]">{alert.location}</span>
                      <button className="flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300">
                        <span>查看详情</span>
                        <ArrowRightOutlined className="text-[9px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'directory' && (
              <div className="space-y-1.5">
                {directoryItems.map((item, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center justify-between px-3 py-2 bg-black/30 hover:bg-black/40 rounded transition-colors"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span className="text-white/70 text-xs">{item.label}</span>
                    </div>
                    <ArrowRightOutlined className="text-white/30 text-xs" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeTab === 'chat' && (
            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入您的问题..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  className="px-3 py-2 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/40 transition-all"
                  onClick={handleSend}
                >
                  <SendOutlined className="text-xs" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="fixed top-1/2 right-0 z-50 -translate-y-1/2 w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-l-xl flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.6)] hover:shadow-[0_0_30px_rgba(34,211,238,0.8)] transition-all cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MessageOutlined className="text-white text-lg" />
      </button>
    </>
  )
}

export default ChatBot
