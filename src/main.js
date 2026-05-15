// src/main.js
// 入口:JSZip 自检 + tab nav 渲染 + hash 路由 + 工具挂载/卸载切换。

import * as packer from './packer.js';
import * as overwrite from './overwrite.js';

const TOOLS = {
  packer:    { label: '打包模组',       module: packer },
  overwrite: { label: '覆盖原版图包',   module: overwrite },
};
const DEFAULT_TOOL = 'packer';

let currentToolId = null;
let containerEl = null;
let navEl = null;

function parseHash() {
  const m = (location.hash || '').match(/^#\/([a-z][a-z0-9-]*)$/i);
  if (!m) return null;
  return m[1];
}

function renderNav() {
  navEl.innerHTML = '';
  for (const id of Object.keys(TOOLS)) {
    const btn = document.createElement('button');
    btn.textContent = TOOLS[id].label;
    btn.dataset.tool = id;
    btn.addEventListener('click', () => {
      location.hash = '#/' + id;
    });
    navEl.appendChild(btn);
  }
}

function updateNavActive() {
  const btns = navEl.querySelectorAll('button[data-tool]');
  btns.forEach((b) => {
    if (b.dataset.tool === currentToolId) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function router() {
  let toolId = parseHash();
  if (!toolId || !TOOLS[toolId]) {
    // 未知 hash → 修正到默认 tab
    history.replaceState(null, '', '#/' + DEFAULT_TOOL);
    toolId = DEFAULT_TOOL;
  }
  if (toolId === currentToolId) return;

  // 卸载旧
  if (currentToolId && TOOLS[currentToolId]) {
    try {
      TOOLS[currentToolId].module.unmount(containerEl);
    } catch (err) {
      console.error('[main] unmount failed for', currentToolId, err);
    }
  }

  // 挂载新
  try {
    TOOLS[toolId].module.mount(containerEl);
  } catch (err) {
    console.error('[main] mount failed for', toolId, err);
    containerEl.innerHTML = '<div class="err">错误: 加载工具 ' + toolId + ' 失败,请查看控制台</div>';
  }
  currentToolId = toolId;
  updateNavActive();
}

function init() {
  containerEl = document.getElementById('tool-container');
  navEl = document.getElementById('tab-nav');
  if (!containerEl || !navEl) {
    console.error('[main] missing #tool-container or #tab-nav');
    return;
  }

  // JSZip 自检
  if (typeof window.JSZip === 'undefined') {
    containerEl.innerHTML = '<div class="err">错误: 依赖 JSZip 加载失败, 请检查 vendor/jszip.min.js</div>';
    // 仍然渲染 nav 还是不渲染?根据 spec §4.5 不渲染,避免无意义切换
    navEl.style.display = 'none';
    return;
  }

  renderNav();
  window.addEventListener('hashchange', router);
  router();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
