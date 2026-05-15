# DoL 美化模组工具集 - 工程目录架构重构设计文档

- 日期: 2026-05-15
- 源参考: 现 `index.html`(单文件 ~340 行 JS)、`docs/superpowers/specs/2026-05-12-dol-beauty-packer-web-design.md`、`docs/superpowers/specs/2026-05-13-multi-zip-merge-design.md`
- 形态: 纯静态站点(无构建工具),从单 HTML 拆分为多模块 ES Modules
- 风格: 与现有项目一致 — 零工具链 / 零 npm / 零框架 / 极简 CSS

## 1. 目标

当前 `index.html` 单文件内联 ~340 行 JS,已开始变得拥挤。下一步要新增第二个工具
「把美化图片包覆盖到 ModLoader 版本的原版游戏图包」(在部分 DoL 版本里,原版图包
是通过 ModLoader 加载的)。趁此机会先做**工程目录架构重构**,为后续添加新工具
建立稳定的承接面。

**本次 spec 只做架构重构,不设计新功能本身**。新功能(覆盖到原版图包)的输入输出、
算法、UI 留待下一次 brainstorm 单独写一份 spec。

### 1.1 范围

- ✅ 现有功能 1:1 平移到新结构,行为不变
- ✅ 引入 `src/` 与 `vendor/` 目录,JS 拆分成 ES Modules
- ✅ 单 HTML + URL hash 路由实现 Tab 切换
- ✅ 为第二个工具 `overwrite` 建立占位与扩展契约
- ❌ 不实现 `overwrite` 工具的业务逻辑(下次 spec)
- ❌ 不引入构建工具/npm/package.json
- ❌ 不调整 CSS 组织(仍内联,≤30 行 + tab nav 增量)

### 1.2 决策汇总(brainstorming 阶段已锁)

| # | 决策点 | 选择 |
|---|---|---|
| 1 | 架构形态 | 纯静态 ES Modules,JSZip 仍走 vendored 静态文件 |
| 2 | 本次 spec 范围 | 只做架构重构,新功能下次单独 brainstorm |
| 3 | Tab 切换 | 单 HTML + URL hash(`#/packer`、`#/overwrite`) |
| 4 | 目录粒度 | 粗粒度,每个工具一个文件,`src/common.js` 集中共享 |
| 5 | 测试组织 | `window.runTests` 沿用,迁到 `src/common.js` 末尾 |

## 2. 目录结构

```
dol-beauty-packer/
├── index.html                  # 壳:<head> + tab nav + 两个 <section> 容器
│                               # + <script src="vendor/jszip.min.js">
│                               # + <script type="module" src="src/main.js">
├── vendor/
│   └── jszip.min.js            # 第三方依赖,从根目录搬来,内容不动
├── src/
│   ├── main.js                 # 入口:JSZip 自检 + hash 路由 + 工具挂载/卸载
│   ├── common.js               # 共享纯函数 + UI helpers + window.runTests
│   ├── packer.js               # 工具 1:打包成 modloader 模组(迁自现 index.html)
│   └── overwrite.js            # 工具 2:覆盖原版图包(本次为占位)
├── test/                       # 既有目录,放 .zip fixture(被 .gitignore 忽略 *.zip)
│   ├── conflict-a.zip
│   ├── conflict-b.zip
│   └── ...
├── reference/                  # 既有目录,原 Python 脚本(被 .gitignore 忽略)
│   └── dol美化模组自动生成器.py
├── docs/
│   └── superpowers/
│       ├── specs/              # 含本份新 spec
│       └── plans/
├── README.md                   # 同步更新:文件结构、运行方式
├── LICENSE
└── .gitignore                  # 已覆盖 .claude/、reference/、test/*.zip;vendor/ 与 src/ 跟踪入库
```

**相对当前的关键变更**

| 项 | 当前 | 新结构 |
|---|---|---|
| `jszip.min.js` 位置 | `./jszip.min.js` | `./vendor/jszip.min.js` |
| `index.html` JS 来源 | 内联 `<script>` ~340 行 | 外链 `<script type="module" src="src/main.js">`,自身只剩 DOM 与 `<style>` |
| `index.html` CSS | 内联 `<style>` ~30 行 | **仍内联,沿用**(不拆 CSS,符合极简风格);新增 tab nav 样式 ≤ 8 行 |
| JS 总组织 | 1 个 `<script>` 块 | 4 个 ES Module 文件:`main / common / packer / overwrite` |

