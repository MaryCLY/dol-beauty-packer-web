// src/main.js
// 入口:JSZip 自检 + tab nav 渲染 + hash 路由 + 工具挂载/卸载切换 + i18n 接入。

import * as packer from './packer.js';
import * as overwrite from './overwrite.js';
import { getLang, setLang, t, onLangChange, SUPPORTED_LANGS } from './i18n.js';

const TOOLS = {
  packer:    { labelKey: 'tab.packer',    module: packer },
  overwrite: { labelKey: 'tab.overwrite', module: overwrite },
};
const DEFAULT_TOOL = 'packer';

let currentToolId = null;
let containerEl = null;
let navEl = null;
let langSwitchEl = null;

function parseHash() {
  const m = (location.hash || '').match(/^#\/([a-z][a-z0-9-]*)$/i);
  if (!m) return null;
  return m[1];
}

function renderNav() {
  navEl.innerHTML = '';
  for (const id of Object.keys(TOOLS)) {
    const btn = document.createElement('button');
    btn.textContent = t(TOOLS[id].labelKey);
    btn.dataset.tool = id;
    btn.addEventListener('click', () => {
      location.hash = '#/' + id;
    });
    navEl.appendChild(btn);
  }
}

function renderLangSwitch() {
  if (!langSwitchEl) return;
  langSwitchEl.innerHTML = '';
  for (const code of SUPPORTED_LANGS) {
    const btn = document.createElement('button');
    btn.textContent = (code === 'zh-CN') ? t('common.lang.zh') : t('common.lang.en');
    btn.dataset.lang = code;
    if (code === getLang()) btn.classList.add('active');
    btn.addEventListener('click', () => setLang(code));
    langSwitchEl.appendChild(btn);
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
    containerEl.innerHTML = '<div class="err">' + t('common.error.loadTool', { id: toolId }) + '</div>';
  }
  currentToolId = toolId;
  updateNavActive();
}

function init() {
  containerEl = document.getElementById('tool-container');
  navEl = document.getElementById('tab-nav');
  langSwitchEl = document.getElementById('lang-switch');
  if (!containerEl || !navEl || !langSwitchEl) {
    console.error('[main] missing #tool-container, #tab-nav, or #lang-switch');
    return;
  }

  // 同步 <html lang>
  document.documentElement.lang = getLang();

  // JSZip 自检
  if (typeof window.JSZip === 'undefined') {
    containerEl.innerHTML = '<div class="err">' + t('common.error.jszipBoot') + '</div>';
    // 仍然渲染 nav 还是不渲染?根据 spec §4.5 不渲染,避免无意义切换
    navEl.style.display = 'none';
    langSwitchEl.style.display = 'none';
    return;
  }

  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = t('common.app.title');

  renderNav();
  renderLangSwitch();
  window.addEventListener('hashchange', router);
  router();

  // 监听语言切换:重 mount 当前工具 + 重渲染 nav 与 lang-switch + 同步 <html lang>。
  onLangChange((code) => {
    document.documentElement.lang = code;
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = t('common.app.title');
    if (currentToolId && TOOLS[currentToolId]) {
      try {
        TOOLS[currentToolId].module.unmount(containerEl);
        TOOLS[currentToolId].module.mount(containerEl);
      } catch (err) {
        console.error('[main] re-mount failed for', currentToolId, err);
      }
    }
    renderNav();
    renderLangSwitch();
    updateNavActive();
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
