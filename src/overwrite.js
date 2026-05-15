// src/overwrite.js
// 工具 2:覆盖原版图包。提供 mount/unmount 生命周期。

import {
  normalizePath,
  basenameNoExt,
  readZipFile,
  readBootJson,
  collectEntries,
  escapeHtml,
  setStatus,
  triggerDownload,
  registerTests,
} from './common.js';

// =========================================================
// HTML 模板
// =========================================================

const HTML = `
  <p class="intro">上传原版游戏图包(.mod.zip)，再添加覆盖图包ZIP，合并后生成覆盖版模组。</p>

  <input type="file" id="base-file" accept=".zip" hidden>
  <input type="file" id="overlay-file" accept=".zip" multiple hidden>

  <div id="base-info">暂未上传原版图包</div>
  <button id="add-base">+ 上传原版图包</button>

  <div style="margin: 0.6em 0; font-weight: bold;">覆盖图包来源列表:</div>
  <div id="sources-list"></div>

  <button id="add-zip">+ 添加覆盖 ZIP</button>

  <label>
    <span>模组名称:</span>
    <input type="text" id="name" placeholder="(默认: 原版名-overwrite)">
  </label>

  <label>
    <span>版本号:</span>
    <input type="text" id="version" value="1.0.0">
  </label>

  <button id="pack" disabled>开始覆盖打包</button>

  <div id="status">请先上传原版图包</div>

  <div id="conflicts" hidden></div>

  <a id="download" hidden>下载</a>
`;

// =========================================================
// Public lifecycle
// =========================================================

