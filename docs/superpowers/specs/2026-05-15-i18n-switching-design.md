# 「i18n 切换」功能设计文档

## §1 目标与范围

为「DoL 美化模组工具集」加入中/英双语切换：

- 顶部 tab nav 右侧增加语言切换器，两个按钮：`中文` / `EN`。
- 整站 UI 文本（标签、按钮、placeholder、状态、错误信息、tab 名）均经过 `t(key, vars)` 翻译。
- **首次访问按浏览器语言自动选择**：`navigator.language` 主语言为 `zh` → `zh-CN`；其余（含 `en` 与所有未识别语言）→ `en-US`。
- 用户手动切换后写入 `localStorage`，刷新后保持用户选择（覆盖浏览器检测）。
- 切换语言时同步更新 `<html lang>`，重渲染当前 tab。

**不在范围**：
- 不支持除 zh-CN / en-US 之外的语言（YAGNI；架构留扩展点但不实现）。
- 不翻译 README / 设计文档 / 注释 / `console.log` 日志（仅用户面向文本走 i18n）。
- 不引入任何第三方 i18n 库（保持零构建/vanilla ES Modules 路线）。
- 不做切换时保留 sources 列表的高级体验优化（沿用 unmount+mount 生命周期，已添加的 ZIP 会被清空）。
- 不做 ICU 复数 / 性别 / 上下文规则；动态数量用 `X file(s)` 或单复合一表述。

## §2 架构与复用

```
index.html
├── <nav class="tabs" id="tab-nav">           # 现有,main.js 渲染 tab 按钮
└── <div class="lang-switch" id="lang-switch"># 新增,放 nav 同行靠右

src/
├── i18n.js                                  # 新增,核心 i18n 模块
├── main.js                                  # 改:渲染语言切换器、监听切换事件、同步 <html lang>
├── common.js                                # 改:错误信息走 t(...);新增 i18n 自检
├── packer.js                                # 改:模板/状态/错误全部走 t(...)
└── overwrite.js                             # 同上
```

设计原则：

- **零构建**：纯 ES Modules + vanilla JS,延续现有路线。
- **集中字典**：所有翻译写在 `src/i18n.js`,导出 `messages` 对象;不按工具/语言拆文件(100 条文本不值得拆)。
- **扁平点分键**:`packer.button.addZip` 形式,便于自检与扫描。
- **占位符插值**:`{name}` 风格,`t()` 内做朴素 `String.replace`,不引入模板引擎。
- **生命周期复用**:切换语言 = 当前工具 `unmount` + `mount`,无需引入新机制。

## §3 关键决策

| # | 决策点 | 选择 | 备选 | 理由 |
|---|--------|------|------|------|
| D1 | 支持语言 | zh-CN + en-US | + ja-JP / 多语言 | 受众主体中文,DoL 原版英文;其余 YAGNI |
| D2 | 首次默认语言 | `navigator.language` 主语言匹配:`zh` → `zh-CN`,其余 → `en-US` | 总是 zh-CN / 总是 en-US / 弹窗询问 | 受众有海外 DoL 玩家;中文用户浏览器普遍 `zh-CN`,自动检测可命中;识别不出时偏英文(更通用) |
| D2b | 字典回退语言 | 缺失 key 时回退到 `zh-CN`(canonical) | 回退 en-US | 中文字典为源文本,翻译漏译时回退中文比回退到自己更有意义 |
| D3 | 库选型 | 自写 `t(key, vars)` | i18next 等 | 守住零构建约定,无依赖 |
| D4 | 资源组织 | 单文件 `src/i18n.js` | 按语言/工具拆文件 | 100 条文本,单文件最简 |
| D5 | 键命名 | 扁平点分 `ns.section.key` | 嵌套对象访问 | 易做缺失/重复自检 |
| D6 | 切换 UI | tab nav 右侧两按钮 | 下拉/设置弹窗 | 极简、视觉与 tabs 一致 |
| D7 | 持久化 | `localStorage['dolbp_lang']` | URL query / sessionStorage | hash 已被 tab 路由占用 |
| D8 | 切换刷新 | 触发当前工具 unmount+mount + nav 重渲染 | data-i18n 增量替换 | 沿用现有生命周期 |
| D9 | 插值 | `{name}` 占位符 | printf / ICU | 中文无复数,英文用 `X file(s)` |
| D10 | 错误信息 | `throw new Error(t('common.error.xxx'))` | 保留中文 | 用户面向错误必须可翻译 |
| D11 | `<html lang>` | 切换时同步 | 不动 | a11y 与字体渲染 |
| D12 | 测试 | `runTests()` 新增 i18n 自检 | 跳过 | 防漏翻 |

