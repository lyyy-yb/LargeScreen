import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table, Modal, Form, Input, Select, Radio, InputNumber, Switch, Tag, Space, DatePicker, App } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, AlertFilled, ArrowLeftOutlined, DeleteOutlined, SendOutlined, SearchOutlined, CheckCircleOutlined, CopyOutlined, DownloadOutlined, ImportOutlined, ExportOutlined } from '@ant-design/icons'
import RegionSelector from '@/components/RegionSelector'
import './index.less'
import { useAppStore, useAuthStore } from '@/stores'
import { addOption, buildDeptRegionOptions, flattenDepartments, nameEquals } from '@/utils/deptRegion'
import dayjs from 'dayjs'
import { alertEventApi, disposalTaskApi, warningRuleApi } from '@/servers/business'
import type { AlertEventDTO, DisposalTaskDTO, WarningRuleDTO, WarningRuleExportQuery } from '@/types/business'
import type { DeptInfo } from '@/types/auth'
import { deptList, userList } from '@/servers/api'

const { Option } = Select

interface AlertRule {
  id: string; ruleName: string; dataType: string; fieldName: string;
  ruleType: string; alertLevel: string; priority: number; enabled: boolean;
  description: string; config: Record<string, any>; autoDispatch: boolean;
  targetCityId?: number | string; targetDistrictId?: number | string; targetTownId?: number | string;
}
interface AlertEvent {
  id: string; ruleName: string; alertLevel: string; dataType: string;
  deviceName: string; location: string; city: string; district: string;
  town?: string;
  triggerReason: string; status: string; createdAt: string; assignedCity?: string;
}
interface DisposalTask {
  id: string; alertId: string; dataType: string; taskType: string; status: string;
  assigneeName: string; requesterName: string; requireTime: string; createdAt: string;
  disposalContent?: string; photos?: string[]; completedAt?: string;
  city: string; district: string; town?: string;
}

