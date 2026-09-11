import { disposalTaskApi } from '@/servers/business'
import { requireSuccess } from '@/servers/alertFollowUp'
import type { DisposalTaskDTO } from '@/types/business'

export const canCollectEvidence = (status: string) => ['undispatched', 'pending', 'processing'].includes(status)
export const canEditSiteResult = (status: string) => ['pending', 'processing'].includes(status)

export async function loadSiteTasks(alertId: string): Promise<DisposalTaskDTO[]> {
  const tasks: DisposalTaskDTO[] = []
  let page = 1
  while (true) {
    const data = requireSuccess(await disposalTaskApi.list({ alertId: Number(alertId), pageNum: page++, pageSize: 100 }))
    tasks.push(...data.records)
    if (!data.records.length || tasks.length >= data.total) break
  }
  return tasks.filter(task => canEditSiteResult(task.status))
}

/** 保存核查结果草稿，保留最新任务的状态、照片、人员及区域，避免把填写结果当作完成任务。 */
export async function saveSiteResult(taskId: number, alertId: string, content: string) {
  const current = requireSuccess(await disposalTaskApi.detail(taskId))
  if (!current || String(current.alertId) !== alertId || !canEditSiteResult(current.status)) {
    throw new Error('关联任务状态已变化，请重新打开取证弹窗')
  }
  requireSuccess(await disposalTaskApi.edit({ ...current, disposalContent: content }))
}
/** 自动保存必须成功后才能派发，保存失败时保留编辑会话。 */
export async function saveBeforeDispatch(changed: boolean, save: () => Promise<boolean>, dispatch: () => void): Promise<void> {
  if (changed && !await save()) return
  dispatch()
}
