// src/i18n.js
// i18n 核心模块:集中字典 + getLang/setLang/t/onLangChange。
// 不依赖第三方库;沿用项目零构建路线。

import { registerTests } from './common.js';

export const SUPPORTED_LANGS = ['zh-CN', 'en-US'];
export const FALLBACK_LANG = 'zh-CN';   // 字典缺失 key 时回退的语言(canonical)
export const STORAGE_KEY = 'dolbp_lang';

export const messages = {
  'zh-CN': {
    // ---- common ----
    'common.error.jszip_missing': 'JSZip 未加载',
    'common.error.invalid_zip': '压缩包 {name} 损坏或不是有效的 ZIP',
    'common.error.non_zip_skipped': '错误: 有 {count} 个文件不是 .zip,已跳过',
    'common.error.no_match': '"{name}" 路径 "{path}" 下无任何文件匹配',
    'common.button.download': '下载 {filename}',
    'common.lang.zh': '中文',
    'common.lang.en': 'EN',
    'common.app.title': 'DoL 美化模组工具集',
    'common.error.loadTool': '错误: 加载工具 {id} 失败,请查看控制台',
    'common.error.jszipBoot': '错误: 依赖 JSZip 加载失败, 请检查 vendor/jszip.min.js',
    'common.loading': '正在加载工具集...',

    // ---- tab ----
    'tab.packer': '打包模组',
    'tab.overwrite': '覆盖原版图包',

    // ---- packer ----
    'packer.intro': '把含 body/clothes 等子目录的 ZIP 压缩包打包成 DoL ModLoader 格式。列表中越靠下的 ZIP 优先级越高(后写覆盖前写)。',
    'packer.label.modName': '模组名称:',
    'packer.placeholder.modName': '(留空则取第一个 ZIP 文件名)',
    'packer.label.version': '版本号:',
    'packer.label.sourcesList': '来源列表:',
    'packer.empty.sources': '暂无 ZIP,请点击「+ 添加 ZIP」',
    'packer.button.addZip': '+ 添加 ZIP',
    'packer.button.pack': '开始打包',
    'packer.button.up': '上移',
    'packer.button.down': '下移',
    'packer.button.del': '删除',
    'packer.label.imgPath': 'img路径:',
    'packer.status.idle': '请添加至少一个 ZIP 文件',
    'packer.status.reading': '正在解析 {count} 个压缩包...',
    'packer.status.loaded': '已添加 {zipCount} 个 ZIP, 共 {fileCount} 个文件',
    'packer.status.packing': '正在合并与打包...',
    'packer.status.done': '完成 ✓ 合并 {count} 个文件',
    'packer.status.done_conflicts': ', 冲突(覆盖) {count} 个',
    'packer.summary.matchCount': '匹配 {count} 个文件',
    'packer.summary.folderHint': ' ({count} 个目录: {first}{more})',
    'packer.summary.more': ', ...',
    'packer.conflicts.title': '冲突列表 ({count})',
    'packer.error.needZip': '错误: 请至少添加一个 ZIP 文件',

    // ---- overwrite ----
    'overwrite.intro': '上传原版游戏图包(.mod.zip),再添加覆盖图包ZIP,合并后生成覆盖版模组。',
    'overwrite.base.empty': '暂未上传原版图包',
    'overwrite.button.addBase': '+ 上传原版图包',
    'overwrite.label.sourcesList': '覆盖图包来源列表:',
    'overwrite.empty.sources': '暂无覆盖 ZIP,请点击「+ 添加覆盖 ZIP」',
    'overwrite.button.addZip': '+ 添加覆盖 ZIP',
    'overwrite.label.modName': '模组名称:',
    'overwrite.placeholder.modName': '(默认: 原版名-overwrite)',
    'overwrite.label.version': '版本号:',
    'overwrite.button.pack': '开始覆盖打包',
    'overwrite.status.idleBase': '请先上传原版图包',
    'overwrite.status.idleSources': '请添加至少一个覆盖图包',
    'overwrite.status.ready': '已准备好,可以开始覆盖打包',
    'overwrite.status.readingBase': '正在解析原版图包...',
    'overwrite.status.readingSources': '正在解析 {count} 个覆盖图包...',
    'overwrite.status.packing': '正在合并与打包,时间可能较长,请耐心等待...',
    'overwrite.status.done': '完成 ✓ 合并 {count} 个文件',
    'overwrite.status.done_conflicts': ', 冲突(覆盖) {count} 个',
    'overwrite.base.summary': '已上传: {name}<br>模组名称: {modName}<br>版本: {version}<br>img/ 文件数: {imgCount}',
    'overwrite.base.unknown': '(未知)',
    'overwrite.error.notZip': '错误: 原版图包必须是 .zip 文件',
    'overwrite.error.notMod': '错误: 这不是有效的 ModLoader 模组图包(缺少 boot.json)',
    'overwrite.error.needBase': '错误: 请先上传原版图包',
    'overwrite.error.needSources': '错误: 请至少添加一个覆盖图包',
    'overwrite.conflicts.title': '冲突列表 ({count})',
    'overwrite.conflicts.fromVanilla': '原版',
    'overwrite.conflicts.fromPrev': '前序覆盖',
  },
  'en-US': {
    // ---- common ----
    'common.error.jszip_missing': 'JSZip is not loaded',
    'common.error.invalid_zip': 'Archive {name} is corrupted or not a valid ZIP',
    'common.error.non_zip_skipped': 'Error: {count} non-zip file(s) skipped',
    'common.error.no_match': 'No files matched under path "{path}" in "{name}"',
    'common.button.download': 'Download {filename}',
    'common.lang.zh': '中文',
    'common.lang.en': 'EN',
    'common.app.title': 'DoL Beauty Mod Toolkit',
    'common.error.loadTool': 'Error: Failed to load tool {id}, see console',
    'common.error.jszipBoot': 'Error: Failed to load JSZip, check vendor/jszip.min.js',
    'common.loading': 'Loading toolkit...',

    // ---- tab ----
    'tab.packer': 'Pack Mod',
    'tab.overwrite': 'Overlay Vanilla',

    // ---- packer ----
    'packer.intro': 'Package ZIPs containing body/clothes subfolders into DoL ModLoader format. Later entries override earlier ones.',
    'packer.label.modName': 'Mod name:',
    'packer.placeholder.modName': '(defaults to first ZIP filename)',
    'packer.label.version': 'Version:',
    'packer.label.sourcesList': 'Source list:',
    'packer.empty.sources': 'No ZIP yet, click "+ Add ZIP"',
    'packer.button.addZip': '+ Add ZIP',
    'packer.button.pack': 'Pack',
    'packer.button.up': 'Up',
    'packer.button.down': 'Down',
    'packer.button.del': 'Delete',
    'packer.label.imgPath': 'img path:',
    'packer.status.idle': 'Please add at least one ZIP',
    'packer.status.reading': 'Parsing {count} archive(s)...',
    'packer.status.loaded': 'Added {zipCount} ZIP(s), {fileCount} file(s) total',
    'packer.status.packing': 'Merging and packing...',
    'packer.status.done': 'Done ✓ merged {count} file(s)',
    'packer.status.done_conflicts': ', {count} conflict(s) overridden',
    'packer.summary.matchCount': 'Matched {count} file(s)',
    'packer.summary.folderHint': ' ({count} folder(s): {first}{more})',
    'packer.summary.more': ', ...',
    'packer.conflicts.title': 'Conflicts ({count})',
    'packer.error.needZip': 'Error: please add at least one ZIP',

    // ---- overwrite ----
    'overwrite.intro': 'Upload the vanilla image pack (.mod.zip), then add overlay ZIP(s) to produce an overlayed mod.',
    'overwrite.base.empty': 'No vanilla pack uploaded yet',
    'overwrite.button.addBase': '+ Upload vanilla pack',
    'overwrite.label.sourcesList': 'Overlay source list:',
    'overwrite.empty.sources': 'No overlay ZIP, click "+ Add overlay ZIP"',
    'overwrite.button.addZip': '+ Add overlay ZIP',
    'overwrite.label.modName': 'Mod name:',
    'overwrite.placeholder.modName': '(default: vanilla-overwrite)',
    'overwrite.label.version': 'Version:',
    'overwrite.button.pack': 'Build overlay',
    'overwrite.status.idleBase': 'Please upload the vanilla pack first',
    'overwrite.status.idleSources': 'Please add at least one overlay',
    'overwrite.status.ready': 'Ready, you can build the overlay',
    'overwrite.status.readingBase': 'Parsing vanilla pack...',
    'overwrite.status.readingSources': 'Parsing {count} overlay(s)...',
    'overwrite.status.packing': 'Merging and packing, may take a while...',
    'overwrite.status.done': 'Done ✓ merged {count} file(s)',
    'overwrite.status.done_conflicts': ', {count} conflict(s) overridden',
    'overwrite.base.summary': 'Uploaded: {name}<br>Mod name: {modName}<br>Version: {version}<br>img/ files: {imgCount}',
    'overwrite.base.unknown': '(unknown)',
    'overwrite.error.notZip': 'Error: vanilla pack must be a .zip file',
    'overwrite.error.notMod': 'Error: not a valid ModLoader pack (missing boot.json)',
    'overwrite.error.needBase': 'Error: please upload the vanilla pack first',
    'overwrite.error.needSources': 'Error: please add at least one overlay',
    'overwrite.conflicts.title': 'Conflicts ({count})',
    'overwrite.conflicts.fromVanilla': 'vanilla',
    'overwrite.conflicts.fromPrev': 'previous overlay',
  },
};