## §4 UI 布局

### 4.1 index.html 新增节点

```html
<nav class="tabs" id="tab-nav"></nav>
<div class="lang-switch" id="lang-switch"></div>
```

样式调整（让 nav 与 lang-switch 同行）：

```css
.top-bar { display: flex; align-items: flex-end; gap: 0.6em; border-bottom: 1px solid #ddd; margin: 0.8em 0; }
nav.tabs { flex: 1; border-bottom: none; margin: 0; }
.lang-switch { display: flex; gap: 0.3em; padding-bottom: 0.4em; }
.lang-switch button { padding: 0.2em 0.6em; font-size: 0.85em; border: 1px solid #ddd; background: #f6f6f6; cursor: pointer; }
.lang-switch button.active { background: #fff; font-weight: bold; }
```

实施方式：把 `<nav>` 和 `<div id="lang-switch">` 一起包在 `<div class="top-bar">` 里。

### 4.2 切换器形态

两个独立按钮（不用 `<select>`，避免下拉一次点击的成本）：

```
[ 打包模组 ] [ 覆盖原版图包 ]         [中文] [EN]
─────────────────────────────────────────────────
```

- 当前语言按钮加 `active` class。
- 点击触发 `setLang(code)`。

## §5 src/i18n.js 设计

### 5.1 公共 API

```js
export const SUPPORTED_LANGS = ['zh-CN', 'en-US'];
export const FALLBACK_LANG = 'zh-CN';   // 字典缺失 key 时回退的语言(canonical)
export const STORAGE_KEY = 'dolbp_lang';

export const messages = {
  'zh-CN': { /* 见 §6 */ },
  'en-US': { /* 见 §6 */ },
};

// 纯函数:把 BCP-47 标签映射到 SUPPORTED_LANGS,zh-* → 'zh-CN',其余 → 'en-US'。导出供测试调用。
export function pickLangFromTag(tag)

export function getLang() {
  // 1. localStorage 优先(用户曾手动选择)
  // 2. 否则用 pickLangFromTag(navigator.languages[0] || navigator.language || '')
  //    navigator 不可用时退化为 pickLangFromTag('') → 'en-US'
}
export function setLang(code)               // 写 storage + emit langchange
export function t(key, vars = {})           // 查询 + 占位符替换 + 缺失回退到 FALLBACK_LANG
export function onLangChange(cb)            // 简易订阅,返回 unsubscribe
```

### 5.2 `t(key, vars)` 行为

1. 取 `messages[getLang()][key]`。
2. 若不存在 → 取 `messages[FALLBACK_LANG][key]`，并 `console.warn('[i18n] missing key', key, 'in', lang)`。
3. 若 FALLBACK_LANG 中也不存在 → 返回 `key` 本身（防止 UI 空白），并 `console.warn`。
4. 用 `vars` 替换 `{name}`：

   ```js
   text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : '{' + k + '}'));
   ```

5. 不做 HTML 转义（调用方决定是否用 `escapeHtml`）。

### 5.3 切换流程

```
用户点击 [EN]
  → setLang('en-US')
  → localStorage 写入
  → emit langchange 事件
    ↳ main.js 监听:
       1. document.documentElement.lang = 'en-US'
       2. unmount(currentTool)
       3. mount(currentTool)         // mount 内部首次渲染就用新语言
       4. 重渲染 #tab-nav            // tab 按钮文案
       5. 重渲染 #lang-switch        // active class 切换
```

## §6 翻译键清单

完整字典列表见下表。中文取自现有硬编码文本（保持一致），英文给出第一版译文。

### 6.1 common（通用）

