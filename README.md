# workbuddy-agent-plugin

这是一个符合 Claude Code Plugin 规范的百度地图 Agent Plugin，提供 4 个并列 Skill
和 1 个官方文档检索 MCP。Plugin 同时在 WorkBuddy 与 Ducc 客户端完成兼容性验证，
不绑定特定 Agent。

### 插件本体（推送到 WorkBuddy 市场）

```text
workbuddy-agent-plugin/
├── connector-meta.json        # 插件市场元信息（WorkBuddy 市场使用）
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

### 本地开发资源（仅维护者本地参考，不随插件发布）

```text
workbuddy-agent-plugin/        # 同上，仅追加以下三项
├── tests/                     # 补充测试脚本（不发布）
├── demo/                      # 综合地图 demo + 验证脚本（不发布）
└── TEST_REPORT.md             # 完整测试报告（不发布）
```

`tests/`、`demo/`、`TEST_REPORT.md` 是本插件维护过程中在本地积累的测试与演示资源，
用于辅助验证 `bin/docs-mcp-proxy.mjs` 的修复与 skill 的代码组织示例。**它们不是
Claude Code Plugin 规范的组成部分，不应被客户端加载，也不会随插件一起推送到
WorkBuddy 市场。** 如果你从 GitHub 克隆本仓库后想复现测试，可保留这些目录；如果你
只想使用插件本身，可以直接删除它们而不影响功能。

Plugin 使用 Claude Code 的根 `mcp.json` + `skills/` 目录结构，不含
`.codex-plugin/`、`.claude-plugin/` 等其他规范兼容清单。

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

或把目录软链接到 `~/.claude/plugins/workbuddy-agent-plugin` 后让 Claude Code
自动发现。

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

Claude Code Plugin 是只读快照：修改 `skills/` 或 `mcp.json` 后需要重新启动
客户端才会生效，不需要重新"安装"。

卸载 Plugin：移除客户端配置中的 plugin 目录或软链接即可，无需清理 MCP 注册
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

## 校验与测试

详细报告见 [TEST_REPORT.md](TEST_REPORT.md)（**本地参考，不随插件发布**）。

| 套件 | Case | 覆盖 |
|---|---|---|
| 原版（已 commit） | 28 | Fix 1-4 回归 + 18 个查询 + 10 个负例 |
| 补充 Phase 7 | 10 | bmap-cli 真实 CLI（version/ak/ap/user/quota/consume/style） |
| 补充 Phase 8 | 4 | 上游 503/502/401/notification@500 错误处理 |
| 补充 Phase 9 | 3 | SSE 多帧 / `[DONE]` / 损坏帧 |
| 补充 Phase 10 | 1 | 真上游 30 个串行 tools/call |
| 补充 Phase 11 | 5 | 真 bmap-cli banner 格式（binary audit + 3 个 fixture） |
| Demo 验证 | 17 + 1 | HTML 结构 + JS 语法 + 关键 API + WebAPI 真实数据 + Chrome 渲染 |

> 上表数字与 [TEST_REPORT.md](TEST_REPORT.md) 第 3 节测试矩阵一致。最终通过情况以
> 报告结论为准。`tests/` 与 `demo/` 是本地验证脚本，市场分发版本中**不包含**这些
> 文件；如需复现，需额外从维护者处获取或在本地重新生成。

### 复现命令

> 以下命令均在本仓库根目录执行，且要求 `tests/`、`demo/` 已在本地。

```bash
# 静态校验 mcp.json
node -e 'JSON.parse(require("fs").readFileSync("mcp.json"))'

# 补充测试（含 Phase 7-11）
node tests/test-proxy-supplementary.mjs

# 压测规模可调
LOAD_N=100 node tests/test-proxy-supplementary.mjs

# Demo 静态验证（17 个 case）
node demo/verify-demo.mjs

# Demo 真实浏览器渲染（截图 + 检查 console）
bash demo/run-chrome.sh
```

依赖：Node.js ≥ 18（内置 fetch + node:http）、macOS / Linux、Google Chrome（仅
demo 用）。原版 28 个 case 的脚本 `/tmp/test-proxy.mjs` 是早期一次性脚本，未纳入
仓库；如需复现可联系维护者。

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
- **5xx 透传**：上游错误转为 `error.code=-32603`，message 含 HTTP 状态码
- **退出前 flush**：所有响应写完后再 `process.exit(0)`，避免截断

## 演示

> 本节引用 [demo/map-demo.html](demo/map-demo.html) 作为代码组织示例。该文件在
> 仓库内供维护者参考，不随插件发布。如果你已经从 GitHub 克隆了仓库可直接查看，
> 否则可联系维护者获取。

[demo/map-demo.html](demo/map-demo.html) 是一个综合地图 demo，覆盖：

- **POI 检索**：调 `BMapGL.LocalSearch`
- **驾车路线规划**：调 `BMapGL.DrivingRoute` + `BMapGL.Geocoder`（6 种策略）
- **个性化地图样式**：5 种预设（default / dark / light / hide-poi / fresh）通过
  `map.setMapStyleV2({ styleJson: [...] })` 切换

打开方式：

```bash
# 替换占位 AK 后用浏览器打开
$EDITOR demo/map-demo.html   # 把 <浏览器端AK> 换成真实浏览器端 AK
open demo/map-demo.html      # macOS

# 或在 headless Chrome 截图验证
bash demo/run-chrome.sh
# 输出: demo/screenshot.png
```

无浏览器端 AK 时页面会进入 fallback 模式（不白屏），并通过状态条说明原因。

## 已知限制

| 场景 | 影响 | 计划 |
|---|---|---|
| `fetch` 没有 timeout | 真上游卡死时 proxy 挂起到 SIGKILL | ⏳ 加 `AbortController + 10s 超时` |
| `get_docs` 参数名 `names` 只接受单字符串 | 文档未说明，需从 `isError` 反推 | ⏳ SKILL.md 补充说明 |
| 服务端 AK 仅 IP 白名单（`0.0.0.0/0`） | 无浏览器端 AK 时无法直接跑 JSAPI | ⏳ 文档补充创建浏览器端 AK 步骤 |
| proxy 第一条 banner 检测是中文关键字 | 英文 banner + stdout 污染双重场景会漏判 | ⏳ 改为 i18n 正则 `/(?:发现新版本\|new version\|update available)/i` |