# 「覆盖原版图包」功能设计文档

## §1 目标与范围

在现有「DoL 美化模组工具集」的 `#/overwrite` tab 中实现完整功能：

- 用户上传一个原版游戏图包（`.mod.zip`，含 `boot.json` + `img/`）。
- 用户再添加一个或多个覆盖图包 ZIP（含 `img/` 子目录）。
- 每个覆盖图包可指定 `img/` 资源相对路径前缀（如 `/` 或 `img/`）。
- 覆盖图包来源列表可调整顺序（上移/下移/删除），越靠下优先级越高。
- 程序把覆盖文件按优先级合并到原版图包的 `img/` 目录中。
- 复用原版图包的 `boot.json`，仅增量更新 `imgFileList`（追加新文件路径、去重），其他字段原样保留。
- 生成新的 `.mod.zip` 文件，提供下载。

**不在范围**：不支持覆盖非 `img/` 下的文件（`dist/`、`styleFileList` 等原样保留）；不支持修改原版 `boot.json` 中除 `name`/`version`/`imgFileList` 外的任何字段。

## §2 架构与复用

遵循现有工程架构：

- `src/common.js`：共享纯函数，本次新增 `readBootJson()` 导出。
- `src/overwrite.js`：工具 2 完整实现，提供 `mount(container)` / `unmount(container)` 生命周期。
- `src/main.js`：无需改动，路由已注册 `#/overwrite`。
- `index.html`：无需改动，样式由 packer 复用。

## §3 UI 布局

```
<p class="intro">上传原版游戏图包(.mod.zip)，再添加覆盖图包ZIP，合并后生成覆盖版模组。</p>

<!-- 原版图包 -->
<input type="file" id="base-file" accept=".zip" hidden>
<div id="base-info">暂未上传原版图包</div>
<button id="add-base">+ 上传原版图包</button>

<!-- 覆盖图包列表 -->
<div style="margin: 0.6em 0; font-weight: bold;">覆盖图包来源列表:</div>
<div id="sources-list"></div>
<button id="add-zip">+ 添加覆盖 ZIP</button>

<!-- 模组信息 -->
<label><span>模组名称:</span><input type="text" id="name" placeholder="(默认: 原版名-overwrite)"></label>
<label><span>版本号:</span><input type="text" id="version" value="1.0.0"></label>

<button id="pack" disabled>开始覆盖打包</button>
<div id="status">请先上传原版图包</div>
<div id="conflicts" hidden></div>
<a id="download" hidden>下载</a>
```

## §4 核心逻辑流程

### 4.1 原版图包解析

1. 用户上传 `.mod.zip`。
2. 用 `readZipFile()` 解析。
3. 用 `readBootJson(zip)` 读取 `boot.json`：
   - 若无 `boot.json` → 报错「这不是有效的 ModLoader 模组图包」。
   - 若解析失败 → 报错。
4. 遍历 ZIP 所有条目：
   - `img/` 开头的文件 → 存入 `baseMap`（relPath = 去掉 `img/` 前缀）。
   - `boot.json` → 单独保存到 `baseBoot`（已第 3 步完成）。
   - 其他文件（`dist/`、`styleFileList` 对应的 CSS/字体等）→ 存入 `extraMap`（完整路径 → 数据）。
5. 更新 UI：显示原版文件名、`boot.json` 中的 `name` 和 `version`、`img/` 下文件数量。
6. 自动填充名称输入框 = 原版 `name` + `-overwrite`；版本输入框 = 原版 `version`。

### 4.2 覆盖图包处理

与 `packer.js` 完全一致：

1. 用户通过文件选择添加 ZIP。
2. 每个覆盖 ZIP 存储为 `{ fileName, zip, path, matchCount }`。
3. `path` 默认 `'/'`，用户可修改。
4. 支持上移/下移/删除。

### 4.3 合并与生成

```
1. 输出 ZIP = new JSZip()
2. 先写 baseMap 所有文件到 img/relPath
3. 再写 extraMap 所有文件到其原始路径（含 boot.json 以外的全部）
4. 按 sources 顺序处理每个覆盖图包：
   a. 用 collectEntries(zip, normalizePath(path)) 提取文件
   b. 对每个文件：outPath = 'img/' + rel；写入输出 ZIP（覆盖同名）
   c. 记录冲突（如果 rel 已被 baseMap 或前面的覆盖写入过）
5. boot.json 处理：
   a. baseBootCopy = JSON.parse(JSON.stringify(baseBoot))（深拷贝）
   b. 遍历最终输出 ZIP 中 img/ 下的所有文件路径：
      - 若不在 baseBootCopy.imgFileList 中 → 追加
   c. baseBootCopy.name = 用户输入（默认 原版名-overwrite）
   d. baseBootCopy.version = 用户输入（默认 原版 version）
   e. 输出 ZIP.file('boot.json', JSON.stringify(baseBootCopy, null, 2))
6. 生成 blob → triggerDownload
```

## §5 boot.json 字段保留策略

复用原版的完整 `boot.json`，只改动以下字段：