export function mount(container) {
  container.innerHTML = HTML;

  const state = {
    baseZip: null,
    baseBoot: null,
    baseMap: null,
    extraEntries: null,
    baseName: '',
    sources: [],
    blobUrl: null,
  };

  const $ = (sel) => container.querySelector(sel);
  const els = {
    baseFile: $('#base-file'),
    overlayFile: $('#overlay-file'),
    baseInfo: $('#base-info'),
    addBase: $('#add-base'),
    sourcesList: $('#sources-list'),
    addZip: $('#add-zip'),
    pack: $('#pack'),
    name: $('#name'),
    version: $('#version'),
    status: $('#status'),
    conflicts: $('#conflicts'),
    download: $('#download'),
  };

  function updatePackButton() {
    els.pack.disabled = !state.baseZip || state.sources.length === 0;
  }

  function updateStatus() {
    if (!state.baseZip) {
      setStatus(els.status, 'idle', '请先上传原版图包');
    } else if (state.sources.length === 0) {
      setStatus(els.status, 'idle', '请添加至少一个覆盖图包');
    } else {
      setStatus(els.status, 'loaded', '已准备好，可以开始覆盖打包');
    }
  }

  function renderBaseInfo() {
    if (!state.baseZip) {
      els.baseInfo.textContent = '暂未上传原版图包';
      return;
    }
    const bootName = state.baseBoot ? state.baseBoot.name : '(未知)';
    const bootVersion = state.baseBoot ? state.baseBoot.version : '(未知)';
    const imgCount = state.baseMap ? state.baseMap.size : 0;
    els.baseInfo.innerHTML =
      '已上传: ' + escapeHtml(state.baseName) +
      '<br>模组名称: ' + escapeHtml(bootName) +
      '<br>版本: ' + escapeHtml(bootVersion) +
      '<br>img/ 文件数: ' + imgCount;
  }

  function countMatchEntries(zip, pathStr) {
    return collectEntries(zip, normalizePath(pathStr)).length;
  }

  function renderSourcesList() {
    if (state.sources.length === 0) {
      els.sourcesList.innerHTML = '<div style="color:#666;font-size:0.9em;">暂无覆盖 ZIP，请点击「+ 添加覆盖 ZIP」</div>';
      updatePackButton();
      updateStatus();
      return;
    }
    let html = '';
    let totalFiles = 0;
    for (let i = 0; i < state.sources.length; i++) {
      const s = state.sources[i];
      totalFiles += s.matchCount;
      const showUp = i > 0;
      const showDown = i < state.sources.length - 1;
      html += '<div class="source-row">' +
        '<span class="fname" title="' + escapeHtml(s.fileName) + '">' + escapeHtml(s.fileName) + '</span>' +
        '<span>img路径:</span>' +
        '<input type="text" value="' + escapeHtml(s.path) + '" data-idx="' + i + '" class="path-input">' +
        '<span class="count">匹配 ' + s.matchCount + ' 个文件</span>' +
        (showUp ? '<button data-idx="' + i + '" data-dir="up">上移</button>' : '') +
        (showDown ? '<button data-idx="' + i + '" data-dir="down">下移</button>' : '') +
        '<button data-idx="' + i + '" data-dir="del">删除</button>' +
      '</div>';
    }
    els.sourcesList.innerHTML = html;
    updatePackButton();
    updateStatus();

    // path 输入改变
    els.sourcesList.querySelectorAll('.path-input').forEach((input) => {
      input.addEventListener('change', function () {
        const idx = parseInt(this.dataset.idx, 10);
        state.sources[idx].path = this.value;
        state.sources[idx].matchCount = countMatchEntries(state.sources[idx].zip, this.value);
        renderSourcesList();
      });
    });

    // 上移/下移/删除
    els.sourcesList.querySelectorAll('button[data-dir]').forEach((btn) => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.dataset.idx, 10);
        const dir = this.dataset.dir;
        if (dir === 'up' && idx > 0) {
          const tmp = state.sources[idx];
          state.sources[idx] = state.sources[idx - 1];
          state.sources[idx - 1] = tmp;
        } else if (dir === 'down' && idx < state.sources.length - 1) {
          const tmp = state.sources[idx];
          state.sources[idx] = state.sources[idx + 1];
          state.sources[idx + 1] = tmp;
        } else if (dir === 'del') {
          state.sources.splice(idx, 1);
        }
        renderSourcesList();
      });
    });
  }

  function renderConflicts(conflicts) {
    if (conflicts.length === 0) {
      els.conflicts.hidden = true;
      els.conflicts.innerHTML = '';
      return;
    }
    let html = '<details>' +
      '<summary>冲突列表 (' + conflicts.length + ')</summary>' +
      '<ul style="font-size:0.9em;margin:0.4em 0;">';
    for (const c of conflicts) {
      html += '<li>img/' + escapeHtml(c.relPath) + ': ' + escapeHtml(c.originalSource) + ' → ' + escapeHtml(c.overwrittenBy) + '</li>';
    }
    html += '</ul></details>';
    els.conflicts.innerHTML = html;
    els.conflicts.hidden = false;
  }

  async function mergeAndPack(modName, modVersion) {
    if (typeof window.JSZip === 'undefined') {
      throw new Error('JSZip 未加载');
    }
    if (!state.baseZip) {
      throw new Error('请先上传原版图包');
    }
    if (state.sources.length === 0) {
      throw new Error('请至少添加一个覆盖图包');
    }

    const out = new window.JSZip();
    const conflicts = [];
    const finalImgPaths = new Set();

    // 写原版 img/ 文件
    for (const [rel, entry] of state.baseMap) {
      const data = await entry.async('uint8array');
      const outPath = 'img/' + rel;
      out.file(outPath, data);
      finalImgPaths.add(outPath);
    }

    // 写原版非 img/ 文件（dist/、字体 CSS 等）
    for (const { path, entry } of state.extraEntries) {
      const data = await entry.async('uint8array');
      out.file(path, data);
    }

    // 处理覆盖图包
    for (const source of state.sources) {
      const normalized = normalizePath(source.path);
      const entries = collectEntries(source.zip, normalized);
      if (entries.length === 0) {
        throw new Error('"' + source.fileName + '" 路径 "' + source.path + '" 下无任何文件匹配');
      }
      for (const item of entries) {
        const rel = item.rel;
        const outPath = 'img/' + rel;
        if (finalImgPaths.has(outPath)) {
          conflicts.push({
            relPath: rel,
            originalSource: state.baseMap.has(rel) ? '原版' : '前序覆盖',
            overwrittenBy: source.fileName,
          });
        }
        const data = await item.entry.async('uint8array');
        out.file(outPath, data);
        finalImgPaths.add(outPath);
      }
    }

    // boot.json：深拷贝 + 增量更新 imgFileList
    const bootCopy = JSON.parse(JSON.stringify(state.baseBoot));
    bootCopy.name = modName;
    bootCopy.version = modVersion;

    if (!Array.isArray(bootCopy.imgFileList)) {
      bootCopy.imgFileList = [];
    }
    const existingSet = new Set(bootCopy.imgFileList);
    for (const path of finalImgPaths) {
      if (!existingSet.has(path)) {
        bootCopy.imgFileList.push(path);
      }
    }

    out.file('boot.json', JSON.stringify(bootCopy, null, 2));

    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, totalFiles: finalImgPaths.size + state.extraEntries.length, conflicts };
  }

  // 原版图包上传
  els.baseFile.addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setStatus(els.status, 'error', '错误: 原版图包必须是 .zip 文件');
      e.target.value = '';
      return;
    }

    setStatus(els.status, 'reading', '正在解析原版图包...');
    try {
      const zip = await readZipFile(file);
      const boot = await readBootJson(zip);
      if (!boot) {
        setStatus(els.status, 'error', '错误: 这不是有效的 ModLoader 模组图包（缺少 boot.json）');
        e.target.value = '';
        return;
      }

      const baseMap = new Map();
      const extraEntries = [];
      let imgCount = 0;

      zip.forEach((relPath, entry) => {
        if (entry.dir) return;
        const name = relPath.replace(/\\/g, '/');
        if (name.startsWith('img/')) {
          const rel = name.slice(4);
          baseMap.set(rel, entry);
          imgCount++;
        } else if (name !== 'boot.json') {
          extraEntries.push({ path: name, entry });
        }
      });

      state.baseZip = zip;
      state.baseBoot = boot;
      state.baseMap = baseMap;
      state.extraEntries = extraEntries;
      state.baseName = file.name;

      if (!els.name.value.trim()) {
        els.name.value = (boot.name || basenameNoExt(file.name)) + '-overwrite';
      }
      if (!els.version.value.trim()) {
        els.version.value = boot.version || '1.0.0';
      }

      renderBaseInfo();
      updatePackButton();
      updateStatus();
    } catch (err) {
      setStatus(els.status, 'error', '错误: ' + err.message);
    }
    e.target.value = '';
  });

  els.addBase.addEventListener('click', () => {
    els.baseFile.click();
  });

  // 覆盖图包上传
  els.addZip.addEventListener('click', () => {
    els.overlayFile.click();
  });

  els.overlayFile.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const validFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      setStatus(els.status, 'error', '错误: 有 ' + invalidCount + ' 个文件不是 .zip，已跳过');
    }
    if (validFiles.length === 0) return;

    setStatus(els.status, 'reading', '正在解析 ' + validFiles.length + ' 个覆盖图包...');

    for (const file of validFiles) {
      try {
        const zip = await readZipFile(file);
        const matchCount = countMatchEntries(zip, '/');
        state.sources.push({
          fileName: file.name,
          zip,
          path: '/',
          matchCount,
        });
      } catch (err) {
        setStatus(els.status, 'error', '错误: 压缩包 ' + file.name + ' 损坏或不是有效的 ZIP');
      }
    }

    renderSourcesList();
    e.target.value = '';
  });

  // 打包
  els.pack.addEventListener('click', async () => {
    if (!state.baseZip) {
      setStatus(els.status, 'error', '错误: 请先上传原版图包');
      return;
    }
    if (state.sources.length === 0) {
      setStatus(els.status, 'error', '错误: 请至少添加一个覆盖图包');
      return;
    }
    let name = els.name.value.trim();
    let version = els.version.value.trim();
    if (!name) {
      name = (state.baseBoot.name || basenameNoExt(state.baseName)) + '-overwrite';
    }
    if (!version) {
      version = state.baseBoot.version || '1.0.0';
    }

    setStatus(els.status, 'packing', '正在合并与打包...');
    els.download.hidden = true;
    els.conflicts.hidden = true;
    try {
      const result = await mergeAndPack(name, version);
      state.blobUrl = triggerDownload(els.download, result.blob, name + '.mod.zip');
      let statusText = '完成 ✓ 合并 ' + result.totalFiles + ' 个文件';
      if (result.conflicts.length > 0) {
        statusText += ', 冲突(覆盖) ' + result.conflicts.length + ' 个';
        renderConflicts(result.conflicts);
      }
      setStatus(els.status, 'done', statusText);
    } catch (err) {
      setStatus(els.status, 'error', '错误: ' + err.message);
    }
  });

  // 初始渲染
  renderBaseInfo();
  renderSourcesList();
}

export function unmount(container) {
  const a = container.querySelector('#download');
  if (a && a.href && a.href.startsWith('blob:')) {
    URL.revokeObjectURL(a.href);
  }
  container.innerHTML = '';
}

// =========================================================
// 工具注册的自检
// =========================================================

registerTests('overwrite', () => {
  const results = [];
  let pass = 0, fail = 0;
  const T = (msg, cond) => {
    if (cond) { pass++; results.push('PASS: ' + msg); }
    else      { fail++; results.push('FAIL: ' + msg); }
  };

  T("mount is function", typeof mount === 'function');
  T("unmount is function", typeof unmount === 'function');

  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    try {
      mount(tmp);
      T("mount renders #base-file input", !!tmp.querySelector('#base-file'));
      T("mount renders #overlay-file input", !!tmp.querySelector('#overlay-file'));
      T("mount renders #pack button", !!tmp.querySelector('#pack'));
      T("mount renders #sources-list", !!tmp.querySelector('#sources-list'));
      unmount(tmp);
      T("unmount clears container", tmp.innerHTML === '');
    } catch (err) {
      fail++;
      results.push('FAIL: mount/unmount threw ' + (err && err.message));
    }
  }

  return { pass, fail, results };
});
