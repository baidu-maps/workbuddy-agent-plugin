---
name: baidu-map
description: 百度地图位置服务技能 —— 地点检索与详情、路线规划(驾车/骑行/步行/公交)、批量算路、地址正逆解析、实时路况、天气、行政区划、地图调起与行程地图。说明各工具的真实参数、坐标顺序约定与实测坑位。
version: "1.0.0"
author: "百度地图开放平台"
---

# 百度地图 Skill

本 Skill 覆盖百度地图 MCP Server(`mcp-server-baidu-maps`)暴露的全部工具。以下参数与行为均经真实调用验证,与工具自带 schema 存在差异之处已标注。

## 认证前置

- 本 Connector 使用**用户自填 AK**:AK 由 WorkBuddy 加密存于本机 `~/.workbuddy` 并在请求时注入服务地址,**AI 不需要也不应在任何参数中传 ak**。
- AK 必须是开放平台控制台创建的**「服务器端」类型**;浏览器端 AK 会因 referer 校验被拒。
- 鉴权类错误(AK 无效、服务未开通、配额耗尽)不要重试,直接提示用户去控制台检查 AK 类型、服务开通状态与当日配额。

## 坐标系与参数顺序(最高频出错点)

全部坐标为**百度坐标系 `bd09ll`**。用户给的若是 GPS(wgs84)或高德/腾讯(gcj02)坐标,存在数百米偏移,必须先说明,不要直接混用。

**经纬度顺序在工具之间不一致,逐个确认:**

| 工具 | 参数 | 顺序 |
|------|------|------|
| `map_search_places` | `location` | **纬度,经度** |
| `map_directions` | `origin` / `destination` | **纬度,经度** |
| `map_directions_matrix` | `origins` / `destinations` | **纬度,经度**,多点用 `\|` 分隔 |
| `map_road_traffic` | `center` / `bounds` / `vertexes` | **纬度,经度** |
| `map_search_pro` | `center` | **纬度,经度** |
| `map_uri` | `location` | **纬度,经度** |
| `map_weather` | `location` | **经度,纬度**(与上面全部相反) |
| `map_geoconv` | `coords` | **经度,纬度** |

`map_reverse_geocode` 用独立数值参数 `latitude` / `longitude`(也接受别名 `lat` / `lng`),不涉及顺序。

**另一处不一致**:境内外开关在多数工具叫 `is_chinese_mainland`,但 `map_weather` 叫 `is_china`。两者都是**字符串** `"true"` / `"false"`,不是布尔。

`district_id` 是**字符串**类型的 6 位行政区划码(如 `"330100"`),不要传数字。

## 工具总览

服务端共暴露 14 个工具,均已实测。其中 `map_geoconv` 当前服务端返回错误、官方待修复,其余 13 个正常可用。

| 工具 | 用途 | 必填参数 | 实测 |
|------|------|---------|:----:|
| `map_geocode` | 地址文本 → 坐标 | `address` | ✅ |
| `map_reverse_geocode` | 坐标 → 地址/行政区划/周边 | (需给出经纬度对) | ✅ |
| `map_search_places` | 关键字检索 POI | `query` | ✅ |
| `map_place_details` | 用 uid 查 POI 详情 | `uid` | ✅ |
| `map_directions` | 两点路线规划 | `origin`, `destination` | ✅ |
| `map_directions_matrix` | 多起终点批量距离/耗时 | `origins`, `destinations` | ✅ |
| `map_weather` | 实时天气 + 未来 5 天 | (`district_id` 或 `location`) | ✅ |
| `map_ip_location` | IP → 城市 | — | ✅ |
| `map_road_traffic` | 实时路况 | `model` | ✅ |
| `map_search_pro` | 自然语言多维检索 | `query`, `region` | ✅ |
| `map_district_search` | 行政区划 → adcode/边界/下级 | `keyword` | ✅ |
| `map_uri` | 生成百度地图调起链接 | `service` | ✅ |
| `map_mark` | 行程文本 → 可分享地图页 | `text_content` | ✅ |
| `map_geoconv` | 坐标系转换 | `coords` | ⚠️ 待修复 |

