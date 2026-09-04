import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Select, Switch, Table, App } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  PlusOutlined,
  DownloadOutlined,
  ImportOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDebounce } from '@/hooks/useDebounce'
import { warningRuleApi } from '@/servers/business'
import type { WarningRuleExportQuery } from '@/types/business'
import RuleModal, {
  type AlertRule,
  type RuleMode,
  type RoleLevel,
  type LockedRegion,
  type DeptRegionOptions,
  toAlertRule as toAlertRuleDTO,
} from '../modals/RuleModal'
import {
  DATA_TYPE_OPTIONS,
  RULE_TYPE_OPTIONS,
  ALERT_LEVEL_OPTIONS,
  FIELD_OPTIONS,
} from './shared/tabConstants'

interface RuleTabProps {
  /** 当前用户角色级别：'town' 时不允许新增/编辑/启用切换 */
  isTown: boolean
  /** 当前选择区域（用于表格列展示 target city 名称的回退） */
  selectionCityName?: string
  /** add/edit/copy 按钮可点状态（一般同 !isTown） */
  canEditRule: boolean
  /** 父组件提供的地市选项（来自 deptRegionOptions） */
  cityOptions: { value: string; label: string }[]
  /** 角色级别（传给 RuleModal） */
  roleLevel: RoleLevel
  /** 是否可自主选择目标区域（传给 RuleModal） */
  canSelectRegion: boolean
  /** 当前用户所属区域（传给 RuleModal） */
  lockedRegion: LockedRegion
  /** 部门区域选项（传给 RuleModal） */
  deptRegionOptions: DeptRegionOptions
}