**未动**:`LICENSE`、`reference/`、`test/`、`.gitignore`(`vendor/` 与 `src/` 不需要加进 ignore)、`docs/superpowers/{specs,plans}/` 路径约定。

## 3. 模块边界与 API

**依赖方向(箭头 = "依赖")**:

```
index.html
    │
    └─► src/main.js
            │
            ├─► src/common.js  (纯函数 + UI helpers)
            ├─► src/packer.js  (工具 1)
            └─► src/overwrite.js (工具 2,占位)

           packer.js ──► common.js
           overwrite.js ──► common.js
           common.js ──► window.JSZip(运行时全局,不 import)
```

**约束**:
- `common.js` 只能被向下依赖,**不**反向依赖 `packer` / `overwrite`
- `packer.js` 与 `overwrite.js` 互不依赖
- `main.js` 负责把它们串起来
- `common.js` 通过 `window.JSZip` 全局读取 JSZip,不试图把 JSZip 包装成 ESM

### 3.1 `src/common.js`

**职责**:与具体工具无关的可复用单元 + `window.runTests` 入口。

```js
// === 路径与文件名 ===
export function normalizePath(p)
export function isImageFile(name)
export function basenameNoExt(filename)

// === ZIP 操作(浏览器内,依赖 window.JSZip) ===
export async function readZipFile(file)            // JSZip.loadAsync 包装
export function collectEntries(zip, normalizedPath) // 通用 ZIP entries 查询

// === Boot JSON 构造 ===
export function buildBootJson(name, version, imgList, additionList)

// === UI helpers ===
export function escapeHtml(str)
export function setStatus(el, kind, text)          // kind ∈ {'idle','reading','loaded','packing','done','error'}
export function triggerDownload(anchorEl, blob, filename)

// === 测试入口 ===
const _tests = []
export function registerTests(name, fn) { _tests.push({ name, fn }) }

// 文件末尾:
if (typeof window !== 'undefined') {
  window.runTests = function() {
    // 1) common 自身的纯函数 case(平移自现 runTests,共 22+ 条)
    // 2) 遍历 _tests 调用工具注册的 fn
    // 3) console.log PASS/FAIL 计数,返回结果对象
  }
}
```

**自检覆盖**(从现 `runTests` 平移):`normalizePath` 5 case、`isImageFile` 4 case、`basenameNoExt` 3 case、`buildBootJson` 7 case、`escapeHtml` 1 case、关键函数 "exists" 断言。

### 3.2 `src/packer.js`

**职责**:工具 1(打包成 modloader 模组)的全部 UI 与业务。沿用现有多 ZIP 合并实现,1:1 平移。

```js
import {
  normalizePath, isImageFile, basenameNoExt,
  readZipFile, collectEntries, buildBootJson,
  escapeHtml, setStatus, triggerDownload,
  registerTests
} from './common.js'

// === Public lifecycle ===
export function mount(container)   // 把工具 1 的 DOM 注入 container,绑定事件
export function unmount(container) // 卸载:释放 blob URL、container.innerHTML = ''
```

**关键变化**(相对现 `index.html`):

- 全局变量 `let sources = []` → `mount()` 局部 `const state = { sources: [], blobUrl: null }`
- `document.getElementById('xxx')` → `container.querySelector('#xxx')`,防止与未来工具的 id 冲突
- HTML 片段用 template literal 写在 `mount` 内,注入 `container.innerHTML`
- `countMatchEntries` 仍在 packer 内部使用(不导出),`mergeAndPack` / `renderSourcesList` / `renderConflicts` 均为模块内私有

**自检注册**:文件末尾 `registerTests('packer', () => { /* 5 条 packer 自检,平移自现 runTests 末尾 */ })`。

### 3.3 `src/overwrite.js`(占位)

**职责**:工具 2 的扩展插槽。**本次不实现业务**,只定义最小骨架。

