---
name: baidu-ai-map
description: 使用百度地图 Agent Plan 直接完成普通或复杂的地理任务，包括语义化地点检索、路线规划、地理编码与逆地理编码、天气查询。用户要的是地点、路线、地址或天气答案时默认优先使用；无需开发者账户或 AK。不用于生成地图调用代码、纯官方文档查询，也不用于登录、AK、样式、配额等账户资源管理。
license: MIT
metadata:
  openclaw.primaryEnv: BAIDU_MAP_AUTH_TOKEN
  openclaw.requiresBins: curl
---

# 百度地图服务 Agent Plan

提供大模型友好调用的地图工具，支持语义化 AI 搜索、语义化 AI 路线规划、地理编码与逆地理编码、天气查询。

## 定位：直接得到地理结果

**无需成为百度地图开发者，无需申请 AK**——只要登录态就能用。这是本 skill 相对同 plugin 内 `baidu-map-webapi` / `baidu-map-jsapi-gl` 的核心差异：

| | 本 skill（Agent Plan） | webapi / jsapi-gl skill |
|---|---|---|
| 凭据 | Agent Plan SK，登录即得 | 需对应端 AK，可能要新建 |
| 产出 | **地理问题的答案** | **可交付的代码** |
| 入参 | 用户原话（`user_raw_request`） | 结构化参数、坐标、UID |

**适用**：用户想直接知道「附近有什么」「怎么走」「这个坐标是哪」「天气如何」。无论问题简单还是复杂，都默认优先使用本 skill。

**不适用**：

- 用户要能运行的 HTML / 前端代码：使用 `baidu-map-jsapi-gl`。
- 用户要服务端 API 调用代码：使用 `baidu-map-webapi`。
- 用户明确询问官方接口参数、字段、限制或版本定义：使用 `baidu-maps-docs` MCP。
- 用户要登录、AK、样式、配额或账户资源管理：使用 `bmap-cli`。

> **禁止在本 skill 中触发 AK 流程**：不执行 `ak list`、不创建 AK、不询问 AK 类型。误入凭据申请流程会毁掉本 skill 零配置的价值。

## 使用准则

### 准则 1：API 端点

所有能力统一使用：

> **Base URL**: `https://api.map.baidu.com/`

### 准则 2：SK 凭证安全处理

SK（Service Key）是调用所有 API 的必须凭证，按以下顺序获取：

1. 读取环境变量 `BAIDU_MAP_AUTH_TOKEN`，有值则直接使用。
2. 无值则触发同 plugin 的 **`bmap-cli` skill**，由它完成 CLI 自举与登录，然后执行：

   ```bash
   "$BMAP_CLI" ap list
   ```

   从输出的 `data.api_key` 取得 SK。**该输出含明文 SK，禁止整段回显给用户**；仅在需要说明时按「前 4 位 + `****` + 后 4 位」遮掩陈述。

3. `ap list` 返回空列表时，须先向用户说明并征得同意，再执行 `"$BMAP_CLI" ap create`。**列表非空时严禁执行 `ap create`**——它是重置语义，会立即作废所有在用 SK。
4. 若 `bmap-cli` skill 不可用，提示用户前往 [百度地图 Agent Plan](https://lbs.baidu.com/apiconsole/agentplan) 申请 SK 并自行设置环境变量：

```bash
export BAIDU_MAP_AUTH_TOKEN="你的SK"
```

### 准则 3：统一鉴权方式（Header 传入）

调用所有 API 时，统一通过 Header 传入：

- `Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN`

示例：

```bash
curl --get "https://api.map.baidu.com/agent_plan/v1/place" \
  -H "Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN" \
  --data-urlencode "user_raw_request=帮我找北京可带宠物的咖啡馆" \
  --data-urlencode "region=北京市"
```

## 全局参数与行为约束

1. `user_raw_request` 必须是完整的用户需求，不可压缩为关键词。
2. `user_raw_request` 出现“我附近”等非明确地点时，可根据上下文为用户推理为具体地点名称，但不可对坐标进行推理。
3. `user_raw_request` 需保留定语/约束词，例如“评分最高”“最近”“最便宜”“3公里内”。
4. 不得编造坐标；`center` / `location` / `refer_pois` 仅可来自用户明确提供或可信来源，当无可靠坐标时，必须先向用户澄清或先调用 `geocoding` / `place` 等工具获取。
5. 统一使用 Header 鉴权：`Authorization: Bearer $BAIDU_MAP_AUTH_TOKEN`。
6. 经纬度至少保留小数点后 6 位。
7. 所有工具返回坐标类型统一为 `gcj02`。
8. 禁止使用 grep/sed/awk/jq/python脚本 正则裁剪响应后再推断字段，这会造成百度地图 Agent Plan 巨额的token消耗；短时间内遇到相同或高度相似请求时，应优先基于结果直接推理，避免重复发起请求。
9. `direction` 可能返回两类结果：路线结果，或起终点澄清结果。当返回起终点澄清结果时，应先根据用户需求推理最合理候选；若仍无法唯一确定，应引导用户在候选中选择后再继续规划。

## 执行工作流

1. 按需求选择 `place`、`direction`、`geocoding`、`reverse_geocoding` 或 `weather`。
2. 调用前读取 [`references/agent-plan-api.md`](references/agent-plan-api.md) 中对应接口的必填参数、约束和示例；不要一次加载无关接口资料。
3. 使用 `curl --get` 与 `--data-urlencode` 发起请求，凭据只放在 Authorization Header，不放进 URL、日志或最终回答。
4. 直接解析完整 JSON 响应；不要用文本正则裁剪响应后猜测字段。
5. 结果有歧义时先利用响应候选和用户上下文消歧，仍无法唯一确定再询问用户。
6. API 返回参数错误时，重新读取对应 reference；涉及精确字段、限制或最新定义时改查 `baidu-maps-docs` MCP，不凭记忆补齐。

## API 索引

| 需求 | 接口 | 读取位置 |
|---|---|---|
| 语义化地点检索 | `GET /agent_plan/v1/place` | `references/agent-plan-api.md#place` |
| 语义化路线规划 | `GET /agent_plan/v1/direction` | `references/agent-plan-api.md#direction` |
| 地址转坐标 | `GET /agent_plan/v1/geocoding` | `references/agent-plan-api.md#geocoding` |
| 坐标转地址 | `GET /agent_plan/v1/reverse_geocoding` | `references/agent-plan-api.md#reverse-geocoding` |
| 天气查询 | `GET /agent_plan/v1/weather` | `references/agent-plan-api.md#weather` |
