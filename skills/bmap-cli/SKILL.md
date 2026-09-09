---
name: bmap-cli
description: 百度地图开放平台 CLI 与账户资源管理。用于定位已安装的 bmap-cli、登录/登出、查看或创建浏览器端/服务端 AK、管理 Agent Plan SK 和个性化地图样式，以及查询配额、消费量和资源账户；也在同 plugin 的地图业务 skill 缺少所需凭据时按需使用。普通地点/路线/天气请求或地图代码请求本身不应先触发本 skill。
license: MIT
metadata:
  openclaw.primaryEnv: BMAP_CLI
---

# bmap-cli 百度地图开放平台工具

管理百度地图 CLI、登录态和账户资源。本 skill 不是 plugin 入口，也不负责选择业务实现或编写地图代码。

同 plugin 内各组件的协作边界：

| 组件 | 本 skill 只提供什么 |
|---|---|
| `baidu-ai-map` | 缺少 `BAIDU_MAP_AUTH_TOKEN` 时获取 Agent Plan SK |
| `baidu-map-jsapi-gl` | 缺少 `BMAP_JSAPI_KEY` 时获取浏览器端 AK；按需获取 `style_id` |
| `baidu-map-webapi` | 缺少 `BMAP_WEBAPI_AK` 时获取服务端 AK |
| `baidu-maps-docs` MCP | 代理鉴权失败时检查可用 AK 和登录态 |

不要在本 skill 中执行 `bmap-cli skills install` 或 `bmap-cli mcp install`。Agent Plugin 安装器已经分发 Skills 并注册 MCP，重复安装会产生副本和版本漂移。

## 操作规则

- 只读操作（`ak list`、`style list`、`ap list`、`quota`、`consume`、`user list`）可直接执行。
- 创建资源（`ak create`、`style create`）前，说明将创建的内容及影响并取得明确同意。
- `ap create` 会重置现有 Agent Plan SK。必须先执行 `ap list`，仅在列表为空且用户明确同意后执行。
- 不回显完整 AK / SK。向用户说明时仅显示前 4 位和后 4 位，例如 `ByM8****KMxw`。
- `ap list` 等输出可能包含明文凭据，不要把原始输出整段贴给用户。
- 精确标识必须来自当前轮次的 CLI 原始输出，不凭记忆、截图或历史消息构造。

任何 bmap-cli 命令输出若包含「发现新版本」，立即暂停当前流程，向用户完整展示更新命令和其中的下载域名（例如 `open-agent-cli.bj.bcebos.com`）。确认域名与初次安装来源一致并取得用户同意后，才执行更新并继续。

## 定位 CLI

Plugin 不负责下载或安装 `bmap-cli`。先检查用户显式提供的 `BMAP_CLI` 是否指向可执行文件，再检查 PATH：

```bash
if [[ -n "${BMAP_CLI:-}" && -x "$BMAP_CLI" ]]; then
  export BMAP_CLI
elif command -v bmap-cli >/dev/null 2>&1; then
  export BMAP_CLI="$(command -v bmap-cli)"
else
  echo "未找到 bmap-cli。请用户通过百度地图开放平台官方渠道安装后重试。" >&2
  exit 2
fi
```

不要在 Plugin 中执行下载、安装或升级 CLI 的命令，不要使用 curl、wget、chmod、安装脚本或自行拼接下载地址。用户安装完成后重新检查 `BMAP_CLI` 或 PATH。定位阶段不登录、不安装 Skill、不注册 MCP。

## 登录

目标命令返回「未登录」或「登录态已失效」时，告知用户并取得明确同意，然后直接执行：

```bash
"$BMAP_CLI" login
```

`login` 是浏览器授权的人机协作流程。命令出现授权 URL 后，立即以独立代码块向用户展示完整 URL，并告知用户在浏览器中完成授权。CLI 自行管理最长 5 分钟的轮询，模型不要额外轮询，也不要查找 token 文件或凭据存储位置。

禁止把 `login` 交给用户手动执行；禁止使用 `timeout`、`nohup`、后台运行、管道或重定向；禁止用 `sleep`、`ps`、`find`、循环等方式轮询登录状态。唯一允许的调用形式是 `"$BMAP_CLI" login`。

## 按需工作流

### 获取 Agent Plan SK

只在 `baidu-ai-map` 缺少 `BAIDU_MAP_AUTH_TOKEN`，或用户明确管理 Agent Plan 时执行：

```bash
"$BMAP_CLI" ap list
```

- 列表非空：复用已有 `data.api_key`，不要执行 `ap create`。
- 列表为空：说明 `ap create` 的重置语义和影响，取得明确同意后再创建。
- 此流程不需要 AK。禁止顺带执行 `ak list`、创建 AK 或询问 AK 类型。

### 获取 AK

先由调用方明确所需类型，再执行：

```bash
"$BMAP_CLI" ak list
```

- BMapGL / JSAPI 前端代码只能使用浏览器端 AK。
- WebAPI / 服务端代码只能使用服务端 AK。
- 按 `app_type`、服务范围和状态选择唯一匹配项；不得用另一端类型替代。
- 没有匹配项时，说明拟创建的应用名称、类型、服务范围和白名单，取得明确同意后才执行 `ak create`；创建后重新 `ak list` 并从最新结果取值。
- 浏览器端本地 demo 可在明确说明滥用与配额风险后使用 `b_referers='*'`；生产代码必须优先使用准确域名白名单。

把选定凭据交还给触发本流程的业务 Skill，由业务 Skill 决定代码结构和 API 用法。本 skill 不编写或审查地图代码。

### 获取个性化地图样式

先查后建：

```bash
"$BMAP_CLI" style list
```

优先复用 `user_style_list` 中满足需求的样式。仅当没有合适项时，从 `template_list` 选择最匹配模板，说明将创建的样式并取得同意，再执行：

```bash
"$BMAP_CLI" style create --tpl-id <tpl_id>
```

`style_id` 只能来自 `style list` 或 `style create` 的当前原始输出，禁止猜测、拼接或手写。业务 Skill 应使用真实 `styleId`；不要生成 `styleJson` 代替平台样式。

### 查询账户资源

用户明确查询时，直接使用相应只读命令：

| 命令 | 用途 |
|---|---|
| `user list` | 资源账户列表 |
| `quota` | 服务配额 |
| `consume` | 消费量 |
| `version` | CLI 版本 |

对查询目标做唯一匹配。若匹配为 0 条或多条，先消歧；不要猜测账户、AK 或应用 ID。

## 账户切换

重新登录到另一账号后，旧账号的 AK / SK 不再可用。重新执行相应的 `ap list` 或 `ak list`，更新当前任务使用的凭据；若 `baidu-maps-docs` MCP 鉴权失败，重启 MCP 进程让代理重新解析凭据，并提醒用户检查历史项目中的旧凭据。
