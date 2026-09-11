import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Select, App } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import RegionSelector from '@/components/RegionSelector'
import './index.less'
import './evidence.less'
import { useAppStore, useAuthStore } from '@/stores'
import { addOption, buildDeptRegionOptions, nameEquals } from '@/utils/deptRegion'
import { getVisibleAlertTabs, type AlertTab } from '@/utils/region'
import { useDebounce } from '@/hooks/useDebounce'
import type { Dayjs } from 'dayjs'
import { alertEventApi, disposalTaskApi } from '@/servers/business'
import type { AlertEventDTO, DisposalTaskDTO } from '@/types/business'
import { type RoleLevel } from './modals/RuleModal'
import AlertDetailModal, { type AlertEvent } from './modals/AlertDetailModal'
import TaskDetailModal, { type DisposalTask } from './modals/TaskDetailModal'
import EvidenceModal from './modals/EvidenceModal'
import FollowUpModal from './modals/FollowUpModal'
import { normalizePhotos } from './data/normalizePhotos'
import { requireSuccess } from '@/servers/alertFollowUp'
import { canCollectEvidence } from './data/evidenceWorkflow'
import { usePolling } from '@/pages/monitor/hooks/usePolling'
import CommitModal from './modals/CommitModal'
import DispatchModal from './modals/DispatchModal'
import TrendsTab from './tabs/TrendsTab'
import RuleTab from './tabs/RuleTab'
import AlertTabView from './tabs/AlertTab'
import TaskTab from './tabs/TaskTab'
import AlertOverviewCards from './components/AlertOverviewCards'
import type { AlertDashboardVO } from '@/types/business'
import {
  DATA_TYPE_OPTIONS as dataTypeOptions,
  ALERT_LEVEL_OPTIONS as alertLevelOptions,
  TASK_TYPE_OPTIONS as taskTypeOptions,
} from './tabs/shared/tabConstants'

const { Option } = Select

function toAlertEvent(item: AlertEventDTO): AlertEvent {
  return {
    ...item,
    id: String(item.id),
    createdAt: item.createTime ?? '',
  }
}

function toDisposalTask(item: DisposalTaskDTO): DisposalTask {
  const photos = normalizePhotos(item.photos)
  return {
    ...item,
    id: String(item.id),
    alertId: String(item.alertId),
    assigneeName: item.assigneeName ?? '',
    requesterName: item.requesterName ?? '',
    requireTime: item.requireTime ?? '',
    createdAt: item.createTime ?? '',
    photos,
  }
}

// 5 个枚举字典 + 3 个 status 映射 已迁到 tabs/shared/tabConstants.ts（按需 import）

