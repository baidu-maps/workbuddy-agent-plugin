---
name: baidu-map-webapi
description: 编写、修改、审查或调试百度地图服务端 WebAPI 调用代码时使用，涵盖 POI 检索、路线规划、出发时间与耗时预测、交通事件、行政区划、地址坐标转换、天气和上车点等接口。用户要求 Node.js、Python、后端服务、curl 集成示例或排查 WebAPI 请求时触发；不用于直接回答普通地点/路线/天气结果、浏览器 BMapGL 代码或账户资源管理。
license: MIT
metadata:
  openclaw.primaryEnv: BMAP_WEBAPI_AK
  openclaw.requiresBins: curl
---

# WebAPI 开发指南

本 skill 只组织可交付的服务端 WebAPI 代码。直接回答地点、路线、地址或天气结果时改用 `baidu-ai-map`；浏览器地图代码使用 `baidu-map-jsapi-gl`；账户资源由 `bmap-cli` 管理。

## 工作流

1. 先判断任务是多步业务流程还是单接口集成。
2. 多步流程读取下方对应 recipe；单接口任务只读取对应 API reference，避免加载无关资料。
3. 本地 reference 缺失，或涉及精确参数、返回字段、限制、错误码、版本差异和最新定义时，使用同 plugin 的 `baidu-maps-docs` MCP：先 `list_docs`，再对命中文档调用 `get_docs`。
4. 获取服务端 AK，按用户项目语言和已有结构编写调用代码。所有用户输入都用客户端的查询参数编码能力处理，不手工拼接未转义参数。
5. 交付前检查端点、AK 类型、坐标顺序/坐标系、必填参数、错误处理和凭据泄漏风险。不得用未经核实的记忆补齐精确字段。

## 端点选择

百度地图提供两个服务端点：

| 端点类型 | Base URL | 适用场景 |
|---|---|---|
| **标准端点** | `https://api.map.baidu.com/` | 正式开发、生产环境、为用户生成的代码 |
| **高级功能体验端点** | `https://api.map.baidu.com/map_service/` | 百度地图官方提供，仅供大模型直接调用时快速体验高级权限功能 |

为用户生成的开发或生产代码必须使用标准端点。仅在集成测试、接口调试或用户明确要求体验高级能力时使用体验端点；不得把它写入交付代码。两类端点都需要 AK。

## AK 凭证

AK（Access Key）是使用技能之前的必须参数，需要**服务端 AK**：

1. 优先读取环境变量 `BMAP_WEBAPI_AK` 中的 AK。
2. 无值时，转由同 plugin 的 **`bmap-cli` skill** 取得服务端 AK（`ak list`）；**不要**直接提示用户去网页申请，也不要复用浏览器端 AK。
3. 仅当 `bmap-cli` skill 不可用时，才提示用户：**请先前往[百度地图开放平台](https://lbs.baidu.com/apiconsole/key)申请 `服务端` 的 AK**，并设置环境变量：

```bash
export BMAP_WEBAPI_AK="百度地图AK"
```

4. 示例与命令使用 `$BMAP_WEBAPI_AK`，不得把真实 AK 写入仓库、日志或最终回答：

```bash
curl "https://api.map.baidu.com/place/v3/region?query=美食&region=北京&ak=$BMAP_WEBAPI_AK"
```

## 地点与算路规则

- 将用户输入的地名或地址转成坐标/UID 时，先读 `references/recipes/address_to_poi.md`：结构化门牌地址走 `references/geocoding.md`，POI 名称或地标走 `references/administrative_region_search.md`。
- 算路接口优先同时传坐标与 UID。取得 `origin_uid` / `destination_uid` 后必须传入，以提高大型 POI 绑路准确性。
- 不推测坐标、UID 或坐标系；只能使用用户输入或可信接口结果。

## Recipe 路由

| 文件 | 适用场景 | 权限 |
|---|---|---|
| `references/recipes/address_to_poi.md` | 地址文本或地名 → 坐标 + POI UID（算路前置步骤） | 标准 AK |
| `references/recipes/route_to_named_place.md` | 用户说出地名 → 规划驾车路线 | 标准 AK |
| `references/recipes/smart_departure_time.md` | 为准时到达计算出发时间 | 高级权限 |
| `references/recipes/traffic_aware_route.md` | 预测未来出发时的路况耗时 | 高级权限 |
| `references/recipes/nearby_poi_search.md` | 搜索用户附近的某类地点 | 标准 AK |
| `references/recipes/poi_search_to_detail.md` | 关键词搜索 → 获取 POI 完整详情 | 标准 AK |
| `references/recipes/address_to_full_location.md` | 地址文本 → 坐标 + 行政区划 | 标准 AK |
| `references/recipes/coordinate_to_structured_address.md` | 坐标 → 结构化地址 + 行政区划 | 标准 AK |
| `references/recipes/weather_query.md` | 通过城市名称/行政区划编码/坐标, 获取当地详细的天气信息 | 标准 AK |

## 单接口参考

- `references/constants.md` - 通用常量：状态码
- `references/global_reverse_geocoding.md` - 全球逆地理编码: 坐标转位置信息
- `references/reverse_geocoding_agent.md` - 逆地理编码智能体: 智能逆地理编码地址解析
- `references/administrative_region_search.md` - 行政区划区域检索: 行政区划地点检索
- `references/circular_region_search.md` - 圆形区域检索: 圆形区域地点检索
- `references/multi_dimensional_search.md` - 多维检索: 多条件智能检索POI
- `references/place_detail_search.md` - 地点详情检索: 获取指定地点详细信息
- `references/place_input_suggestion.md` - 地点输入提示: 地点输入提示匹配
- `references/geocoding.md` - 地理编码: 地址解析为坐标
- `references/admin_division_query.md` - 行政区划查询: 查询中国行政区划信息
- `references/domestic_weather_query.md` - 国内天气查询: 国内天气查询多功能接口
- `references/overseas_weather_query.md` - 海外天气查询: 查询海外城市天气
- `references/cycling_route_planning.md` - 骑行路线规划: 骑行路线规划方案检索
- `references/driving_route_planning.md` - 驾车路线规划: 驾车路线规划与路况预测
- `references/capabilities/driving_route_duration.md` - 驾车路线历史耗时
- `references/capabilities/future_driving_route.md` - 未来驾车路线耗时
- `references/capabilities/suggested_departure_time.md` - 建议出发时间
- `references/capabilities/waypoint_route_planning.md` - 途经点顺序优化
- `references/motorcycle_route_planning.md` - 摩托车路线规划: 摩托车路线规划服务
- `references/transit_route_planning.md` - 公交路线规划: 多交通方式路线规划
- `references/walking_route_planning.md` - 步行路线规划: 步行路线规划