| key | zh-CN | en-US |
|-----|-------|-------|
| `common.error.jszip_missing` | `JSZip 未加载` | `JSZip is not loaded` |
| `common.error.invalid_zip` | `压缩包 {name} 损坏或不是有效的 ZIP` | `Archive {name} is corrupted or not a valid ZIP` |
| `common.error.non_zip_skipped` | `错误: 有 {count} 个文件不是 .zip，已跳过` | `Error: {count} non-zip file(s) skipped` |
| `common.error.no_match` | `"{name}" 路径 "{path}" 下无任何文件匹配` | `No files matched under path "{path}" in "{name}"` |
| `common.button.download` | `下载 {filename}` | `Download {filename}` |
| `common.lang.zh` | `中文` | `中文` |
| `common.lang.en` | `EN` | `EN` |
| `common.app.title` | `DoL 美化模组工具集` | `DoL Beauty Mod Toolkit` |
| `common.error.loadTool` | `错误: 加载工具 {id} 失败,请查看控制台` | `Error: Failed to load tool {id}, see console` |
| `common.error.jszipBoot` | `错误: 依赖 JSZip 加载失败, 请检查 vendor/jszip.min.js` | `Error: Failed to load JSZip, check vendor/jszip.min.js` |
| `common.loading` | `正在加载工具集...` | `Loading toolkit...` |

### 6.2 tab（工具名）

| key | zh-CN | en-US |
|-----|-------|-------|
| `tab.packer` | `打包模组` | `Pack Mod` |
| `tab.overwrite` | `覆盖原版图包` | `Overlay Vanilla` |

### 6.3 packer（打包工具）

| key | zh-CN | en-US |
|-----|-------|-------|
| `packer.intro` | `把含 body/clothes 等子目录的 ZIP 压缩包打包成 DoL ModLoader 格式。列表中越靠下的 ZIP 优先级越高（后写覆盖前写）。` | `Package ZIPs containing body/clothes subfolders into DoL ModLoader format. Later entries override earlier ones.` |
| `packer.label.modName` | `模组名称:` | `Mod name:` |
| `packer.placeholder.modName` | `(留空则取第一个 ZIP 文件名)` | `(defaults to first ZIP filename)` |
| `packer.label.version` | `版本号:` | `Version:` |
| `packer.label.sourcesList` | `来源列表:` | `Source list:` |
| `packer.empty.sources` | `暂无 ZIP，请点击「+ 添加 ZIP」` | `No ZIP yet, click "+ Add ZIP"` |
| `packer.button.addZip` | `+ 添加 ZIP` | `+ Add ZIP` |
| `packer.button.pack` | `开始打包` | `Pack` |
| `packer.button.up` | `上移` | `Up` |
| `packer.button.down` | `下移` | `Down` |
| `packer.button.del` | `删除` | `Delete` |
| `packer.label.imgPath` | `img路径:` | `img path:` |
| `packer.status.idle` | `请添加至少一个 ZIP 文件` | `Please add at least one ZIP` |
| `packer.status.reading` | `正在解析 {count} 个压缩包...` | `Parsing {count} archive(s)...` |
| `packer.status.loaded` | `已添加 {zipCount} 个 ZIP, 共 {fileCount} 个文件` | `Added {zipCount} ZIP(s), {fileCount} file(s) total` |
| `packer.status.packing` | `正在合并与打包...` | `Merging and packing...` |
| `packer.status.done` | `完成 ✓ 合并 {count} 个文件` | `Done ✓ merged {count} file(s)` |
| `packer.status.done_conflicts` | `, 冲突(覆盖) {count} 个` | `, {count} conflict(s) overridden` |
| `packer.summary.matchCount` | `匹配 {count} 个文件` | `Matched {count} file(s)` |
| `packer.summary.folderHint` | ` ({count} 个目录: {first}{more})` | ` ({count} folder(s): {first}{more})` |
| `packer.summary.more` | `, ...` | `, ...` |
| `packer.conflicts.title` | `冲突列表 ({count})` | `Conflicts ({count})` |
| `packer.error.needZip` | `错误: 请至少添加一个 ZIP 文件` | `Error: please add at least one ZIP` |

### 6.4 overwrite（覆盖工具）