| 字段 | 处理方式 |
|------|----------|
| `name` | 用户输入，默认 = 原版 `name` + `-overwrite` |
| `version` | 用户输入，默认 = 原版 `version` |
| `imgFileList` | 增量追加新文件路径（`img/...`），去重；原有项保留 |

其他所有字段（`scriptFileList`、`styleFileList`、`tweeFileList`、`additionFile`、`addonPlugin`、`dependenceInfo`、`scriptFileList_earlyload`、`scriptFileList_inject_early`、`scriptFileList_preload` 等）**原样保留**。

## §6 关键边界与错误处理

| 场景 | 行为 |
|------|------|
| 原版图包无 `boot.json` | 红色报错「这不是有效的 ModLoader 模组图包」 |
| 原版图包 `boot.json` 解析失败 | 红色报错「boot.json 解析失败」 |
| 原版图包无 `img/` 目录 | 继续执行（可能纯脚本模组，用户硬要覆盖） |
| 覆盖图包路径下无匹配文件 | 红色报错，与 packer 一致 |
| 覆盖图包与原版文件冲突 | 覆盖原版文件，记录冲突日志（显示在 conflicts 区） |
| 覆盖图包之间冲突 | 后写入的赢，记录冲突日志 |
| 未上传原版图包时点击打包 | 红色报错「请先上传原版图包」 |
| 只有原版图包无覆盖图包 | 红色报错「请至少添加一个覆盖图包」 |

## §7 文件变更清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/overwrite.js` | **重写** | 从占位实现改为完整工具 |
| `src/common.js` | **新增导出** | `readBootJson(zip)` |
| `src/main.js` | 不变 | 路由已支持 `#/overwrite` |
| `index.html` | 不变 | 样式由 packer 复用 |
| `README.md` | 更新 | 把「(规划中)」改为已实现 |

## §8 common.js 扩展

新增导出函数：

```js
export async function readBootJson(zip) {
  const entry = zip.file('boot.json');
  if (!entry) return null;
  const text = await entry.async('text');
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}
```

## §9 overwrite.js 状态结构

```js
const state = {
  baseZip: null,        // JSZip 对象
  baseBoot: null,       // boot.json 对象
  baseName: '',         // 原版文件名
  sources: [],          // 覆盖图包列表
  blobUrl: null,
};
```

## §10 独有 UI 行为

- **原版图包上传**：单文件（`multiple=false`），上传后解析并显示信息。
- **名称默认值**：原版 `name` + `-overwrite`（自动填入，用户可改）。
- **版本默认值**：原版 `version`（自动填入，用户可改）。
- **打包按钮禁用条件**：`baseZip === null` 或 `sources.length === 0`。
- **冲突显示**：同 packer，用 `<details>` 展开冲突列表。

## §11 测试策略（11条回归清单）

| # | 测试项 | 期望结果 |
|---|--------|----------|
| 1 | 不上传原版图包 | 打包按钮禁用，状态提示「请先上传原版图包」 |
| 2 | 上传原版图包 | 显示解析信息（文件名、name、version、img数量） |
| 3 | 上传非 mod.zip（无 boot.json） | 红色报错 |
| 4 | 添加覆盖图包 goose-f → 打包 | 下载产物含原版所有文件 + 覆盖文件 |
| 5 | 添加两个覆盖图包（goose-f 在上，fem-goose 在下） | 同名文件取 fem-goose |
| 6 | 交换覆盖顺序 | 同名文件取 goose-f |
| 7 | 产物 boot.json `name` | = 原版名-overwrite |
| 8 | 产物 boot.json `imgFileList` | 包含新增/覆盖的文件路径 |
| 9 | 产物 boot.json 其他字段 | 与原版完全一致（scriptFileList/styleFileList/dependenceInfo 等） |
| 10 | 原版图包非 img/ 文件 | `dist/`、字体 CSS 等原样保留在产物中 |
| 11 | `runTests()` | PASS ≥ 基线（22 common + 5 packer + overwrite 自检） |

**测试 fixture**：
- `test/GameOriginalImagePack-0.5.8.10.mod.zip` — 原版图包
- `test/goose-f-20250430.zip` — 覆盖图包 1
- `test/fem-goose-compilation-20260508.zip` — 覆盖图包 2

## §12 里程碑

| 里程碑 | 内容 |
|--------|------|
| O1 | 重写 `src/overwrite.js` 完整实现 |
| O2 | `src/common.js` 新增 `readBootJson()` |
| O3 | 浏览器回归测试 11 条 |
| O4 | 更新 README，commit |

## §13 风险与缓解

| 风险 | 缓解 |
|------|------|
| 原版图包很大（18000+ 文件），在浏览器中全量解压可能内存压力大 | 只在内存中保留路径索引 + 数据引用，不提前读取所有文件内容；实际数据在生成输出 ZIP 时才 async 读取 |
| boot.json 深拷贝用 `JSON.parse(JSON.stringify())` 丢失非 JSON 值（如 Date、Function） | boot.json 是纯 JSON 对象，此风险不存在 |
| 覆盖图包与原版路径格式不一致（如 Windows 反斜杠） | `collectEntries` 已做 `replace(/\\/g, '/')` 处理 |
