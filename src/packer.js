// src/packer.js
// 工具 1:打包成 ModLoader 模组。提供 mount/unmount 生命周期。

import {
  normalizePath,
  isImageFile,
  basenameNoExt,
  readZipFile,
  collectEntries,
  collectFolderInfo,
  buildBootJson,
  escapeHtml,
  setStatus,
  triggerDownload,
  registerTests,
} from './common.js';

// =========================================================
// HTML 模板
// =========================================================

const HTML = `
  <p class="intro">把含 body/clothes 等子目录的 ZIP 压缩包打包成 DoL ModLoader 格式。列表中越靠下的 ZIP 优先级越高（后写覆盖前写）。</p>

  <input type="file" id="file" accept=".zip" multiple hidden>

  <label>
    <span>模组名称:</span>
    <input type="text" id="name" placeholder="(留空则取第一个 ZIP 文件名)">
  </label>

  <label>
    <span>版本号:</span>
    <input type="text" id="version" value="1.0.0">
  </label>

  <div style="margin: 0.6em 0; font-weight: bold;">来源列表:</div>
  <div id="sources-list"></div>

  <button id="add-zip">+ 添加 ZIP</button>

  <button id="pack" disabled>开始打包</button>

  <div id="status">请添加至少一个 ZIP 文件</div>

  <div id="conflicts" hidden></div>

  <a id="download" hidden>下载</a>
`;

// =========================================================
// Public lifecycle
// =========================================================

