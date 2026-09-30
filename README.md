# 百度地图 WorkBuddy 连接器

基于 **MCP + Skill** 接入方式、**用户自填 Token 模式**（`auth_mode: "token"`）的百度地图连接器。
用户在 WorkBuddy 表单中填写服务端 AK，WorkBuddy 将其保存在本机 `~/.workbuddy` 并在连接时
注入 MCP 地址，不经过云端。

## 目录结构

```text
workbuddy-agent-plugin/
├── connector-meta.json        # 连接器元信息（source、auth_mode、minWorkbuddyVersion 等）
├── token-schema.json          # 凭证表单：BAIDU_MAP_AK（password）
├── mcp.json                   # 远程 streamableHttp MCP：mcp.map.baidu.com
├── icon.png
└── skills/
    ├── baidu-map/             # MCP 工具使用说明：参数、坐标顺序、实测坑位、异常处理
    ├── baidu-ai-map/          # Agent Plan 直接回答地点、路线、地址、天气
    ├── baidu-map-jsapi-gl/    # 编写/审查 BMapGL 浏览器前端代码
    └── baidu-map-webapi/      # 编写/审查服务端 WebAPI 调用代码
```

## 凭证注入

`token-schema.json` 中字段 `key` 为 `BAIDU_MAP_AK`，`mcp.json` 以同名占位符引用：

```json
"url": "https://mcp.map.baidu.com/mcp?ak=${BAIDU_MAP_AK}"
```

占位符与表单 key 区分大小写、一一对应。仓库内不含任何真实凭证。AK 须为开放平台
「服务器端」类型。

表单 AK 只注入 MCP 连接，AI 读取不到。其余 Skill 使用各自的凭据（`BAIDU_MAP_AUTH_TOKEN`、
`BMAP_JSAPI_KEY`、`BMAP_WEBAPI_AK`），缺失时由用户在百度地图开放平台控制台申请后自行设置。

## 组件职责

| 组件 | 负责 |
|---|---|
| `baidu-map` MCP + Skill | 直接回答地点、路线、批量算路、地址正逆解析、路况、天气、行政区划、地图调起、行程地图 |
| `baidu-ai-map` | 通过 Agent Plan API 完成语义化地点检索、路线规划、地理编码、天气 |
| `baidu-map-jsapi-gl` | 编写、审查、调试 BMapGL 浏览器前端代码 |
| `baidu-map-webapi` | 编写、审查、调试服务端 WebAPI 调用代码 |

## 本地验证

```bash
AK='<服务端 AK>'
curl -sS -X POST "https://mcp.map.baidu.com/mcp?ak=$AK" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"map_geocode","arguments":{"address":"北京市海淀区上地十街10号"}}}'
```

## 提交

将目录打包（不含 `.git/`、`.claude/`、`README.md`）提交 WorkBuddy 团队审核。更新时同步修改
`connector-meta.json` 的 `version`。