典型耗时:多数工具 200~600ms;`map_directions` 与 `map_search_pro` 约 1s;`map_mark` 约 **7s**,调用前先告知用户在生成。

## 工具详解

### map_geocode — 地理编码

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| address | string | ✅ | 最多 84 字节。支持结构化地址("北京市海淀区上地十街10号"),也支持"*路与*路交叉口"(仅当地址库存在该描述时才有结果) |
| city | string | - | 限定城市,消解同名地址,如"北京市" |
| inarea | string | - | 仅 `is_chinese_mainland="false"` 时有效,国家/地区代码,如 `"USA,HKG"` |
| is_chinese_mainland | string | - | `"true"`(默认)/`"false"`。查港澳台及海外须传 `"false"` |

返回 `location.lng/lat` 及 `precise`(是否精确)、`confidence`、`level`(地址层级)。`precise=0` 时应提示用户结果可能不准。

### map_reverse_geocode — 逆地理编码

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| latitude | number | - | 纬度(bd09ll),别名 `lat` |
| longitude | number | - | 经度(bd09ll),别名 `lng` |

四个参数 schema 上都标 optional,但**必须给出一对完整经纬度**,否则无法定位。返回结构化地址、`adcode`、所在道路与周边 POI。

### map_search_places — 地点检索

两种模式:给 `region` 做城市内检索(最细到 city 级);给 `location` + `radius` 做圆形周边检索。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| query | string | ✅ | 关键字,**至多 10 个**,英文逗号分隔 |
| tag | string | - | 中文分类过滤,如 `"美食,购物"` |
| region | string | - | 城市名或 citycode,不传默认全国;`is_chinese_mainland="false"` 时**必传且只能是文本**(如"东京") |
| location | string | - | 圆形检索中心点,`纬度,经度` |
| radius | integer | - | 圆形检索半径(米),与 `location` 配对使用 |
| language | string | - | 返回语言,如 `"en"`、`"jp"`、`"cht"` |
| is_chinese_mainland | string | - | 同上 |

返回 `results[]`,每项含 `uid` —— 交给 `map_place_details` 取详情。

### map_place_details — 地点详情

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| uid | string | ✅ | POI 唯一标识,来自 `map_search_places` |
| is_chinese_mainland | string | - | 同上 |

返回评分、营业时间、品牌、价格等,**字段随 POI 类型变化**,不要假定某字段一定存在。

### map_directions — 路线规划

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| origin | string | ✅ | 起点,**位置名称或** `纬度,经度` |
| destination | string | ✅ | 终点,同上 |
| model | string | - | `driving`(默认)/`riding`/`walking`/`transit` |
| is_chinese_mainland | string | - | 起终点任一在内地则传 `"true"` |

**参数名是 `model`,不是 `mode`。** 该工具**直接接受地名**(实测 `origin="北京西站"`, `destination="故宫"` 可成功),无需先跑 `map_geocode`;仅当地名有歧义、需要用户确认选哪个时,才先用 `map_search_places` 列候选。

### map_directions_matrix — 批量算路

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| origins | string | ✅ | 多起点 `纬度,经度`,用 `\|` 分隔 |
| destinations | string | ✅ | 多终点,同上 |
| model | string | - | `driving` / `riding` / `walking` |

**只接受坐标,不接受地名**(与 `map_directions` 不同),地名需先 `map_geocode`。限额:驾车起终点个数之积 ≤ 100;步行任意起终点间距 ≤ 200KM,超限返回参数错误。

### map_weather — 天气查询

`district_id` 与 `location` 二选一,返回实时天气 + 未来 5 天预报。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| district_id | string | - | **字符串**形式的 6 位行政区划码,如 `"330100"` |
| location | string | - | **`经度,纬度`**(注意与其他工具相反) |
| is_china | string | - | 字段名是 `is_china`,不是 `is_chinese_mainland`;含港澳台算 `"true"` |

