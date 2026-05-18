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
import { t } from './i18n.js';

// =========================================================
// HTML 模板
// =========================================================

function renderTemplate() {
  return `
    <p class="intro">${escapeHtml(t('packer.intro'))}</p>

    <input type="file" id="file" accept=".zip" multiple hidden>

    <label>
      <span>${escapeHtml(t('packer.label.modName'))}</span>
      <input type="text" id="name" placeholder="${escapeHtml(t('packer.placeholder.modName'))}">
    </label>

    <label>
      <span>${escapeHtml(t('packer.label.version'))}</span>
      <input type="text" id="version" value="1.0.0">
    </label>

    <div style="margin: 0.6em 0; font-weight: bold;">${escapeHtml(t('packer.label.sourcesList'))}</div>
    <div id="sources-list"></div>

    <button id="add-zip">${escapeHtml(t('packer.button.addZip'))}</button>

    <button id="pack" disabled>${escapeHtml(t('packer.button.pack'))}</button>

    <div id="status">${escapeHtml(t('packer.status.idle'))}</div>

    <div id="conflicts" hidden></div>

    <a id="download" hidden></a>
  `;
}

// =========================================================
// Public lifecycle
// =========================================================

export function mount(container) {
  container.innerHTML = renderTemplate();

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
      els.sourcesList.innerHTML = '<div style="color:#666;font-size:0.9em;">' + escapeHtml(t('packer.empty.sources')) + '</div>';
      els.pack.disabled = true;
      setStatus(els.status, 'idle', t('packer.status.idle'));
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
        const first = s.info.folders[0];
        const more = s.info.folderCount > 1 ? t('packer.summary.more') : '';
        folderTip = t('packer.summary.folderHint', {
          count: s.info.folderCount,
          first: first,
          more: more,
        });
      }
      const matchText = t('packer.summary.matchCount', { count: s.matchCount }) + folderTip;
      html += '<div class="source-row">' +
        '<div class="line1">' +
          '<span class="fname" title="' + escapeHtml(s.fileName) + '">' + escapeHtml(s.fileName) + '</span>' +
          '<span>' + escapeHtml(t('packer.label.imgPath')) + '</span>' +
          '<input type="text" value="' + escapeHtml(s.path) + '" data-idx="' + i + '" class="path-input">' +
        '</div>' +
        '<div class="line2">' +
          '<span class="count">' + escapeHtml(matchText) + '</span>' +
          (showUp ? '<button data-idx="' + i + '" data-dir="up">' + escapeHtml(t('packer.button.up')) + '</button>' : '') +
          (showDown ? '<button data-idx="' + i + '" data-dir="down">' + escapeHtml(t('packer.button.down')) + '</button>' : '') +
          '<button data-idx="' + i + '" data-dir="del">' + escapeHtml(t('packer.button.del')) + '</button>' +
        '</div>' +
      '</div>';
    }
    els.sourcesList.innerHTML = html;
    els.pack.disabled = false;
    setStatus(els.status, 'loaded', t('packer.status.loaded', {
      zipCount: state.sources.length,
      fileCount: totalFiles,
    }));

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
      throw new Error(t('common.error.jszip_missing'));
    }
    const finalMap = new Map();
    const conflicts = [];

    for (const source of sources) {
      const normalized = normalizePath(source.path);
      const entries = collectEntries(source.zip, normalized);
      if (entries.length === 0) {
        throw new Error(t('common.error.no_match', { name: source.fileName, path: source.path }));
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
      '<summary>' + escapeHtml(t('packer.conflicts.title', { count: conflicts.length })) + '</summary>' +
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
      setStatus(els.status, 'error', t('common.error.non_zip_skipped', { count: invalidCount }));
    }
    if (validFiles.length === 0) return;

    setStatus(els.status, 'reading', t('packer.status.reading', { count: validFiles.length }));
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
        setStatus(els.status, 'error', t('common.error.invalid_zip', { name: file.name }));
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
      setStatus(els.status, 'error', t('packer.error.needZip'));
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

    setStatus(els.status, 'packing', t('packer.status.packing'));
    els.pack.disabled = true;
    els.download.hidden = true;
    els.conflicts.hidden = true;
    try {
      const result = await mergeAndPack(state.sources, name, version);
      state.blobUrl = triggerDownload(els.download, result.blob, name + '.mod.zip');
      let statusText = t('packer.status.done', { count: result.totalFiles });
      if (result.conflicts.length > 0) {
        statusText += t('packer.status.done_conflicts', { count: result.conflicts.length });
        renderConflicts(result.conflicts);
      }
      setStatus(els.status, 'done', statusText);
    } catch (err) {
      setStatus(els.status, 'error', err.message);
    } finally {
      els.pack.disabled = false;
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
