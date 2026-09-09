---
name: baidu-map-jsapi-gl
description: 编写、修改、审查或调试百度地图浏览器前端代码时使用，覆盖 BMapGL / JSAPI WebGL 地图初始化、覆盖物、图层、事件、样式、交互和渲染性能。用户要求地图 HTML、前端组件、BMapGL 示例或排查浏览器地图问题时触发；不用于直接回答地点/路线/天气结果、服务端 WebAPI 代码或账户资源管理。
license: MIT
metadata:
  openclaw.primaryEnv: BMAP_JSAPI_KEY
---

# JSAPI GL 开发指南

百度地图 JSAPI WebGL 版本开发指南。包含地图初始化、覆盖物、事件、图层等核心模块的 API 说明和代码示例，旨在帮助开发者快速集成百度地图并遵循正确的使用方式。

## 边界与版本

- 本 skill 只负责浏览器前端代码。直接获取地点、路线、地址或天气答案时使用 `baidu-ai-map`；服务端调用代码使用 `baidu-map-webapi`；登录与资源管理使用 `bmap-cli`。
- 默认使用 BMapGL：加载 `https://api.map.baidu.com/api?v=1.0&type=webgl&...`，命名空间为 `BMapGL`。
- 仅当用户明确要求 JSAPI 3.0，或现有项目已经使用 3.0 时，才沿用 `BMapJS`。不得在同一实现中混用 `BMapGL` 与 `BMapJS`。

## AK 来源

本 skill 需要**浏览器端 AK**：

1. 优先读取环境变量 `BMAP_JSAPI_KEY`。
2. 无值时，转由同 plugin 的 **`bmap-cli` skill** 获取浏览器端 AK，**不要**自行编造或复用服务端 AK。
3. 需要个性化底图样式时，`style_id` 同样只能来自 `bmap-cli` 的 `style list` / `style create` 原始输出。

若用户只要求审查代码、解释 API 或提供不执行的结构示例，且任务不需要真实运行，不要为了填充示例而创建 AK。交付可运行页面时不得写入假 AK 或遮掩后的 AK。

## 何时适用

在以下场景中参考这些指南：

- 创建新的地图页面或组件
- 在地图上添加标注、折线、多边形等覆盖物
- 处理地图交互事件（点击、拖拽、缩放等）
- 配置地图样式或切换图层
- 调试地图渲染或性能问题


## 快速参考

### 0. 基础概念

- `references/base-classes.md` - 基础类：Point、Bounds、Size、Pixel、Icon
- `references/constants.md` - 通用常量：搜索状态码、POI 类型

### 1. 地图

- `references/map-init.md` - 地图初始化：资源引入、创建实例、配置选项、交互与视图控制

### 2. 地图覆盖物

- `references/overlay-common.md` - 覆盖物通用操作：添加/移除、显示/隐藏、批量清除
- `references/marker.md` - 点标记：构造参数、位置/图标/旋转/置顶/拖拽方法
- `references/polyline.md` - 折线：构造参数、线条样式、坐标操作、编辑模式
- `references/polygon.md` - 多边形：构造参数、边框/填充样式、带孔多边形、编辑模式
- `references/circle.md` - 圆形：构造参数、中心点/半径、样式设置、编辑模式
- `references/custom-overlay.md` - 自定义覆盖物：DOM 创建、属性传递、事件绑定、旋转控制
- `references/info-window.md` - 信息窗口：构造参数、内容/尺寸设置、最大化、与 Marker 配合使用

### 3. 事件

- `references/map-events.md` - 地图事件：绑定方式、交互事件、视图变化事件、生命周期事件
- `references/overlay-events.md` - 覆盖物事件：通用事件、拖拽事件、矢量图形事件

### 4. 地图样式

- `references/map-style.md` - 个性化地图：自定义地图外观（颜色、显隐），实现深色主题、简洁地图等效果

### 5. 图层服务

- `references/xyz-layer.md` - 第三方图层：加载 XYZ/TMS/WMS/WMTS 标准瓦片
- `references/mvt-layer.md` - 矢量瓦片：加载 MVT/PBF 格式瓦片，支持样式表达式、特征交互、状态管理

### 6. 路径规划

- `references/route-common.md` - 通用配置：构造参数、渲染选项、回调函数、数据结构、状态常量
  - `references/driving-route.md` - 驾车：策略枚举、途经点、路况、收费、拖拽
  - `references/walking-route.md` - 步行：转向类型、拖拽
  - `references/riding-route.md` - 骑行：骑行搜索
  - `references/transit-route.md` - 公交：市内/跨城策略、交通方式、换乘

### 7. 其他LBS服务

- `references/local-search.md` - 本地检索：普通/范围/周边检索、结果处理、翻页、POI 数据结构
- `references/geocoder.md` - 地理编码：正地理编码（地址→坐标）、逆地理编码（坐标→地址）
- `references/convertor.md` - 坐标转换：GPS/高德/谷歌坐标转百度坐标

## 文档使用顺序

1. 常用且稳定的实现模式先读取上面的本地 `references/` 文件。
2. 本地 reference 缺失，或用户询问精确参数、返回字段、限制、错误码、版本差异和最新定义时，使用同 plugin 的 `baidu-maps-docs` MCP：先 `list_docs`，再对命中文档调用 `get_docs`。
3. Skill 决定实现流程和代码组织；MCP 提供官方事实。不得用未经核实的记忆补齐精确字段。

参考文件路径相对于本 `SKILL.md`：

```
references/map-init.md
```

每个参考文件包含：

- 功能简要说明
- 完整代码示例及解释
- API 参数说明和注意事项

## AK 故障排查

- `references/get-ak.md` - 当浏览器端 AK 缺失、失效或白名单不匹配时读取
