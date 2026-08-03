export type RoleLevel = 'admin' | 'city' | 'county' | 'town'

export interface RoleInfo {
  roleId?: number
  roleName?: string
  roleKey: string
  status?: string
}

export interface DeptInfo {
  deptId: number
  parentId?: number
  ancestors?: string
  deptName: string
  status?: string
  children?: DeptInfo[]
}

export interface UserInfo {
  userId: number
  userName: string
  nickName?: string
  deptId?: number | null
  dept?: DeptInfo | null
  roles?: RoleInfo[]
}

export interface GetInfoResponse {
  code: number
  msg?: string
  user: UserInfo
  roles?: string[]
  permissions?: string[]
}

export interface DeptListResponse {
  code: number
  msg?: string
  data?: DeptInfo[]
}

export interface SysUserItem {
  userId: number
  deptId?: number
  userName: string
  nickName?: string
  phonenumber?: string
  status?: string
}

export interface UserListResponse {
  code: number
  msg?: string
  total?: number
  rows?: SysUserItem[]
}

export interface RoleListResponse {
  code: number
  msg?: string
  rows?: RoleInfo[]
  total?: number
}