不知道 adcode 时,先 `map_district_search(keyword="杭州市")` 拿 `code`,再传 `district_id`。

### map_ip_location — IP 定位

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| ip | string | - | 留空或不传则定位当前出口 IP,支持 IPv4/IPv6 |

实测普通服务端 AK 即可调用。注意留空时返回的是**服务器出口 IP** 的位置,不是用户真实位置 —— 不要拿它当"用户当前位置"直接用于推荐,除非用户确认。

### map_road_traffic — 实时路况

`model` 必填,再给对应范围参数:

| model | 必须同时给 | 说明 |
|-------|-----------|------|
| `road` | `road_name` + `city` | 按道路名查 |
| `bound` | `bounds` | 矩形,`纬度,经度;纬度,经度`(左下;右上) |
| `polygon` | `vertexes` | 多边形顶点,`;` 分隔 |
| `around` | `center` + `radius` | 圆形,`radius` 取值 **[1,1000]** 米 |

⚠️ **两个实测坑,schema 里的说明是错的:**

1. **`road_name` 不能带方向后缀。** schema 举例 `"朝阳路南向北"`,实测直接报 `road_name错误`;传 `"朝阳路"` 才成功。一律只传纯道路名。另外道路名必须是具体街道 —— `"三环"` 这类泛称会失败。
2. **`bounds` 有面积上限。** 约 0.03°×0.03° 就报 `bounds范围过大`;0.01°×0.01°(约 1km²)正常。范围大时改用 `model="around"`。

### map_search_pro — 多维检索

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| query | string | ✅ | 自然语言检索词,如"宠物友好餐厅" |
| region | string | ✅ | **必填**,城市或区域名 |
| type | string | - | 对召回结果二次筛选,如"火锅""民宿" |
| center | string | - | 中心点 `纬度,经度`,用于按距离排序 |

仅在需求模糊时优先用它(如"可以带狗的餐厅""适合自驾的景点")。语义检索**可能返回 `total:0`**(实测"可以带狗的餐厅"/杭州市 即为 0 条);此时应回退到 `map_search_places` 用具体关键字 + `tag` 再试,而不是直接告诉用户"没有"。

### map_district_search — 行政区划检索

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| keyword | string | ✅ | 行政区名("中国""河北省""深圳市",省/市/区/镇)或 adcode |
| boundary | string | - | `"1"` 返回边界坐标,`"0"`(默认)不返回 |

返回 `code`(adcode)、`name`、下级子区划列表。**这是拿 adcode 的标准入口**,给 `map_weather` 用。边界数据量大,非必要不要传 `boundary="1"`。

### map_uri — 地图调起链接

生成可直接在百度地图 App / 网页打开的链接,返回的是**一个 URL 字符串**,不是 JSON。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| service | string | ✅ | `"direction"`(路线)或 `"search"`(检索) |
| origin / destination | string | - | `direction` 用。格式 `name:天安门\|latlng:39.98871,116.43234`,名称仅用于展示 |
| mode | string | - | `direction` 用:`driving`(默认)/`transit`/`walking` |
| region | string | - | 起终点同城时给一次即可 |
| origin_region / destination_region | string | - | 分别指定起终点城市 |
| query | string | - | `search` 用,如"海底捞" |
| location | string | - | `search` 用,中心点 `纬度,经度` |
| radius | string | - | `search` 用,半径(米),**字符串**类型 |

用户想"用手机导航过去"时用这个,把链接给他。