| key | zh-CN | en-US |
|-----|-------|-------|
| `overwrite.intro` | `上传原版游戏图包(.mod.zip)，再添加覆盖图包ZIP，合并后生成覆盖版模组。` | `Upload the vanilla image pack (.mod.zip), then add overlay ZIP(s) to produce an overlayed mod.` |
| `overwrite.base.empty` | `暂未上传原版图包` | `No vanilla pack uploaded yet` |
| `overwrite.button.addBase` | `+ 上传原版图包` | `+ Upload vanilla pack` |
| `overwrite.label.sourcesList` | `覆盖图包来源列表:` | `Overlay source list:` |
| `overwrite.empty.sources` | `暂无覆盖 ZIP，请点击「+ 添加覆盖 ZIP」` | `No overlay ZIP, click "+ Add overlay ZIP"` |
| `overwrite.button.addZip` | `+ 添加覆盖 ZIP` | `+ Add overlay ZIP` |
| `overwrite.label.modName` | `模组名称:` | `Mod name:` |
| `overwrite.placeholder.modName` | `(默认: 原版名-overwrite)` | `(default: vanilla-overwrite)` |
| `overwrite.label.version` | `版本号:` | `Version:` |
| `overwrite.button.pack` | `开始覆盖打包` | `Build overlay` |
| `overwrite.status.idleBase` | `请先上传原版图包` | `Please upload the vanilla pack first` |
| `overwrite.status.idleSources` | `请添加至少一个覆盖图包` | `Please add at least one overlay` |
| `overwrite.status.ready` | `已准备好，可以开始覆盖打包` | `Ready, you can build the overlay` |
| `overwrite.status.readingBase` | `正在解析原版图包...` | `Parsing vanilla pack...` |
| `overwrite.status.readingSources` | `正在解析 {count} 个覆盖图包...` | `Parsing {count} overlay(s)...` |
| `overwrite.status.packing` | `正在合并与打包，时间可能较长，请耐心等待...` | `Merging and packing, may take a while...` |
| `overwrite.status.done` | `完成 ✓ 合并 {count} 个文件` | `Done ✓ merged {count} file(s)` |
| `overwrite.status.done_conflicts` | `, 冲突(覆盖) {count} 个` | `, {count} conflict(s) overridden` |
| `overwrite.base.summary` | `已上传: {name}<br>模组名称: {modName}<br>版本: {version}<br>img/ 文件数: {imgCount}` | `Uploaded: {name}<br>Mod name: {modName}<br>Version: {version}<br>img/ files: {imgCount}` |
| `overwrite.base.unknown` | `(未知)` | `(unknown)` |
| `overwrite.error.notZip` | `错误: 原版图包必须是 .zip 文件` | `Error: vanilla pack must be a .zip file` |
| `overwrite.error.notMod` | `错误: 这不是有效的 ModLoader 模组图包（缺少 boot.json）` | `Error: not a valid ModLoader pack (missing boot.json)` |
| `overwrite.error.needBase` | `错误: 请先上传原版图包` | `Error: please upload the vanilla pack first` |
| `overwrite.error.needSources` | `错误: 请至少添加一个覆盖图包` | `Error: please add at least one overlay` |
| `overwrite.conflicts.title` | `冲突列表 ({count})` | `Conflicts ({count})` |
| `overwrite.conflicts.fromVanilla` | `原版` | `vanilla` |
| `overwrite.conflicts.fromPrev` | `前序覆盖` | `previous overlay` |

### 6.5 键命名约定

- 第一段 = 命名空间(`common` / `tab` / `packer` / `overwrite`)。
- 第二段 = 类别(`button` / `label` / `placeholder` / `status` / `error` / `summary` / `conflicts` / `empty` / `intro` / ...)。
- 第三段 = 具体含义(`addZip` / `idle` / `done` / ...)。
- 所有 key 在 `messages['zh-CN']` 与 `messages['en-US']` 中**必须同时存在**(由 i18n 自检保证)。

## §7 文件改动清单

| 文件 | 动作 | 主要改动 |
|------|------|----------|
| `src/i18n.js` | **新增** | 字典 + getLang/setLang/t/onLangChange |
| `index.html` | 改 | 引入 `top-bar` 容器,新增 `#lang-switch`;`<title>` 保留中文(浏览器标签栏不切) |
| `src/main.js` | 改 | 渲染 lang-switch;监听 langchange 重 mount 当前工具 + 重渲染 nav;启动时同步 `<html lang>`;TOOLS 表的 `label` 改为 i18n key 引用 |
| `src/common.js` | 改 | `throw new Error('JSZip 未加载')` → `throw new Error(t('common.error.jszip_missing'))`;`triggerDownload` 中拼接 "下载 {filename}" 改 `t('common.button.download', { filename })`;`readBootJson` 的 `console.warn` 保留中文(开发者面向) |
| `src/packer.js` | 改 | HTML 模板字符串改为函数 `renderHTML()`,每次 mount 时调用,内部全部 `t(...)`;`renderSourcesList` / `renderConflicts` / `setStatus` 调用全部走 i18n |
| `src/overwrite.js` | 改 | 同 `packer.js` |
| `runTests()` (`common.js` 中) | 改 | 新增 i18n 章节自检(key 对齐、占位符替换) |
| `docs/superpowers/specs/2026-05-15-i18n-switching-design.md` | **新增** | 本文档 |
| `README.md` | 不变 | 文档保留中文;若希望 README 也英化属未来工作 |

