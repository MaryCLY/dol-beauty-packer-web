// src/overwrite.js
// 工具 2:覆盖原版图包。提供 mount/unmount 生命周期。

import {
  normalizePath,
  basenameNoExt,
  readZipFile,
  readBootJson,
  collectEntries,
  collectFolderInfo,
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
    <p class="intro">${escapeHtml(t('overwrite.intro'))}</p>

    <input type="file" id="base-file" accept=".zip" hidden>
    <input type="file" id="overlay-file" accept=".zip" multiple hidden>

    <div id="base-info">${escapeHtml(t('overwrite.base.empty'))}</div>
    <button id="add-base">${escapeHtml(t('overwrite.button.addBase'))}</button>

    <div style="margin: 0.6em 0; font-weight: bold;">${escapeHtml(t('overwrite.label.sourcesList'))}</div>
    <div id="sources-list"></div>

    <button id="add-zip">${escapeHtml(t('overwrite.button.addZip'))}</button>

    <label>
      <span>${escapeHtml(t('overwrite.label.modName'))}</span>
      <input type="text" id="name" placeholder="${escapeHtml(t('overwrite.placeholder.modName'))}">
    </label>

    <label>
      <span>${escapeHtml(t('overwrite.label.version'))}</span>
      <input type="text" id="version" value="1.0.0">
    </label>

    <button id="pack" disabled>${escapeHtml(t('overwrite.button.pack'))}</button>

    <div id="status">${escapeHtml(t('overwrite.status.idleBase'))}</div>

    <div id="conflicts" hidden></div>

    <a id="download" hidden></a>
  `;
}

// =========================================================
// Public lifecycle
// =========================================================

export function mount(container) {
  container.innerHTML = renderTemplate();

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
      setStatus(els.status, 'idle', t('overwrite.status.idleBase'));
    } else if (state.sources.length === 0) {
      setStatus(els.status, 'idle', t('overwrite.status.idleSources'));
    } else {
      setStatus(els.status, 'loaded', t('overwrite.status.ready'));
    }
  }

  function renderBaseInfo() {
    if (!state.baseZip) {
      els.baseInfo.textContent = t('overwrite.base.empty');
      return;
    }
    const unknown = t('overwrite.base.unknown');
    const bootName = state.baseBoot ? state.baseBoot.name : unknown;
    const bootVersion = state.baseBoot ? state.baseBoot.version : unknown;
    const imgCount = state.baseMap ? state.baseMap.size : 0;
    els.baseInfo.innerHTML = t('overwrite.base.summary', {
      name: escapeHtml(state.baseName),
      modName: escapeHtml(bootName),
      version: escapeHtml(bootVersion),
      imgCount: imgCount,
    });
  }

  function getMatchInfo(zip, pathStr) {
    const normalized = normalizePath(pathStr);
    const entries = collectEntries(zip, normalized);
    const info = collectFolderInfo(zip, normalized);
    return { matchCount: entries.length, info };
  }

  function renderSourcesList() {
    if (state.sources.length === 0) {
      els.sourcesList.innerHTML =
        '<div style="color:#666;font-size:0.9em;">' +
        escapeHtml(t('overwrite.empty.sources')) +
        '</div>';
      updatePackButton();
      updateStatus();
      return;
    }
    let html = '';
    for (let i = 0; i < state.sources.length; i++) {
      const s = state.sources[i];
      const showUp = i > 0;
      const showDown = i < state.sources.length - 1;
      let folderTip = '';
      if (s.info && s.info.folderCount > 0) {
        const first = s.info.folders[0];
        const more = s.info.folderCount > 1 ? t('packer.summary.more') : '';
        folderTip = t('packer.summary.folderHint', {
          count: s.info.folderCount,
          first: escapeHtml(first),
          more: more,
        });
      }
      html += '<div class="source-row">' +
        '<div class="line1">' +
          '<span class="fname" title="' + escapeHtml(s.fileName) + '">' + escapeHtml(s.fileName) + '</span>' +
          '<span>' + escapeHtml(t('packer.label.imgPath')) + '</span>' +
          '<input type="text" value="' + escapeHtml(s.path) + '" data-idx="' + i + '" class="path-input">' +
        '</div>' +
        '<div class="line2">' +
          '<span class="count">' +
            t('packer.summary.matchCount', { count: s.matchCount }) +
            folderTip +
          '</span>' +
          (showUp   ? '<button data-idx="' + i + '" data-dir="up">'   + escapeHtml(t('packer.button.up'))   + '</button>' : '') +
          (showDown ? '<button data-idx="' + i + '" data-dir="down">' + escapeHtml(t('packer.button.down')) + '</button>' : '') +
          '<button data-idx="' + i + '" data-dir="del">' + escapeHtml(t('packer.button.del')) + '</button>' +
        '</div>' +
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

  function renderConflicts(conflicts) {
    if (conflicts.length === 0) {
      els.conflicts.hidden = true;
      els.conflicts.innerHTML = '';
      return;
    }
    let html = '<details>' +
      '<summary>' +
      escapeHtml(t('overwrite.conflicts.title', { count: conflicts.length })) +
      '</summary>' +
      '<ul style="font-size:0.9em;margin:0.4em 0;">';
    for (const c of conflicts) {
      html += '<li>img/' + escapeHtml(c.relPath) + ': ' +
        escapeHtml(c.originalSource) + ' → ' +
        escapeHtml(c.overwrittenBy) + '</li>';
    }
    html += '</ul></details>';
    els.conflicts.innerHTML = html;
    els.conflicts.hidden = false;
  }

  async function mergeAndPack(modName, modVersion) {
    if (typeof window.JSZip === 'undefined') {
      throw new Error(t('common.error.jszip_missing'));
    }
    if (!state.baseZip) {
      throw new Error(t('overwrite.error.needBase'));
    }
    if (state.sources.length === 0) {
      throw new Error(t('overwrite.error.needSources'));
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
        throw new Error(t('common.error.no_match', { name: source.fileName, path: source.path }));
      }
      for (const item of entries) {
        const rel = item.rel;
        const outPath = 'img/' + rel;
        if (finalImgPaths.has(outPath)) {
          conflicts.push({
            relPath: rel,
            originalSource: state.baseMap.has(rel)
              ? t('overwrite.conflicts.fromVanilla')
              : t('overwrite.conflicts.fromPrev'),
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
      setStatus(els.status, 'error', t('overwrite.error.notZip'));
      e.target.value = '';
      return;
    }

    setStatus(els.status, 'reading', t('overwrite.status.readingBase'));
    try {
      const zip = await readZipFile(file);
      const boot = await readBootJson(zip);
      if (!boot) {
        setStatus(els.status, 'error', t('overwrite.error.notMod'));
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
      if (boot.version) {
        els.version.value = boot.version;
      }

      renderBaseInfo();
      updatePackButton();
      updateStatus();
    } catch (err) {
      setStatus(els.status, 'error', err.message);
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
      setStatus(els.status, 'error', t('common.error.non_zip_skipped', { count: invalidCount }));
    }
    if (validFiles.length === 0) return;

    setStatus(els.status, 'reading', t('overwrite.status.readingSources', { count: validFiles.length }));

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
      } catch (err) {
        setStatus(els.status, 'error', t('common.error.invalid_zip', { name: file.name }));
      }
    }

    renderSourcesList();
    e.target.value = '';
  });

  // 打包
  els.pack.addEventListener('click', async () => {
    if (!state.baseZip) {
      setStatus(els.status, 'error', t('overwrite.error.needBase'));
      return;
    }
    if (state.sources.length === 0) {
      setStatus(els.status, 'error', t('overwrite.error.needSources'));
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

    setStatus(els.status, 'packing', t('overwrite.status.packing'));
    els.pack.disabled = true;
    els.download.hidden = true;
    els.conflicts.hidden = true;
    try {
      const result = await mergeAndPack(name, version);
      state.blobUrl = triggerDownload(els.download, result.blob, name + '.mod.zip');
      let statusText = t('overwrite.status.done', { count: result.totalFiles });
      if (result.conflicts.length > 0) {
        statusText += t('overwrite.status.done_conflicts', { count: result.conflicts.length });
        renderConflicts(result.conflicts);
      }
      setStatus(els.status, 'done', statusText);
    } catch (err) {
      setStatus(els.status, 'error', err.message);
    } finally {
      els.pack.disabled = false;
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