### map_mark — 行程地图

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| text_content | string | ✅ | 行程规划文本,**避免特殊字符**(如 `\`) |

返回一个可分享的地图页 URL 及二维码。做完多天行程规划后,除了文字讲解,应同时调它生成可视化地图。**实测约 7 秒**,调用前先跟用户说一句在生成。

### map_geoconv — 坐标转换

在不同坐标系之间转换坐标(wgs84 / gcj02 / bd09ll / bd09mc)。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| coords | string | ✅ | 待转换坐标,**`经度,纬度`**,多组用 `;` 分隔 |
| model | string | - | **字符串**形式的转换类型(如 `"1"`~`"6"`);传整数会被 schema 拒绝(`2 is not of type 'string'`) |

⚠️ **服务端当前状态**:实测各参数组合(`model` 取 `"1"`~`"6"`、省略 `model`、以及 schema 自带的示例坐标)均返回 `param error:from illegal, not support such coord type`。这是服务端问题、不是调用姿势问题,官方正在修复;修复后按上表参数正常调用。

遇到该报错时不必反复调参重试,如实告知用户该能力正在修复,并给出替代路径:想定位某个 GPS 坐标附近可用 `map_reverse_geocode`(它按 bd09ll 解读,存在数百米偏移需说明),或让用户提供地名走 `map_geocode` 拿到准确的 bd09ll 坐标。

## 常见组合调用

**地名 → 路线**:直接 `map_directions(origin="北京西站", destination="故宫", model="driving")`。不要先跑 `map_geocode` —— 该工具原生接受地名。仅当地名歧义时才用 `map_search_places` 让用户在候选里选。

**周边推荐 → 详情**:
1. `map_geocode` 或 `map_search_places` 定位中心点
2. `map_search_places(query="咖啡", location="纬度,经度", radius=2000)`
3. 对用户感兴趣的那家 `map_place_details(uid=...)` 取评分、营业时间

**查天气**:`map_district_search(keyword="杭州市")` 取 `code` → `map_weather(district_id="330100")`。手上已有坐标时可直接 `map_weather(location="经度,纬度")`,注意经度在前。

**多地点比通勤**:用 `map_directions_matrix` 一次算完,不要循环调 `map_directions`。记得它只吃坐标。

**多天行程规划**:文字方案讲解 + `map_mark(text_content=...)` 生成可分享地图;用户要手机导航再补 `map_uri`。

**模糊需求**:先 `map_search_pro`;返回 0 条则回退 `map_search_places` + `tag`。

## 结果呈现建议

- 距离换算成米/公里,耗时换算成分钟/小时,不要直抛原始秒数和米数。
- 路线多方案时说明差异(距离、耗时、是否走高速),让用户选。
- POI 超过 5 条先给前几条并说明还有更多,不要铺开长列表。
- `map_geocode` 返回 `precise=0` 或置信度低时,主动提示结果可能不准。
- 出行结论(如"来得及")要注明依据的是实时路况还是静态里程。

## 异常处理

| 现象 | 处理 |
|------|------|
| AK 无效 / 服务未开通 / 配额耗尽 | 不重试,提示用户去控制台检查 AK 类型(须服务器端)、服务开通与配额 |
| `road_name错误` | 去掉方向后缀,只传纯道路名;泛称改用具体街道名 |
| `bounds范围过大` | 缩小矩形,或改 `model="around"` |
| 参数校验错误(如 `is not of type 'string'`) | 该服务多数"数值型"参数实为字符串(`district_id`、`radius` in `map_uri`、`model` in `map_geoconv`),按表格类型传 |
| `map_search_pro` 返回 `total:0` | 回退 `map_search_places` + 具体关键字/`tag`,不要直接回"没有" |
| `map_geoconv` 报 `from illegal` | 服务端待修复,调参重试无效;如实告知并改走 `map_reverse_geocode` / `map_geocode` |
| 请求超时 | 单次应在 30s 内返回;`map_mark` 本身约 7s 属正常。超时先确认网络与配额,再缩小检索范围 |

## 注意事项

- 本 Skill 全部工具均为**只读查询**,不修改用户数据,无需二次确认。
- 工具名以 `map_` 前缀统一;注意 `map_directions_matrix`(不是 `map_distance_matrix`)、路线类参数名为 `model`(不是 `mode`)。
- 本文基于服务端 `mcp-server-baidu-maps` v1.28.0、协议 `2025-06-18` 实测。若服务端升级后行为不符,以运行时 schema 与实际响应为准。