```js
// src/overwrite.js
// 占位模块。具体功能"把美化图片包覆盖到 modloader 版本的原版游戏图包"
// 的设计待后续 spec(2026-05-15 之后)。

export function mount(container) {
  container.innerHTML = `
    <h2 style="font-size:1.1em;">覆盖到原版游戏图包</h2>
    <p style="color:#666;">
      把美化图片包直接覆盖到 ModLoader 版本的原版游戏图包(部分 DoL 版本下,
      原版图包通过 ModLoader 加载)。
    </p>
    <p style="color:#aaa;">此工具尚在设计中,占位实现。</p>
  `
}

export function unmount(container) {
  container.innerHTML = ''
}
```

**不**绑定事件、**不**读 JSZip、**不**注册测试。

### 3.4 `src/main.js`

**职责**:JSZip 自检 + hash 路由 + 工具挂载切换。详细机制在 §4 展开,本节先给签名。

```js
import * as packer from './packer.js'
import * as overwrite from './overwrite.js'

// 工具注册表(扩展点)
const TOOLS = {
  'packer':    { label: '打包模组',     module: packer },
  'overwrite': { label: '覆盖原版图包', module: overwrite },
}
const DEFAULT_TOOL = 'packer'

// 1) JSZip 自检 → 失败则在 #tool-container 显示红色错误并 return,不渲染 tab nav
// 2) 渲染 tab nav(基于 TOOLS)
// 3) router():根据 location.hash 决定当前 tool,unmount 旧 → mount 新
// 4) 监听 hashchange + DOMContentLoaded
```

### 3.5 加入第三个工具的完整步骤(扩展契约)

1. 新建 `src/<toolname>.js`,导出 `mount(container)` 与 `unmount(container)`
2. 在 `main.js` 的 `TOOLS` 字典加一行:`'<toolname>': { label: '<显示名>', module: <toolname> }`
3. (可选)新工具需要的共享逻辑,**先看 `common.js` 有没有**;没有再添加。判断规则:**只有一个工具用 → 留在该工具文件;两个或以上用 → 迁到 `common.js`**
4. (可选)在 `<toolname>.js` 末尾用 `registerTests('<toolname>', fn)` 加自检
5. 跑一遍 §5.4 的回归清单确认 packer 不受影响

### 3.6 工具模块对外契约(凡未来新工具都遵守)

```ts
export function mount(container: HTMLElement): void
export function unmount(container: HTMLElement): void
```

- `mount` 同步把工具 UI 注入 `container`,事件全部绑定在 `container` 子树内
- `mount` 内部状态用闭包 / 模块级局部变量,**不**污染 window
- `unmount` 释放所有 blob URL,清空 `container.innerHTML`
- 工具不直接监听 `hashchange`,所有切换由 `main.js` 路由

## 4. Tab 切换与路由机制