export function mount(container) {
  container.innerHTML = HTML;

  // 局部状态
  const state = {
    sources: [],
    blobUrl: null,
  };

  // DOM refs(局部于 container,避免与未来工具的同名 id 冲突)
  const $ = (sel) => container.querySelector(sel);
  const els = {
    file: $('#file'),
    name: $('#name'),
    version: $('#version'),
    sourcesList: $('#sources-list'),
    addZip: $('#add-zip'),
    pack: $('#pack'),
    status: $('#status'),
    conflicts: $('#conflicts'),
    download: $('#download'),
  };

  // 工具内部函数

  function getMatchInfo(zip, pathStr) {
    const normalized = normalizePath(pathStr);
    const entries = collectEntries(zip, normalized);
    const info = collectFolderInfo(zip, normalized);
    return { matchCount: entries.length, info };
  }

  function renderSourcesList() {
    if (state.sources.length === 0) {
      els.sourcesList.innerHTML = '<div style="color:#666;font-size:0.9em;">暂无 ZIP，请点击「+ 添加 ZIP」</div>';
      els.pack.disabled = true;
      setStatus(els.status, 'idle', '请添加至少一个 ZIP 文件');
      return;
    }
    let html = '';
    let totalFiles = 0;
    for (let i = 0; i < state.sources.length; i++) {
      const s = state.sources[i];
      totalFiles += s.matchCount;
      const showUp = i > 0;
      const showDown = i < state.sources.length - 1;
      let folderTip = '';
      if (s.info && s.info.folderCount > 0) {
        const first = s.info.folders.slice(0, 3).join(', ');
        const more = s.info.folderCount > 3 ? ' 等' : '';
        folderTip = ' (' + s.info.folderCount + ' 个目录: ' + first + more + ')';
      }
      html += '<div class="source-row">' +
        '<span class="fname" title="' + escapeHtml(s.fileName) + '">' + escapeHtml(s.fileName) + '</span>' +
        '<span>img路径:</span>' +
        '<input type="text" value="' + escapeHtml(s.path) + '" data-idx="' + i + '" class="path-input">' +
        '<span class="count">匹配 ' + s.matchCount + ' 个文件' + folderTip + '</span>' +
        (showUp ? '<button data-idx="' + i + '" data-dir="up">上移</button>' : '') +
        (showDown ? '<button data-idx="' + i + '" data-dir="down">下移</button>' : '') +
        '<button data-idx="' + i + '" data-dir="del">删除</button>' +
      '</div>';
    }
    els.sourcesList.innerHTML = html;
    els.pack.disabled = false;
    setStatus(els.status, 'loaded', '已添加 ' + state.sources.length + ' 个 ZIP, 共 ' + totalFiles + ' 个文件');

    // path 输入改变
    els.sourcesList.querySelectorAll('.path-input').forEach((input) => {
      input.addEventListener('change', function () {
        const idx = parseInt(this.dataset.idx, 10);
        state.sources[idx].path = this.value;
        const { matchCount, info } = getMatchInfo(state.sources[idx].zip, this.value);
        state.sources[idx].matchCount = matchCount;
        state.sources[idx].info = info;
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

  async function mergeAndPack(sources, modName, modVersion) {
    if (typeof window.JSZip === 'undefined') {
      throw new Error('JSZip 未加载');
    }
    const finalMap = new Map();
    const conflicts = [];

    for (const source of sources) {
      const normalized = normalizePath(source.path);
      const entries = collectEntries(source.zip, normalized);
      if (entries.length === 0) {
        throw new Error('"' + source.fileName + '" 路径 "' + source.path + '" 下无任何文件匹配');
      }
      for (const item of entries) {
        const rel = item.rel;
        if (finalMap.has(rel)) {
          const old = finalMap.get(rel);
          conflicts.push({
            relPath: rel,
            overwrittenBy: source.fileName,
            originalSource: old.source,
          });
        }
        const data = await item.entry.async('uint8array');
        finalMap.set(rel, { data, source: source.fileName });
      }
    }

    const out = new window.JSZip();
    const imgList = [];
    const additionList = [];
    for (const [rel, info] of finalMap) {
      const outPath = 'img/' + rel;
      out.file(outPath, info.data);
      if (isImageFile(rel)) {
        imgList.push(outPath);
      } else {
        additionList.push(outPath);
      }
    }
    const bootObj = buildBootJson(modName, modVersion, imgList, additionList);
    out.file('boot.json', JSON.stringify(bootObj, null, 2));
    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, totalFiles: finalMap.size, conflicts };
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

  // 事件绑定

  els.file.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const validFiles = files.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    const invalidCount = files.length - validFiles.length;
    if (invalidCount > 0) {
      setStatus(els.status, 'error', '错误: 有 ' + invalidCount + ' 个文件不是 .zip，已跳过');
    }
    if (validFiles.length === 0) return;

    setStatus(els.status, 'reading', '正在解析 ' + validFiles.length + ' 个压缩包...');
    let firstAdded = false;

    for (const file of validFiles) {
      try {
        const zip = await readZipFile(file);
        const { matchCount, info } = getMatchInfo(zip, '/');
        state.sources.push({
          fileName: file.name,
          zip,
          path: '/',
          matchCount,
          info,
        });
        if (!firstAdded) {
          firstAdded = true;
          if (!els.name.value.trim()) {
            els.name.value = basenameNoExt(file.name);
          }
        }
      } catch (err) {
        setStatus(els.status, 'error', '错误: 压缩包 ' + file.name + ' 损坏或不是有效的 ZIP');
      }
    }

    renderSourcesList();
    e.target.value = '';
  });

  els.addZip.addEventListener('click', () => {
    els.file.click();
  });

  els.pack.addEventListener('click', async () => {
    if (state.sources.length === 0) {
      setStatus(els.status, 'error', '错误: 请至少添加一个 ZIP 文件');
      return;
    }
    let name = els.name.value.trim();
    let version = els.version.value.trim();
    if (!name) {
      name = basenameNoExt(state.sources[0].fileName);
    }
    if (!version) {
      version = '1.0.0';
    }

    setStatus(els.status, 'packing', '正在合并与打包...');
    els.download.hidden = true;
    els.conflicts.hidden = true;
    try {
      const result = await mergeAndPack(state.sources, name, version);
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

  // 初始渲染(空态)
  renderSourcesList();
}

export function unmount(container) {
  // 在 container.innerHTML = '' 之前先抓 download 锚的 blob URL revoke
  const a = container.querySelector('#download');
  if (a && a.href && a.href.startsWith('blob:')) {
    URL.revokeObjectURL(a.href);
  }
  container.innerHTML = '';
}

// =========================================================
// 工具注册的自检
// =========================================================

registerTests('packer', () => {
  const results = [];
  let pass = 0, fail = 0;
  const T = (msg, cond) => {
    if (cond) { pass++; results.push('PASS: ' + msg); }
    else      { fail++; results.push('FAIL: ' + msg); }
  };

  T("mount is function", typeof mount === 'function');
  T("unmount is function", typeof unmount === 'function');

  // mount/unmount 烟雾测试:用一个临时 div
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    try {
      mount(tmp);
      T("mount renders #file input", !!tmp.querySelector('#file'));
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
