import { request } from './request'

// 登录
export function login(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params)
  return request.post('/dpSys/login?' + searchParams.toString())
}

// 用户权限查询
export function getUserPermission() {
  return request.post('/dpSys/userPermission')
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