### 4.1 `index.html` 骨架

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>DoL 美化模组工具集</title>
  <style>
    /* 现有 CSS 1:1 平移 */
    body { max-width: 640px; margin: 2em auto; padding: 0 1em; }
    h1 { font-size: 1.3em; margin-bottom: 0.5em; }
    /* ...(其余既有样式)... */

    /* 新增 tab nav 样式,不超过 8 行 */
    nav.tabs { margin: 0.8em 0; border-bottom: 1px solid #ddd; }
    nav.tabs button { padding: 0.4em 1em; margin-right: 0.4em;
                       border: 1px solid #ddd; border-bottom: none;
                       background: #f6f6f6; cursor: pointer; }
    nav.tabs button.active { background: #fff; border-bottom: 1px solid #fff;
                              margin-bottom: -1px; }
  </style>
</head>
<body>
  <h1>DoL 美化模组工具集</h1>

  <nav class="tabs" id="tab-nav"></nav>
  <main id="tool-container">正在加载工具集...</main>

  <script src="vendor/jszip.min.js"></script>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- `<nav id="tab-nav">` 由 `main.js` 渲染按钮
- `<main id="tool-container">` 由当前 tool 的 `mount(container)` 接管
- `"正在加载工具集..."` 文案在 module 加载成功并 mount 后被替换;若 module 加载失败,浏览器原生报错到 console,该文案保持作为兜底

### 4.2 URL 路由约定

| URL | 行为 |
|---|---|
| `index.html`(无 hash) | 默认 tab = `packer` |
| `index.html#/packer` | 工具 1 |
| `index.html#/overwrite` | 工具 2 |
| `index.html#/<未知>` | 回退到默认 tab,**并把 hash 修正回 `#/packer`**(`history.replaceState`) |

**为什么是 `#/<name>`**:hash 不触发服务器请求;与 SPA 习惯一致但不引入路由库;若未来某工具有子状态(`#/overwrite/preview`)可平滑扩展。

### 4.3 切换生命周期

```
用户点 tab 按钮 / 修改 hash / 后退前进
       │
       ▼
hashchange 事件 → main.js 的 router()
       │
       ├─ 解析 hash → toolId
       ├─ 若 toolId 未知 → history.replaceState 到默认值,重新触发 router(避免无限循环:replaceState 不会触发 hashchange,显式调用 router)
       ├─ 若 toolId === currentToolId → 直接 return(无操作)
       ├─ currentTool.unmount(container)
       │       ↑ 释放 blob URL / 清空 sources / 移除事件
       ├─ nextTool.mount(container)
       │       ↑ 注入 DOM,绑定事件,初始化状态文案
       └─ 更新 tab nav 的 active 高亮 + currentToolId = toolId
```

**点击 tab 按钮**:`button.onclick = () => { location.hash = '#/' + toolId }`,**不**直接调 mount(让 hashchange 统一处理,避免双路径)。

**首次进入带 hash 的 URL**:`main.js` 加载完成后立即跑一次 `router()`。

### 4.4 浏览器前进/后退

`location.hash` 写入会被自动加入历史,后退/前进会触发 `hashchange`,自动 unmount 旧工具 + mount 新工具。**明确不做**跨切换状态保留:在 packer 里填了一半切到 overwrite 再切回 packer,sources 不保留(见 §7 范围)。

### 4.5 错误兜底

- **JSZip 未加载**(`vendor/jszip.min.js` 缺失/损坏):`main.js` 在路由前先检查 `typeof window.JSZip === 'undefined'`,失败时在 `<main>` 显示红色错误文案,**不**渲染 tab nav,**不**绑定路由
- **module 加载失败**(404 / 语法错误):浏览器原生报错到 console;`<main>` 里的 "正在加载工具集..." 兜底文案保留

## 5. 现有 packer 的迁移映射

**原则**:1:1 平移行为,不顺手重构业务逻辑。命名/导出/作用域调整可以做,但 `mergeAndPack` 算法、`boot.json` 结构、UI 文案、冲突展示形式都不动。

### 5.1 函数级映射表

| 现 `index.html` 位置 | 函数/变量 | 新位置 | 备注 |
|---|---|---|---|
| `// === 纯函数 ===` | `normalizePath` | `src/common.js` | 1:1 |
| 同上 | `isImageFile` | `src/common.js` | 1:1 |
| 同上 | `basenameNoExt` | `src/common.js` | 1:1 |
| 同上 | `escapeHtml` | `src/common.js` | 1:1 |
| 同上 | `buildBootJson` | `src/common.js` | 1:1 |
| `// === 业务函数 ===` | `readZipFile` | `src/common.js` | 1:1(与 JSZip 解耦,通用) |
| 同上 | `collectEntries` | `src/common.js` | 1:1(两个工具都会用) |
| 同上 | `countMatchEntries` | `src/packer.js` | packer 内部使用,不导出 |
| 同上 | `let sources = []` | `src/packer.js` | 改成 `mount()` 内部 `state` |
| 同上 | `renderSourcesList` | `src/packer.js` | 接受 `(container, state, setStatus)` |
| 同上 | `mergeAndPack` | `src/packer.js` | 1:1 平移,签名不变 |
| 同上 | `triggerDownload` | `src/common.js` | 改为接受 `anchorEl` 显式参数 |
| 同上 | `renderConflicts` | `src/packer.js` | 接受 `container.querySelector('#conflicts')` |
| `// === UI 与事件绑定 ===` | `statusEl`, `setStatus` | `src/common.js` | `setStatus(el, kind, text)` 显式接 el |
| 同上 | `#file` change 事件 | `src/packer.js` | 在 `mount()` 内绑定 |
| 同上 | `#add-zip` click 事件 | `src/packer.js` | 在 `mount()` 内绑定 |
| 同上 | `#pack` click 事件 | `src/packer.js` | 在 `mount()` 内绑定 |
| `// === 自检 ===` | `window.runTests` | `src/common.js` 末尾 | 改用 `registerTests` 集合 |

### 5.2 DOM 结构迁移

现 packer 工具的所有 DOM(`<input id="file">`、`#name`、`#version`、`#sources-list`、`#add-zip`、`#pack`、`#status`、`#conflicts`、`#download`)**全部**移到 `packer.js` 的 `mount(container)` 内,通过 template literal 注入 `container.innerHTML`。`id` 属性保留,但 `document.getElementById('xxx')` 全部改为 `container.querySelector('#xxx')`。

### 5.3 `mount/unmount` 责任清单

**mount(container)**:
1. 把上面那段 DOM 注入 `container.innerHTML`
2. 初始化局部状态 `state = { sources: [], blobUrl: null }`
3. 绑定 3 个事件(`#file` change / `#add-zip` click / `#pack` click)
4. 调用一次 `renderSourcesList(container, state)` 让初始空态文案显示

**unmount(container)**:
1. 若 `state.blobUrl` 存在,`URL.revokeObjectURL(state.blobUrl)`
2. `container.innerHTML = ''`(浏览器自动 GC 移除的 DOM 上的事件监听器)
3. 释放对 `state` 的局部引用(函数返回后自动 GC)

### 5.4 行为一致性回归清单

迁移后手工跑一遍,**必须**与现 `index.html` 行为一致:

| # | 场景 | 期望 |
|---|------|------|
| 1 | 单 ZIP 合并 = 原有功能 | 输出结构与现单 ZIP 完全一致 |
| 2 | 两个 ZIP 无冲突合并 | imgFileList 含两者,冲突 0 |
| 3 | 两个 ZIP 有冲突(靠下赢) | 用靠下的文件,冲突 1 |
| 4 | 上移/下移按钮 | 顺序正确,打包时顺序正确 |
| 5 | 删除行 | 列表重渲,打包不含已删行 |
| 6 | 空路径报错 | 红色报错,不生成产物 |
| 7 | 产物名默认 | name = 第一个 zip 文件名去扩展名 |
| 8 | 版本号默认 | version = "1.0.0" |
| 9 | 重复打包 | 旧 blob URL revoke,新下载链接出现 |
| 10 | 冲突详情展开 | `<details>` 展开显示来源 → 目标映射 |
| 11 | 添加时部分文件损坏 | 合法 zip 加入列表,损坏报错 |
| 12 | 匹配数实时更新 | 修改 path 后该行匹配数即时变化 |
| 13 | 直接打开 `index.html` | 自动渲染 packer 工具,行为与现一致 |
| 14 | 切到 overwrite 再切回 | packer 重新 mount,初始空态(sources 不保留) |
| 15 | 直接打开 `#/overwrite` | 显示 overwrite 占位文案 |
| 16 | 直接打开 `#/unknown` | hash 修正为 `#/packer`,显示 packer |
| 17 | `runTests()` | 控制台 PASS ≥ 22(与现一致) |

## 6. 测试组织

### 6.1 模式

沿用 `window.runTests` 浏览器内手动调用模式。物理位置:

- `src/common.js` 末尾装 `_tests = []`,导出 `registerTests(name, fn)`,并在文件底部把 `runTests` 挂到 `window`
- `src/packer.js` 末尾(模块顶层副作用):`registerTests('packer', () => { /* 5 条 packer 自检 */ })`
- `src/overwrite.js` 占位阶段**不**注册测试(没有逻辑可测)

### 6.2 调用方式

浏览器 F12 → `runTests()` → 控制台输出 PASS/FAIL 计数。

### 6.3 验证标准

重构后 `runTests()` 的 PASS 数 ≥ 现有 22 条。

## 7. 部署 / 本地运行

部署与现状**完全一致**,无构建步骤:

```bash
# 本地运行
cd dol-beauty-packer
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

**唯一变化点**:**必须**通过 HTTP 协议访问,**禁止** `file://` 直接打开 `index.html` — 浏览器对 ES Modules 的 CORS 策略不允许 `file://` 协议下加载本地 module。

**README 同步更新**:
- 「快速使用」一节里"启动本地 HTTP 服务器"加粗强调
- 显式添加"**禁止 file:// 双击打开**"提示
- 「文件结构」一节更新到 §2 的新结构

## 8. 不在本 spec 范围

| 项 | 原因 |
|---|---|
| `overwrite` 工具的实际算法/UI/输入输出 | 留给下一次 brainstorm + spec |
| 引入构建工具 / npm / `package.json` | §1.2 决策 1 已排除 |
| CSS 拆分成独立文件 | 现 ≤30 行,不值得;tab nav 增量 ≤8 行 |
| 跨 tab 共享/保留状态(切回 packer 仍有之前的 sources) | YAGNI;明确不做 |
| 把 JSZip 包装成 ES Module | 麻烦且无收益,`window.JSZip` 全局即可 |
| i18n | 一致沿用现有"仅中文"约定 |
| 服务端 / CI / 自动部署 | 项目性质就是静态站,不需要 |
| 单元测试框架(vitest 等) | 与零工具链路线冲突 |
| Lazy import(动态加载工具模块) | 当前两个工具体量都小,YAGNI |

## 9. 关键风险与缓解

| 风险 | 缓解 |
|---|---|
| 用户双击 `file://` 打开 → ES Modules 加载失败 | README 显眼提示;`<main>` 默认文案 "正在加载工具集..." 作为兜底 |
| 老 README / 外部文档可能指向 `./jszip.min.js`(旧位置) | 同 PR 内更新 README;`index.html` 内引用 `vendor/jszip.min.js` |
| 1:1 平移过程中漏掉某个边界行为 | §5.4 的回归清单逐条手工跑通才能视为完成 |
| ES Modules 在某些老浏览器不支持 | 现有用户群都是 Chromium/Firefox/Safari 近三年,与现兼容性声明一致 |
| `id` 重名(未来 overwrite 也用 `#status`) | §3.6 / §5.2 强制 `container.querySelector('#xxx')` 隔离 |
| `unmount` 漏 revoke blob URL → 内存泄漏 | §5.3 明确清单;packer mount 内只保留一个 blobUrl ref |
| `history.replaceState` 修正 hash 不触发 hashchange,可能导致默认 tab 没 mount | §4.3 明确:replaceState 后**显式**调用 router(),不依赖事件 |
| 现有 `runTests` 与新结构里 `_tests` 数组的注册时序 | `packer.js` 顶层 `registerTests('packer', fn)` 是 ESM 加载时同步执行,在 `main.js` 调用 router() 之前完成,不会缺漏 |

## 10. 实施里程碑(给 writing-plans 用)

- **M1**:目录骨架就位 — 新建 `src/`、`vendor/`,把 `jszip.min.js` 移到 `vendor/`,`index.html` 暂时仍跑现有逻辑(可以是 `<script type="module" src="src/main.js">` 还没真正接上,但页面能开)
- **M2**:`src/common.js` 落地 — 平移所有纯函数 + `setStatus` + `triggerDownload` + `registerTests` + `window.runTests`,控制台 `runTests()` ≥ 22 PASS
- **M3**:`src/packer.js` 落地 — 把现有 packer 逻辑包成 `mount/unmount`,功能与现 `index.html` 100% 等价(§5.4 回归 1-12)
- **M4**:`src/main.js` 落地 — tab nav 渲染 + hash 路由 + JSZip 自检,默认 tab = packer(§5.4 回归 13)
- **M5**:`src/overwrite.js` 占位 + README 更新 — 切到 overwrite tab 看到占位文案,切回 packer 一切正常(§5.4 回归 14-17)

新功能"覆盖原版图包"本身**不**在本里程碑列表中 — 那是下一份 spec/plan。
