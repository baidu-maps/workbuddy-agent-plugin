# workbuddy-agent-plugin

这是一个符合 Claude Code Plugin 规范的百度地图 Agent Plugin，提供 4 个并列 Skill
和 1 个官方文档检索 MCP。Plugin 同时在 WorkBuddy 与 Ducc 客户端完成兼容性验证，
不绑定特定 Agent。

## 目录结构

```text
workbuddy-agent-plugin/
├── connector-meta.json        # WorkBuddy 市场元信息（不属于 Plugin 本体）
├── mcp.json                   # stdio MCP 注册（baidu-maps-docs）
├── icon.png
├── bin/
│   └── docs-mcp-proxy.mjs     # baidu-maps-docs stdio → Streamable HTTP 代理
└── skills/
    ├── bmap-cli/              # CLI 自举、登录、AK/SK、样式、配额、消费量
    ├── baidu-ai-map/          # 直接回答地点、路线、地址、天气
    ├── baidu-map-jsapi-gl/    # 编写/审查 BMapGL 浏览器前端代码
    └── baidu-map-webapi/      # 编写/审查服务端 WebAPI 调用代码
```

Plugin 使用根 `mcp.json` + `skills/` 目录结构，不含 `.claude-plugin/plugin.json`、
`.codex-plugin/` 等清单文件。

## 客户端兼容性

Plugin 规范不限定具体 Agent 客户端。任何完整支持 Claude Code Plugin 格式
（根 `mcp.json` + `skills/<name>/SKILL.md`）和 stdio MCP 的客户端，都可以按其
自身机制加载本 Plugin：

| 客户端 | 状态 | 说明 |
|---|---|---|
| Claude Code | ✅ 已验证 | 标准 Claude Code Plugin 加载方式 |
| WorkBuddy | ✅ 已验证 | 通过 connector-meta.json 注册到市场 |
| Ducc | ✅ 已验证 | 通过 `${CLAUDE_PLUGIN_ROOT}` 展开 |

实际兼容性取决于客户端对这些规范的实现，请以对应客户端的文档和验证结果为准。
`connector-meta.json` 是 WorkBuddy 市场的元信息，不是 Plugin 本体的一部分。

## 安装

### 在 Claude Code 中

将 Plugin 目录放到任意位置，然后通过 `--plugin-dir` 加载：

```bash
claude --plugin-dir /absolute/path/to/workbuddy-agent-plugin
```

### 在 WorkBuddy 中

把 `connector-meta.json` 上传到 WorkBuddy 插件市场，或在本地 `.workbuddy/plugins/`
下放置 Plugin 目录。市场安装会自动缓存到
`~/.workbuddy/plugins/cache/workbuddy-agent-plugin/<version>/`。

### 在 Ducc 中

通过 Ducc 插件管理器添加：

```bash
ducc plugin add /absolute/path/to/workbuddy-agent-plugin
```

### 验证安装

Plugin 加载后，应能在新会话中看到以下 4 个 Skill 自动注册：

- `bmap-cli`
- `baidu-ai-map`
- `baidu-map-jsapi-gl`
- `baidu-map-webapi`

以及 1 个 MCP server：

- `baidu-maps-docs`（工具 `list_docs`、`get_docs`）

无需在宿主 `config.toml` / `.workbuddy/config.json` 中手工注册 MCP。
`${CLAUDE_PLUGIN_ROOT}` 在 MCP 启动时展开为 Plugin 缓存根目录。

## 使用方式

在支持自动发现 Agent Skills 和 MCP 的客户端中，不需要先选择入口 Skill，也不需要
显式调用 MCP。直接在新会话中描述地图需求，客户端会根据各 `SKILL.md` 的
`description` 选择 Skill，并在需要精确官方资料时调用 `baidu-maps-docs` MCP：

```text
帮我找西湖附近适合带孩子的餐厅
写一个 BMapGL 页面显示多个 Marker
用 Node.js 调用百度地图驾车路线规划接口
帮我登录百度地图开放平台并查看现有 AK
查询百度地图官方文档中驾车路线规划的返回字段
```

不需要写 `$workbuddy-agent-plugin:...`、`$baidu-maps-docs` 或 `mcp://...`。显式
形式只用于调试、验证或强制选择组件。

第一次遇到需要百度账号、AK 或 SK 的任务时，Plugin 会按需进入 `bmap-cli` 登录和
凭据流程，不会在安装阶段要求用户预先配置所有凭据。

## 更新和卸载

修改 `skills/` 或 `mcp.json` 后，新开会话（Claude Code 中也可执行 `/reload-plugins`）
即可生效，不需要重新"安装"。

卸载 Plugin：去掉 `--plugin-dir` 参数，或在对应客户端的插件管理中移除即可，无需清理 MCP 注册
（MCP 生命周期与 Plugin 绑定）。