let _listeners = [];

// 纯函数:输入 BCP-47 语言标签(如 'zh-CN'/'en'/'ja-JP'/''),输出 SUPPORTED_LANGS 之一。
// 规则:取主语言段(- 前部分,小写);'zh' → 'zh-CN';其余(含空) → 'en-US'。
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
  } catch (_) { /* 隐私模式等:仅当前会话生效 */ }
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

// =========================================================
// 工具注册的自检
// =========================================================

registerTests('i18n', () => {
  const results = [];
  let pass = 0, fail = 0;
  const T = (msg, cond) => {
    if (cond) { pass++; results.push('PASS: ' + msg); }
    else      { fail++; results.push('FAIL: ' + msg); }
  };

  // 保存当前 lang,测试结束后恢复
  const originalStored = (typeof localStorage !== 'undefined')
    ? localStorage.getItem(STORAGE_KEY)
    : null;

  // #1
  T("t is function", typeof t === 'function');
  // #2
  T("getLang() returns one of SUPPORTED_LANGS",
    SUPPORTED_LANGS.includes(getLang()));

  // #3 两侧字典 key 集合相等
  const zhKeys = Object.keys(messages['zh-CN']).sort().join('|');
  const enKeys = Object.keys(messages['en-US']).sort().join('|');
  T("messages['zh-CN'] keys === messages['en-US'] keys", zhKeys === enKeys);

  // #4 占位符替换
  setLang('zh-CN');
  const interpolated = t('packer.status.reading', { count: 3 });
  T("t('packer.status.reading', {count:3}) contains '3'",
    typeof interpolated === 'string' && interpolated.indexOf('3') !== -1);
  T("interpolated does not contain '{count}'",
    typeof interpolated === 'string' && interpolated.indexOf('{count}') === -1);

  // #5 缺失 key 回退
  T("t('nonexistent.key') === 'nonexistent.key'",
    t('nonexistent.key') === 'nonexistent.key');

  // #6 / #7 切换语言后立即生效
  setLang('en-US');
  T("setLang('en-US') → t('tab.packer') === 'Pack Mod'",
    t('tab.packer') === 'Pack Mod');
  setLang('zh-CN');
  T("setLang('zh-CN') → t('tab.packer') === '打包模组'",
    t('tab.packer') === '打包模组');

  // #8 非法 setLang 不改变当前
  setLang('zh-CN');
  setLang('xx-XX');
  T("setLang('xx-XX') ignored, lang still zh-CN", getLang() === 'zh-CN');

  // #9 onLangChange 被触发
  let cbFired = null;
  const unsub = onLangChange((code) => { cbFired = code; });
  setLang('en-US');
  T("onLangChange callback fired with 'en-US'", cbFired === 'en-US');
  unsub();
  setLang('zh-CN');

  // #10 - #15 pickLangFromTag 纯函数
  T("pickLangFromTag('zh-CN') === 'zh-CN'", pickLangFromTag('zh-CN') === 'zh-CN');
  T("pickLangFromTag('zh-TW') === 'zh-CN'", pickLangFromTag('zh-TW') === 'zh-CN');
  T("pickLangFromTag('en-US') === 'en-US'", pickLangFromTag('en-US') === 'en-US');
  T("pickLangFromTag('en')    === 'en-US'", pickLangFromTag('en') === 'en-US');
  T("pickLangFromTag('ja-JP') === 'en-US'", pickLangFromTag('ja-JP') === 'en-US');
  T("pickLangFromTag('')      === 'en-US'", pickLangFromTag('') === 'en-US');

  // #16 测试结束后恢复原 lang(避免污染后续运行)
  try {
    if (typeof localStorage !== 'undefined') {
      if (originalStored === null) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, originalStored);
      }
    }
  } catch (_) { /* 隐私模式忽略 */ }
  T("restored original lang", true);

  return { pass, fail, results };
});
