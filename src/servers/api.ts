import { request } from './request'
import type { DeptListResponse, GetInfoResponse, RoleListResponse, UserListResponse } from '@/types/auth'

// 登录（新后端需要验证码 code + uuid）
export function login(data: { username: string; password: string; code: string; uuid: string }) {
  return request.post('/dpSys/login', data)
}

// 获取验证码
export function captchaImage() {
  return request.get('/dpSys/captchaImage')
}

// 当前登录用户、角色与部门
export function getInfo() {
  return request.get('/dpSys/getInfo') as unknown as Promise<GetInfoResponse>
}

export function deptList(params?: object) {
  return request.get('/dpSys/system/dept/list', { params }) as unknown as Promise<DeptListResponse>
}

// 用户分页列表（可按 deptId 查询指定部门下用户，依那 TableDataInfo 返回 rows/total）
export function userList(params?: object) {
  return request.get('/dpSys/system/user/list', { params }) as unknown as Promise<UserListResponse>
}

export function roleList(params?: object) {
  return request.get('/dpSys/system/role/list', { params }) as unknown as Promise<RoleListResponse>
}

// 部署总数
export function deployNum() {
  return request.get('/dpSys/hbdp/main/deployNum')
}

// 雷达报警统计
export function leiDaBaojingTongji(params?: object) {
  return request.get('/dpSys/hbdp/main/leiDaBaojingTongji', { params })
}

// 雷达部署情况
export function leiDaDeploySituation(params?: object) {
  return request.get('/dpSys/hbdp/main/leiDaDeploySituation', { params })
}

// 无人机部署情况
export function wuRenJiDeploySituation(params?: object) {
  return request.get('/dpSys/hbdp/main/wuRenJiDeploySituation', { params })
}

// 走航车部署情况
export function zouHangCheDeploySituation(params?: object) {
  return request.get('/dpSys/hbdp/main/zouHangCheDeploySituation', { params })
}

// 因子指标查询
export function getFactorIndex() {
  return request.get('/dpSys/hbdp/zouhang/getFactorIndex')
}

// 因子指标保存
export function saveFactorIndex(data: object) {
  return request.post('/dpSys/hbdp/zouhang/saveFactorIndex', data)
}

// 测试接口
export function test() {
  return request.get('/dpSys/hbdp/LeidaZhandain/test')
}

// ============ 数据清洗规则（对应后端 /hbdp/cleanRule） ============
export function cleanRuleList() {
  return request.get('/dpSys/hbdp/cleanRule/list')
}
export function cleanRuleAdd(data: object) {
  return request.post('/dpSys/hbdp/cleanRule', data)
}
export function cleanRuleEdit(data: object) {
  return request.put('/dpSys/hbdp/cleanRule', data)
}
export function cleanRuleRemove(ids: string | number) {
  return request.delete(`/dpSys/hbdp/cleanRule/${ids}`)
}
export function cleanRuleChangeStatus(data: object) {
  return request.put('/dpSys/hbdp/cleanRule/changeStatus', data)
}

// ============ 污染源（对应后端 /hbdp/wuranyuan） ============
export function wuranyuanPage(params: { pageNo: number; pageSize: number } & Record<string, unknown>) {
  return request.get('/dpSys/hbdp/wuranyuan/page', { params })
}
export function wuranyuanAdd(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/add', data)
}
export function wuranyuanEdit(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/edit', data)
}
export function wuranyuanDelete(data: object) {
  return request.post('/dpSys/hbdp/wuranyuan/delete', data)
}