## §8 关键代码草图

### 8.1 src/i18n.js

```js
// src/i18n.js
export const SUPPORTED_LANGS = ['zh-CN', 'en-US'];
export const FALLBACK_LANG = 'zh-CN';   // 字典回退(canonical)
export const STORAGE_KEY = 'dolbp_lang';

export const messages = {
  'zh-CN': {
    'common.error.jszip_missing': 'JSZip 未加载',
    // ... 见 §6
  },
  'en-US': {
    'common.error.jszip_missing': 'JSZip is not loaded',
    // ... 见 §6
  },
};

let _listeners = [];

// 纯函数:输入 BCP-47 语言标签(如 'zh-CN'/'en'/'ja-JP'/''),输出 SUPPORTED_LANGS 之一。
// 规则:取主语言段;'zh' → 'zh-CN';其余(含空) → 'en-US'。
export function pickLangFromTag(tag) {
  const main = String(tag || '').toLowerCase().split('-')[0];
  if (main === 'zh') return 'zh-CN';
  return 'en-US';
}

// 内部:读取浏览器语言,委托给 pickLangFromTag。
function detectFromBrowser() {
  let raw = '';
  try {
    if (typeof navigator !== 'undefined') {
      raw = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    }
  } catch (_) { /* 忽略 */ }
  return pickLangFromTag(raw);
}

export function getLang() {
  let stored = null;
  try {
    if (typeof localStorage !== 'undefined') {
      stored = localStorage.getItem(STORAGE_KEY);
    }
  } catch (_) { /* 忽略 */ }
  if (SUPPORTED_LANGS.includes(stored)) return stored;
  return detectFromBrowser();
}

export function setLang(code) {
  if (!SUPPORTED_LANGS.includes(code)) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
    }
  } catch (_) { /* 隐私模式等场景:仅当前会话生效 */ }
  for (const cb of _listeners) {
    try { cb(code); } catch (err) { console.error('[i18n] listener', err); }
  }
}

export function onLangChange(cb) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter((x) => x !== cb); };
}

export function t(key, vars) {
  vars = vars || {};
  const lang = getLang();
  let text = messages[lang] && messages[lang][key];
  if (text === undefined) {
    if (lang !== FALLBACK_LANG) {
      text = messages[FALLBACK_LANG] && messages[FALLBACK_LANG][key];
      if (text !== undefined) {
        console.warn('[i18n] missing key', key, 'in', lang);
      }
    }
    if (text === undefined) {
      console.warn('[i18n] missing key', key);
      return key;
    }
  }
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : '{' + k + '}'));
}
```

**注意**:`setLang` 只在用户**手动切换**时被调用;首次访问不写 localStorage,这样用户切换浏览器语言后(未手动选择过的情况下)能继续匹配上新语言。

### 8.2 src/main.js 切换片段

```js
import { getLang, setLang, t, onLangChange, SUPPORTED_LANGS } from './i18n.js';

const TOOLS = {
  packer:    { labelKey: 'tab.packer',    module: packer },
  overwrite: { labelKey: 'tab.overwrite', module: overwrite },
};

function renderLangSwitch() {
  const el = document.getElementById('lang-switch');
  if (!el) return;
  el.innerHTML = '';
  for (const code of SUPPORTED_LANGS) {
    const btn = document.createElement('button');
    btn.textContent = (code === 'zh-CN') ? t('common.lang.zh') : t('common.lang.en');
    btn.dataset.lang = code;
    if (code === getLang()) btn.classList.add('active');
    btn.addEventListener('click', () => setLang(code));
    el.appendChild(btn);
  }
}

function renderNav() {
  navEl.innerHTML = '';
  for (const id of Object.keys(TOOLS)) {
    const btn = document.createElement('button');
    btn.textContent = t(TOOLS[id].labelKey);
    btn.dataset.tool = id;
    btn.addEventListener('click', () => { location.hash = '#/' + id; });
    navEl.appendChild(btn);
  }
}

function init() {
  document.documentElement.lang = getLang();
  // ...JSZip 自检...
  renderNav();
  renderLangSwitch();
  router();

  onLangChange((code) => {
    document.documentElement.lang = code;
    if (currentToolId && TOOLS[currentToolId]) {
      TOOLS[currentToolId].module.unmount(containerEl);
      TOOLS[currentToolId].module.mount(containerEl);
    }
    renderNav();
    renderLangSwitch();
    updateNavActive();
  });
}
```