export default function RuleTab({
  isTown,
  selectionCityName,
  canEditRule,
  cityOptions,
  roleLevel,
  canSelectRegion,
  lockedRegion,
  deptRegionOptions,
}: RuleTabProps) {
  const { message, modal } = App.useApp()

  // 数据 + 分页
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(false)
  const [rulesPage, setRulesPage] = useState(1)
  const [rulesSize, setRulesSize] = useState(15)
  const [rulesTotal, setRulesTotal] = useState(0)

  // 搜索 + 筛选
  const [ruleSearchName, setRuleSearchName] = useState('')
  const [ruleAppliedName, setRuleAppliedName] = useState('')
  const [ruleFilterDataType, setRuleFilterDataType] = useState<string | undefined>(undefined)
  const [ruleFilterType, setRuleFilterType] = useState<string | undefined>(undefined)
  const [ruleFilterLevel, setRuleFilterLevel] = useState<string | undefined>(undefined)
  const [ruleFilterEnabled, setRuleFilterEnabled] = useState<0 | 1 | undefined>(undefined)

  // 工具栏状态
  const [ruleImporting, setRuleImporting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const ruleImportInputRef = useRef<HTMLInputElement>(null)

  // RuleModal 控制
  const [ruleModal, setRuleModal] = useState<{
    open: boolean
    mode: RuleMode
    sourceRule: AlertRule | null
  }>({ open: false, mode: 'add', sourceRule: null })
  const openRuleModal = (mode: RuleMode, sourceRule: AlertRule | null = null) =>
    setRuleModal({ open: true, mode, sourceRule })
  const closeRuleModal = () => setRuleModal({ open: false, mode: 'add', sourceRule: null })

  // 数据加载
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
      setRules((response.data?.records ?? []).map(toAlertRuleDTO))
      setRulesTotal(response.data?.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [
    rulesPage,
    rulesSize,
    ruleAppliedName,
    ruleFilterDataType,
    ruleFilterType,
    ruleFilterLevel,
    ruleFilterEnabled,
  ])

  useEffect(() => {
    queueMicrotask(() => void loadRules())
  }, [loadRules])

  // 搜索框 300ms 防抖（修改即触发，无需回车/查询按钮）
  const debouncedRuleSearch = useDebounce(ruleSearchName, 300)
  useEffect(() => {
    setRuleAppliedName(debouncedRuleSearch.trim())
    setRulesPage(1)
  }, [debouncedRuleSearch])

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

  // 工具栏：下载 Blob（模板/导出共用）
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
    setTemplateDownloading(true)
    try {
      const res = await warningRuleApi.importTemplate()
      const blob = res as unknown as Blob
      if (await isJsonErrorBlob(blob)) return
      downloadBlob(blob, '预警规则导入模板.xlsx')
    } catch {
      message.error('模板下载失败')
    } finally {
      setTemplateDownloading(false)
    }
  }

  const handleExportRules = async () => {
    setExportLoading(true)
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
    } finally {
      setExportLoading(false)
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

  // 列定义
  const ruleCols: TableColumnsType<AlertRule> = [
    { title: '规则名称', dataIndex: 'ruleName', width: 170 },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      width: 130,
      render: (t: string) => DATA_TYPE_OPTIONS.find((o) => o.value === t)?.label || t,
    },
    {
      title: '监测字段',
      dataIndex: 'fieldName',
      width: 90,
      render: (t: string, r: AlertRule) =>
        FIELD_OPTIONS[r.dataType]?.find((o) => o.value === t)?.label || t,
    },
    {
      title: '规则类型',
      dataIndex: 'ruleType',
      width: 120,
      render: (t: string) => RULE_TYPE_OPTIONS.find((o) => o.value === t)?.label || t,
    },
    {
      title: '预警级别',
      dataIndex: 'alertLevel',
      width: 95,
      render: (t: string) => {
        const item = ALERT_LEVEL_OPTIONS.find((o) => o.value === t) || {
          label: '二级预警',
          color: '#FA8C16',
        }
        const cls =
          item.label.includes('一') || t === '1' || t === 'red'
            ? 'level-1'
            : item.label.includes('二') || t === '2' || t === 'orange'
              ? 'level-2'
              : item.label.includes('三') || t === '3' || t === 'yellow'
                ? 'level-3'
                : 'level-4'
        return (
          <span className={`pill-badge ${cls}`}>
            <span className="pill-dot" />
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
        const matched = cityOptions.find((c) => Number(c.value) === Number(t))
        return matched ? matched.label : selectionCityName || '杭州市'
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
            onChange={() => void toggleRule(r.id, t)}
          />
          <span style={{ color: t ? '#03FBFD' : 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            {t ? '启用' : '禁用'}
          </span>
        </div>
      ),
    },
    {
      title: '操作',
      width: isTown ? 80 : 180,
      align: 'center' as const,
      render: (_: unknown, r: AlertRule) =>
        isTown ? (
          <button
            type="button"
            className="tech-action-btn btn-detail"
            onClick={() => openRuleModal('edit', r)}
          >
            查看
          </button>
        ) : (
          <div className="flex items-center gap-1.5 justify-center whitespace-nowrap">
            <button
              type="button"
              className="tech-action-btn btn-detail"
              onClick={() => openRuleModal('edit', r)}
            >
              编辑
            </button>
            <button
              type="button"
              className="tech-action-btn btn-success"
              onClick={() => openRuleModal('copy', r)}
            >
              复制
            </button>
            <button
              type="button"
              className="tech-action-btn btn-danger"
              onClick={() => handleDeleteRule(r.id)}
            >
              删除
            </button>
          </div>
        ),
    },
  ]

  return (
    <>
      {/* 工具栏 + 筛选同一行：搜索/筛选左，按钮组右 */}
      <div className="flex items-center gap-3 flex-shrink-0 px-2 pt-2 pb-3">
        <Input
          className="model_from_input !w-200px"
          placeholder="搜索规则名称"
          value={ruleSearchName}
          onChange={(e) => setRuleSearchName(e.target.value)}
          allowClear
        />
        <Select
          className="!w-160px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选接入类型"
          value={ruleFilterDataType}
          onChange={(v) => {
            setRuleFilterDataType(v)
            setRulesPage(1)
          }}
          options={DATA_TYPE_OPTIONS}
          allowClear
        />
        <Select
          className="!w-160px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选规则类型"
          value={ruleFilterType}
          onChange={(v) => {
            setRuleFilterType(v)
            setRulesPage(1)
          }}
          options={RULE_TYPE_OPTIONS}
          allowClear
        />
        <Select
          className="!w-150px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选预警级别"
          value={ruleFilterLevel}
          onChange={(v) => {
            setRuleFilterLevel(v)
            setRulesPage(1)
          }}
          options={ALERT_LEVEL_OPTIONS}
          allowClear
        />
        <Select
          className="!w-130px model_from_sel"
          classNames={{ popup: { root: 'alert-rule-dropdown' } }}
          placeholder="筛选状态"
          value={ruleFilterEnabled}
          onChange={(v) => {
            setRuleFilterEnabled(v)
            setRulesPage(1)
          }}
          options={[
            { value: 1, label: '启用' },
            { value: 0, label: '禁用' },
          ]}
          allowClear
        />
        <div className="flex-1" />
        {!isTown && (
          <div className="flex items-center gap-2">
            <Button
              icon={<DownloadOutlined />}
              loading={templateDownloading}
              onClick={() => void handleDownloadTemplate()}
            >
              模板下载
            </Button>
            <Button
              icon={<ImportOutlined />}
              loading={ruleImporting}
              onClick={() => ruleImportInputRef.current?.click()}
            >
              导入
            </Button>
            <Button
              icon={<ExportOutlined />}
              loading={exportLoading}
              onClick={() => void handleExportRules()}
            >
              导出
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                if (!canEditRule) return
                openRuleModal('add')
              }}
            >
              新增预警规则
            </Button>
            <input
              ref={ruleImportInputRef}
              type="file"
              accept=".xls,.xlsx"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImportRules(file)
                e.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      {/* 表格 */}
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
          onChange: (page, size) => {
            setRulesPage(page)
            setRulesSize(size)
          },
        }}
        size="small"
        scroll={{ x: 1000 }}
      />

      {/* RuleModal（自管，按规则 modal 控制 state 渲染） */}
      <RuleModal
        open={ruleModal.open}
        mode={ruleModal.mode}
        sourceRule={ruleModal.sourceRule}
        onClose={closeRuleModal}
        onSaved={loadRules}
        roleLevel={roleLevel}
        canSelectRegion={canSelectRegion}
        lockedRegion={lockedRegion}
        deptRegionOptions={deptRegionOptions}
        dataTypeOptions={DATA_TYPE_OPTIONS}
        ruleTypeOptions={RULE_TYPE_OPTIONS}
        alertLevelOptions={ALERT_LEVEL_OPTIONS}
        fieldOptions={FIELD_OPTIONS}
      />
    </>
  )
}
