// src/common.js
// 共享纯函数 + UI helpers + window.runTests 入口。
// 不依赖 ES Modules 之外的全局,JSZip 在调用 readZipFile 时通过 window.JSZip 读取。

// =========================================================
// 路径与文件名
// =========================================================

export function normalizePath(p) {
  if (!p) return '';
  let s = p.replace(/\\/g, '/').trim();
  if (s === '/') return '';
  s = s.replace(/^\/+/, '').replace(/\/+$/, '');
  return s === '' ? '' : s + '/';
}

export function isImageFile(name) {
  const lower = name.toLowerCase();
  return lower.endsWith('.png') || lower.endsWith('.gif');
}

export function basenameNoExt(filename) {
  return filename.replace(/\.[^./]+$/, '');
}

// =========================================================
// HTML escape
// =========================================================

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// =========================================================
// boot.json 构造
// =========================================================

export function buildBootJson(name, version, imgList, additionList) {
  return {
    name: name,
    version: version,
    styleFileList: [],
    scriptFileList: [],
    tweeFileList: [],
    additionFile: additionList,
    imgFileList: imgList,
    addonPlugin: [{
      modName: 'ModLoader DoL ImageLoaderHook',
      addonName: 'ImageLoaderAddon',
      modVersion: '^2.3.0',
      params: []
    }],
    dependenceInfo: [{
      modName: 'ModLoader DoL ImageLoaderHook',
      version: '^2.3.0'
    }]
  };
}

// =========================================================
// ZIP 操作(依赖 window.JSZip)
// =========================================================

export async function readZipFile(file) {
  if (typeof window === 'undefined' || typeof window.JSZip === 'undefined') {
    throw new Error('JSZip 未加载');
  }
  return await window.JSZip.loadAsync(file);
}

export async function readBootJson(zip) {
  const entry = zip.file('boot.json');
  if (!entry) return null;
  const text = await entry.async('text');
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('[readBootJson] boot.json parse failed:', err.message);
    return null;
  }
}

export function collectEntries(zip, normalizedPath) {
  const entries = [];
  zip.forEach(function (relPath, entry) {
    if (entry.dir) return;
    const name = relPath.replace(/\\/g, '/');
    if (normalizedPath === '' || name.startsWith(normalizedPath)) {
      const rel = name.slice(normalizedPath.length);
      if (rel.length > 0) {
        entries.push({ entry: entry, rel: rel });
      }
    }
  });
  return entries;
}

export function collectFolderInfo(zip, normalizedPath) {
  const topFolders = new Set();
  let fileCount = 0;
  zip.forEach(function (relPath, entry) {
    if (entry.dir) return;
    const name = relPath.replace(/\\/g, '/');
    if (normalizedPath === '' || name.startsWith(normalizedPath)) {
      const rel = name.slice(normalizedPath.length);
      if (rel.length > 0) {
        fileCount++;
        const firstSlash = rel.indexOf('/');
        if (firstSlash === -1) return; // 根级文件不算目录
        const topName = rel.slice(0, firstSlash);
        if (topName) {
          topFolders.add(topName);
        }
      }
    }
  });
  const folders = Array.from(topFolders);
  folders.sort();
  return {
    fileCount,
    folderCount: folders.length,
    folders,
  };
}

// =========================================================
// UI helpers
// =========================================================

export function setStatus(el, kind, text) {
  if (!el) return;
  el.textContent = text;
  el.className = (kind === 'done') ? 'ok'
              : (kind === 'error') ? 'err' : '';
}

export function triggerDownload(anchorEl, blob, filename) {
  if (anchorEl.href && anchorEl.href.startsWith('blob:')) {
    URL.revokeObjectURL(anchorEl.href);
  }
  const url = URL.createObjectURL(blob);
  anchorEl.href = url;
  anchorEl.download = filename;
  anchorEl.textContent = '下载 ' + filename;
  anchorEl.hidden = false;
  return url;
}

// =========================================================
// 测试注册表 + window.runTests
// =========================================================

const _tests = [];

export function registerTests(name, fn) {
  _tests.push({ name, fn });
}

if (typeof window !== 'undefined') {
  window.runTests = function() {
    const results = [];
    let pass = 0, fail = 0;
    const T = (msg, cond) => {
      if (cond) { pass++; results.push('PASS: ' + msg); }
      else      { fail++; results.push('FAIL: ' + msg); }
    };

    // ---- common 自身纯函数 ----

    T("normalizePath('') === ''",        normalizePath('') === '');
    T("normalizePath('/') === ''",       normalizePath('/') === '');
    T("normalizePath('a/b') === 'a/b/'", normalizePath('a/b') === 'a/b/');
    T("normalizePath('/a/b/') === 'a/b/'", normalizePath('/a/b/') === 'a/b/');
    T("normalizePath('a\\b') === 'a/b/'", normalizePath('a\\b') === 'a/b/');

    T("isImageFile('a.png') === true",   isImageFile('a.png') === true);
    T("isImageFile('a.GIF') === true",   isImageFile('a.GIF') === true);
    T("isImageFile('a.txt') === false",  isImageFile('a.txt') === false);
    T("isImageFile('no_ext') === false", isImageFile('no_ext') === false);

    T("basenameNoExt('foo.zip') === 'foo'",      basenameNoExt('foo.zip') === 'foo');
    T("basenameNoExt('a.b.zip') === 'a.b'",      basenameNoExt('a.b.zip') === 'a.b');
    T("basenameNoExt('noext') === 'noext'",      basenameNoExt('noext') === 'noext');

    const boot = buildBootJson('demo', '1.0.0', ['img/a.png'], ['img/b.txt']);
    T("boot.name === 'demo'",            boot.name === 'demo');
    T("boot.version === '1.0.0'",        boot.version === '1.0.0');
    T("boot.imgFileList.length === 1",   boot.imgFileList.length === 1);
    T("boot.additionFile.length === 1",  boot.additionFile.length === 1);
    T("boot.addonPlugin[0].addonName === 'ImageLoaderAddon'",
      boot.addonPlugin[0].addonName === 'ImageLoaderAddon');
    T("boot.dependenceInfo[0].version === '^2.3.0'",
      boot.dependenceInfo[0].version === '^2.3.0');
    T("boot.styleFileList is empty array",
      Array.isArray(boot.styleFileList) && boot.styleFileList.length === 0);

    T("escapeHtml('<\">') === '&lt;&quot;&gt;'", escapeHtml('<">') === '&lt;&quot;&gt;');
    T("readZipFile is async function", typeof readZipFile === 'function');
    T("collectEntries is function", typeof collectEntries === 'function');
    T("setStatus is function", typeof setStatus === 'function');
    T("triggerDownload is function", typeof triggerDownload === 'function');

    // ---- 工具注册的测试 ----

    for (const { name, fn } of _tests) {
      try {
        const sub = fn();
        if (sub && typeof sub === 'object') {
          if (typeof sub.pass === 'number') pass += sub.pass;
          if (typeof sub.fail === 'number') fail += sub.fail;
          if (Array.isArray(sub.results)) results.push(...sub.results.map(r => `[${name}] ${r}`));
        }
      } catch (err) {
        fail++;
        results.push(`FAIL: [${name}] threw ${err && err.message}`);
      }
    }

    console.log(results.join('\n'));
    console.log('---\n通过 ' + pass + ', 失败 ' + fail);
    return { pass, fail, results };
  };
}