### 8.3 packer.js 模板模式

把原来字符串字面量 `HTML` 改成函数,每次 mount 重新求值:

```js
function renderTemplate() {
  return `
    <p class="intro">${t('packer.intro')}</p>
    <input type="file" id="file" accept=".zip" multiple hidden>
    <label>
      <span>${t('packer.label.modName')}</span>
      <input type="text" id="name" placeholder="${t('packer.placeholder.modName')}">
    </label>
    ...
    <button id="add-zip">${t('packer.button.addZip')}</button>
    <button id="pack" disabled>${t('packer.button.pack')}</button>
    <div id="status">${t('packer.status.idle')}</div>
    ...
  `;
}

export function mount(container) {
  container.innerHTML = renderTemplate();
  // ...
}
```

## §9 边界与错误处理

| 场景 | 行为 |
|------|------|
| 首次访问 + `navigator.language` = `zh-CN` / `zh-TW` / `zh-HK` 等 | 主语言段为 `zh`,启动语言 = `zh-CN` |
| 首次访问 + `navigator.language` = `en` / `en-US` / `en-GB` 等 | 启动语言 = `en-US` |
| 首次访问 + `navigator.language` = `ja-JP` / `fr-FR` / 其他非中英 | 启动语言 = `en-US`(兜底) |
| `navigator` 不可用 / 抛错 | 启动语言 = `en-US` |
| `localStorage` 不可用(隐私模式) | `setLang` 写入失败被吞掉,语言仅当前会话生效 |
| `messages[lang][key]` 缺失 | 回退 `FALLBACK_LANG` 字典,`console.warn` |
| `messages[FALLBACK_LANG][key]` 也缺失 | 返回 key 字符串本身防止空 UI,`console.warn` |
| `vars` 中没有占位符所需 key | 保留 `{name}` 字面量 |
| 用户手改 `localStorage` 为非法值 | `getLang()` 检测白名单失败 → 回到 `detectFromBrowser()` 流程 |
| 切换语言时正在打包(异步进行中) | 完成后状态显示新语言;打包逻辑不受影响 |
| 切换语言时 sources 列表非空 | unmount 后 sources 状态丢失(已声明) |

## §10 测试策略

### 10.1 `runTests()` 新增 i18n 章节

> 浏览器检测分支不便在真实浏览器里 mock `navigator`,所以 `pickLangFromTag(tag)` 作为纯函数导出,直接覆盖映射规则。

| # | 测试项 | 期望 |
|---|--------|------|
| 1 | `t` 是函数 | true |
| 2 | `getLang()` 返回值 ∈ SUPPORTED_LANGS | true |
| 3 | 两语言 key 集合相等 | `Object.keys(messages['zh-CN']).sort().join('\|') === Object.keys(messages['en-US']).sort().join('\|')` |
| 4 | 占位符替换 | `t('packer.status.reading', { count: 3 })` 包含 `3`,不含 `{count}` |
| 5 | 缺失 key 回退 | `t('nonexistent.key')` === `'nonexistent.key'` |
| 6 | `setLang('en-US') → t('tab.packer')` === `'Pack Mod'` | 切换后立即生效 |
| 7 | `setLang('zh-CN') → t('tab.packer')` === `'打包模组'` | 切换回来生效 |
| 8 | 非法 `setLang('xx')` 不改变当前语言 | true |
| 9 | `onLangChange` 回调被触发 | true |
| 10 | `pickLangFromTag('zh-CN')` === `'zh-CN'` | true |
| 11 | `pickLangFromTag('zh-TW')` === `'zh-CN'` | true |
| 12 | `pickLangFromTag('en-US')` === `'en-US'` | true |
| 13 | `pickLangFromTag('en')` === `'en-US'` | true |
| 14 | `pickLangFromTag('ja-JP')` === `'en-US'` | 非中英兜底 |
| 15 | `pickLangFromTag('')` === `'en-US'` | 空兜底 |
| 16 | 测试结束后恢复原 lang | 避免污染后续测试 |

