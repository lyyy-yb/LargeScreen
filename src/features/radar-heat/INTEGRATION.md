# 2026-09-06 真实接口对接

已删除生产目录的空气和雷达模拟数据生成器，接口空数据或失败不回退模拟值。离线测试仅保留协议校验用固定输入，不参与运行时打包。

## 已接入

- 空气质量 `/hbdp/airData/series`：只传 resolution=minute/hour/day、startTime、endTime。统一供地图、热力和选定范围趋势使用。分钟最多60个、小时48个、日31个时段；缺测保持 null，零值保留，GCJ02 坐标直接使用。
- `/hbdp/airData/microStationAvg`：上一完整小时的可见微站均值，不再前端平均 latest。页面浓度为真实数据；已移除模拟评级，接口未提供真实浓度等级阈值时显示“等级待配置”。
- `/hbdp/radarSps/periods` + `/detail`：雷达默认展示最新存储周期；首页每60秒查询，隐藏/卸载时停止。不伪造实时扫描射线，当前 Swagger 未提供实时 SSE。
- `/hbdp/radar/playback`：fetch SSE，通过应用登录态 Authorization 请求头鉴权。支持跨块、多行消息和 type=end 结束事件；每次只交付完整周期。流中断、认证失败、后台错误明确提示，不自动重连混合历史数据。已接收数据可先播放，追上缓存等待；上限200周期，超限显式报错而非静默抽样。
- 雷达 PM2.5/PM10 入口禁用并标注暂未支持（Swagger 注明目前仅 sps）。

## 验证证据与尚未完成的联调

- minute 示例 2026-09-06 15:00–15:59 返回1122条；hour 示例 2026-09-05 00:00–2026-09-06 15:59 返回560条。
- microStationAvg 返回20站，PM2.5=10.9、PM10=14.8、SO2=0.4、NO2=19.8、VOCs=19.8；CO/O3/TSP为空。浏览器显示一致。
- 浏览器最近24小时获得24帧并播放到末尾停止。空雷达范围 SSE 实测返回 `data:{"type":"end","periodId":null,"dataType":"sps","startTime":null,"data":null}`；业务 end 后主动取消读取，兼容服务端随后异常断连接。
- admin 能查到和合财富中心 20260811060745_162 等周期，但 detail 返回 code=500：SPS文件读取失败。对应历史 SSE 返回 code=401。普通区县账号仅可见衢化医院，周期列表为空。
- 尚未获取成功的真实扫描详情/非空 SSE 帧，不能声称真实扇面联调通过。当前详情适配遵循 Swagger 的 SpsDetailVO/SpsRayVO；距离按 km 数组转换，数量不匹配会明确报错，不猜测压缩三元组。
- 2026-09-09 按用户最新反馈，所有基站统一修正起始角，不按基站名称校准。当前方位角为 `(hangle + 252 + bsiYaw) mod 360`，252° 为依据现有平台对照暂用的公共偏移，bsiYaw 为站点额外偏航（缺失按 0°）。最近周期、首页与历史 SSE 共用 SPS 适配器，页面分开展示公共修正和站点偏航。方向保持顺时针，跨北向射线宽度有回归覆盖；实际画面对齐和 vangle 投影约定仍待验证。
- 生产反向代理需允许 Authorization、关闭 SSE buffering/cache、提供足够 read timeout。前端没有写入任何测试 token，也不把 token 放在 URL。

## 回归命令

离线回归覆盖多个站点、零值/缺失/非零站点偏航、公共起始角修正以及最近周期和历史 SSE，已删除所有单站名称特判。

`node scripts/verify-live-data.cjs` 覆盖真实接口映射、缺测、跨站隔离、SSE拆包、结束/异常/鉴权、距离和周期校验、边接收边交付；用离线 fixture，不请求外部服务。

`tsc -b --pretty false`、变更模块 ESLint、`vite build`。