export default function AlertPage() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const regionContext = useAppStore(state => state.regionContext)
  const user = useAuthStore(state => state.user)
  const selection = regionContext?.selection

  const [activeTab, setActiveTab] = useState<AlertTab>(() => getVisibleAlertTabs(regionContext?.roleKey)?.[0] ?? 'alerts')
  // 业务角色页签限制：地市业务人员仅区域预警实时动向，区县业务人员为实时预警监控+处置任务管理；null 表示不限制
  const visibleAlertTabs = getVisibleAlertTabs(regionContext?.roleKey)
  const isTabVisible = (tab: AlertTab) => !visibleAlertTabs || visibleAlertTabs.includes(tab)
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [tasks, setTasks] = useState<DisposalTask[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const requestVersions = useRef({ alerts: 0, tasks: 0, counts: 0, dashboard: 0, refresh: 0 })
  const [dashboard, setDashboard] = useState<AlertDashboardVO | null>(null)
  // 4 个 Modal 的状态合并：open + data 二元组（RuleModal 由 RuleTab 内部自管）
  const [alertDetail, setAlertDetail] = useState<{ open: boolean; alert: AlertEvent | null }>({ open: false, alert: null })
  const [dispatchModal, setDispatchModal] = useState<{ open: boolean; alert: AlertEvent | null; fromEvidence?: boolean }>({ open: false, alert: null })
  const [evidenceAlert, setEvidenceAlert] = useState<AlertEvent | null>(null)
  const [followUpTask, setFollowUpTask] = useState<DisposalTask | null>(null)
  const [taskDetail, setTaskDetail] = useState<{ open: boolean; task: DisposalTask | null }>({ open: false, task: null })
  const [commitModal, setCommitModal] = useState<{ open: boolean; task: DisposalTask | null }>({ open: false, task: null })

  // 详情数据预填：先打开 Modal（用列表数据），异步加载详情后回填
  const openAlertDetail = (r: AlertEvent) => {
    setAlertDetail({ open: true, alert: r })
    alertEventApi.detail(Number(r.id))
      .then((res) => {
        const data = requireSuccess(res)
        if (data) {
          const full = toAlertEvent(data)
          setAlertDetail((prev) => (prev.open && prev.alert?.id === r.id ? { open: true, alert: full } : prev))
        }
      })
      .catch(() => message.error('预警详情加载失败，当前显示列表信息'))
  }
  const openTaskDetail = (r: DisposalTask) => {
    setTaskDetail({ open: true, task: r })
  }
  // 三个列表的服务端分页与筛选状态（默认每页 15 条）
  // rules/* 已迁到 tabs/RuleTab.tsx
  const [alertsPage, setAlertsPage] = useState(1)
  const [alertsSize, setAlertsSize] = useState(15)
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertSearchDevice, setAlertSearchDevice] = useState('')
  const [alertAppliedDevice, setAlertAppliedDevice] = useState('')
  const [alertFilterDataType, setAlertFilterDataType] = useState<string | undefined>(undefined)
  const [alertFilterLevel, setAlertFilterLevel] = useState<string | undefined>(undefined)
  const [alertFilterStatus, setAlertFilterStatus] = useState<string | undefined>(undefined)
  // 历史预警开关：开启后展示全量（含已清除/已关闭），默认只显示活跃预警
  const [alertIncludeHistory, setAlertIncludeHistory] = useState(false)
  // 预警时间范围筛选（startTime/endTime）
  const [alertTimeRange, setAlertTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksSize, setTasksSize] = useState(15)
  const [tasksTotal, setTasksTotal] = useState(0)
  const [taskCounts, setTaskCounts] = useState<Partial<Record<'pending' | 'processing' | 'completed', number>>>({})
  const [taskFilterDataType, setTaskFilterDataType] = useState<string | undefined>(undefined)
  const [taskFilterType, setTaskFilterType] = useState<string | undefined>(undefined)
  const [taskFilterStatus, setTaskFilterStatus] = useState<string | undefined>(undefined)
  // ruleImportInputRef / ruleImporting 已迁到 tabs/RuleTab.tsx
  const allDepts = useMemo(() => {
    const departments = [...(regionContext?.departments ?? [])]
    const currentDept = user?.dept
    if (currentDept && !departments.some(dept => Number(dept.deptId) === Number(currentDept.deptId))) {
      departments.push(currentDept)
    }
    return departments
  }, [regionContext?.departments, user?.dept])
  /** 区域部门 ID 反查名称（后端不再返回城市/区县/乡镇名称字段） */
  const deptNameOf = useCallback((deptId?: number) => {
    if (deptId == null) return undefined
    return allDepts.find(dept => Number(dept.deptId) === Number(deptId))?.deptName
  }, [allDepts])
  const deptRegionOptions = useMemo(() => buildDeptRegionOptions(allDepts), [allDepts])
  const lockedRegion = useMemo(() => {
    if (!regionContext || regionContext.roleLevel === 'admin') return {}
    const currentDept = allDepts.find(dept => Number(dept.deptId) === Number(user?.deptId ?? user?.dept?.deptId))
    const cityDept = allDepts.find(dept => nameEquals(dept.deptName, selection?.cityName ?? ''))
    const districtDept = allDepts.find(dept => nameEquals(dept.deptName, selection?.countyName ?? ''))

    if (regionContext.roleLevel === 'city') {
      const rawCityId = Number(cityDept?.deptId ?? currentDept?.deptId)
      return {
        cityId: rawCityId ? String(rawCityId) : undefined,
        cityName: selection?.cityName,
      }
    }

    const lockedDistrict = districtDept ?? currentDept
    const rawCityId = Number(cityDept?.deptId ?? lockedDistrict?.parentId)
    const rawDistrictId = Number(lockedDistrict?.deptId)
    return {
      cityId: rawCityId ? String(rawCityId) : undefined,
      cityName: selection?.cityName,
      districtId: rawDistrictId ? String(rawDistrictId) : undefined,
      districtName: selection?.countyName,
    }
  }, [allDepts, regionContext, selection?.cityName, selection?.countyName, user?.dept?.deptId, user?.deptId])
  const cityOptions = useMemo(
    () => addOption(deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName),
    [deptRegionOptions.cityOptions, lockedRegion.cityId, lockedRegion.cityName],
  )
  // 全量部门已在 session 初始化时加载（regionContext.departments 含市/区县/乡镇全层级），
  // 级联选项直接由 regionContext 派生，无需再次按需请求，避免合并重复。
  const canSelectRegion = regionContext?.roleLevel === 'admin'
  const roleLevel: RoleLevel = (regionContext?.roleLevel ?? 'town') as RoleLevel
  const isTown = roleLevel === 'town'
  const canEditRule = !isTown

  const regionParams = useMemo(() => ({
    ...(selection?.cityName ? { city: selection.cityName } : {}),
    ...(selection?.countyName ? { district: selection.countyName } : {}),
    ...(selection?.townName ? { town: selection.townName } : {}),
  }), [selection])

  // loadRules / rulesPage etc 已迁到 tabs/RuleTab.tsx

  const loadAlerts = useCallback(async (silent = false) => {
    const version = ++requestVersions.current.alerts
    if (!silent) setLoading(true)
    try {
      const response = await alertEventApi.list({
        pageNum: alertsPage,
        pageSize: alertsSize,
        ...regionParams,
        deviceName: alertAppliedDevice || undefined,
        dataType: alertFilterDataType,
        alertLevel: alertFilterLevel,
        status: alertFilterStatus,
        includeHistory: alertIncludeHistory || undefined,
        startTime: alertTimeRange?.[0]?.format('YYYY-MM-DD HH:mm:ss'),
        endTime: alertTimeRange?.[1]?.format('YYYY-MM-DD HH:mm:ss'),
      })
      const data = requireSuccess(response)
      if (version !== requestVersions.current.alerts) return
      setAlerts((data?.records ?? []).map(toAlertEvent))
      setAlertsTotal(data?.total ?? 0)
      const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / alertsSize))
      if (alertsPage > lastPage) setAlertsPage(lastPage)
    } catch {
      if (!silent) message.error('实时预警加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [
    message, regionParams, setAlertsPage,
    alertsPage, alertsSize, alertAppliedDevice, alertFilterDataType, alertFilterLevel, alertFilterStatus,
    alertIncludeHistory, alertTimeRange,
  ])

  const loadTasks = useCallback(async () => {
    const version = ++requestVersions.current.tasks
    setLoading(true)
    try {
      const response = await disposalTaskApi.list({
        pageNum: tasksPage,
        pageSize: tasksSize,
        ...regionParams,
        dataType: taskFilterDataType,
        taskType: taskFilterType,
        status: taskFilterStatus,
      })
      const data = requireSuccess(response)
      if (version !== requestVersions.current.tasks) return
      setTasks((data?.records ?? []).map(toDisposalTask))
      setTasksTotal(data?.total ?? 0)
      const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / tasksSize))
      if (tasksPage > lastPage) setTasksPage(lastPage)
    } catch {
      message.error('处置任务加载失败')
    } finally {
      setLoading(false)
    }
  }, [message, regionParams, tasksPage, tasksSize, taskFilterDataType, taskFilterType, taskFilterStatus, setTasksPage])

  // 使用真实分页 total 分别统计各任务状态，不借用预警统计或当前页行数。
  const loadTaskCounts = useCallback(async () => {
    const version = ++requestVersions.current.counts
    const statuses = ['pending', 'processing', 'completed'] as const
    const entries = await Promise.all(statuses.map(async status => {
      try {
        const res = await disposalTaskApi.list({ pageNum: 1, pageSize: 1, ...regionParams, dataType: taskFilterDataType, taskType: taskFilterType, status })
        const succeeded = res.resultCode != null ? res.resultCode === 0 : res.code === 200
        return [status, succeeded && typeof res.data?.total === 'number' ? res.data.total : undefined] as const
      } catch { return [status, undefined] as const }
    }))
    if (version !== requestVersions.current.counts) return
    setTaskCounts(Object.fromEntries(entries))
    if (entries.some(([, value]) => value == null)) message.error('部分任务统计加载失败，请刷新重试')
  }, [message, regionParams, taskFilterDataType, taskFilterType])

  // loadRules effect 已迁到 tabs/RuleTab.tsx

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersions.current.dashboard
    try {
      const data = requireSuccess(await alertEventApi.dashboard())
      if (version === requestVersions.current.dashboard) setDashboard(data)
    } catch {
      if (version === requestVersions.current.dashboard) {
        setDashboard(null)
        message.error('预警统计加载失败，请刷新重试')
      }
    }
  }, [message])

  useEffect(() => { void loadTaskCounts() }, [loadTaskCounts])
  useEffect(() => { queueMicrotask(() => void loadDashboard()) }, [loadDashboard])

  const refreshAll = async () => {
    const version = ++requestVersions.current.refresh
    setRefreshing(true)
    try { await Promise.all([loadAlerts(), loadTasks(), loadTaskCounts(), loadDashboard()]) }
    finally { if (version === requestVersions.current.refresh) setRefreshing(false) }
  }

  useEffect(() => {
    queueMicrotask(() => void loadAlerts())
  }, [loadAlerts])

  useEffect(() => {
    queueMicrotask(() => void loadTasks())
  }, [loadTasks])

  // 区域预警实时动向：进入该 tab 后按 30s 间隔轮询实时预警数据
  // 非 trends tab 时 fn 内部 early return（activeTab 变化触发 deps 重新调度）
  usePolling(() => {
    if (activeTab !== 'trends') return
    void loadAlerts(true)
  }, 30_000, [activeTab, loadAlerts])

  // 搜索框 300ms 防抖：连续输入停止 300ms 后才应用到查询，避免每次按键打接口
  const debouncedAlertSearch = useDebounce(alertSearchDevice, 300)
  useEffect(() => {
    queueMicrotask(() => {
      setAlertAppliedDevice(debouncedAlertSearch.trim())
      setAlertsPage(1)
    })
  }, [debouncedAlertSearch])

  // AlertTab 的 onPressEnter / onClear 仍保留立即查询入口（用户主动回车或清空不应等防抖）
  const applyAlertSearch = (value?: string) => {
    setAlertAppliedDevice((value ?? alertSearchDevice).trim())
    setAlertsPage(1)
  }

  // 派发弹窗：选中乡镇后加载该乡镇下的用户（已迁到 modals/DispatchModal.tsx）
  // 详情/查看/提交/派发 等 Modal 的 state + handler 已迁到 modals/
  // 规则相关 handler (loadRules / handleDeleteRule / toggleRule / handleDownloadTemplate / handleExportRules / handleImportRules) 已迁到 tabs/RuleTab.tsx
  // 确认关闭（仅已处置状态，review 接口 action=confirm）
  const confirmAlert = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认关闭',
      content: '确定确认关闭该预警？',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.review({ alertId: Number(id), action: 'confirm' }))
          message.success('已确认关闭')
          await refreshAll()
        } catch {
          message.error('预警确认失败')
        }
      },
    })
  }
  // 退回重办（仅已处置状态，review 接口 action=return）
  const returnAlert = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认退回',
      content: '确定将该预警退回重办？',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.review({ alertId: Number(id), action: 'return' }))
          message.success('已退回重办')
          await refreshAll()
        } catch {
          message.error('预警退回失败')
        }
      },
    })
  }
  // 清除预警（仅待派发状态，clear 接口）
  const clearAlert = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认清除',
      content: '确定清除该预警？',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.clear(Number(id)))
          message.success('已清除')
          await refreshAll()
        } catch {
          message.error('预警清除失败')
        }
      },
    })
  }
  const deleteAlert = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认删除',
      content: '确定要永久删除该预警记录吗？此操作不可恢复。',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.remove(Number(id)))
          message.success('删除成功')
          await refreshAll()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }
  const updateTaskStatus = async (id: string, status: string) => {
    try {
      requireSuccess(await disposalTaskApi.changeStatus(Number(id), status as DisposalTaskDTO['status']))
      message.success('状态已更新')
      await refreshAll()
    } catch {
      message.error('任务状态更新失败')
    }
  }
  const deleteTask = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认删除',
      content: '确定要删除该处置任务吗？',
      onOk: async () => {
        try {
          requireSuccess(await disposalTaskApi.remove(Number(id)))
          message.success('删除成功')
          await refreshAll()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }
  // 任务确认完成（仅已提交状态，与预警表格公用 alertEvent/review 接口，后端联动预警关闭+任务完成）
  const confirmTask = (alertId: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认完成',
      content: '确定确认该处置任务已完成？',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.review({ alertId: Number(alertId), action: 'confirm' }))
          message.success('已确认完成')
          await refreshAll()
        } catch {
          message.error('任务确认失败')
        }
      },
    })
  }
  // 任务退回重办（仅已提交状态，与预警表格公用 alertEvent/review 接口，后端联动预警退回处置中+任务退回执行中）
  const returnTask = (alertId: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认退回',
      content: '确定将该处置任务退回重办？',
      onOk: async () => {
        try {
          requireSuccess(await alertEventApi.review({ alertId: Number(alertId), action: 'return' }))
          message.success('已退回重办')
          await refreshAll()
        } catch {
          message.error('任务退回失败')
        }
      },
    })
  }
  // 提交处置/任务详情/查看处置 的 Modal state + handler 已迁到 modals/
  const dispatchToTown = (task: DisposalTask) => {
    const availableTownOptions = deptRegionOptions.getTownOptions(task.districtId ?? lockedRegion.districtId)
      .filter(option => !selection?.townName || nameEquals(option.label, selection.townName))
    if (!availableTownOptions.length) {
      message.warning('当前任务所属区县没有可用的乡镇部门，请先维护部门数据')
      return
    }
    let selectedTownValue = ''
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '任务下派',
      content: (
        <div className="space-y-2">
          <p>将任务 <b>{task.id}</b> 下派至乡镇处置：</p>
          <Select placeholder="选择乡镇" className="w-full" onChange={(value: string) => { selectedTownValue = value }}>
            {availableTownOptions.map((o: { value: string; label: string }) => <Option key={o.value} value={o.value}>{o.label}</Option>)}
          </Select>
        </div>
      ),
      onOk: async () => {
        const town = availableTownOptions.find((o: { value: string; label: string }) => o.value === selectedTownValue)
        if (!town) {
          message.warning('请选择乡镇')
          throw new Error('town is required')
        }
        requireSuccess(await disposalTaskApi.edit({
          id: Number(task.id),
          alertId: Number(task.alertId),
          dataType: task.dataType,
          taskType: task.taskType,
          status: 'processing',
          assigneeName: task.assigneeName,
          requesterName: task.requesterName,
          requireTime: task.requireTime,
          disposalContent: task.disposalContent,
          photos: task.photos,
          completedAt: task.completedAt,
          cityId: task.cityId,
          districtId: task.districtId,
          townId: Number(town.value),
        }))
        message.success(`已下派至${town.label}`)
        await refreshAll()
      },
    })
  }

  // 1. 预警规则管理列已迁到 tabs/RuleTab.tsx

  // 1. 预警规则管理列已迁到 tabs/RuleTab.tsx
  // 2. 实时预警监控列已迁到 tabs/AlertTab.tsx
  // 3. 处置任务管理列已迁到 tabs/TaskTab.tsx

  return (
    <div className="alert-page-container">
      {/* 顶部返回导航行 (借鉴图一图二: < 返回监控大屏 | 预警中心) */}
      <div className="alert-header-bar">
        <div className="header-left">
          <div className="alert-nav-breadcrumb">
            <span className="back-btn" onClick={() => navigate('/monitor')}>
              <ArrowLeftOutlined /> 返回监控大屏
            </span>
            <span className="nav-divider">|</span>
            <span className="nav-current-title">预警中心</span>
          </div>
          <RegionSelector />
        </div>
      </div>

      {/* Tabs 切换行 */}
      <div className="alert-title-tabs-row">
        <div className="tech-tabs-bar">
          {isTabVisible('rules') && (
            <div
              className={`tech-tab-item ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              预警规则管理
            </div>
          )}
          {isTabVisible('alerts') && (
            <div
              className={`tech-tab-item ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              实时预警监控
            </div>
          )}
          {isTabVisible('tasks') && (
            <div
              className={`tech-tab-item ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              处置任务管理
            </div>
          )}
          {isTabVisible('trends') && (
            <div
              className={`tech-tab-item ${activeTab === 'trends' ? 'active' : ''}`}
              onClick={() => setActiveTab('trends')}
            >
              区域预警实时动向
            </div>
          )}
        </div>
      </div>

      {/* 顶部 5 联排指标卡 (实时预警监控 & 处置任务管理 Tab 展示) */}
      {(activeTab === 'alerts' || activeTab === 'tasks') && (
        <AlertOverviewCards
          mode={activeTab}
          dashboard={dashboard}
          totalAlerts={alertsTotal}
          totalTasks={tasksTotal} taskCounts={taskCounts}
        />
      )}

      {/* 表格 / 内容区域 */}
      <div className="tech-table-wrapper">
        {activeTab === 'rules' && (
          <RuleTab
            isTown={isTown}
            selectionCityName={selection?.cityName}
            canEditRule={canEditRule}
            cityOptions={cityOptions}
            roleLevel={roleLevel}
            canSelectRegion={canSelectRegion}
            lockedRegion={lockedRegion}
            deptRegionOptions={deptRegionOptions}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertTabView
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            alerts={alerts}
            loading={loading}
            page={alertsPage}
            size={alertsSize}
            total={alertsTotal}
            setPage={setAlertsPage}
            setSize={setAlertsSize}
            searchDevice={alertSearchDevice}
            setSearchDevice={setAlertSearchDevice}
            appliedDevice={alertAppliedDevice}
            filterDataType={alertFilterDataType}
            setFilterDataType={setAlertFilterDataType}
            filterLevel={alertFilterLevel}
            setFilterLevel={setAlertFilterLevel}
            filterStatus={alertFilterStatus}
            setFilterStatus={setAlertFilterStatus}
            includeHistory={alertIncludeHistory}
            setIncludeHistory={setAlertIncludeHistory}
            timeRange={alertTimeRange}
            setTimeRange={setAlertTimeRange}
            isTown={isTown}
            selectionCityName={selection?.cityName}
            handlers={{
              onOpenDetail: openAlertDetail,
              onOpenDispatch: (r: AlertEvent) => setDispatchModal({ open: true, alert: r }),
              onOpenEvidence: (r: AlertEvent) => { if (canCollectEvidence(r.status)) setEvidenceAlert(r) },
              onConfirm: confirmAlert,
              onReturn: returnAlert,
              onClear: clearAlert,
              onDelete: deleteAlert,
              onApplySearch: applyAlertSearch,
            }}
          />
        )}
        {activeTab === 'tasks' && (
          <TaskTab
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tasks={tasks}
            loading={loading}
            page={tasksPage}
            size={tasksSize}
            total={tasksTotal}
            setPage={setTasksPage}
            setSize={setTasksSize}
            filterDataType={taskFilterDataType}
            setFilterDataType={setTaskFilterDataType}
            filterType={taskFilterType}
            setFilterType={setTaskFilterType}
            filterStatus={taskFilterStatus}
            setFilterStatus={setTaskFilterStatus}
            isTown={isTown}
            handlers={{
              onOpenDetail: openTaskDetail,
              onOpenFollowUp: (r: DisposalTask) => { if (r.status === 'completed') setFollowUpTask(r) },
              onUpdateStatus: updateTaskStatus,
              onOpenCommit: (r: DisposalTask) => setCommitModal({ open: true, task: r }),
              onDispatchToTown: dispatchToTown,
              onConfirm: confirmTask,
              onReturn: returnTask,
              onDelete: deleteTask,
            }}
          />
        )}
        {activeTab === 'trends' && (
          <TrendsTab alerts={alerts} alertLevelOptions={alertLevelOptions} />
        )}
      </div>

      {/* 新增/编辑规则弹窗（已抽到 modals/RuleModal.tsx） */}
      {/* 预警详情 Modal（已抽到 modals/AlertDetailModal.tsx） */}
      <AlertDetailModal
        open={alertDetail.open}
        alert={alertDetail.alert}
        onClose={() => setAlertDetail({ open: false, alert: null })}
        alertLevelOptions={alertLevelOptions}
        deptNameOf={deptNameOf}
      />

      <EvidenceModal alert={evidenceAlert} onClose={() => setEvidenceAlert(null)} onSaved={() => void refreshAll()}
        onDispatch={() => { if (evidenceAlert) setDispatchModal({ open: true, alert: evidenceAlert, fromEvidence: true }) }} />
      <FollowUpModal task={followUpTask} onClose={() => setFollowUpTask(null)} onSaved={(task) => { void refreshAll(); openTaskDetail(task) }} />

      {/* 派发任务 Modal（已抽到 modals/DispatchModal.tsx） */}
      <DispatchModal
        open={dispatchModal.open}
        alert={dispatchModal.alert}
        onClose={() => setDispatchModal({ open: false, alert: null })}
        onSaved={() => {
          void refreshAll()
          if (dispatchModal.fromEvidence && dispatchModal.alert) {
            setEvidenceAlert({ ...dispatchModal.alert, status: 'pending' })
          }
        }}
        roleLevel={roleLevel}
        canSelectRegion={canSelectRegion}
        lockedRegion={lockedRegion}
        deptRegionOptions={deptRegionOptions}
        taskTypeOptions={taskTypeOptions}
      />

      {/* 任务详情 Modal（已抽到 modals/TaskDetailModal.tsx） */}
      <TaskDetailModal
        open={taskDetail.open}
        task={taskDetail.task}
        onClose={() => setTaskDetail({ open: false, task: null })}
        deptNameOf={deptNameOf}
        dataTypeOptions={dataTypeOptions}
        taskTypeOptions={taskTypeOptions}
      />


      {/* 提交处置结果 Modal（已抽到 modals/CommitModal.tsx） */}
      <CommitModal
        open={commitModal.open}
        task={commitModal.task}
        onClose={() => setCommitModal({ open: false, task: null })}
        onSaved={() => void refreshAll()}
      />
    </div>
  )
}