### 10.2 手工回归清单

> 测试前先 `localStorage.removeItem('dolbp_lang')`,确保首次访问场景。

| # | 步骤 | 期望 |
|---|------|------|
| 1 | 浏览器主语言为 `zh-CN`,首次访问 | nav 中文;`[中文]` active;`<html lang>=zh-CN`;localStorage 无值 |
| 2 | 浏览器主语言为 `en-US`,首次访问 | nav 英文;`[EN]` active;`<html lang>=en-US`;localStorage 无值 |
| 3 | 浏览器主语言为 `ja-JP`,首次访问 | nav 英文(兜底);`<html lang>=en-US`;localStorage 无值 |
| 4 | 点击 `EN`(在中文页面) | nav 切换为英文;`<html lang>=en-US`;localStorage 写入 `en-US` |
| 5 | 刷新页面 | 仍为英文(localStorage 优先) |
| 6 | 在 packer 添加 ZIP,然后切回中文 | sources 被清空(已声明);中文文案正确 |
| 7 | 切到 overwrite tab | 当前语言文案正确 |
| 8 | F12 `localStorage.removeItem('dolbp_lang')` 后刷新 | 重新走浏览器检测,语言可能变化(取决于浏览器) |
| 9 | F12 `localStorage.setItem('dolbp_lang','fr-FR')` 后刷新 | 白名单检查失败 → 走浏览器检测 |
| 10 | F12 `runTests()` | 所有 i18n 自检 PASS |

## §11 里程碑

| 里程碑 | 内容 |
|--------|------|
| M1 | `src/i18n.js` 新增(API + 中文全量 + 英文全量字典) |
| M2 | `index.html` 加 `top-bar` 容器 + `#lang-switch` + CSS |
| M3 | `src/main.js` 接入 i18n(渲染 nav/lang-switch、监听切换、同步 html lang) |
| M4 | `src/common.js` 错误与下载提示走 i18n;`runTests()` 增加 i18n 自检 |
| M5 | `src/packer.js` 全量改造(`renderTemplate()`,所有面向用户字符串走 `t()`) |
| M6 | `src/overwrite.js` 全量改造 |
| M7 | 浏览器手工回归 + `runTests()` 验证 |
| M8 | 提交 |

## §12 风险与缓解

| 风险 | 缓解 |
|------|------|
| 英文译文质量不齐(机翻味/术语漂移) | 先给草稿;术语固定:mod / overlay / ZIP / boot.json 保留原文;ImageLoaderHook 等保留原英文 |
| 切换语言导致 sources 列表清空,用户困惑 | 在状态栏切换语言时给一行短提示(可选 §10 测试覆盖);未来若想保留,把 sources 提到工具外的会话级 state(后续 spec) |
| `{count}` 占位符与英文复数不匹配(`1 ZIPs`) | 统一用 `X file(s)` / `X ZIP(s)` 表述,接受单复合一 |
| 多处隐式拼接难发现(`'错误: ' + ...`) | 把"错误: " 也并入 key,如 `common.error.invalid_zip` 已含前缀 |
| 后续新增工具忘记走 i18n | i18n 自检会因为 fallback `console.warn` 提示开发者 |
| 第三方库错误信息(JSZip)是英文 | 不翻译;`catch (err)` 时把 `err.message` 直接拼到模板里(已支持) |

## §13 未来扩展(明确不在范围,但留口)

- 增加 ja-JP / 其他语言:`SUPPORTED_LANGS` 加 + `messages[code]` 加 + `pickLangFromTag()` 主语言段分支加。
- README / spec 英化。
- ICU 复数规则(若英文体验明显劣化再做)。
- 保留 sources 跨切换:把 sources 提到 main.js 持有,作为 session-state 注入到 `mount(container, sessionState)`(需要修改 mount 签名)。
- "重置为浏览器语言"操作:清掉 localStorage 让检测重新生效(目前只能 F12 操作)。