## 组件职责

| 组件 | 负责 | 不负责 |
|---|---|---|
| `baidu-ai-map` | 直接回答地点、路线、地理编码、天气等地理问题；复杂地图问题优先考虑 | 生成调用代码、账户资源管理 |
| `baidu-map-jsapi-gl` | 编写、审查、调试 BMapGL 浏览器前端代码 | 服务端 WebAPI、直接地理问答 |
| `baidu-map-webapi` | 编写、审查、调试服务端 WebAPI 调用代码 | 浏览器渲染、直接地理问答 |
| `bmap-cli` | CLI 自举、登录、AK / SK、样式、配额、消费量和账户资源管理 | 总分诊、地图代码组织 |
| `baidu-maps-docs` MCP | 查询精确、缺失、版本相关或最新的官方 API / SDK 事实 | 决定业务流程和代码架构 |

```text
直接地理结果 -> baidu-ai-map
浏览器地图代码 -> baidu-map-jsapi-gl -> 缺凭据时 bmap-cli
服务端地图代码 -> baidu-map-webapi -> 缺凭据时 bmap-cli
登录 / AK / Agent Plan / 样式 / 配额 -> bmap-cli
精确或最新的官方文档事实 -> baidu-maps-docs MCP
```

Skill 负责工作流、约束和代码组织，MCP 负责官方事实。代码任务先由业务 Skill 组织；
遇到精确、缺失或版本相关信息时查询 MCP。明确的官方文档问题可以直接使用 MCP。

## 首次使用与凭据

本包不包含任何凭据。各业务 Skill 只在实际缺少凭据时调用 `bmap-cli`：

| 变量 | 用途 |
|---|---|
| `BAIDU_MAP_AUTH_TOKEN` | Agent Plan SK；直接地理问答 |
| `BMAP_WEBAPI_AK` | 服务端 AK；WebAPI 代码 |
| `BMAP_JSAPI_KEY` | 浏览器端 AK；BMapGL 代码 |
| `BAIDU_MAPS_DOCS_AK` / `BMAP_AK` | 文档 MCP AK；独立运行代理时可用 |
| `BMAP_CLI` | 已有 bmap-cli 路径；跳过自举 |

首次提出需要凭据的请求时，`bmap-cli` Skill 会检查外部 CLI。若本机没有 CLI，它会先
展示固定下载地址、完整命令和风险，取得用户确认后才安装，再按需启动浏览器登录并获取
正确类型的 AK / SK。

如果文档 MCP 在登录前已启动并因没有 AK 鉴权失败，完成登录后新开一个会话，
让 MCP 进程重新从 `bmap-cli` 登录态解析凭据。只安装 Plugin 的含义是不需要独立安装
Skill 或手工配置 MCP；网络、百度账号登录态和按需运行的 `bmap-cli` 仍是外部依赖。

Claude Code / Ducc 在启动 Plugin stdio MCP 时会过滤任意宿主环境变量，只继承
`HOME`、`PATH` 等安全白名单。因此文档代理通常通过 `HOME` 找到 `bmap-cli`，再由
CLI 读取登录态并解析可用 AK。当前 MCP 规范没有可移植的 secret reference 字段，
不能把凭据写入可见的 `mcp.json` `env` 或 `headers`。

## MCP 代理

`bin/docs-mcp-proxy.mjs` 需要 Node.js 18+。它按
`BAIDU_MAPS_DOCS_AK`、`BMAP_AK`、`bmap-cli ak list`（优先服务端 AK）的顺序解析
凭据，将 stdio JSON-RPC 转发到 `https://docs.map.baidu.com/mcp/`，并兼容 JSON 与
SSE 响应。诊断信息只写 stderr。

### 单独验证

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node bin/docs-mcp-proxy.mjs
```

### 关键行为

- **AK 解析顺序**：`BAIDU_MAPS_DOCS_AK` > `BMAP_AK` > `bmap-cli ak list` 的服务端 AK
- **协议协商**：首次 `initialize` 后回填 `mcp-session-id` 和 `MCP-Protocol-Version` 头
- **SSE / JSON 双解析**：支持 `text/event-stream` 分帧与单 JSON 响应
- **错误转换**：上游非 2xx 响应转为 `error.code=-32603`，message 含 HTTP 状态码
- **退出前 flush**：所有响应写完后再 `process.exit(0)`，避免截断

## 已知限制

| 场景 | 影响 | 计划 |
|---|---|---|
| `fetch` 没有 timeout | 真上游卡死时 proxy 挂起到 SIGKILL | ⏳ 加 `AbortController + 10s 超时` |
| proxy 第一条 banner 检测是中文关键字 | 英文 banner + stdout 污染双重场景会漏判 | ⏳ 改为 i18n 正则 `/(?:发现新版本\|new version\|update available)/i` |