function parseConfig(config: WarningRuleDTO['config']): Record<string, unknown> {
  if (!config) return {}
  if (typeof config === 'object') return config
  let value: unknown = config
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    try {
      value = JSON.parse(value)
    } catch {
      break
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toAlertRule(item: WarningRuleDTO): AlertRule {
  return {
    ...item,
    id: String(item.id),
    description: item.description ?? '',
    config: parseConfig(item.config),
    enabled: item.enabled === 1,
    autoDispatch: item.autoDispatch === 1,
    targetCityId: item.targetCityId != null ? String(item.targetCityId) : undefined,
    targetDistrictId: item.targetDistrictId != null ? String(item.targetDistrictId) : undefined,
    targetTownId: item.targetTownId != null ? String(item.targetTownId) : undefined,
  }
}

function toAlertEvent(item: AlertEventDTO): AlertEvent {
  return {
    ...item,
    id: String(item.id),
    createdAt: item.createTime ?? '',
  }
}

function toDisposalTask(item: DisposalTaskDTO): DisposalTask {
  const photos = Array.isArray(item.photos)
    ? item.photos
    : typeof item.photos === 'string'
      ? item.photos.split(',').filter(Boolean)
      : []
  return {
    ...item,
    id: String(item.id),
    alertId: String(item.alertId),
    assigneeName: item.assigneeName ?? '',
    requesterName: item.requesterName ?? '',
    requireTime: item.requireTime ?? '',
    createdAt: item.createTime ?? '',
    city: item.city ?? '',
    district: item.district ?? '',
    photos,
  }
}

const dataTypeOptions = [
  { value: 'air_quality_station', label: '空气质量检测站' },
  { value: 'mobile_monitor_car', label: '走航车' },
  { value: 'drone_sensor', label: '无人机传感器' },
  { value: 'power_monitor', label: '用电监控' },
  { value: 'radar_station', label: '雷达站' },
]
const ruleTypeOptions = [
  { value: 'threshold', label: '数值阈值预警' },
  { value: 'change_rate', label: '变化率预警' },
  { value: 'continuous', label: '连续超标预警' },
  { value: 'offline', label: '离线预警' },
]
const alertLevelOptions = [
  { value: 'level1', label: '一级预警', color: '#FF4D4F' },
  { value: 'level2', label: '二级预警', color: '#FA8C16' },
  { value: 'level3', label: '三级预警', color: '#FAAD14' },
  { value: 'level4', label: '四级预警', color: '#1890FF' },
]
const taskTypeOptions = [
  { value: 'on_site_check', label: '现场核查' },
  { value: 'data_verification', label: '数据校验' },
  { value: 'vehicle_dispatch', label: '车辆调度' },
  { value: 'flight_dispatch', label: '飞行调度' },
  { value: 'enterprise_inspection', label: '企业巡查' },
]
const townOptions = [
  { value: 'fengshan', label: '凤山街道' },
  { value: 'yangming', label: '阳明街道' },
  { value: 'lizhou', label: '梨洲街道' },
  { value: 'lanjiang', label: '兰江街道' },
  { value: 'langxia', label: '朗霞街道' },
  { value: 'ditang', label: '低塘街道' },
]

const fieldOptions: Record<string, { value: string; label: string }[]> = {
  air_quality_station: [
    { value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' },
    { value: 'tsp', label: 'TSP' }, { value: 'o3', label: 'O₃' },
    { value: 'so2', label: 'SO₂' }, { value: 'no2', label: 'NO₂' },
    { value: 'co', label: 'CO' }, { value: 'vocs', label: 'VOCs' },
  ],
  mobile_monitor_car: [{ value: 'pm25', label: 'PM2.5' }, { value: 'tsp', label: 'TSP' }],
  drone_sensor: [{ value: 'pm25', label: 'PM2.5' }, { value: 'pm10', label: 'PM10' }],
  power_monitor: [{ value: 'power', label: '功率' }, { value: 'powerFactor', label: '功率因数' }],
  radar_station: [{ value: 'alarmLevel', label: '报警级别' }, { value: 'alarmCount', label: '报警次数' }],
}

export default function AlertPage() {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const regionContext = useAppStore(state => state.regionContext)
  const user = useAuthStore(state => state.user)
  const selection = regionContext?.selection

  const [activeTab, setActiveTab] = useState<'rules' | 'alerts' | 'tasks' | 'trends'>('alerts')
  const [rules, setRules] = useState<AlertRule[]>([])
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [tasks, setTasks] = useState<DisposalTask[]>([])
  const [loading, setLoading] = useState(false)
  const [isRuleModalVisible, setIsRuleModalVisible] = useState(false)
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false)
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false)
  const [isDisposalModalVisible, setIsDisposalModalVisible] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<AlertEvent | null>(null)
  const [selectedTask, setSelectedTask] = useState<DisposalTask | null>(null)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [form] = Form.useForm()
  const [dispatchForm] = Form.useForm()
  const [isDispatchModalVisible, setIsDispatchModalVisible] = useState(false)
  const [dispatchAlert, setDispatchAlert] = useState<AlertEvent | null>(null)
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false)
  const [townUserOptions, setTownUserOptions] = useState<{ value: number; label: string }[]>([])
  const loadedUserTownIds = useRef(new Set<number>())
  const [selectedDataType, setSelectedDataType] = useState('')
  // 三个列表的服务端分页与筛选状态（默认每页 15 条）
  const [rulesPage, setRulesPage] = useState(1)
  const [rulesSize, setRulesSize] = useState(15)
  const [rulesTotal, setRulesTotal] = useState(0)
  const [ruleSearchName, setRuleSearchName] = useState('')
  const [ruleAppliedName, setRuleAppliedName] = useState('')
  const [ruleFilterDataType, setRuleFilterDataType] = useState<string | undefined>(undefined)
  const [ruleFilterType, setRuleFilterType] = useState<string | undefined>(undefined)
  const [ruleFilterLevel, setRuleFilterLevel] = useState<string | undefined>(undefined)
  const [ruleFilterEnabled, setRuleFilterEnabled] = useState<0 | 1 | undefined>(undefined)
  const [alertsPage, setAlertsPage] = useState(1)
  const [alertsSize, setAlertsSize] = useState(15)
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertSearchDevice, setAlertSearchDevice] = useState('')
  const [alertAppliedDevice, setAlertAppliedDevice] = useState('')
  const [alertFilterDataType, setAlertFilterDataType] = useState<string | undefined>(undefined)
  const [alertFilterLevel, setAlertFilterLevel] = useState<string | undefined>(undefined)
  const [alertFilterStatus, setAlertFilterStatus] = useState<string | undefined>(undefined)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksSize, setTasksSize] = useState(15)
  const [tasksTotal, setTasksTotal] = useState(0)
  const [taskFilterDataType, setTaskFilterDataType] = useState<string | undefined>(undefined)
  const [taskFilterType, setTaskFilterType] = useState<string | undefined>(undefined)
  const [taskFilterStatus, setTaskFilterStatus] = useState<string | undefined>(undefined)
  const [extraDepts, setExtraDepts] = useState<DeptInfo[]>([])
  const loadingDeptParentIds = useRef(new Set<number>())
  // 预警规则导入：隐藏的文件选择框与导入中状态
  const ruleImportInputRef = useRef<HTMLInputElement>(null)
  const [ruleImporting, setRuleImporting] = useState(false)
  const allDepts = useMemo(() => {
    const departments = flattenDepartments([
      ...(regionContext?.departments ?? []),
      ...extraDepts,
    ])
    const currentDept = user?.dept
    if (currentDept && !departments.some(dept => Number(dept.deptId) === Number(currentDept.deptId))) {
      flattenDepartments([currentDept]).forEach(dept => {
        if (!departments.some(item => Number(item.deptId) === Number(dept.deptId))) departments.push(dept)
      })
    }
    return departments
  }, [extraDepts, regionContext?.departments, user?.dept])
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
  const targetCityId = Form.useWatch('targetCityId', form)
  const targetDistrictId = Form.useWatch('targetDistrictId', form)
  const dispatchCityId = Form.useWatch('cityId', dispatchForm)
  const dispatchDistrictId = Form.useWatch('districtId', dispatchForm)
  const dispatchTownId = Form.useWatch('townId', dispatchForm)
  const dispatchDistrictOptions = useMemo(
    () => deptRegionOptions.getDistrictOptions(dispatchCityId),
    [deptRegionOptions, dispatchCityId],
  )
  const dispatchTownOptions = useMemo(
    () => deptRegionOptions.getTownOptions(dispatchDistrictId),
    [deptRegionOptions, dispatchDistrictId],
  )
  const watchedRuleType = Form.useWatch('ruleType', form)
  const districtOptions = useMemo(
    () => {
      const opts = addOption(
        deptRegionOptions.getDistrictOptions(targetCityId),
        lockedRegion.districtId,
        lockedRegion.districtName,
      )
      // 添加"全部"选项
      return [{ value: 'all', label: '全部' }, ...opts]
    },
    [deptRegionOptions, lockedRegion.districtId, lockedRegion.districtName, targetCityId],
  )
  const targetTownOptions = useMemo(
    () => {
      const opts = deptRegionOptions.getTownOptions(targetDistrictId)
      // 添加"全部"选项
      return [{ value: 'all', label: '全部' }, ...opts]
    },
    [deptRegionOptions, targetDistrictId],
  )
  const loadDepartmentChildren = useCallback(async (parentId?: number) => {
    const normalizedParentId = Number(parentId)
    if (
      !Number.isFinite(normalizedParentId)
      || loadingDeptParentIds.current.has(normalizedParentId)
    ) return
    loadingDeptParentIds.current.add(normalizedParentId)
    try {
      const response = await deptList({ parentId: normalizedParentId })
      if (response.code !== 200 || !Array.isArray(response.data)) return
      const loaded = flattenDepartments(response.data)
      setExtraDepts(previous => {
        const knownIds = new Set(flattenDepartments(previous).map(dept => Number(dept.deptId)))
        const additions = loaded.filter(dept => !knownIds.has(Number(dept.deptId)))
        return additions.length ? [...previous, ...additions] : previous
      })
    } catch {
      // 权限范围内无下级部门时保持空选项，不影响已锁定区域。
    }
  }, [])
  const canSelectRegion = regionContext?.roleLevel === 'admin'
  const roleLevel = regionContext?.roleLevel ?? 'town'
  const isTown = roleLevel === 'town'
  const canEditRule = !isTown

  useEffect(() => {
    if (!isRuleModalVisible) return
    queueMicrotask(() => {
      if (targetCityId && !districtOptions.length && roleLevel !== 'county' && roleLevel !== 'town') {
        void loadDepartmentChildren(Number(targetCityId))
      }
      if (targetDistrictId && !targetTownOptions.length && roleLevel !== 'town') {
        void loadDepartmentChildren(Number(targetDistrictId))
      }
    })
  }, [
    districtOptions.length,
    isRuleModalVisible,
    loadDepartmentChildren,
    roleLevel,
    targetCityId,
    targetDistrictId,
    targetTownOptions.length,
  ])

  useEffect(() => {
    if (!isRuleModalVisible) return
    if (editingRule) return
    if (roleLevel !== 'city' && roleLevel !== 'county') return
    queueMicrotask(() => {
      form.setFieldsValue({
        ...(lockedRegion.cityId ? { targetCityId: lockedRegion.cityId } : {}),
        ...(roleLevel === 'county' && lockedRegion.districtId
          ? { targetDistrictId: lockedRegion.districtId }
          : {}),
      })
    })
  }, [
    form,
    editingRule,
    isRuleModalVisible,
    lockedRegion.cityId,
    lockedRegion.districtId,
    roleLevel,
  ])

  const regionParams = useMemo(() => ({
    ...(selection?.cityName ? { city: selection.cityName } : {}),
    ...(selection?.countyName ? { district: selection.countyName } : {}),
    ...(selection?.townName ? { town: selection.townName } : {}),
  }), [selection])

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const response = await warningRuleApi.list({
        pageNum: rulesPage,
        pageSize: rulesSize,
        ruleName: ruleAppliedName || undefined,
        dataType: ruleFilterDataType,
        ruleType: ruleFilterType,
        alertLevel: ruleFilterLevel,
        enabled: ruleFilterEnabled,
      })
      setRules((response.data?.records ?? []).map(toAlertRule))
      setRulesTotal(response.data?.total ?? 0)
    } catch {
      message.error('预警规则加载失败')
    } finally {
      setLoading(false)
    }
  }, [message, rulesPage, rulesSize, ruleAppliedName, ruleFilterDataType, ruleFilterType, ruleFilterLevel, ruleFilterEnabled])

  const loadAlerts = useCallback(async (silent = false) => {
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
      })
      setAlerts((response.data?.records ?? []).map(toAlertEvent))
      setAlertsTotal(response.data?.total ?? 0)
    } catch {
      if (!silent) message.error('实时预警加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [
    message, regionParams,
    alertsPage, alertsSize, alertAppliedDevice, alertFilterDataType, alertFilterLevel, alertFilterStatus,
  ])

  const loadTasks = useCallback(async () => {
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
      setTasks((response.data?.records ?? []).map(toDisposalTask))
      setTasksTotal(response.data?.total ?? 0)
    } catch {
      setTasks([])
      message.error('处置任务加载失败')
    } finally {
      setLoading(false)
    }
  }, [message, regionParams, tasksPage, tasksSize, taskFilterDataType, taskFilterType, taskFilterStatus])

  useEffect(() => {
    queueMicrotask(() => void loadRules())
  }, [loadRules])

  useEffect(() => {
    queueMicrotask(() => void loadAlerts())
  }, [loadAlerts])

  useEffect(() => {
    queueMicrotask(() => void loadTasks())
  }, [loadTasks])

  // 区域预警实时动向：进入该 tab 后立即刷新，并按 30s 间隔轮询实时预警数据
  useEffect(() => {
    if (activeTab !== 'trends') return
    // 标准的列表数据拉取模式，忽略 set-state-in-effect 规则
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAlerts(true)
    const timer = window.setInterval(() => void loadAlerts(true), 30_000)
    return () => window.clearInterval(timer)
  }, [activeTab, loadAlerts])

  const applyRuleSearch = (value?: string) => {
    setRuleAppliedName((value ?? ruleSearchName).trim())
    setRulesPage(1)
  }

  const applyAlertSearch = (value?: string) => {
    setAlertAppliedDevice((value ?? alertSearchDevice).trim())
    setAlertsPage(1)
  }

  // 派发弹窗：选中乡镇后加载该乡镇下的用户
  const loadTownUsers = useCallback(async (townId?: number | string) => {
    const normalizedTownId = Number(townId)
    if (!Number.isFinite(normalizedTownId) || loadedUserTownIds.current.has(normalizedTownId)) return
    loadedUserTownIds.current.add(normalizedTownId)
    try {
      const response = await userList({ deptId: normalizedTownId, pageNum: 1, pageSize: 200 })
      if (response.code !== 200) {
        message.warning(response.msg || '获取乡镇用户列表失败')
        return
      }
      const options = (response.rows ?? [])
        .filter(user => user.status === '0')
        .map(user => ({ value: user.userId, label: user.nickName || user.userName }))
      setTownUserOptions(options)
      if (!options.length) message.info('该乡镇下暂无可选处置人员')
    } catch {
      message.warning('获取乡镇用户列表失败')
    }
  }, [])

  useEffect(() => {
    if (!isDispatchModalVisible) return
    const cityValue = dispatchForm.getFieldValue('cityId')
    const districtValue = dispatchForm.getFieldValue('districtId')
    const townValue = dispatchForm.getFieldValue('townId')
    queueMicrotask(() => {
      if (cityValue && !deptRegionOptions.getDistrictOptions(cityValue).length) {
        void loadDepartmentChildren(Number(cityValue))
      }
      if (districtValue && !deptRegionOptions.getTownOptions(districtValue).length) {
        void loadDepartmentChildren(Number(districtValue))
      }
      if (townValue) void loadTownUsers(townValue)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDispatchModalVisible])

  const showDispatchModal = (alert: AlertEvent) => {
    setDispatchAlert(alert)
    setTownUserOptions([])
    dispatchForm.resetFields()
    const defaults: Record<string, unknown> = {
      taskType: 'on_site_check',
      requireTime: dayjs().add(1, 'hour'),
    }
    // 默认选中预警事件所属区域；乡镇级角色锁定到所属乡镇
    if (alert.city) {
      const cityDept = allDepts.find(dept => nameEquals(dept.deptName, alert.city))
      if (cityDept) defaults.cityId = String(cityDept.deptId)
    }
    if (alert.district) {
      const districtDept = allDepts.find(dept => nameEquals(dept.deptName, alert.district))
      if (districtDept) defaults.districtId = String(districtDept.deptId)
    }
    if (alert.town) {
      const townDept = allDepts.find(dept => nameEquals(dept.deptName, alert.town))
      if (townDept) defaults.townId = String(townDept.deptId)
    }
    if (roleLevel !== 'admin') {
      if (lockedRegion.cityId) defaults.cityId = lockedRegion.cityId
      if (roleLevel === 'county' && lockedRegion.districtId) defaults.districtId = lockedRegion.districtId
    }
    dispatchForm.setFieldsValue(defaults)
    setIsDispatchModalVisible(true)
  }

  const handleDispatchOk = () => {
    dispatchForm.validateFields().then(async values => {
      if (!dispatchAlert) return
      setDispatchSubmitting(true)
      try {
        await alertEventApi.dispatch({
          alertId: Number(dispatchAlert.id),
          taskType: values.taskType,
          assigneeId: Number(values.assigneeId),
          townId: values.townId ? Number(values.townId) : undefined,
          requireTime: dayjs(values.requireTime).format('YYYY-MM-DD HH:mm:ss'),
          disposalContent: values.disposalContent,
        })
        message.success('派发成功')
        setIsDispatchModalVisible(false)
        await Promise.all([loadAlerts(), loadTasks()])
      } catch {
        message.error('任务派发失败')
      } finally {
        setDispatchSubmitting(false)
      }
    })
  }

  const showAddRuleModal = () => {
    if (!canEditRule) return
    setEditingRule(null)
    setSelectedDataType('')
    form.resetFields()
    const defaults: Record<string, unknown> = { autoDispatch: false }
    if (roleLevel !== 'admin') {
      defaults.targetCityId = lockedRegion.cityId
      if (roleLevel === 'county') defaults.targetDistrictId = lockedRegion.districtId
    }
    form.setFieldsValue(defaults)
    setIsRuleModalVisible(true)
  }
  // 编辑/复制共用：asCopy=true 时以新增模式打开弹窗，并预填选中行的全部数据
  const openRuleModalWithData = async (r: AlertRule, asCopy: boolean) => {
    const buildFormValues = (rule: AlertRule) => {
      // 将 targetTownId 转为数组以适配多选（统一转成 string 以匹配 options）
      let townArr: (string | number)[] | undefined
      if (rule.targetTownId) {
        const townStr = String(rule.targetTownId)
        townArr = townStr === 'all' ? ['all'] : townStr.split(',').filter(Boolean).map(v => String(v))
      }
      // 从 config 中提取 ruleTimeWindow（间隔时间）
      const ruleTimeWindow = rule.config?.timeWindow
      return {
        ...rule,
        ...rule.config,
        targetTownId: townArr,
        ruleTimeWindow: ruleTimeWindow || undefined,
      }
    }

    form.resetFields()
    setEditingRule(asCopy ? null : r)
    setSelectedDataType(r.dataType)
    // 先设置不含区域字段的基本值；复制时规则名追加副本后缀避免重名
    const baseValues = buildFormValues(r)
    form.setFieldsValue({
      ...baseValues,
      ...(asCopy ? { ruleName: `${r.ruleName}-副本` } : {}),
      targetDistrictId: undefined,
      targetTownId: undefined,
    })
    setIsRuleModalVisible(true)

    const hide = message.loading('加载规则详情...', 0)
    let finalRule = r
    try {
      const res = await warningRuleApi.detail(Number(r.id))
      const detail = res.data
      if (detail) {
        const detailRule = toAlertRule(detail)
        finalRule = {
          ...r,
          ...detailRule,
          targetCityId: detailRule.targetCityId ?? r.targetCityId,
          targetDistrictId: detailRule.targetDistrictId ?? r.targetDistrictId,
          targetTownId: detailRule.targetTownId ?? r.targetTownId,
        }
        setEditingRule(finalRule)
      }
    } catch {
      // 列表数据已包含编辑所需字段，详情接口异常时保留列表数据回显。
    } finally {
      hide()
    }

    // 确保区域选项加载完成后再设置区域字段
    const cityId = finalRule.targetCityId
    if (cityId && roleLevel !== 'county' && roleLevel !== 'town') {
      await loadDepartmentChildren(Number(cityId))
    }
    const districtId = finalRule.targetDistrictId
    if (districtId && districtId !== 'all' && roleLevel !== 'town') {
      await loadDepartmentChildren(Number(districtId))
    }
    // 延迟一帧让 React 更新 options 后再设置区域值
    requestAnimationFrame(() => {
      const regionValues = buildFormValues(finalRule)
      form.setFieldsValue({
        targetCityId: regionValues.targetCityId,
        targetDistrictId: regionValues.targetDistrictId,
        targetTownId: regionValues.targetTownId,
      })
    })
  }
  const showEditRuleModal = (r: AlertRule) => void openRuleModalWithData(r, false)

  const handleRuleOk = () => {
    form.validateFields().then(async values => {
      const config: Record<string, unknown> = {}
      if (values.ruleType === 'threshold' || values.ruleType === 'change_rate') {
        config.threshold = values.threshold
        config.operator = values.operator
        if (values.ruleTimeWindow) config.timeWindow = values.ruleTimeWindow
      }
      else if (values.ruleType === 'continuous') { config.count = values.count; config.interval = values.interval }
      else if (values.ruleType === 'offline') { config.offlineTime = values.offlineTime }

      // 处理目标区县
      const districtValue = values.targetDistrictId === 'all' ? 'all' : values.targetDistrictId
      // 处理目标乡镇
      let townValue: string | undefined
      if (values.targetDistrictId === 'all') {
        townValue = undefined
      } else if (Array.isArray(values.targetTownId)) {
        townValue = values.targetTownId.includes('all') ? 'all' : values.targetTownId.join(',')
      } else {
        townValue = values.targetTownId
      }

      const payload = {
        ruleName: values.ruleName,
        dataType: values.dataType,
        fieldName: values.fieldName,
        ruleType: values.ruleType,
        alertLevel: values.alertLevel,
        priority: values.priority,
        enabled: values.enabled === false ? 0 as const : 1 as const,
        description: values.description,
        config: JSON.stringify(config),
        autoDispatch: values.autoDispatch ? 1 as const : 0 as const,
        targetCityId: values.targetCityId,
        targetDistrictId: districtValue,
        targetTownId: townValue,
      }
      try {
        if (editingRule) await warningRuleApi.edit({ ...payload, id: Number(editingRule.id) })
        else await warningRuleApi.add(payload)
        setIsRuleModalVisible(false)
        form.resetFields()
        message.success(editingRule ? '更新成功' : '创建成功')
        await loadRules()
      } catch {
        message.error('规则保存失败')
      }
    })
  }
  const handleDeleteRule = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认删除',
      content: '确定删除该规则？',
      onOk: async () => {
        await warningRuleApi.remove(Number(id))
        message.success('删除成功')
        await loadRules()
      },
    })
  }
  const toggleRule = async (id: string, enabled: boolean) => {
    try {
      await warningRuleApi.changeStatus(Number(id), enabled ? 0 : 1)
      await loadRules()
    } catch {
      message.error('规则状态更新失败')
    }
  }

  // 下载 Blob 文件（模板下载/导出共用）
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }
  // 后端异常时也会返回 JSON 格式的 blob，先识别再提示
  const isJsonErrorBlob = async (blob: Blob) => {
    if (!blob.type.includes('application/json')) return false
    try {
      const body = JSON.parse(await blob.text()) as { msg?: string; message?: string }
      message.error(body.msg || body.message || '操作失败')
    } catch {
      message.error('操作失败')
    }
    return true
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await warningRuleApi.importTemplate()
      const blob = res as unknown as Blob
      if (await isJsonErrorBlob(blob)) return
      downloadBlob(blob, '预警规则导入模板.xlsx')
    } catch {
      message.error('模板下载失败')
    }
  }

  const handleExportRules = async () => {
    try {
      const params: WarningRuleExportQuery = {
        ruleName: ruleAppliedName || undefined,
        dataType: ruleFilterDataType,
        ruleType: ruleFilterType,
        alertLevel: ruleFilterLevel,
        enabled: ruleFilterEnabled,
      }
      const res = await warningRuleApi.exportRules(params)
      const blob = res as unknown as Blob
      if (await isJsonErrorBlob(blob)) return
      downloadBlob(blob, `预警规则_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`)
    } catch {
      message.error('导出失败')
    }
  }

  const handleImportRules = async (file: File) => {
    setRuleImporting(true)
    try {
      const res = await warningRuleApi.importData(file)
      message.success(res.msg || '导入成功')
      setRulesPage(1)
      await loadRules()
    } catch {
      message.error('导入失败')
    } finally {
      setRuleImporting(false)
    }
  }
  const confirmAlert = async (id: string) => {
    try {
      await alertEventApi.changeStatus(Number(id), 'processing')
      message.success('已确认')
      await loadAlerts()
    } catch {
      message.error('预警确认失败')
    }
  }
  const closeAlert = (id: string) => {
    modal.confirm({
      className: 'dark-confirm-modal',
      title: '确认清除',
      content: '确定清除该预警？',
      onOk: async () => {
        await alertEventApi.changeStatus(Number(id), 'closed')
        await loadAlerts()
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
          await alertEventApi.remove(Number(id))
          message.success('删除成功')
          await loadAlerts()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }
  const updateTaskStatus = async (id: string, status: string) => {
    try {
      await disposalTaskApi.changeStatus(Number(id), status as DisposalTaskDTO['status'])
      message.success('状态已更新')
      await loadTasks()
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
          await disposalTaskApi.remove(Number(id))
          message.success('删除成功')
          await loadTasks()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }
  const dispatchToTown = (task: DisposalTask) => {
    const availableTownOptions = selection?.townName
      ? [{ value: selection.townName, label: selection.townName }]
      : townOptions
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
        await disposalTaskApi.edit({
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
          city: task.city,
          district: task.district,
          town: town.label,
        })
        message.success(`已下派至${town.label}`)
        await loadTasks()
      },
    })
  }

  // 1. 预警规则管理列 - 完全与原型图一一致
  const ruleCols = [
    { title: '规则名称', dataIndex: 'ruleName', width: 170 },
    { title: '数据类型', dataIndex: 'dataType', width: 130, render: (t: string) => dataTypeOptions.find(o => o.value === t)?.label || t },
    { title: '监测字段', dataIndex: 'fieldName', width: 90, render: (t: string, r: AlertRule) => fieldOptions[r.dataType]?.find(o => o.value === t)?.label || t },
    { title: '规则类型', dataIndex: 'ruleType', width: 120, render: (t: string) => ruleTypeOptions.find(o => o.value === t)?.label || t },
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      width: 90,
      render: (t: string) => {
        const item = alertLevelOptions.find(o => o.value === t) || { label: '二级预警', color: '#FA8C16' }
        return (
          <span className="flex items-center gap-1 font-semibold" style={{ color: item.color }}>
            <AlertFilled style={{ color: item.color, fontSize: 13 }} />
            {item.label}
          </span>
        )
      },
    },
    { title: '优先级', dataIndex: 'priority', width: 60, align: 'center' as const },
    {
      title: '直接下发',
      dataIndex: 'autoDispatch',
      width: 80,
      align: 'center' as const,
      render: (t: boolean) => (
        <span style={{ color: t ? '#03FBFD' : '#FAAD14', fontWeight: 600 }}>
          {t ? '是' : '否'}
        </span>
      ),
    },
    {
      title: '目标地市',
      dataIndex: 'targetCityId',
      width: 100,
      render: (t?: number) => {
        const matched = cityOptions.find(c => Number(c.value) === Number(t))
        return matched ? matched.label : (selection?.cityName || '杭州市')
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 80,
      render: (t: boolean, r: AlertRule) => (
        <div className="flex items-center gap-1">
          <Switch
            checked={t}
            size="small"
            className="tech-switch"
            disabled={isTown}
            onChange={() => toggleRule(r.id, t)}
          />
          <span style={{ color: t ? '#03FBFD' : 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            {t ? '启用' : '禁用'}
          </span>
        </div>
      ),
    },
    {
      title: '操作',
      width: isTown ? 70 : 170,
      render: (_: unknown, r: AlertRule) => (
        isTown ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showEditRuleModal(r)}
            className="!text-[#03FBFD] hover:!text-white !p-0"
          >
            查看
          </Button>
        ) : (
        <div className="flex items-center gap-2">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showEditRuleModal(r)}
            className="!text-[#03FBFD] hover:!text-white !p-0"
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => void openRuleModalWithData(r, true)}
            className="!text-[#52C41A] hover:!text-green-300 !p-0"
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRule(r.id)}
            className="!text-[#FF4D4F] hover:!text-red-300 !p-0"
          >
            删除
          </Button>
        </div>
        )
      ),
    },
  ]

  // 2. 实时预警监控列
  const alertCols = [
    { title: '预警ID', dataIndex: 'id', width: 70 },
    { title: '规则名称', dataIndex: 'ruleName', width: 160 },
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      width: 90,
      render: (t: string) => {
        const item = alertLevelOptions.find(o => o.value === t) || { label: '二级预警', color: '#FA8C16' }
        return (
          <span className="flex items-center gap-1 font-semibold" style={{ color: item.color }}>
            <AlertFilled style={{ color: item.color, fontSize: 13 }} />
            {item.label}
          </span>
        )
      },
    },
    { title: '设备名称', dataIndex: 'deviceName', width: 120 },
    { title: '监测位置', dataIndex: 'location', width: 110 },
    {
      title: '处置状态',
      dataIndex: 'status',
      width: 80,
      render: (t: string) => {
        const m: Record<string, { l: string; c: string }> = {
          undispatched: { l: '待派发', c: 'gold' },
          pending: { l: '待处置', c: 'orange' },
          processing: { l: '处置中', c: 'blue' },
          completed: { l: '已处置', c: 'green' },
          closed: { l: '已关闭', c: 'default' },
        }
        return <Tag color={m[t]?.c}>{m[t]?.l}</Tag>
      },
    },
    { title: '预警时间', dataIndex: 'createdAt', width: 150 },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, r: AlertEvent) => (
        <div className="flex items-center gap-1">
          <Button type="link" size="small" icon={<EyeOutlined />} className="!text-[#03FBFD] hover:!text-white !p-0" onClick={() => { setSelectedAlert(r); setIsAlertModalVisible(true); alertEventApi.detail(Number(r.id)).then(res => { if (res.data) setSelectedAlert(toAlertEvent(res.data)) }).catch(() => {}) }}>详情</Button>
          {!isTown && r.status === 'pending' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} className="!text-[#52C41A] hover:!text-green-300 !p-0" onClick={() => confirmAlert(r.id)}>确认</Button>
          )}
          {!isTown && r.status === 'undispatched' && (
            <Button type="link" size="small" icon={<SendOutlined />} className="!text-[#1890FF] hover:!text-blue-300 !p-0" onClick={() => showDispatchModal(r)}>派发</Button>
          )}
          {!isTown && r.status !== 'closed' && r.status !== 'completed' && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} className="!p-0" onClick={() => closeAlert(r.id)}>清除</Button>
          )}
          {!isTown && (r.status === 'closed' || r.status === 'completed') && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} className="!p-0" onClick={() => deleteAlert(r.id)}>删除</Button>
          )}
        </div>
      ),
    },
  ]

  // 3. 处置任务管理列
  const taskCols = [
    { title: '任务ID', dataIndex: 'id', width: 70 },
    { title: '关联预警', dataIndex: 'alertId', width: 80 },
    { title: '任务类型', dataIndex: 'taskType', width: 90, render: (t: string) => taskTypeOptions.find(o => o.value === t)?.label || t },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (t: string) => {
        const m: Record<string, { l: string; c: string }> = {
          pending: { l: '待接收', c: 'orange' },
          received: { l: '已接收', c: 'blue' },
          processing: { l: '处置中', c: 'blue' },
          completed: { l: '已完成', c: 'green' },
        }
        return <Tag color={m[t]?.c}>{m[t]?.l}</Tag>
      },
    },
    { title: '处置人', dataIndex: 'assigneeName', width: 80, render: (t: string) => t || '未分配' },
    { title: '要求时间', dataIndex: 'requireTime', width: 150 },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, r: DisposalTask) => (
        <div className="flex items-center gap-1">
          <Button type="link" size="small" icon={<EyeOutlined />} className="!text-[#03FBFD] hover:!text-white !p-0" onClick={() => { setSelectedTask(r); setIsTaskModalVisible(true); disposalTaskApi.detail(Number(r.id)).then(res => { if (res.data) setSelectedTask(toDisposalTask(res.data)) }).catch(() => {}) }}>详情</Button>
          {!isTown && r.status === 'pending' && <Button type="link" size="small" icon={<CheckCircleOutlined />} className="!text-[#52C41A] hover:!text-green-300 !p-0" onClick={() => updateTaskStatus(r.id, 'received')}>接收</Button>}
          {!isTown && r.status === 'received' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} className="!text-[#1890FF] hover:!text-blue-300 !p-0" onClick={() => updateTaskStatus(r.id, 'processing')}>处置</Button>
              <Button type="link" size="small" icon={<SendOutlined />} className="!text-[#FA8C16] hover:!text-orange-300 !p-0" onClick={() => dispatchToTown(r)}>下派</Button>
            </>
          )}
          {r.status === 'completed' && r.disposalContent && (
            <Button type="link" size="small" icon={<EyeOutlined />} className="!text-[#03FBFD] hover:!text-white !p-0" onClick={() => { setSelectedTask(r); setIsDisposalModalVisible(true) }}>查看</Button>
          )}
          {!isTown && r.status === 'completed' && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} className="!p-0" onClick={() => deleteTask(r.id)}>删除</Button>
          )}
        </div>
      ),
    },
  ]

  const statusLabels: Record<string, string> = {
    undispatched: '待派发',
    pending: '待处置',
    processing: '处置中',
    completed: '已处置',
    closed: '已关闭',
  }
  const alertTrends = alerts.slice(0, 20).map(item => ({
    time: item.createdAt ? dayjs(item.createdAt).format('HH:mm') : '--:--',
    area: item.location || item.district || item.city || '杭州市',
    level: item.alertLevel,
    content: item.triggerReason,
    status: statusLabels[item.status] ?? item.status,
  }))
  const levelColorMap: Record<string, string> = { level1: '#FF4D4F', level2: '#FA8C16', level3: '#FAAD14', level4: '#1890FF' }
  const statusColorMap: Record<string, string> = { '待派发': '#FAAD14', '待处置': '#FA8C16', '处置中': '#1890FF', '已处置': '#52C41A', '已关闭': '#8C8C8C' }

  return (
    <div className="alert-page-container">
      {/* 返回行 - 紧凑上移 */}
      <div className="alert-header-bar">
        <div className="header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/monitor')}
            className="!text-[#03FBFD] hover:!text-white !px-2 !h-28px"
          >
            返回监控大屏
          </Button>
          <RegionSelector />
        </div>
      </div>

      {/* 标题 + Tabs + 按钮 同一行 */}
      <div className="alert-title-tabs-row" style={{ position: 'relative' }}>
        <div className="alert-center-title">
          <span className="title-diamond">◆</span>
          <span>预警中心</span>
          <span className="title-diamond">◆</span>
        </div>

        <div className="tech-tabs-bar">
          <div
            className={`tech-tab-item ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            预警规则管理
          </div>
          <div
            className={`tech-tab-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            实时预警监控
          </div>
          <div
            className={`tech-tab-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            处置任务管理
          </div>
          <div
            className={`tech-tab-item ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            区域预警实时动向
          </div>
        </div>

        <div className="header-right-btn">
          {activeTab === 'rules' && !isTown && (
            <div className="flex items-center gap-2">
              <Button icon={<DownloadOutlined />} onClick={() => void handleDownloadTemplate()}>模板下载</Button>
              <Button icon={<ImportOutlined />} loading={ruleImporting} onClick={() => ruleImportInputRef.current?.click()}>导入</Button>
              <Button icon={<ExportOutlined />} onClick={() => void handleExportRules()}>导出</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showAddRuleModal}
                style={{
                  background: 'linear-gradient(90deg, #1890ff 0%, #03fbfd 100%)',
                  borderColor: '#03fbfd',
                  fontWeight: 600,
                  boxShadow: '0 0 10px rgba(3, 251, 253, 0.3)',
                }}
              >
                新增预警规则
              </Button>
              {/* 隐藏的导入文件选择框 */}
              <input
                ref={ruleImportInputRef}
                type="file"
                accept=".xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportRules(file)
                  e.target.value = ''
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 表格 / 内容区域 */}
      <div className="tech-table-wrapper">
        {activeTab === 'rules' && (
          <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2">
            <Input
              className="model_from_input !w-200px"
              placeholder="搜索规则名称"
              value={ruleSearchName}
              onChange={e => setRuleSearchName(e.target.value)}
              onPressEnter={() => applyRuleSearch()}
              allowClear
              onClear={() => applyRuleSearch('')}
              suffix={<SearchOutlined className="text-[#03FBFD] cursor-pointer" onClick={() => applyRuleSearch()} />}
            />
            <Select
              className="!w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选接入类型"
              value={ruleFilterDataType}
              onChange={v => { setRuleFilterDataType(v); setRulesPage(1) }}
              options={dataTypeOptions}
              allowClear
            />
            <Select
              className="!w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选规则类型"
              value={ruleFilterType}
              onChange={v => { setRuleFilterType(v); setRulesPage(1) }}
              options={ruleTypeOptions}
              allowClear
            />
            <Select
              className="!w-150px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选预警级别"
              value={ruleFilterLevel}
              onChange={v => { setRuleFilterLevel(v); setRulesPage(1) }}
              options={alertLevelOptions}
              allowClear
            />
            <Select
              className="!w-130px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选状态"
              value={ruleFilterEnabled}
              onChange={v => { setRuleFilterEnabled(v); setRulesPage(1) }}
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '禁用' },
              ]}
              allowClear
            />
          </div>
        )}
        {activeTab === 'alerts' && (
          <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2">
            <Input
              className="model_from_input !w-200px"
              placeholder="搜索设备/数据源名称"
              value={alertSearchDevice}
              onChange={e => setAlertSearchDevice(e.target.value)}
              onPressEnter={() => applyAlertSearch()}
              allowClear
              onClear={() => applyAlertSearch('')}
              suffix={<SearchOutlined className="text-[#03FBFD] cursor-pointer" onClick={() => applyAlertSearch()} />}
            />
            <Select
              className="!w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选接入类型"
              value={alertFilterDataType}
              onChange={v => { setAlertFilterDataType(v); setAlertsPage(1) }}
              options={dataTypeOptions}
              allowClear
            />
            <Select
              className="!w-150px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选预警级别"
              value={alertFilterLevel}
              onChange={v => { setAlertFilterLevel(v); setAlertsPage(1) }}
              options={alertLevelOptions}
              allowClear
            />
            <Select
              className="!w-150px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选处置状态"
              value={alertFilterStatus}
              onChange={v => { setAlertFilterStatus(v); setAlertsPage(1) }}
              options={[
                { value: 'undispatched', label: '待派发' },
                { value: 'pending', label: '待处置' },
                { value: 'processing', label: '处置中' },
                { value: 'completed', label: '已处置' },
                { value: 'closed', label: '已关闭' },
              ]}
              allowClear
            />
          </div>
        )}
        {activeTab === 'tasks' && (
          <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2">
            <Select
              className="!w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选接入类型"
              value={taskFilterDataType}
              onChange={v => { setTaskFilterDataType(v); setTasksPage(1) }}
              options={dataTypeOptions}
              allowClear
            />
            <Select
              className="!w-160px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选任务类型"
              value={taskFilterType}
              onChange={v => { setTaskFilterType(v); setTasksPage(1) }}
              options={taskTypeOptions}
              allowClear
            />
            <Select
              className="!w-150px model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
              placeholder="筛选处置状态"
              value={taskFilterStatus}
              onChange={v => { setTaskFilterStatus(v); setTasksPage(1) }}
              options={[
                { value: 'pending', label: '待接收' },
                { value: 'received', label: '已接收' },
                { value: 'processing', label: '处置中' },
                { value: 'completed', label: '已完成' },
              ]}
              allowClear
            />
          </div>
        )}
        {activeTab === 'rules' && (
          <Table
            dataSource={rules}
            columns={ruleCols}
            rowKey="id"
            loading={loading}
            pagination={{
              current: rulesPage,
              pageSize: rulesSize,
              total: rulesTotal,
              showSizeChanger: true,
              onChange: (page, size) => { setRulesPage(page); setRulesSize(size) },
            }}
            size="small"
            scroll={{ x: 1000 }}
          />
        )}
        {activeTab === 'alerts' && (
          <Table
            dataSource={alerts}
            columns={alertCols}
            rowKey="id"
            loading={loading}
            pagination={{
              current: alertsPage,
              pageSize: alertsSize,
              total: alertsTotal,
              showSizeChanger: true,
              onChange: (page, size) => { setAlertsPage(page); setAlertsSize(size) },
            }}
            size="small"
            scroll={{ x: 950 }}
          />
        )}
        {activeTab === 'tasks' && (
          <Table
            dataSource={tasks}
            columns={taskCols}
            rowKey="id"
            loading={loading}
            pagination={{
              current: tasksPage,
              pageSize: tasksSize,
              total: tasksTotal,
              showSizeChanger: true,
              onChange: (page, size) => { setTasksPage(page); setTasksSize(size) },
            }}
            size="small"
            scroll={{ x: 900 }}
          />
        )}
        {activeTab === 'trends' && (
          <div className="space-y-3 p-4">
            {alertTrends.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3.5 rounded-lg"
                style={{
                  backgroundColor: 'rgba(3,251,253,0.04)',
                  border: '1px solid rgba(3,251,253,0.15)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: (levelColorMap[item.level] || '#FA8C16') + '22',
                    border: `2px solid ${levelColorMap[item.level] || '#FA8C16'}`,
                  }}
                >
                  <AlertFilled style={{ color: levelColorMap[item.level] || '#FA8C16', fontSize: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/90 text-14px font-medium">{item.area}</span>
                    <span
                      className="text-12px px-2 py-0.5 rounded font-semibold"
                      style={{ color: levelColorMap[item.level] || '#FA8C16', border: `1px solid ${levelColorMap[item.level] || '#FA8C16'}` }}
                    >
                      {alertLevelOptions.find(o => o.value === item.level)?.label || '预警'}
                    </span>
                  </div>
                  <div className="text-white/60 text-12px mt-1 truncate">{item.content}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-12px font-medium" style={{ color: statusColorMap[item.status] || '#1890FF' }}>{item.status}</div>
                  <div className="text-white/40 text-11px mt-1">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增/编辑规则弹窗 */}
      <Modal
        title={<span className="alert-rule-modal-title">{isTown ? '查看预警规则' : editingRule ? '编辑预警规则' : '新增预警规则'}</span>}
        open={isRuleModalVisible}
        onCancel={() => { setIsRuleModalVisible(false); form.resetFields() }}
        width={840}
        className="alert-rule-modal"
        footer={isTown
          ? <Button onClick={() => { setIsRuleModalVisible(false); form.resetFields() }}>关闭</Button>
          : [
              <Button key="cancel" onClick={() => { setIsRuleModalVisible(false); form.resetFields() }}>取消</Button>,
              <Button key="ok" type="primary" onClick={handleRuleOk}>确定</Button>,
            ]}
      >
        <Form
          form={form}
          disabled={isTown}
          layout="horizontal"
          labelCol={{ style: { width: 110, textAlign: 'right', color: '#03FBFD', paddingRight: 12 } }}
          className="alert-rule-form pt-2"
        >
          <Form.Item label="规则名称" name="ruleName" rules={[{ required: true, message: '请输入' }]}>
            <Input className="model_from_input" placeholder="请输入规则名称" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="数据类型" name="dataType" rules={[{ required: true, message: '请选择' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择" onChange={(v: string) => { setSelectedDataType(v); form.setFieldsValue({ fieldName: '' }) }}>
                {dataTypeOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="监测字段" name="fieldName" rules={[{ required: true, message: '请选择' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择">
                {selectedDataType && fieldOptions[selectedDataType]?.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="规则类型" name="ruleType" rules={[{ required: true, message: '请选择' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择">
                {ruleTypeOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
              </Select>
            </Form.Item>

            {(watchedRuleType === 'threshold' || watchedRuleType === 'change_rate') && (
              <Form.Item label="间隔时间" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="ruleTimeWindow" noStyle rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} className="model_from_input" placeholder="分钟" />
                  </Form.Item>
                  <span className="flex items-center px-2 h-32px text-white/60 bg-white/5 border border-l-0 border-white/10 rounded-r shrink-0">分</span>
                </Space.Compact>
              </Form.Item>
            )}
          </div>

          <Form.Item noStyle shouldUpdate={(p, c) => p.ruleType !== c.ruleType}>
            {() => {
              const rt = form.getFieldValue('ruleType')
              if (rt === 'threshold' || rt === 'change_rate') {
                return (
                  <div className="grid grid-cols-2 gap-x-2">
                    <Form.Item label={rt === 'threshold' ? '阈值' : '变化率'} required>
                      <div className="grid grid-cols-[1.2fr_1fr] gap-2">
                        <Form.Item name="operator" noStyle rules={[{ required: true, message: '请选择' }]}>
                          <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="比较符">
                            <Option value=">">大于&gt;</Option>
                            <Option value="<">小于&lt;</Option>
                            <Option value=">=">大于等于&ge;</Option>
                            <Option value="<=">小于等于&le;</Option>
                          </Select>
                        </Form.Item>
                        <Form.Item name="threshold" noStyle rules={[{ required: true, message: '请输入' }]}>
                          <InputNumber step={1} className="w-full model_from_input" placeholder="数值" />
                        </Form.Item>
                      </div>
                    </Form.Item>
                    <div />
                  </div>
                )
              }
              if (rt === 'continuous') {
                return (
                  <div className="grid grid-cols-2 gap-x-2">
                    <Form.Item label="连续配置" required>
                      <div className="grid grid-cols-2 gap-2">
                        <Form.Item name="count" noStyle rules={[{ required: true, message: '请输入' }]}>
                          <InputNumber step={1} className="w-full model_from_input" placeholder="次数" />
                        </Form.Item>
                        <Form.Item name="interval" noStyle rules={[{ required: true, message: '请输入' }]}>
                          <InputNumber step={1} className="w-full model_from_input" placeholder="间隔(分)" />
                        </Form.Item>
                      </div>
                    </Form.Item>
                    <div />
                  </div>
                )
              }
              if (rt === 'offline') {
                return (
                  <div className="grid grid-cols-2 gap-x-2">
                    <Form.Item label="离线时长" name="offlineTime" rules={[{ required: true, message: '请输入' }]}>
                      <InputNumber step={1} className="w-full model_from_input" placeholder="离线(分)" />
                    </Form.Item>
                    <div />
                  </div>
                )
              }
              return null
            }}
          </Form.Item>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="优先级" name="priority" rules={[{ required: true, message: '请输入' }]}>
              <InputNumber min={1} max={10} step={1} className="w-full model_from_input" placeholder="数值" />
            </Form.Item>
            <Form.Item label="预警级别" name="alertLevel" rules={[{ required: true, message: '请选择' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择">
                {alertLevelOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="目标地市" name="targetCityId" rules={[{ required: true, message: '请选择' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder="请选择目标地市"
                disabled={!canSelectRegion}
                showSearch
                optionFilterProp="label"
                onChange={() => { form.setFieldsValue({ targetDistrictId: undefined, targetTownId: undefined }) }}
                options={cityOptions}
              />
            </Form.Item>
            <Form.Item label="目标区县" name="targetDistrictId" rules={[{ required: true, message: '请选择' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={targetCityId ? '请选择目标区县' : '请先选择地市'}
                disabled={roleLevel === 'county' || roleLevel === 'town' || !targetCityId}
                showSearch
                optionFilterProp="label"
                onChange={() => {
                  form.setFieldsValue({ targetTownId: undefined })
                }}
                options={districtOptions}
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="是否直接下发" name="autoDispatch" rules={[{ required: true, message: '请选择' }]}>
              <Radio.Group className="flex items-center gap-4 h-8">
                <Radio value={true} className="!text-white">是</Radio>
                <Radio value={false} className="!text-white">否</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.targetDistrictId !== c.targetDistrictId}>
              {() => {
                const districtVal = form.getFieldValue('targetDistrictId')
                const isAllDistrict = districtVal === 'all'
                return (
                  <Form.Item label="目标乡镇" name="targetTownId">
                    <Select
                      className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                      mode="multiple"
                      placeholder={isAllDistrict ? '区县已选全部' : (districtVal ? '请选择目标乡镇' : '请先选择区县')}
                      disabled={roleLevel === 'town' || !districtVal || isAllDistrict}
                      showSearch
                      optionFilterProp="label"
                      maxTagCount="responsive"
                      onChange={(vals: string[]) => {
                        if (vals.includes('all') && vals.length > 1) {
                          const prev = form.getFieldValue('targetTownId') || []
                          if (!prev.includes('all')) {
                            form.setFieldsValue({ targetTownId: ['all'] })
                          } else {
                            form.setFieldsValue({ targetTownId: vals.filter(v => v !== 'all') })
                          }
                        }
                      }}
                      options={targetTownOptions}
                    />
                  </Form.Item>
                )
              }}
            </Form.Item>
          </div>

          <Form.Item label="描述" name="description">
            <Input.TextArea className="model_from_input" rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 预警详情 Modal */}
      <Modal title={<span className="text-[#03FBFD] font-bold">预警详情</span>} open={isAlertModalVisible} onCancel={() => setIsAlertModalVisible(false)} width={550} footer={null} styles={{ body: { padding: '20px 24px' } }}>
        {selectedAlert && (
          <div className="space-y-2 p-3 rounded" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            {[['预警ID', selectedAlert.id], ['规则', selectedAlert.ruleName], ['设备', selectedAlert.deviceName], ['位置', selectedAlert.location], ['时间', selectedAlert.createdAt], ['原因', selectedAlert.triggerReason]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-[#03FBFD]">{k}</span><span className="text-white/75 text-right max-w-[60%]">{v}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-[#03FBFD]">级别</span><Tag color={alertLevelOptions.find(o => o.value === selectedAlert.alertLevel)?.color}>{alertLevelOptions.find(o => o.value === selectedAlert.alertLevel)?.label}</Tag></div>
          </div>
        )}
      </Modal>

      {/* 派发任务 Modal */}
      <Modal
        title={<span className="alert-rule-modal-title">派发处置任务</span>}
        open={isDispatchModalVisible}
        onCancel={() => setIsDispatchModalVisible(false)}
        width={720}
        className="alert-rule-modal"
        footer={[
          <Button key="cancel" onClick={() => setIsDispatchModalVisible(false)}>取消</Button>,
          <Button key="ok" type="primary" loading={dispatchSubmitting} onClick={handleDispatchOk}>确定</Button>,
        ]}
      >
        {dispatchAlert && (
          <div className="flex items-center gap-4 mb-2 p-2 rounded text-sm" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            <span className="text-[#03FBFD]">预警 #{dispatchAlert.id}</span>
            <span className="text-white/80">{dispatchAlert.ruleName}</span>
            <span className="text-white/60">{dispatchAlert.deviceName}</span>
          </div>
        )}
        <Form
          form={dispatchForm}
          layout="horizontal"
          labelCol={{ style: { width: 90, textAlign: 'right', color: '#03FBFD', paddingRight: 10 } }}
          className="alert-rule-form pt-2"
        >
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="任务类型" name="taskType" rules={[{ required: true, message: '请选择任务类型' }]}>
              <Select className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }} placeholder="请选择任务类型" options={taskTypeOptions} />
            </Form.Item>
            <Form.Item label="地市" name="cityId" rules={[{ required: true, message: '请选择地市' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder="请选择地市"
                disabled={!canSelectRegion}
                showSearch
                optionFilterProp="label"
                options={cityOptions}
                onChange={() => dispatchForm.setFieldsValue({ districtId: undefined, townId: undefined, assigneeId: undefined })}
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="区县" name="districtId" rules={[{ required: true, message: '请选择区县' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={dispatchCityId ? '请选择区县' : '请先选择地市'}
                disabled={roleLevel === 'county' || roleLevel === 'town' || !dispatchCityId}
                showSearch
                optionFilterProp="label"
                options={dispatchDistrictOptions}
                onChange={() => dispatchForm.setFieldsValue({ townId: undefined, assigneeId: undefined })}
              />
            </Form.Item>
            <Form.Item label="乡镇" name="townId" rules={[{ required: true, message: '请选择乡镇' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={dispatchDistrictId ? '请选择乡镇' : '请先选择区县'}
                disabled={roleLevel === 'town' || !dispatchDistrictId}
                showSearch
                optionFilterProp="label"
                options={dispatchTownOptions}
                onChange={value => { dispatchForm.setFieldsValue({ assigneeId: undefined }); void loadTownUsers(value) }}
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <Form.Item label="处置人" name="assigneeId" rules={[{ required: true, message: '请选择处置人' }]}>
              <Select
                className="model_from_sel" classNames={{ popup: { root: 'alert-rule-dropdown' } }}
                placeholder={dispatchTownId ? '请选择处置人员' : '请先选择乡镇'}
                disabled={!dispatchTownId}
                showSearch
                optionFilterProp="label"
                options={townUserOptions}
              />
            </Form.Item>
            <Form.Item label="要求完成时间" name="requireTime" rules={[{ required: true, message: '请选择要求完成时间' }]}>
              <DatePicker
                className="model_from_input w-full"
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择时间"
              />
            </Form.Item>
          </div>
          <Form.Item label="处置内容" name="disposalContent">
            <Input.TextArea className="model_from_input" rows={2} placeholder="请输入处置要求说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情 Modal */}
      <Modal title={<span className="text-[#03FBFD] font-bold">任务详情</span>} open={isTaskModalVisible} onCancel={() => setIsTaskModalVisible(false)} width={550} footer={null} styles={{ body: { padding: '20px 24px' } }}>
        {selectedTask && (
          <div className="space-y-2 p-3 rounded" style={{ backgroundColor: 'rgba(3,251,253,0.05)', border: '1px solid rgba(3,251,253,0.15)' }}>
            {[['任务ID', selectedTask.id], ['关联预警', selectedTask.alertId], ['类型', taskTypeOptions.find(o => o.value === selectedTask.taskType)?.label || ''], ['处置人', selectedTask.assigneeName || '未分配'], ['派发人', selectedTask.requesterName], ['要求时间', selectedTask.requireTime]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-[#03FBFD]">{k}</span><span className="text-white/75">{v}</span></div>
            ))}
            {selectedTask.disposalContent && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(3,251,253,0.15)' }}>
                <span className="text-[#03FBFD] block mb-1">处置内容</span>
                <p className="text-white/75">{selectedTask.disposalContent}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 查看处置 Modal */}
      <Modal title={<span className="text-[#03FBFD] font-bold">查看处置</span>} open={isDisposalModalVisible} onCancel={() => setIsDisposalModalVisible(false)} width={600} footer={null} styles={{ body: { padding: '20px 24px' } }}>
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <span className="text-[#03FBFD] block mb-2">处置内容</span>
              <div className="p-3 rounded text-white/75" style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(3,251,253,0.15)' }}>{selectedTask.disposalContent}</div>
            </div>
            {selectedTask.photos && (
              <div>
                <span className="text-[#03FBFD] block mb-2">现场照片</span>
                <div className="flex gap-3">
                  {selectedTask.photos.map((_, i) => (
                    <div key={i} className="w-20 h-20 rounded flex items-center justify-center border text-white/50" style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'rgba(3,251,253,0.2)' }}>
                      <SearchOutlined className="text-xl" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedTask.completedAt && (
              <div className="flex justify-between">
                <span className="text-[#03FBFD]">完成时间</span>
                <span className="text-white/75">{selectedTask.completedAt}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
